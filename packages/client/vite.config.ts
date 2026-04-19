import { defineConfig } from "vite";

// Tiled .tsx tilesets collide with TypeScript React .tsx — tell Vite to treat
// them as external static assets, not TypeScript modules.
const tiledTsxPlugin = () => ({
  name: "tiled-tileset-plugin",
  resolveId: {
    order: "pre" as const,
    handler(sourceId: string) {
      if (!sourceId.endsWith(".tsx")) return;
      return { id: "tileset:" + sourceId, external: "relative" as const };
    },
  },
});

export default defineConfig({
  plugins: [tiledTsxPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    assetsInlineLimit: 0, // Excalibur cannot handle inlined XML in prod
    sourcemap: true,
  },
});
