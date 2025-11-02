import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/NPRG045/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunk for React and React DOM
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          
          // Material-UI chunk (large library)
          if (id.includes("node_modules/@mui")) {
            return "vendor-mui";
          }
          
          // Slate editor chunk
          if (id.includes("node_modules/slate")) {
            return "vendor-slate";
          }
          
          // TipTap editor chunk
          if (id.includes("node_modules/@tiptap")) {
            return "vendor-tiptap";
          }
          
          // Other large dependencies
          if (id.includes("node_modules/fuse.js")) {
            return "vendor-utils";
          }
          
          // Other node_modules go to vendor-other
          if (id.includes("node_modules")) {
            return "vendor-other";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      "/api/semtag": {
        target: "https://semtag-api.dev.memorise.sdu.dk",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/semtag/, "/semtag"),
      },
      "/api/ner": {
        target: "https://semtag-api.dev.memorise.sdu.dk",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ner/, "/ner"),
      },
      "/api/mt": {
        target: "https://quest.ms.mff.cuni.cz/dimbu",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mt/, ""),
      },
    },
  },
});
