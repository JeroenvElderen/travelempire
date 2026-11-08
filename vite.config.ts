import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Embed build metadata in the shipped bundle so mobile diagnostic logs can
// identify the deployed artifact independently of browser cache state.
export default defineConfig(({ mode }) => {
 const env = loadEnv(mode, '.', '');
 const buildTime = new Date().toISOString();
 const buildId = env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || env.VITE_BUILD_ID || 'unknown';
 return {
 plugins: [react()],
 define: {
  'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
 },
 server: { host: "0.0.0.0" },
 };
});
