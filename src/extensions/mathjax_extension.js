import { Extension, Lexical } from "@37signals/lexxy"
import { MathNode, $createMathNode, $isMathNode } from "../nodes/math_node.js"
import { defineMathEditorDialogElement } from "../elements/math_editor_dialog.js"

const {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $insertNodes,
  COMMAND_PRIORITY_NORMAL,
  createCommand
} = Lexical

export const INSERT_MATH_COMMAND = createCommand("INSERT_MATH_COMMAND")

// Square root of x, drawn to match lexxy's 18x18 filled toolbar icons
const MATH_ICON = `
  <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 3.5V5.3H10.1L6.7 15.5H5.2L3.3 10.9H1.5V9.1H4.5L5.9 12.5L8.8 3.5Z"/>
    <path d="M10.4 7.9L14.6 13.1M14.6 7.9L10.4 13.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  </svg>
`

export class MathjaxExtension extends Extension {
  #dialog = null
  #editor = null

  get enabled() {
    return this.editorElement.supportsRichText
  }

  get allowedElements() {
    return [
      { tag: "span", attributes: [ "data-latex" ] },
      { tag: "div", attributes: [ "data-latex" ] }
    ]
  }

  get lexicalExtension() {
    const extension = this

    return this.defineExtension({
      name: "lexxy/mathjax",
      nodes: [ MathNode ],
      register(editor) {
        extension.#editor = editor

        const unregisterInsert = editor.registerCommand(INSERT_MATH_COMMAND, () => {
          extension.#promptNewEquation()
          return true
        }, COMMAND_PRIORITY_NORMAL)

        // String command so toolbar buttons can use data-command="insertMath"
        const unregisterToolbarInsert = editor.registerCommand("insertMath", () => {
          extension.#promptNewEquation()
          return true
        }, COMMAND_PRIORITY_NORMAL)

        const unregisterClicks = editor.registerRootListener((rootElement, previousRootElement) => {
          previousRootElement?.removeEventListener("click", extension.#handleEquationClicked)
          rootElement?.addEventListener("click", extension.#handleEquationClicked)
        })

        return () => {
          unregisterInsert()
          unregisterToolbarInsert()
          unregisterClicks()
        }
      }
    })
  }

  initializeToolbar(toolbar) {
    const button = document.createElement("button")
    button.type = "button"
    button.name = "math"
    button.className = "lexxy-editor__toolbar-button"
    button.title = "Insert equation"
    button.setAttribute("data-command", "insertMath")
    button.setAttribute("data-hotkey", "cmd+shift+e ctrl+shift+e")
    button.innerHTML = MATH_ICON

    toolbar.appendChild(button)
    toolbar.requestOverflowRefresh?.()
  }

  dispose() {
    this.#dialog?.remove()
    this.#dialog = null
    this.#editor = null
  }

  async #promptNewEquation() {
    const result = await this.#openDialog()
    if (!result) return

    this.#editor.update(() => {
      $insertNodes([ $createMathNode(result.latex, result.display) ])
    })
    this.#editor.focus()
  }

  #handleEquationClicked = async (event) => {
    const element = event.target.closest(".lexxy-math")
    if (!element) return

    let nodeKey = null
    this.#editor.read(() => {
      const node = $getNearestNodeFromDOMNode(element)
      if ($isMathNode(node)) nodeKey = node.getKey()
    })
    if (nodeKey === null) return

    event.preventDefault()

    let currentValues = null
    this.#editor.read(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isMathNode(node)) {
        currentValues = { latex: node.getLatex(), display: node.isDisplay() }
      }
    })
    if (!currentValues) return

    const result = await this.#openDialog(currentValues)
    if (!result) return

    this.#editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if (!$isMathNode(node)) return

      if (node.isDisplay() === result.display) {
        node.setLatex(result.latex)
      } else {
        // Inline vs block affects where the node may live in the tree, so
        // swap in a fresh node instead of mutating in place.
        node.replace($createMathNode(result.latex, result.display))
      }
    })
    this.#editor.focus()
  }

  #openDialog(values = {}) {
    return this.#findOrCreateDialog().open(values)
  }

  #findOrCreateDialog() {
    if (!this.#dialog || !this.#dialog.isConnected) {
      defineMathEditorDialogElement()
      this.#dialog = document.createElement("lexxy-math-editor")
      document.body.appendChild(this.#dialog)
    }
    return this.#dialog
  }
}
