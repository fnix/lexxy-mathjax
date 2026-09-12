const MATHJAX_WAIT_ATTEMPTS = 40
const MATHJAX_WAIT_INTERVAL = 250

const CONVERTERS = {
  chtml: "tex2chtmlPromise",
  svg: "tex2svgPromise"
}

let warnedAboutMissingMathJax = false
let warnedAboutMissingConverter = false
let renderQueue = Promise.resolve()
let mathjaxPromise = null

// Resolves with window.MathJax once its startup has finished, or null if
// MathJax never shows up (the host page is responsible for loading it).
// The poll is memoized so concurrent callers share one wait instead of each
// burning the full ~10s timeout on its own.
export function findMathJax() {
  if (!mathjaxPromise) {
    mathjaxPromise = pollForMathJax().then((mathjax) => {
      if (!mathjax) mathjaxPromise = null // let a later call retry if MathJax arrives late
      return mathjax
    })
  }

  return mathjaxPromise
}

async function pollForMathJax() {
  for (let attempt = 0; attempt < MATHJAX_WAIT_ATTEMPTS; attempt++) {
    if (window.MathJax?.startup?.promise) {
      await window.MathJax.startup.promise
      return window.MathJax
    }
    await sleep(MATHJAX_WAIT_INTERVAL)
  }

  if (!warnedAboutMissingMathJax) {
    warnedAboutMissingMathJax = true
    console.warn("@fnix/lexxy-mathjax: window.MathJax not found. Equations will show raw LaTeX. " +
      "Load MathJax v4 (tex-chtml) on pages that use the editor.")
  }

  return null
}

// Runs task once every previously enqueued task has settled, without ever
// leaving the shared queue itself rejected. Returns a promise for THIS task
// specifically (not the shared chain), so a caller can observe its own
// outcome instead of waiting on unrelated work queued after it.
export function enqueue(task) {
  const result = renderQueue.then(task)
  renderQueue = result.catch(() => {})
  return result
}

// Picks which TeX conversion method to use. Consults the document's live
// output jax first (so a renderer switched via MathJax's own contextual
// menu is respected), then falls back to whichever of chtml/svg is loaded.
// MathJax only creates a tex2*Promise method for jax it was actually asked
// to load, so a host that loaded tex-svg.js has no tex2chtmlPromise at all.
export function resolveConverter(mathjax, output = "auto") {
  const candidates = output === "auto"
    ? [ mathjax.startup?.document?.outputJax?.name?.toLowerCase(), "chtml", "svg" ]
    : [ output ]

  for (const name of candidates) {
    const method = CONVERTERS[name]
    if (method && typeof mathjax[method] === "function") {
      return { name, convert: (latex, options) => mathjax[method](latex, options) }
    }
  }

  if (!warnedAboutMissingConverter) {
    warnedAboutMissingConverter = true
    console.warn(`@fnix/lexxy-mathjax: no TeX conversion method found on window.MathJax for output "${output}".`)
  }

  return null
}

// clientWidth is 0 on a non-replaced inline element (e.g. a <span> before
// the package stylesheet has loaded), so fall back to the parent's width.
export function measureContainerWidth(element) {
  return element.clientWidth || element.parentElement?.clientWidth || 780
}

// Converts latex into element using converter, replacing its content. Falls
// back to showing the raw LaTeX with an error class when conversion fails.
// Returns whether conversion succeeded, so callers can decide whether a
// stylesheet refresh is worth doing.
export async function convertInto(converter, element, latex, { display = false, containerWidth } = {}) {
  try {
    const rendered = await converter.convert(latex, {
      display,
      em: 16,
      ex: 8,
      containerWidth: containerWidth ?? measureContainerWidth(element)
    })
    element.replaceChildren(rendered)
    element.classList.remove("lexxy-math--error")
    return true
  } catch (error) {
    element.textContent = latex
    element.classList.add("lexxy-math--error")
    element.title = `${error}`
    return false
  }
}

// Refreshes MathJax's global stylesheet so glyphs used by newly-converted
// equations render. reset(), not clear(): clear() also wipes MathJax's
// record of every expression the host page itself has typeset, which isn't
// ours to clear. This matters for SVG output too, not just CHTML: with the
// default global font cache, updateDocument() is what inserts the shared
// glyph cache into the page, and skipping it can leave SVG <use> references
// pointing at nothing.
export function refreshDocumentStyles(mathjax) {
  mathjax.startup.document.reset()
  mathjax.startup.document.updateDocument()
}

// Typesets LaTeX into the given element, replacing its content. Falls back to
// showing the raw LaTeX when MathJax is unavailable or the LaTeX is invalid.
// Calls are serialized because MathJax's own promise chaining only covers
// conversion, not our DOM insertion and stylesheet refresh below.
export function typesetInto(element, latex, { display = false } = {}) {
  element.textContent = latex

  return enqueue(async () => {
    const mathjax = await findMathJax()
    if (!mathjax) return

    const converter = resolveConverter(mathjax)
    if (!converter) return

    if (await convertInto(converter, element, latex, { display })) {
      refreshDocumentStyles(mathjax)
    }
  })
}

// Test-only: clears the module-level caches (memoized MathJax lookup, render
// queue, warning flags) between test cases. Not part of the public API and
// never re-exported from src/index.js.
export function __resetMathjaxHelperForTests() {
  warnedAboutMissingMathJax = false
  warnedAboutMissingConverter = false
  renderQueue = Promise.resolve()
  mathjaxPromise = null
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
