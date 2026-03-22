import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import type { Plugin } from "vite";

// hoist-non-react-statics bundles react-is@16 inline which crashes on React 19.
// This plugin replaces it with a no-op at the module resolution level.
function hoistShimPlugin(): Plugin {
  const SHIM_ID = "\0hoist-non-react-statics-shim";
  return {
    name: "hoist-non-react-statics-shim",
    resolveId(id) {
      if (id === "hoist-non-react-statics") return SHIM_ID;
    },
    load(id) {
      if (id === SHIM_ID) {
        return "export default function hoistNonReactStatics(t){return t}";
      }
    },
  };
}

export default defineConfig({
  base: "/NPRG045/",
  plugins: [
    hoistShimPlugin(),
    react(),
    visualizer({
      filename: "./dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    chunkSizeWarningLimit: 750,
  },
  server: {
    proxy: {
      "/api/semtag": {
        target: "https://semtag-api.dev.memorise.sdu.dk",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/semtag/, "/semtag"),
      },
      "/api/ner": {
        target: "https://ner-api.dev.memorise.sdu.dk",  
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ner/, ""),  
      },
      "/api/mt": {
        target: "https://quest.ms.mff.cuni.cz/dimbu",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mt/, ""),
      },
    },
  },
});
