import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect } from "vitest";

expect.extend(axeMatchers);
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Base MSW server populated with contract-tested handlers
export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
  if (typeof window !== "undefined") {
    window.fetch = globalThis.fetch;
  }
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
