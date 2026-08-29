import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  // Both public entrypoints share one immutable asset tree under /slides/.
  // Development keeps relative URLs so the local root preview remains usable.
  base: command === "build" ? "/slides/" : "./",
  build: {
    target: "baseline-widely-available",
    sourcemap: false
  }
}));
