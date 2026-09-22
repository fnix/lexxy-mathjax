import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { startMathjaxAutoTypeset } from "../src/auto_typeset.js"
import { installFakeMathJax } from "./support/fake_mathjax.js"

function el(tag, latex) {
  const element = document.createElement(tag)
  element.setAttribute("data-latex", latex)
  return element
}

function stubReadyState(value) {
  vi.spyOn(document, "readyState", "get").mockReturnValue(value)
}

describe("startMathjaxAutoTypeset", () => {
  let teardown

  beforeEach(() => {
    document.body.innerHTML = ""
    document.body.append(el("span", "a"))
  })

  afterEach(() => {
    teardown?.()
    teardown = undefined
    vi.restoreAllMocks()
  })

  it("runs exactly one pass on an already-parsed document, not two", async () => {
    stubReadyState("complete")
    const handle = installFakeMathJax()

    teardown = startMathjaxAutoTypeset()
    await Promise.resolve() // let the immediate handler's typesetMath settle
    await new Promise((resolve) => setTimeout(resolve, 0))

    document.dispatchEvent(new window.Event("DOMContentLoaded"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handle.calls).toHaveLength(1)
  })

  it("waits for DOMContentLoaded when the document is still parsing", async () => {
    stubReadyState("loading")
    const handle = installFakeMathJax()

    teardown = startMathjaxAutoTypeset()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handle.calls).toHaveLength(0)

    document.dispatchEvent(new window.Event("DOMContentLoaded"))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handle.calls).toHaveLength(1)
  })

  it("scopes turbo:frame-load to the frame instead of the whole document", async () => {
    stubReadyState("complete")
    const handle = installFakeMathJax()

    const frame = document.createElement("turbo-frame")
    document.body.append(frame)

    teardown = startMathjaxAutoTypeset()
    await new Promise((resolve) => setTimeout(resolve, 0))
    handle.calls.length = 0 // discard the initial full-document pass

    // Content that arrives after the initial pass, as if Turbo had just
    // swapped it in: one equation inside the frame, one outside it.
    const inFrame = el("span", "b")
    frame.append(inFrame)
    document.body.append(el("span", "c"))

    const event = new window.Event("turbo:frame-load", { bubbles: true })
    Object.defineProperty(event, "target", { value: frame })
    document.dispatchEvent(event)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handle.calls).toHaveLength(1)
    expect(handle.calls[0].latex).toBe("b")
    expect(inFrame.getAttribute("data-lexxy-math-output")).toBe("chtml")
  })

  it("removes exactly the listeners it registered", async () => {
    stubReadyState("complete")
    const handle = installFakeMathJax()

    teardown = startMathjaxAutoTypeset()
    await new Promise((resolve) => setTimeout(resolve, 0))
    handle.calls.length = 0

    teardown()
    teardown = undefined

    document.dispatchEvent(new window.Event("turbo:load"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handle.calls).toHaveLength(0)
  })
})
