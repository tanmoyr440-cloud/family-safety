import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "@/shared/testing/utils";
import { AccountsPage } from "../pages/AccountsPage";

describe("Accounts Feature - Bank Accounts & Mutual Funds", () => {
  it("renders financial accounts heading, bank accounts card, holdings snapshot, and nominee notes, passing axe", async () => {
    const { container } = renderWithProviders(<AccountsPage />, { route: "/accounts" });

    expect(
      screen.getByRole("heading", { level: 1, name: /financial accounts & investments/i }),
    ).toBeInTheDocument();

    // Bank accounts card
    expect(screen.getByText("Savings & Bank Accounts")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /add bank account/i })[0],
    ).toBeInTheDocument();

    // Holdings snapshot
    expect(screen.getByText("Portfolio Holdings Snapshot")).toBeInTheDocument();
    expect(screen.getByText(/live navs from official sebi \/ amfi/i)).toBeInTheDocument();

    // Import CAS Statement button in header
    expect(
      screen.getAllByRole("button", { name: /import cas statement/i })[0],
    ).toBeInTheDocument();

    // Add Mutual Fund button in header
    expect(
      screen.getAllByRole("button", { name: /add mutual fund/i })[0],
    ).toBeInTheDocument();

    // Nominee notes
    expect(screen.getByText("Nominee & Emergency Guidance Notes")).toBeInTheDocument();
    expect(screen.getByText("Savitri Sharma")).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens Add Bank Account dialog when Add Bank Account is clicked, passing axe", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AccountsPage />, { route: "/accounts" });

    const addBankBtn = screen.getAllByRole("button", { name: /add bank account/i })[0]!;
    await user.click(addBankBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /add bank account/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^account number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm account number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ifsc code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save bank account/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens CAS Auto-Import dialog when Import CAS Statement is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AccountsPage />, { route: "/accounts" });

    const importCasBtn = screen.getAllByRole("button", { name: /import cas statement/i })[0]!;
    await user.click(importCasBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /auto-import cas statement/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/upload your cdsl, nsdl, cams/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pdf password/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens Add Mutual Fund dialog when Add Mutual Fund is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AccountsPage />, { route: "/accounts" });

    const addBtn = screen.getAllByRole("button", { name: /add mutual fund/i })[0]!;
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText("Add SEBI Mutual Fund")).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("allows editing and saving Nominee & Emergency Guidance Notes, persisting updated details", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AccountsPage />, { route: "/accounts" });

    // Initial state
    expect(screen.getByText("Nominee & Emergency Guidance Notes")).toBeInTheDocument();
    expect(await screen.findByText("Savitri Sharma")).toBeInTheDocument();

    // Click Edit Notes
    const editBtn = screen.getByRole("button", { name: /edit notes/i });
    await user.click(editBtn);

    // Edit fields
    const nameInput = screen.getByLabelText(/nominee full name/i);
    const relInput = screen.getByLabelText(/relationship/i);
    const shareInput = screen.getByLabelText(/nomination share/i);
    const notesInput = screen.getByLabelText(/emergency notes for family/i);

    await user.clear(nameInput);
    await user.type(nameInput, "Anita Sharma");

    await user.clear(relInput);
    await user.type(relInput, "Spouse");

    await user.clear(shareInput);
    await user.type(shareInput, "50%");

    await user.clear(notesInput);
    await user.type(notesInput, "Contact ICICI AMC directly with death certificate.");

    // Click Save Notes
    const saveBtn = screen.getByRole("button", { name: /save notes/i });
    await user.click(saveBtn);

    // Verify updated values displayed in read mode
    await waitFor(() => {
      expect(screen.getByText("Anita Sharma")).toBeInTheDocument();
      expect(screen.getByText("Spouse")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
      expect(
        screen.getByText("Contact ICICI AMC directly with death certificate."),
      ).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

