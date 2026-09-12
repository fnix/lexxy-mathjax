// Entry point for display-only pages: @fnix/lexxy-mathjax/typeset pulls in
// neither lexxy nor Lexical, unlike the "." entry which loads the whole
// editor extension.
export { typesetMath } from "./typeset_math.js"
export { startMathjaxAutoTypeset } from "./auto_typeset.js"
