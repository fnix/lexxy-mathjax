import { typesetMath } from "./typeset_math.js"

const DEFAULT_EVENTS = [ "DOMContentLoaded", "turbo:load", "turbo:frame-load", "turbo:render" ]

// Wires typesetMath up to a page's navigation lifecycle. Covers full-page
// loads, Turbo Drive visits, and Turbo Frames/Streams: on turbo:frame-load
// the event target is the frame itself, so only its own subtree is
// retypeset instead of walking the whole document again.
//
// Returns a teardown function that removes the listeners.
export function startMathjaxAutoTypeset({ events = DEFAULT_EVENTS, ...options } = {}) {
  const handler = (event) => {
    const root = event.target?.nodeType === 1 ? event.target : document
    return typesetMath(root, options)
  }

  events.forEach((name) => document.addEventListener(name, handler))
  if (document.readyState !== "loading") handler({})

  return () => events.forEach((name) => document.removeEventListener(name, handler))
}
