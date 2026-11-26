import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The browser talks to a single origin, so the session cookie stays
    // SameSite=Strict and no CORS is involved in development.
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: false },
    },
  },
});
