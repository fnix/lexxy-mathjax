import { beforeEach, describe, expect, it } from "vitest"
import { Lexical } from "@37signals/lexxy"
import { MathNode, $createMathNode, $isMathNode } from "../src/nodes/math_node"

const { createEditor } = Lexical

// Fake MathJax so typesetInto resolves instantly instead of polling for 10s
beforeEach(() => {
  window.MathJax = {
    startup: {
      promise: Promise.resolve(),
      document: { clear() {}, updateDocument() {} }
    },
    tex2chtmlPromise: async (latex) => {
      const span = document.createElement("span")
      span.className = "MathJax"
      span.textContent = latex
      return span
    }
  }
})

function buildEditor() {
  return createEditor({
    nodes: [ MathNode ],
    onError: (error) => { throw error }
  })
}

function update(editor, fn) {
  return new Promise((resolve) => {
    editor.update(() => resolve(fn()), { discrete: true })
  })
}

describe("MathNode", () => {
  it("stores latex and display mode", async () => {
    const editor = buildEditor()

    await update(editor, () => {
      const node = $createMathNode("x^2", false)
      expect(node.getLatex()).toBe("x^2")
      expect(node.isDisplay()).toBe(false)
      expect(node.isInline()).toBe(true)
      expect(node.getTextContent()).toBe("x^2")
      expect($isMathNode(node)).toBe(true)
    })
  })

  it("round-trips through JSON", async () => {
    const editor = buildEditor()

    await update(editor, () => {
      const original = $createMathNode("\\frac{a}{b}", true)
      const restored = MathNode.importJSON(original.exportJSON())

      expect(original.exportJSON()).toEqual({
        type: "lexxy-math",
        version: 1,
        latex: "\\frac{a}{b}",
        display: true
      })
      expect(restored.getLatex()).toBe("\\frac{a}{b}")
      expect(restored.isDisplay()).toBe(true)
      expect(restored.isInline()).toBe(false)
    })
  })

  it("exports inline equations as a span with data-latex", async () => {
    const editor = buildEditor()

    await update(editor, () => {
      const { element } = $createMathNode("e^{i\\pi}", false).exportDOM()

      expect(element.tagName).toBe("SPAN")
      expect(element.getAttribute("data-latex")).toBe("e^{i\\pi}")
      expect(element.textContent).toBe("e^{i\\pi}")
      expect(element.className).toBe("lexxy-math")
    })
  })

  it("exports display equations as a div with data-latex", async () => {
    const editor = buildEditor()

    await update(editor, () => {
      const { element } = $createMathNode("\\int_0^1 x\\,dx", true).exportDOM()

      expect(element.tagName).toBe("DIV")
      expect(element.getAttribute("data-latex")).toBe("\\int_0^1 x\\,dx")
    })
  })

  it("imports span[data-latex] as an inline node and div[data-latex] as display", async () => {
    const editor = buildEditor()

    await update(editor, () => {
      const span = document.createElement("span")
      span.setAttribute("data-latex", "a+b")
      const spanConversion = MathNode.importDOM().span(span)
      const inlineNode = spanConversion.conversion(span).node

      expect(spanConversion.priority).toBe(2)
      expect(inlineNode.getLatex()).toBe("a+b")
      expect(inlineNode.isDisplay()).toBe(false)

      const div = document.createElement("div")
      div.setAttribute("data-latex", "a-b")
      const blockNode = MathNode.importDOM().div(div).conversion(div).node

      expect(blockNode.getLatex()).toBe("a-b")
      expect(blockNode.isDisplay()).toBe(true)
    })
  })

  it("ignores spans and divs without data-latex", () => {
    const span = document.createElement("span")
    const div = document.createElement("div")

    expect(MathNode.importDOM().span(span)).toBeNull()
    expect(MathNode.importDOM().div(div)).toBeNull()
  })

  it("creates editor DOM with accessibility attributes and typesets async", async () => {
    const editor = buildEditor()

    const element = await update(editor, () => $createMathNode("x^2", false).createDOM())

    expect(element.tagName).toBe("SPAN")
    expect(element.getAttribute("role")).toBe("math")
    expect(element.getAttribute("aria-label")).toBe("Equation: x^2")
    expect(element.getAttribute("data-latex")).toBe("x^2")
    expect(element.textContent).toBe("x^2") // raw fallback before typesetting

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(element.querySelector(".MathJax")).not.toBeNull()
  })
})
