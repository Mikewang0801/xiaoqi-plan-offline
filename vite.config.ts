import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  return {
    plugins: [react()],
    base: "./",
    server: {
      watch: {
        ignored: [
          "**/.android-toolchain/**",
          "**/.android-user-home/**",
          "**/.gradle-user-home/**",
          "**/android/**/build/**",
        ],
      },
    },
    build: {
      target: "es2022",
      sourcemap: false,
    },
  };
});
