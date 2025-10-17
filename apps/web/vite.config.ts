import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const useDocker = process.env.USE_DOCKER === "1";
const target = useDocker ? "http://api:3001" : "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target, changeOrigin: true } }
  },
  preview: { port: 5173, strictPort: true }
});
