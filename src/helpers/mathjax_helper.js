const MATHJAX_WAIT_ATTEMPTS = 40
const MATHJAX_WAIT_INTERVAL = 250

let warnedAboutMissingMathJax = false
let renderQueue = Promise.resolve()

// Resolves with window.MathJax once its startup has finished, or null if
// MathJax never shows up (the host page is responsible for loading it).
export async function findMathJax() {
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

// Typesets LaTeX into the given element, replacing its content. Falls back to
// showing the raw LaTeX when MathJax is unavailable or the LaTeX is invalid.
// Calls are serialized because MathJax's own promise chaining only covers
// conversion, not our DOM insertion and stylesheet refresh below.
export function typesetInto(element, latex, { display = false } = {}) {
  element.textContent = latex

  renderQueue = renderQueue.then(async () => {
    const mathjax = await findMathJax()
    if (!mathjax) return

    try {
      const rendered = await mathjax.tex2chtmlPromise(latex, {
        display,
        em: 16,
        ex: 8,
        containerWidth: element.clientWidth || 780
      })
      element.replaceChildren(rendered)
      element.classList.remove("lexxy-math--error")

      // Refresh MathJax's global stylesheet so glyphs used by this equation render.
      // reset(), not clear(): clear() also wipes MathJax's record of every
      // expression the host page itself has typeset, which isn't ours to clear.
      mathjax.startup.document.reset()
      mathjax.startup.document.updateDocument()
    } catch (error) {
      element.textContent = latex
      element.classList.add("lexxy-math--error")
      element.title = `${error}`
    }
  })

  return renderQueue
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
