import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    // This line tells Vite to replace 'global' with an empty object
    // which effectively solves the ReferenceError
    global: {},
  },
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(new URL(import.meta.url).pathname), "src"),
    },
  },
  build: {
    rollupOptions: {
      external: [
        "@reown/appkit",
        "@reown/appkit-common",
        "@reown/appkit-utils",
        "@reown/appkit/adapters",
        "@reown/appkit/networks",
        "@reown/walletkit",
        "@walletconnect/jsonrpc-http-connection",
        "@walletconnect/universal-provider",
      ],
    },
  },
});
