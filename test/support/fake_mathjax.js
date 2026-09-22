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

      // Mirrors MathJax 4's CHTML/SVG output shape: every MathML node wrapper
      // renders as an "mjx-" + kind custom element (ChtmlWrapper#toCHTML does
      // this.html('mjx-' + this.node.kind); SvgWrapper is analogous with
      // <g data-mml-node="...">), and the TeX input jax's data-latex
      // attribute gets copied onto both the outer node and inner ones like
      // mjx-mi. None of this is a <span>/<div>, which is what the narrowed
      // DEFAULT_SELECTOR in typeset_math.js relies on — this fake exists to
      // give regression tests for that something real to skip.
      const container = document.createElement("mjx-container")
      container.className = "MathJax"
      container.setAttribute("data-output", output)

      const math = document.createElement("mjx-math")
      math.setAttribute("data-latex", latex)

      const mi = document.createElement("mjx-mi")
      mi.setAttribute("data-latex", latex)
      mi.textContent = latex

      math.append(mi)
      container.append(math)
      return container
    }
  }

  window.MathJax = mathjax
  return handle
}
