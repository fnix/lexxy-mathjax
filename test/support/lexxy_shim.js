// Test-only stand-in for "@37signals/lexxy": importing the real dist pulls in
// Prism/DOM side effects that don't load under Node ESM. Unit tests only need
// the Lexical namespace re-export, which resolves to the same lexical package
// lexxy itself depends on.
export * as Lexical from "lexical"
export class Extension {}
export function configure() {}
