import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { App } from "@/App";

describe("Smoke test", () => {
  it("renders the application without crashing", () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
