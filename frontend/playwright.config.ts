import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-390px",
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "desktop-1280px",
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: "uv run uvicorn app.main:app --port 8000",
      cwd: "../backend",
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: "sqlite+aiosqlite:///./test_playwright.db",
        NOTIFICATIONS_ALLOWLIST: '["*"]',
        DRY_RUN: "true",
      },
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
