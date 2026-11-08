import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Embed build metadata in the shipped bundle so mobile diagnostic logs can
// identify the deployed artifact independently of browser cache state.
const buildTime = new Date().toISOString();
const buildId = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.VITE_BUILD_ID || 'unknown';

export default defineConfig({
 plugins: [react()],
 define: {
  'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
 },
 server: { host: "0.0.0.0" },
});
