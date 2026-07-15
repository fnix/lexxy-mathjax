import { typesetInto } from "../helpers/mathjax_helper.js"

const PREVIEW_DEBOUNCE_INTERVAL = 150

export class MathEditorDialogElement extends HTMLElement {
  #resolve = null
  #previewTimer = null

  connectedCallback() {
    this.innerHTML = this.constructor.template
    this.dialog = this.querySelector("dialog")
    this.textarea = this.querySelector("textarea")
    this.displayCheckbox = this.querySelector("input[name='display']")
    this.preview = this.querySelector(".lexxy-math-editor__preview")

    this.querySelector("form").addEventListener("submit", this.#handleSubmit)
    this.dialog.addEventListener("close", this.#handleClose)
    this.textarea.addEventListener("input", this.#schedulePreview)
    this.textarea.addEventListener("keydown", this.#handleTextareaKeydown)
    this.displayCheckbox.addEventListener("change", this.#refreshPreview)
    this.querySelector("[data-behavior='cancel']").addEventListener("click", () => this.dialog.close())
  }

  disconnectedCallback() {
    clearTimeout(this.#previewTimer)
    this.#settle(null)
  }

  // Shows the dialog and resolves with { latex, display } on confirm, null on cancel.
  open({ latex = "", display = false } = {}) {
    this.textarea.value = latex
    this.displayCheckbox.checked = display
    this.#refreshPreview()

    this.dialog.showModal()
    this.textarea.focus()
    this.textarea.select()

    return new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  #handleSubmit = (event) => {
    event.preventDefault()

    const latex = this.textarea.value.trim()
    this.#settle(latex ? { latex, display: this.displayCheckbox.checked } : null)
    this.dialog.close()
  }

  #handleClose = () => {
    this.#settle(null)
  }

  #handleTextareaKeydown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.querySelector("form").requestSubmit()
    }
  }

  #schedulePreview = () => {
    clearTimeout(this.#previewTimer)
    this.#previewTimer = setTimeout(this.#refreshPreview, PREVIEW_DEBOUNCE_INTERVAL)
  }

  #refreshPreview = () => {
    const latex = this.textarea.value.trim()

    if (latex) {
      typesetInto(this.preview, latex, { display: this.displayCheckbox.checked })
    } else {
      this.preview.textContent = ""
    }
  }

  #settle(result) {
    if (this.#resolve) {
      const resolve = this.#resolve
      this.#resolve = null
      resolve(result)
    }
  }

  static get template() {
    return `
      <dialog class="lexxy-math-editor">
        <form method="dialog" novalidate>
          <label class="lexxy-math-editor__label">
            LaTeX
            <textarea name="latex" rows="3" spellcheck="false" autocomplete="off" placeholder="\\frac{a}{b}"></textarea>
          </label>

          <div class="lexxy-math-editor__preview" aria-live="polite"></div>

          <div class="lexxy-math-editor__footer">
            <label class="lexxy-math-editor__display-toggle">
              <input type="checkbox" name="display"> Display as block
            </label>

            <div class="lexxy-math-editor__actions">
              <button type="button" data-behavior="cancel">Cancel</button>
              <button type="submit" data-behavior="confirm">Save</button>
            </div>
          </div>
        </form>
      </dialog>
    `
  }
}

export function defineMathEditorDialogElement() {
  if (!customElements.get("lexxy-math-editor")) {
    customElements.define("lexxy-math-editor", MathEditorDialogElement)
  }
}
