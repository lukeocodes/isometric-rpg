import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
      "@server/world": resolve(__dirname, "../server/src/world"),
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
