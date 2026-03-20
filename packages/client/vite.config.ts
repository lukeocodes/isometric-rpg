import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500, // Babylon.js engine chunk is ~1.4MB
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split Babylon.js into its own chunk
          if (id.includes("@babylonjs")) {
            return "babylon";
          }
          // Split audio libraries into their own chunk
          if (
            id.includes("tone") ||
            id.includes("standardized-audio-context")
          ) {
            return "audio";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
