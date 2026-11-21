import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      // Node 22+ ships its own localStorage global (undefined without
      // --localstorage-file), which hides happy-dom's. Turn it off in workers.
      execArgv: ["--no-experimental-webstorage"],
    },
  })
)
