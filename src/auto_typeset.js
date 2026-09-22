import { typesetMath } from "./typeset_math.js"

const DEFAULT_EVENTS = [ "DOMContentLoaded", "turbo:load", "turbo:frame-load", "turbo:render" ]

// Wires typesetMath up to a page's navigation lifecycle. Covers full-page
// loads, Turbo Drive visits, and Turbo Frames/Streams: on turbo:frame-load
// the event target is the frame itself, so only its own subtree is
// retypeset instead of walking the whole document again.
//
// When the document has already finished parsing, DOMContentLoaded has
// already fired (or never will), so it's dropped from the listener list
// instead of also being listened for — otherwise both the immediate call
// below and a still-pending DOMContentLoaded would fire a redundant first
// pass. typesetMath's own queuing (see typeset_math.js) protects against any
// passes that do legitimately overlap, e.g. turbo:load racing a slow
// DOMContentLoaded.
//
// Returns a teardown function that removes exactly the listeners this call
// registered.
export function startMathjaxAutoTypeset({ events = DEFAULT_EVENTS, ...options } = {}) {
  const handler = (event) => {
    const root = event.target?.nodeType === 1 ? event.target : document
    return typesetMath(root, options)
  }

  const parsing = document.readyState === "loading"
  const listened = parsing ? events : events.filter((name) => name !== "DOMContentLoaded")

  listened.forEach((name) => document.addEventListener(name, handler))
  if (!parsing) handler({})

  return () => listened.forEach((name) => document.removeEventListener(name, handler))
}
