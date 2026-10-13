import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";
import { renderWithProviders } from "@/shared/testing/utils";

describe("Layout Shell", () => {
  it("renders brand, desktop navigation items, and skip link", () => {
    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<div>Child Content</div>} />
        </Route>
      </Routes>,
      { route: "/" },
    );

    // Skip to main content link
    expect(screen.getByRole("link", { name: /skip to main content/i })).toBeInTheDocument();

    // Brand title
    expect(screen.getByText("Family Safety Net")).toBeInTheDocument();

    // Nav items
    expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /loans & emi/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /contacts/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /documents/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /notifications/i }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByRole("link", { name: /settings/i }).length).toBeGreaterThanOrEqual(1);

    // Main content slot
    expect(screen.getByText("Child Content")).toBeInTheDocument();

    // Monitoring indicator
    expect(screen.getByText("Monitoring active")).toBeInTheDocument();
  });
});
