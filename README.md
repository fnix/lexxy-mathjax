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

Inside the editor the extension typesets these with the page's MathJax. On a display page, `typesetMath` (below) does the same thing without an editor. **MathJax is host-provided, not bundled**: load MathJax v4 (`tex-chtml` or `tex-svg`) on any page that uses the editor or displays saved content. The extension also works against MathJax v3, so hosts already loading v3 can upgrade on their own schedule.

## The persisted format

This is the whole contract between the editor and anything else that needs to render or process saved equations — MathJax, but also any other script or server-side tool:

- `<span data-latex="...">` is an inline equation, `<div data-latex="...">` is display/block. Tag name is the only signal for inline vs. display; treat it as authoritative.
- Text content is the raw LaTeX, with no delimiters (`\(...\)`, `$$...$$`, `\[...\]`).
- `data-latex` is the one attribute this package relies on surviving sanitization (see the ActionText step below). `class="lexxy-math"` / `lexxy-math--display` are presentation only, applied defensively by `typesetMath`, and are not guaranteed to be present or to survive a sanitizer.

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
  window.MathJax = { output: { displayAlign: "center" } }
</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@4/tex-chtml.js"></script>
```

If MathJax is missing, the editor still works and equations show their raw LaTeX.

#### MathJax v4 notes

This package persists raw LaTeX (`data-latex`) and re-typesets it on every load, so a few v4 changes are worth knowing about before upgrading a host that already has saved content:

- **Different default font.** v4 defaults to `mathjax-newcm` (New Computer Modern), noticeably lighter than v3's TeX font. Set `output: { font: "mathjax-tex" }` to keep the old look.
- **`\text{...}` is now macro-parsed.** The `textmacros` extension ships in all v4 combined components, so a backslash or brace inside `\text{}` that was inert in v3 can now raise "undefined control sequence" for existing saved equations.
- **Font-size macros changed in MathJax 4.1.2** (`\tiny`/`\Tiny` swapped, `\large`…`\Huge` shifted by one), so existing content can render at a different size. Opt out with the `fontsizev3` TeX package (`loader: { load: ["[tex]/fontsizev3"] }, tex: { packages: { "[+]": ["fontsizev3"] } }`) if you pin a floating `@4` range.
- **Accessibility moved, but only for math MathJax typesets itself.** v4 turns assistive MathML off by default and turns the expression explorer (speech/braille) on instead. MathJax's own docs warn that math inserted via a direct conversion call — `tex2chtmlPromise`/`tex2svgPromise`, which is what this package uses, both in the editor and on display pages — "will not become part of the list of math expressions that MathJax knows about in the page", so the explorer never attaches to it. Both `createDOM` (editor) and `typesetMath` (display pages) compensate by setting `role="math"` / `aria-label="Equation: ..."` on every equation directly, rather than relying on the explorer.

## Rails / ActionText integration

**1. Allow `data-latex` through the server-side sanitizer** (ActionText strips unknown attributes when rendering):

```ruby
# config/initializers/lexxy_mathjax.rb
ActiveSupport.on_load(:action_text_content) do
  ActionText::ContentHelper.allowed_attributes += [ "data-latex" ]
end
```

**2. Typeset saved content on display pages.** Load MathJax (as above), include the stylesheet, and start the auto-typesetter:

```js
// app/javascript/application.js
import "@fnix/lexxy-mathjax/styles"
import { startMathjaxAutoTypeset } from "@fnix/lexxy-mathjax/typeset"

startMathjaxAutoTypeset()
```

`@fnix/lexxy-mathjax/typeset` is a separate entry point from the package's default export: it pulls in neither lexxy nor Lexical, so a display-only page doesn't load the editor. It re-typesets on `DOMContentLoaded`, `turbo:load`, `turbo:frame-load` and `turbo:render`, skips equations it has already rendered (so repeated Turbo navigations are cheap), and leaves any equation inside a live `<lexxy-editor>` to the extension.

For manual control — a specific container, a one-off re-render, or Stimulus — call `typesetMath` directly. It never throws and resolves with a summary:

```js
import { typesetMath } from "@fnix/lexxy-mathjax/typeset"

const { total, typeset, failed, skipped, mathjax } = await typesetMath(document.querySelector(".post-body"))
```

Options: `output` (`"auto" | "chtml" | "svg"`, default `"auto"` — detects whether the host loaded `tex-chtml` or `tex-svg`), `selector` (default `"[data-latex]"`), `force` (re-typeset elements already rendered), `accessible` (default `true`, adds `role="math"` / `aria-label`).

With Stimulus, for per-element control instead of a page-wide listener:

```js
// app/javascript/controllers/math_controller.js
import { Controller } from "@hotwired/stimulus"
import { typesetMath } from "@fnix/lexxy-mathjax/typeset"

export default class extends Controller {
  connect() {
    typesetMath(this.element)
  }
}
```
```erb
<div data-controller="math"><%= @post.body %></div>
```

**Without importing this package's JS at all**, wrap the stored LaTeX in MathJax's own delimiters and let `typesetPromise` scan for it normally:

```js
document.querySelectorAll("[data-latex]").forEach((el) => {
  const latex = el.getAttribute("data-latex")
  el.textContent = el.tagName === "DIV" ? `\\[${latex}\\]` : `\\(${latex}\\)`
})
window.MathJax.typesetPromise()
```

This is the only approach that keeps MathJax's contextual menu and the v4 expression explorer, because the math becomes part of MathJax's own document list (see the accessibility note above). The trade-offs: it depends on the host's `tex.inlineMath` / `tex.displayMath` configuration matching those delimiters, and invalid LaTeX renders as MathJax's own `merror` markup rather than this package's `.lexxy-math--error` styling.

> An earlier version of this README suggested setting `el.textContent` to the bare, undelimited `data-latex` value and then calling `MathJax.typesetPromise([...elements])`. That never worked: `typesetPromise` scans for delimiters, and bare LaTeX has none — passing an element list narrows *where* it scans, not *whether* it requires delimiters. If you copied that snippet, switch to one of the two approaches above.

## Rendering outside a browser (PDF export)

Both approaches above need an actual MathJax running in a DOM — the editor's, or a display page's. Some PDF pipelines have neither: [sghtmltopdf](https://github.com/waka/sghtmltopdf), for one, runs no JavaScript at all and does not render inline `<svg>`, so MathJax can never execute there, and CHTML output needs WOFF/WOFF2 web fonts, which such engines typically don't support either. The persisted format above is designed for exactly this case: `data-latex` carries everything a separate rendering step needs, without this package's help.

This isn't something this package ships — it's server-side, has no browser to run in, and every detail (page size, body font, cache store, job queue, PDF engine) belongs to the app, not the editor extension. The recipe:

**1. Render LaTeX to SVG in Node, using MathJax's server-side v4 package**, `@mathjax/src@4` (`mathjax-full` is the v3 name, `mathjax-node` is v2-era and abandoned — most recipes found online are stale):

```js
global.MathJax = {
  loader: { paths: { mathjax: "@mathjax/src/bundle" }, load: [ "adaptors/liteDOM" ], require: (f) => import(f) },
  svg: { fontCache: "none" },   // no shared <use> references — safer for a standalone image
  options: { enableSpeech: false, enableBraille: false, enableEnrichment: false }   // skip the speech-rule-engine; it's the dominant startup cost
}
await import("@mathjax/src/bundle/tex-svg.js")
await MathJax.startup.promise

const svg = await MathJax.tex2svgPromise(latex, { display, em, ex, containerWidth })
// pick em/containerWidth from the PDF's body font and page width — 16/780 above are editor-viewport defaults, not PDF ones

MathJax.done()   // mandatory: shuts down the speech-rule-engine's worker threads, or the process never exits
```

**2. Transfer the geometry, then embed as an image.** MathJax puts sizing on the `<svg>` element itself — `output/svg.ts`'s `createSVG` sets `width="Wex"`, `height="Hex"` and `style="vertical-align:-Dex"` — so wrapping it in an `<img>` (as most non-JS PDF engines require) discards all three unless you copy them onto the wrapper:

```html
<img src="data:image/svg+xml;base64,…" alt="\frac{a}{b}"
     style="width:2.62em;height:1.29em;vertical-align:-0.40em">
```

**3. Run this at export time, on a throwaway copy of the HTML — not at save time.** Keep `data-latex` as the only thing that's ever persisted:
- stored content stays canonical and round-trips through the editor unchanged (an `<img>` in a saved record wouldn't be recognized by `importDOM`);
- the sanitizer never has to accept `data:` URIs on `img[src]` app-wide, which would be a real XSS surface (`data:image/svg+xml` can carry `<script>`);
- there's no staleness or backfill migration when MathJax's output changes — bump a version in your cache key and the next export re-renders.

If your PDF engine has no accessibility tagging (sghtmltopdf doesn't), `alt` never reaches the PDF's own text layer either — still worth setting for tools that read it another way, but don't rely on it for accessibility.

Since the transform depends on nothing this package controls, and the format contract is exactly the `data-latex` spec above, this is intentionally left as a recipe rather than shipped code.

## Demo

Try it online: https://fnix.github.io/lexxy-mathjax/

Or serve the repo statically and open the demo locally:

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
- `src/helpers/mathjax_helper.js` — serialized MathJax typesetting with graceful degradation; shared by the editor and by `typeset_math.js`
- `src/typeset_math.js` — `typesetMath(root)`, the display-page renderer; batches conversions and refreshes MathJax's stylesheet once per call instead of once per equation
- `src/auto_typeset.js` — `startMathjaxAutoTypeset()`, wires `typesetMath` to `DOMContentLoaded`/Turbo events
- `src/typeset.js` — the `@fnix/lexxy-mathjax/typeset` entry point (re-exports the two above without pulling in lexxy/Lexical)
