import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api":  { target: "http://localhost:3001", changeOrigin: true },
      "/auth": { target: "http://localhost:3001", changeOrigin: true },
      "/v1":   { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        agent: path.resolve(__dirname, "public/agent.html"),
      },
    },
  },
});
