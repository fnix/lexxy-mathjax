import {
  convertInto,
  enqueue,
  findMathJax,
  measureContainerWidth,
  refreshDocumentStyles,
  resolveConverter
} from "./helpers/mathjax_helper.js"

// Matches only the saved format (see the "persisted format" README section),
// not MathJax's own output. MathJax 4's TeX input jax stamps `data-latex` on
// the MML it produces (TexConstants.Attr.LATEX), and CommonWrapper doesn't
// strip it, so it survives onto the rendered `mjx-*` elements too — a plain
// "[data-latex]" would match those and re-typeset them. MathJax 3 doesn't do
// this, but a tag-qualified selector costs nothing there either.
const DEFAULT_SELECTOR = "span[data-latex], div[data-latex]"
const EDITOR_SELECTOR = "lexxy-editor, [contenteditable='true']"
const MATHJAX_OUTPUT_SELECTOR = "mjx-container"
const OUTPUT_ATTRIBUTE = "data-lexxy-math-output"

// How many equations to convert before flushing styles and handing the
// thread back to the browser. A plain macrotask yield (setTimeout), not
// scheduler.yield(): scheduler.yield() continuations are documented to run
// ahead of other same-priority tasks, which could keep delaying the
// follow-up work a click needs (e.g. Turbo's fetch and render) until the
// whole pass finishes. ~1.7ms/equation on a real page, so this is ~40ms
// chunks — a starting point, not a tuned constant.
const YIELD_EVERY = 25

// Typesets every span/div[data-latex] element under root (root itself
// included, so typesetMath(element) works as well as typesetMath(document)).
// This is the display-page counterpart to MathNode#createDOM: it turns saved
// `<span data-latex="...">`/`<div data-latex="...">` markup back into
// rendered math, for pages that have no editor at all.
//
// Never rejects: a single bad equation is reported in the result, not thrown.
//
// Routed through the same queue as typesetInto(): MathJax's conversion
// pipeline isn't reentrant, and without this, concurrent passes (e.g. an
// immediate call racing DOMContentLoaded) each build their pending list
// before the others mark their elements typeset, converting the same
// equations more than once. The cost is that an editor render queued while a
// long display pass is running waits for the whole pass to finish; that's
// cheap in practice once a pass has already run once, because a repeat pass
// skips everything in a couple of milliseconds.
export async function typesetMath(root = document, options = {}) {
  return enqueue(() => typesetMathNow(root, options))
}

async function typesetMathNow(root, {
  output = "auto",
  selector = DEFAULT_SELECTOR,
  force = false,
  accessible = true
} = {}) {
  const elements = collectElements(root, selector)
  if (elements.length === 0) return { total: 0, typeset: 0, failed: 0, skipped: 0, mathjax: true }

  const mathjax = await findMathJax()
  if (!mathjax) return { total: elements.length, typeset: 0, failed: 0, skipped: 0, mathjax: false }

  const converter = resolveConverter(mathjax, output)
  if (!converter) return { total: elements.length, typeset: 0, failed: 0, skipped: 0, mathjax: true }

  const result = { total: elements.length, typeset: 0, failed: 0, skipped: 0, mathjax: true }

  try {
    const pending = []

    for (const element of elements) {
      if (shouldSkip(element, converter, force)) {
        result.skipped++
        continue
      }

      pending.push({
        element,
        latex: element.getAttribute("data-latex"),
        display: element.tagName === "DIV",
        containerWidth: measureContainerWidth(element)
      })
    }

    let sinceRefresh = 0

    for (const { element, latex, display, containerWidth } of pending) {
      applyPresentation(element, display, accessible, latex)

      const succeeded = await convertInto(converter, element, latex, { display, containerWidth })
      element.setAttribute(OUTPUT_ATTRIBUTE, succeeded ? converter.name : "error")

      if (succeeded) { result.typeset++; sinceRefresh++ }
      else result.failed++

      if (sinceRefresh >= YIELD_EVERY) {
        // Flush now, before yielding: this is what lets the browser paint
        // the equations converted so far mid-pass, instead of leaving them
        // unstyled until the whole pass ends.
        refreshDocumentStyles(mathjax)
        sinceRefresh = 0
        await yieldToBrowser()
      }
    }

    if (sinceRefresh > 0) refreshDocumentStyles(mathjax)
  } catch {
    // typesetMath never rejects: any surprise here is reported via the
    // per-element failed/typeset counts already recorded above.
  }

  return result
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function collectElements(root, selector) {
  const own = root.matches?.(selector) ? [ root ] : []
  return own.concat([ ...root.querySelectorAll(selector) ])
}

function shouldSkip(element, converter, force) {
  if (element.closest(EDITOR_SELECTOR)) return true
  // Never descend into MathJax's own output, even for an explicit selector
  // or force: true — there's nothing a host could want typeset in there.
  // parentElement (not element itself), so a selector that targets an
  // mjx-container directly is still honoured.
  if (element.parentElement?.closest(MATHJAX_OUTPUT_SELECTOR)) return true
  if (force) return false

  const rendered = element.getAttribute(OUTPUT_ATTRIBUTE)
  return rendered === converter.name || rendered === "error"
}

function applyPresentation(element, display, accessible, latex) {
  element.classList.add("lexxy-math")
  element.classList.toggle("lexxy-math--display", display)

  if (accessible) {
    element.setAttribute("role", "math")
    element.setAttribute("aria-label", `Equation: ${latex}`)
  }
}
