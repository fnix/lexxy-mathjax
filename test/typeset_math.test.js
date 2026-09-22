import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetMathjaxHelperForTests, typesetInto } from "../src/helpers/mathjax_helper.js"
import { typesetMath } from "../src/typeset_math.js"
import { installFakeMathJax } from "./support/fake_mathjax.js"

function el(tag, { latex, output } = {}) {
  const element = document.createElement(tag)
  if (latex !== undefined) element.setAttribute("data-latex", latex)
  if (output !== undefined) element.setAttribute("data-lexxy-math-output", output)
  return element
}

describe("typesetMath", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("typesets every [data-latex] descendant of root", async () => {
    installFakeMathJax()

    const root = document.createElement("div")
    root.append(el("span", { latex: "a" }), el("div", { latex: "b" }))
    document.body.append(root)

    const result = await typesetMath(root)

    expect(result).toEqual({ total: 2, typeset: 2, failed: 0, skipped: 0, mathjax: true })
    expect(root.querySelectorAll(".MathJax")).toHaveLength(2)
  })

  it("infers display from tag name", async () => {
    const handle = installFakeMathJax()

    const root = document.createElement("div")
    root.append(el("span", { latex: "a" }), el("div", { latex: "b" }))
    document.body.append(root)

    await typesetMath(root)

    expect(handle.calls.find((c) => c.latex === "a").options.display).toBe(false)
    expect(handle.calls.find((c) => c.latex === "b").options.display).toBe(true)
  })

  it("typesets root itself when it matches the selector", async () => {
    installFakeMathJax()

    const span = el("span", { latex: "a" })
    document.body.append(span)

    const result = await typesetMath(span)

    expect(result.total).toBe(1)
    expect(span.querySelector(".MathJax")).not.toBeNull()
  })

  it("reports failures without aborting the rest of the batch", async () => {
    installFakeMathJax({ failOn: [ "\\bogus" ] })

    const root = document.createElement("div")
    const bad = el("span", { latex: "\\bogus" })
    const good = el("span", { latex: "a" })
    root.append(bad, good)
    document.body.append(root)

    const result = await typesetMath(root)

    expect(result).toEqual({ total: 2, typeset: 1, failed: 1, skipped: 0, mathjax: true })
    expect(bad.classList.contains("lexxy-math--error")).toBe(true)
    expect(bad.textContent).toBe("\\bogus")
    expect(bad.title).toContain("\\bogus")
    expect(bad.getAttribute("data-lexxy-math-output")).toBe("error")
    expect(good.querySelector(".MathJax")).not.toBeNull()
  })

  it("skips elements already typeset with the same output, unless forced", async () => {
    const handle = installFakeMathJax()

    const root = document.createElement("div")
    root.append(el("span", { latex: "a" }))
    document.body.append(root)

    await typesetMath(root)
    const result = await typesetMath(root)

    expect(result).toEqual({ total: 1, typeset: 0, failed: 0, skipped: 1, mathjax: true })
    expect(handle.calls).toHaveLength(1)

    const forced = await typesetMath(root, { force: true })
    expect(forced).toEqual({ total: 1, typeset: 1, failed: 0, skipped: 0, mathjax: true })
    expect(handle.calls).toHaveLength(2)
  })

  it("refreshes the document stylesheet once per batch, not once per equation", async () => {
    const handle = installFakeMathJax()

    const root = document.createElement("div")
    root.append(el("span", { latex: "a" }), el("span", { latex: "b" }), el("span", { latex: "c" }))
    document.body.append(root)

    await typesetMath(root)

    expect(handle.resets).toBe(1)
    expect(handle.updates).toBe(1)
  })

  it("contrasts with typesetInto, which refreshes per call", async () => {
    const handle = installFakeMathJax()

    await Promise.all([
      typesetInto(el("span", { latex: "a" }), "a"),
      typesetInto(el("span", { latex: "b" }), "b"),
      typesetInto(el("span", { latex: "c" }), "c")
    ])

    expect(handle.resets).toBe(3)
    expect(handle.updates).toBe(3)
  })

  it("auto-detects SVG output when only tex2svgPromise is available", async () => {
    installFakeMathJax({ outputs: [ "svg" ] })

    const root = document.createElement("div")
    root.append(el("span", { latex: "a" }))
    document.body.append(root)

    const result = await typesetMath(root)

    expect(result).toEqual({ total: 1, typeset: 1, failed: 0, skipped: 0, mathjax: true })
    expect(root.querySelector("[data-lexxy-math-output='svg']")).not.toBeNull()
  })

  it("lets an explicit output option override the document's live output jax", async () => {
    installFakeMathJax({ outputs: [ "chtml", "svg" ], name: "CHTML" })

    const root = document.createElement("div")
    root.append(el("span", { latex: "a" }))
    document.body.append(root)

    await typesetMath(root, { output: "svg" })

    expect(root.querySelector("[data-lexxy-math-output='svg']")).not.toBeNull()
  })

  describe("when MathJax never shows up", () => {
    beforeEach(() => {
      __resetMathjaxHelperForTests()
      vi.useFakeTimers()
      delete window.MathJax
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("leaves elements untouched and reports mathjax: false", async () => {
      const root = document.createElement("div")
      root.append(el("span", { latex: "a" }))
      document.body.append(root)

      const promise = typesetMath(root)
      await vi.advanceTimersByTimeAsync(10_000)
      const result = await promise

      expect(result).toEqual({ total: 1, typeset: 0, failed: 0, skipped: 0, mathjax: false })
      expect(root.querySelector(".lexxy-math--error")).toBeNull()
    })
  })

  it("skips equations inside a live editor", async () => {
    const handle = installFakeMathJax()

    const editor = document.createElement("lexxy-editor")
    editor.append(el("span", { latex: "a" }))
    document.body.append(editor)

    const result = await typesetMath(document)

    expect(result).toEqual({ total: 1, typeset: 0, failed: 0, skipped: 1, mathjax: true })
    expect(handle.calls).toHaveLength(0)
  })

  it("adds accessibility attributes and display class by default", async () => {
    installFakeMathJax()

    const div = el("div", { latex: "a" })
    document.body.append(div)

    await typesetMath(document.body)

    expect(div.getAttribute("role")).toBe("math")
    expect(div.getAttribute("aria-label")).toBe("Equation: a")
    expect(div.classList.contains("lexxy-math--display")).toBe(true)
  })

  it("suppresses accessibility attributes when accessible: false", async () => {
    installFakeMathJax()

    const span = el("span", { latex: "a" })
    document.body.append(span)

    await typesetMath(document.body, { accessible: false })

    expect(span.hasAttribute("role")).toBe(false)
    expect(span.hasAttribute("aria-label")).toBe(false)
  })

  describe("does not descend into MathJax's own output", () => {
    it("does not re-typeset the data-latex nodes a MathJax 4 render produces", async () => {
      const handle = installFakeMathJax()

      const root = document.createElement("div")
      root.append(el("span", { latex: "a" }))
      document.body.append(root)

      await typesetMath(root)
      const second = await typesetMath(root)

      // The default selector (span/div only) never even collects MathJax's
      // own mjx-* output nodes, so the count stays at the one source span.
      expect(second).toEqual({ total: 1, typeset: 0, failed: 0, skipped: 1, mathjax: true })
      expect(handle.calls).toHaveLength(1)
      expect(root.querySelectorAll("mjx-container")).toHaveLength(1)
    })

    it("excludes MathJax output even with a widened selector and force: true", async () => {
      const handle = installFakeMathJax()

      const root = document.createElement("div")
      root.append(el("span", { latex: "a" }))
      document.body.append(root)

      await typesetMath(root)
      // Widen past the default span/div selector, and force re-typesetting:
      // this is the case a host selector or force: true could otherwise
      // reach into MathJax's own mjx-math/mjx-mi output.
      const result = await typesetMath(root, { selector: "[data-latex]", force: true })

      // The selector now matches all three (span, mjx-math, mjx-mi), but
      // only the source span is actually converted — the other two are
      // strictly inside the mjx-container and are always skipped.
      expect(result.total).toBe(3)
      expect(result.skipped).toBe(2)
      expect(handle.calls).toHaveLength(2) // one from the first pass, one from this forced re-convert
      expect(root.querySelectorAll("mjx-container")).toHaveLength(1) // no nesting
    })
  })

  it("only collects span/div[data-latex] by default, but honors a wider selector", async () => {
    installFakeMathJax()

    const root = document.createElement("div")
    const paragraph = el("p", { latex: "a" })
    root.append(paragraph)
    document.body.append(root)

    const defaultResult = await typesetMath(root)
    expect(defaultResult).toEqual({ total: 0, typeset: 0, failed: 0, skipped: 0, mathjax: true })

    const widened = await typesetMath(root, { selector: "[data-latex]" })
    expect(widened.total).toBe(1)
  })

  it("does not run two concurrent passes over the same elements", async () => {
    const handle = installFakeMathJax()

    const root = document.createElement("div")
    root.append(el("span", { latex: "a" }))
    document.body.append(root)

    const [ first, second ] = await Promise.all([ typesetMath(root), typesetMath(root) ])

    expect(handle.calls).toHaveLength(1)
    expect(first.typeset + second.typeset).toBe(1)
    expect(first.skipped + second.skipped).toBe(1)
  })

  it("yields to the browser instead of blocking a whole pass in one task", async () => {
    installFakeMathJax()

    const root = document.createElement("div")
    for (let i = 0; i < 60; i++) root.append(el("span", { latex: `eq${i}` }))
    document.body.append(root)

    const order = []
    const typesetting = typesetMath(root).then(() => order.push("typeset"))
    setTimeout(() => order.push("task"), 0)

    await typesetting
    expect(order).toEqual([ "task", "typeset" ])
  })

  it("flushes styles at each yield boundary, not just once for a large batch", async () => {
    const handle = installFakeMathJax()

    const root = document.createElement("div")
    for (let i = 0; i < 60; i++) root.append(el("span", { latex: `eq${i}` }))
    document.body.append(root)

    await typesetMath(root)

    expect(handle.resets).toBeGreaterThan(1)
    expect(handle.updates).toBeGreaterThan(1)
  })
})

describe("typesetInto queue", () => {
  it("resolves each call independently instead of waiting on later calls", async () => {
    installFakeMathJax()

    const first = typesetInto(el("span", { latex: "a" }), "a")
    const second = typesetInto(el("span", { latex: "b" }), "b")

    const order = []
    first.then(() => order.push("first"))
    second.then(() => order.push("second"))

    await first
    expect(order).toEqual([ "first" ])

    await second
    expect(order).toEqual([ "first", "second" ])
  })

  it("does not wedge the queue when a conversion fails", async () => {
    installFakeMathJax({ failOn: [ "\\bogus" ] })

    await typesetInto(el("span", { latex: "\\bogus" }), "\\bogus")
    const span = el("span", { latex: "a" })
    await typesetInto(span, "a")

    expect(span.querySelector(".MathJax")).not.toBeNull()
  })
})
