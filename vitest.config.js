import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@37signals/lexxy": path.resolve(import.meta.dirname, "test/support/lexxy_shim.js")
    }
  },
  test: {
    environment: "jsdom",
    exclude: [ "**/node_modules/**" ]
  }
})
