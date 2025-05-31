import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/~55063713/memorise-ui/",
  plugins: [react()],
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
    },
  },
});
