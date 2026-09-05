import { defineConfig, devices } from "@playwright/test";

// Both servers must already be running: the backend on :9000 and the
// storefront dev server on :8080. These tests exercise real Medusa carts and
// place real orders in the local database, so they are deliberately not run
// against a throwaway in-memory backend.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      // Drives the installed Google Chrome. Avoids downloading browsers.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
