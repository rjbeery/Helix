import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
<<<<<<< HEAD

export default defineConfig({
  plugins: [react()],
=======
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
>>>>>>> origin/main
  server: { proxy: { "/api": "http://localhost:3001" } }
});
