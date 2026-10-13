/// <reference types="vite/client" />

import "vitest";
import "@testing-library/jest-dom/vitest";

// Augment Vitest matchers with vitest-axe
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<_T = any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toHaveNoViolations(): any;
  }
  interface AsymmetricMatchersContaining {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toHaveNoViolations(): any;
  }
}
