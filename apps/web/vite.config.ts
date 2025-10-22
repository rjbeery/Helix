import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
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
