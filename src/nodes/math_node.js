import { Lexical } from "@37signals/lexxy"
import { typesetInto } from "../helpers/mathjax_helper.js"

const { DecoratorNode } = Lexical

export class MathNode extends DecoratorNode {
  static getType() {
    return "lexxy-math"
  }

  static clone(node) {
    return new MathNode(node.__latex, node.__display, node.__key)
  }

  static importJSON(serializedNode) {
    return $createMathNode(serializedNode.latex, serializedNode.display)
  }

  static importDOM() {
    return {
      span: (element) => $mathConversionFor(element, false),
      div: (element) => $mathConversionFor(element, true)
    }
  }

  constructor(latex = "", display = false, key) {
    super(key)
    this.__latex = latex
    this.__display = display
  }

  getLatex() {
    return this.__latex
  }

  setLatex(latex) {
    this.getWritable().__latex = latex
  }

  isDisplay() {
    return this.__display
  }

  setDisplay(display) {
    this.getWritable().__display = display
  }

  isInline() {
    return !this.__display
  }

  isKeyboardSelectable() {
    return true
  }

  getTextContent() {
    return this.__latex
  }

  createDOM() {
    const element = document.createElement(this.__display ? "div" : "span")
    element.className = this.__display ? "lexxy-math lexxy-math--display" : "lexxy-math"
    element.setAttribute("role", "math")
    element.setAttribute("aria-label", `Equation: ${this.__latex}`)
    element.setAttribute("data-latex", this.__latex)

    typesetInto(element, this.__latex, { display: this.__display })

    return element
  }

  updateDOM() {
    return true
  }

  exportDOM() {
    const element = document.createElement(this.__display ? "div" : "span")
    element.className = "lexxy-math"
    element.setAttribute("data-latex", this.__latex)
    element.textContent = this.__latex
    return { element }
  }

  exportJSON() {
    return {
      type: "lexxy-math",
      version: 1,
      latex: this.__latex,
      display: this.__display
    }
  }

  decorate() {
    return null
  }
}

export function $createMathNode(latex = "", display = false) {
  return new MathNode(latex, display)
}

export function $isMathNode(node) {
  return node instanceof MathNode
}

function $mathConversionFor(element, display) {
  if (!element.hasAttribute("data-latex")) return null

  return {
    conversion: (domNode) => ({
      node: $createMathNode(domNode.getAttribute("data-latex"), display)
    }),
    priority: 2
  }
}
