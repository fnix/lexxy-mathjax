import { __resetMathjaxHelperForTests } from "../../src/helpers/mathjax_helper.js"

const CONVERTERS = {
  chtml: "tex2chtmlPromise",
  svg: "tex2svgPromise"
}

// Installs a fake window.MathJax exposing only the API surface src/ actually
// uses, and resets the helper's module-level caches (the memoized MathJax
// lookup, the render queue, the "already warned" flags) so each test starts
// clean regardless of what a previous test did.
//
// outputs: which tex2*Promise methods to install ("chtml", "svg", or both).
// failOn: latex strings that should reject, to exercise the error path.
// name: startup.document.outputJax.name, for auto-detection tests.
export function installFakeMathJax({ outputs = [ "chtml" ], failOn = [], name } = {}) {
  __resetMathjaxHelperForTests()

  const handle = { calls: [], resets: 0, updates: 0 }

  const mathjax = {
    startup: {
      promise: Promise.resolve(),
      document: {
        reset() { handle.resets++ },
        updateDocument() { handle.updates++ },
        outputJax: name ? { name } : undefined
      }
    }
  }

  for (const output of outputs) {
    const method = CONVERTERS[output]

    mathjax[method] = async (latex, options) => {
      handle.calls.push({ method: output, latex, options })

      if (failOn.includes(latex)) throw new Error(`invalid LaTeX: ${latex}`)

      const container = document.createElement("mjx-container")
      container.className = "MathJax"
      container.setAttribute("data-output", output)
      container.textContent = latex
      return container
    }
  }

  window.MathJax = mathjax
  return handle
}
