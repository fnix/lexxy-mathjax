import {
  convertInto,
  findMathJax,
  measureContainerWidth,
  refreshDocumentStyles,
  resolveConverter
} from "./helpers/mathjax_helper.js"

const DEFAULT_SELECTOR = "[data-latex]"
const EDITOR_SELECTOR = "lexxy-editor, [contenteditable='true']"
const OUTPUT_ATTRIBUTE = "data-lexxy-math-output"

// Typesets every [data-latex] element under root (root itself included, so
// typesetMath(element) works as well as typesetMath(document)). This is the
// display-page counterpart to MathNode#createDOM: it turns saved
// `<span data-latex="...">`/`<div data-latex="...">` markup back into
// rendered math, for pages that have no editor at all.
//
// Never rejects: a single bad equation is reported in the result, not thrown.
export async function typesetMath(root = document, {
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

    for (const { element, latex, display, containerWidth } of pending) {
      applyPresentation(element, display, accessible, latex)

      const succeeded = await convertInto(converter, element, latex, { display, containerWidth })
      element.setAttribute(OUTPUT_ATTRIBUTE, succeeded ? converter.name : "error")

      if (succeeded) result.typeset++
      else result.failed++
    }

    if (result.typeset > 0) refreshDocumentStyles(mathjax)
  } catch {
    // typesetMath never rejects: any surprise here is reported via the
    // per-element failed/typeset counts already recorded above.
  }

  return result
}

function collectElements(root, selector) {
  const own = root.matches?.(selector) ? [ root ] : []
  return own.concat([ ...root.querySelectorAll(selector) ])
}

function shouldSkip(element, converter, force) {
  if (element.closest(EDITOR_SELECTOR)) return true
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
