import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "@/shared/testing/utils";
import { InsurancePage } from "../pages/InsurancePage";

describe("Insurance Feature - Policies & Cashless Claim Hub", () => {
  it("renders insurance page heading, metrics, policy card, and passes axe", async () => {
    const { container } = renderWithProviders(<InsurancePage />, { route: "/insurance" });

    expect(
      screen.getByRole("heading", { level: 1, name: /insurance & cashless claim hub/i }),
    ).toBeInTheDocument();

    // Metric cards
    expect(screen.getByText(/total health cover/i)).toBeInTheDocument();
    expect(screen.getByText(/total term life cover/i)).toBeInTheDocument();

    // Add Insurance Policy button
    expect(
      screen.getByRole("button", { name: /add insurance policy/i }),
    ).toBeInTheDocument();

    // Policy item rendered from mock
    await waitFor(() => {
      expect(screen.getByText("Optima Secure")).toBeInTheDocument();
    });
    expect(screen.getByText("HDFC ERGO General Insurance")).toBeInTheDocument();
    expect(screen.getByText(/tpa: medi assist tpa/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens Add Insurance Policy dialog when clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<InsurancePage />, { route: "/insurance" });

    const addBtn = screen.getByRole("button", { name: /add insurance policy/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /register insurance policy/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/policy name \/ plan/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/insurer name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/policy number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sum insured \(₹\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save insurance policy/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens Digital TPA Card when button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsurancePage />, { route: "/insurance" });

    await waitFor(() => {
      expect(screen.getByText("Optima Secure")).toBeInTheDocument();
    });

    const tpaCardBtn = screen.getByRole("button", { name: /digital tpa card/i });
    await user.click(tpaCardBtn);

    await waitFor(() => {
      expect(screen.getByText(/emergency cashless health card/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/hospital admission desk instructions:/i)).toBeInTheDocument();
  });

  it("opens Claim Playbook SOP when button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsurancePage />, { route: "/insurance" });

    await waitFor(() => {
      expect(screen.getByText("Optima Secure")).toBeInTheDocument();
    });

    const playbookBtn = screen.getByRole("button", { name: /claim playbook/i });
    await user.click(playbookBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /hospital cashless treatment sop/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/critical timeline rule/i)).toBeInTheDocument();
  });
});
