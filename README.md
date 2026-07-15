# @fnix/lexxy-mathjax

LaTeX equations for [Lexxy](https://lexxy.dev) (the rich text editor for Rails), rendered with [MathJax](https://www.mathjax.org).

- Toolbar button (and `Cmd/Ctrl+Shift+E`) opens a dialog with a LaTeX input and live preview
- Click any equation to edit it
- Inline (`e^{i\pi} + 1 = 0` in a sentence) and display/block modes
- Saved HTML stores the raw LaTeX in a `data-latex` attribute, so content round-trips cleanly and is typeset again on display pages

## How it works

Equations are stored in the document (and in what ActionText persists) as:

```html
<span class="lexxy-math" data-latex="\frac{a}{b}">\frac{a}{b}</span>   <!-- inline -->
<div  class="lexxy-math" data-latex="\int_0^1 x\,dx">...</div>         <!-- display/block -->
```

Inside the editor the extension typesets these with the page's MathJax. **MathJax is host-provided, not bundled**: load MathJax v3 (`tex-chtml`) on any page that uses the editor or displays saved content.

## Installation

### With importmap-rails (no build)

Vendor this package (or pin it) and pin lexxy's bare specifier so the extension resolves it:

```ruby
# config/importmap.rb
pin "lexxy"                                        # from the lexxy gem, per lexxy's install docs
pin "@37signals/lexxy", to: "lexxy.js"             # alias used by @fnix/lexxy-mathjax
pin "@fnix/lexxy-mathjax", to: "lexxy-mathjax/index.js"  # vendored src/ of this package
# ...pin the files under src/ as well if vendoring, e.g. via pin_all_from
```

### With a JS bundler (esbuild / vite / webpack)

```bash
npm install @fnix/lexxy-mathjax @37signals/lexxy
```

### Register the extension

```js
import { configure } from "@37signals/lexxy"
import MathjaxExtension from "@fnix/lexxy-mathjax"

configure({
  global: { extensions: [ MathjaxExtension ] }
})
```

Include the stylesheet (`@fnix/lexxy-mathjax/styles`, or copy `styles/lexxy-mathjax.css` into your assets).

### Load MathJax

```html
<script>
  window.MathJax = { chtml: { displayAlign: "center" } }
</script>
<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
```

If MathJax is missing, the editor still works and equations show their raw LaTeX.

## Rails / ActionText integration

**1. Allow `data-latex` through the server-side sanitizer** (ActionText strips unknown attributes when rendering):

```ruby
# config/initializers/lexxy_mathjax.rb
ActiveSupport.on_load(:action_text_content) do
  ActionText::ContentHelper.allowed_attributes += [ "data-latex" ]
end
```

**2. Typeset saved content on display pages.** Load MathJax (as above) plus a small script that renders `[data-latex]` elements, Turbo-compatible:

```js
function typesetEquations() {
  const elements = document.querySelectorAll(".trix-content [data-latex], .lexxy-content [data-latex]")
  if (elements.length === 0 || !window.MathJax?.typesetPromise) return

  elements.forEach((el) => { el.textContent = el.getAttribute("data-latex") })
  window.MathJax.typesetPromise([ ...elements ])
}

document.addEventListener("turbo:load", typesetEquations)
document.addEventListener("DOMContentLoaded", typesetEquations)
```

Note: `typesetPromise` scans for `\(...\)` delimiters by default; the snippet above instead sets each element's content from `data-latex` and typesets just those elements. If you prefer delimiter scanning, configure `tex.inlineMath` accordingly.

## Demo

Serve the repo statically and open the demo:

```bash
npx serve .
# then visit http://localhost:3000/demo/
```

## Tests

```bash
npm install
npm test
```

## Development notes

The code follows lexxy's own conventions: plain ES modules, vanilla JS, no build step. Structure:

- `src/nodes/math_node.js` — `DecoratorNode` storing `{ latex, display }`; `createDOM` typesets with MathJax, `exportDOM`/`importDOM` handle the `data-latex` HTML format
- `src/extensions/mathjax_extension.js` — the `Lexxy.Extension`: registers the node, the `insertMath` command, the toolbar button, and click-to-edit
- `src/elements/math_editor_dialog.js` — `<lexxy-math-editor>` dialog with live preview
- `src/helpers/mathjax_helper.js` — serialized MathJax typesetting with graceful degradation
