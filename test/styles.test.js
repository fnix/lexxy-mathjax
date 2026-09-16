import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const CSS = readFileSync(path.resolve(import.meta.dirname, "../styles/lexxy-mathjax.css"), "utf8")

// Every custom property the dialog exposes for theming, and the declarations that consume it.
// Kept in sync with the README's "Theming" table by the test at the bottom of this file.
const THEME = [
  { property: "--lexxy-math-backdrop-color", fallback: "rgba(0, 0, 0, 0.35)",
    declarations: [ [ ".lexxy-math-editor::backdrop", "background" ] ] },
  { property: "--lexxy-math-dialog-bg", fallback: "Canvas",
    declarations: [
      [ ".lexxy-math-editor", "background" ],
      [ ".lexxy-math-editor__actions button", "background" ]
    ] },
  { property: "--lexxy-math-dialog-border-color", fallback: "#d4d4d8",
    declarations: [ [ ".lexxy-math-editor", "border" ] ] },
  { property: "--lexxy-math-dialog-radius", fallback: "0.5rem",
    declarations: [ [ ".lexxy-math-editor", "border-radius" ] ] },
  { property: "--lexxy-math-dialog-shadow", fallback: "0 10px 30px rgba(0, 0, 0, 0.15)",
    declarations: [ [ ".lexxy-math-editor", "box-shadow" ] ] },
  { property: "--lexxy-math-text-color", fallback: "CanvasText",
    declarations: [
      [ ".lexxy-math-editor", "color" ],
      [ ".lexxy-math-editor__actions button", "color" ]
    ] },
  { property: "--lexxy-math-muted-color", fallback: "#52525b",
    declarations: [ [ ".lexxy-math-editor__label", "color" ] ] },
  { property: "--lexxy-math-input-bg", fallback: "Field",
    declarations: [ [ ".lexxy-math-editor textarea", "background" ] ] },
  { property: "--lexxy-math-input-text-color", fallback: "FieldText",
    declarations: [ [ ".lexxy-math-editor textarea", "color" ] ] },
  { property: "--lexxy-math-input-border-color", fallback: "#d4d4d8",
    declarations: [
      [ ".lexxy-math-editor textarea", "border" ],
      [ ".lexxy-math-editor__preview", "border" ],
      [ ".lexxy-math-editor__actions button", "border" ]
    ] },
  { property: "--lexxy-math-input-radius", fallback: "0.375rem",
    declarations: [
      [ ".lexxy-math-editor textarea", "border-radius" ],
      [ ".lexxy-math-editor__preview", "border-radius" ],
      [ ".lexxy-math-editor__actions button", "border-radius" ]
    ] },
  { property: "--lexxy-math-focus-color", fallback: "#2563eb",
    declarations: [
      [ "lexxy-editor .lexxy-math.selected, lexxy-editor [data-lexical-decorator=\"true\"]:focus .lexxy-math", "outline" ],
      [ ".lexxy-math-editor__actions button[data-behavior=\"confirm\"]", "background" ],
      [ ".lexxy-math-editor__actions button[data-behavior=\"confirm\"]", "border-color" ]
    ] },
  { property: "--lexxy-math-focus-content-color", fallback: "white",
    declarations: [ [ ".lexxy-math-editor__actions button[data-behavior=\"confirm\"]", "color" ] ] },
  { property: "--lexxy-math-error-color", fallback: "#b91c1c",
    declarations: [
      [ ".lexxy-math--error", "color" ],
      [ ".lexxy-math--error", "outline" ]
    ] }
]

function ruleFor(selector) {
  const document = window.document
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.selectorText === selector) return rule
    }
  }
  throw new Error(`No rule found for selector: ${selector}`)
}

describe("styles/lexxy-mathjax.css", () => {
  let styleElement

  function loadStylesheet({ resetMargins = false } = {}) {
    if (resetMargins) {
      const reset = document.createElement("style")
      reset.textContent = "* { margin: 0; padding: 0; }"
      document.head.append(reset)
    }
    styleElement = document.createElement("style")
    styleElement.textContent = CSS
    document.head.append(styleElement)
  }

  afterEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  describe("dialog centring", () => {
    it("stays centred even under a host reset that zeroes margin on *", () => {
      loadStylesheet({ resetMargins: true })

      const dialog = document.createElement("dialog")
      dialog.className = "lexxy-math-editor"
      document.body.append(dialog)

      expect(getComputedStyle(dialog).margin).toBe("auto")
    })
  })

  describe("theming contract", () => {
    it.each(THEME)("$property falls back to today's value in every declaration that consumes it", ({ property, fallback, declarations }) => {
      loadStylesheet()

      for (const [ selector, cssProperty ] of declarations) {
        const declared = ruleFor(selector).style.getPropertyValue(cssProperty)
        expect(declared).toContain(`var(${property}, ${fallback})`)
      }
    })

    it("documents the same properties as the README's theming table", () => {
      const readme = readFileSync(path.resolve(import.meta.dirname, "../README.md"), "utf8")

      for (const { property } of THEME) {
        expect(readme).toContain(property)
      }
    })
  })
})
