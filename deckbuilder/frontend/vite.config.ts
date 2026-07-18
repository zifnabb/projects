import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build output (dist/) is copied into the FastAPI image as ./static.
// In dev, the Vite server proxies /api to the backend on :8099.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8099",
    },
  },
  build: {
    outDir: "dist",
  },
});
