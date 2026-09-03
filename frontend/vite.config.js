import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const backendTarget = env.VITE_BACKEND_URL || "http://localhost:8080";

  return {
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
  proxy: {
    "/api": {
      target: backendTarget,
      changeOrigin: true,
    },

    "/health": {
      target: backendTarget,
      changeOrigin: true,
    },
  },
},
  };
});
