import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  },
  resolve: {
    alias: {
      "@engine": "/src/engine",
      "@voxel": "/src/voxel",
      "@multiplayer": "/src/multiplayer",
      "@ui": "/src/ui",
      "@types": "/src/types"
    }
  }
});
