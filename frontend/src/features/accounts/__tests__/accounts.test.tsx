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

    // Initial state: clean empty state with no hardcoded dummy data
    expect(screen.getByText("Nominee & Emergency Guidance Notes")).toBeInTheDocument();
    expect(await screen.findByText(/no nominees registered yet/i)).toBeInTheDocument();

    // Click Add Nominees
    const addBtn = screen.getByRole("button", { name: /add nominees/i });
    await user.click(addBtn);

    // Edit fields
    const nameInput = screen.getByLabelText(/nominee 1 full name/i);
    const relInput = screen.getAllByLabelText(/relationship/i)[0]!;
    const shareInput = screen.getAllByLabelText(/share/i)[0]!;
    const notesInput = screen.getByLabelText(/emergency instructions/i);

    await user.type(nameInput, "Anita Sharma");
    await user.clear(relInput);
    await user.type(relInput, "Spouse");
    await user.clear(shareInput);
    await user.type(shareInput, "50%");

    // Add a second nominee
    const addNomineeBtn = screen.getByRole("button", { name: /add nominee/i });
    await user.click(addNomineeBtn);

    const nameInput2 = screen.getByLabelText(/nominee 2 full name/i);
    await user.type(nameInput2, "Rohan Sharma");

    const relInput2 = screen.getAllByLabelText(/relationship/i)[1]!;
    await user.type(relInput2, "Son");

    await user.clear(notesInput);
    await user.type(notesInput, "Contact ICICI AMC directly with death certificate.");

    // Click Save Nominees & Guidance
    const saveBtn = screen.getByRole("button", { name: /save nominees & guidance/i });
    await user.click(saveBtn);

    // Verify updated values displayed in read mode
    await waitFor(() => {
      expect(screen.getByText("Anita Sharma")).toBeInTheDocument();
      expect(screen.getByText("Rohan Sharma")).toBeInTheDocument();
      expect(screen.getByText("Spouse")).toBeInTheDocument();
      expect(screen.getByText("Son")).toBeInTheDocument();
      expect(screen.getAllByText("50%")).toHaveLength(2);
      expect(
        screen.getByText("Contact ICICI AMC directly with death certificate."),
      ).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("allows removing an individual mutual fund holding with confirmation dialog", async () => {
    const { http, HttpResponse } = await import("msw");
    const { server } = await import("@/shared/testing/setup");

    let holdings = [
      {
        id: "mf-test-1",
        scheme_code: 122639,
        scheme_name: "Parag Parikh Flexi Cap Fund",
        fund_house: "PPFAS Mutual Fund",
        units: 50.0,
        folio_masked: "XXXX5678",
        latest_nav: 85.5,
        nav_date: "14-Oct-2026",
        value_paise: 427500,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    server.use(
      http.get(new RegExp("/api/v1/mutual-funds/holdings$"), () => {
        return HttpResponse.json(holdings);
      }),
      http.delete(new RegExp("/api/v1/mutual-funds/holdings/(?<id>[^/]+)$"), ({ params }) => {
        holdings = holdings.filter((h) => h.id !== params.id);
        return HttpResponse.json({ message: "Mutual fund holding removed successfully." });
      }),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<AccountsPage />, { route: "/accounts" });

    // Verify holding is listed
    expect(await screen.findByText("Parag Parikh Flexi Cap Fund")).toBeInTheDocument();
    expect(screen.getByText("Folio: XXXX5678")).toBeInTheDocument();

    // Click trash button on the row
    const deleteBtn = screen.getByRole("button", { name: /remove parag parikh flexi cap fund/i });
    await user.click(deleteBtn);

    // Verify confirmation dialog opens
    expect(await screen.findByRole("heading", { name: /remove mutual fund holding\?/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to remove "parag parikh flexi cap fund"/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: /^remove holding$/i });
    await user.click(confirmBtn);

    // Verify success banner and holding is removed
    await waitFor(() => {
      expect(screen.getByText(/removed "parag parikh flexi cap fund" from portfolio/i)).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("allows clearing all portfolio holdings snapshot data with confirmation dialog", async () => {
    const { http, HttpResponse } = await import("msw");
    const { server } = await import("@/shared/testing/setup");

    let holdings = [
      {
        id: "mf-test-1",
        scheme_code: 122639,
        scheme_name: "Parag Parikh Flexi Cap Fund",
        fund_house: "PPFAS Mutual Fund",
        units: 50.0,
        folio_masked: "XXXX5678",
        latest_nav: 85.5,
        nav_date: "14-Oct-2026",
        value_paise: 427500,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    server.use(
      http.get(new RegExp("/api/v1/mutual-funds/holdings$"), () => {
        return HttpResponse.json(holdings);
      }),
      http.delete(new RegExp("/api/v1/mutual-funds/holdings$"), () => {
        holdings = [];
        return HttpResponse.json({ message: "Successfully removed all portfolio holdings." });
      }),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<AccountsPage />, { route: "/accounts" });

    // Verify holding is present and Clear All button is visible in header
    expect(await screen.findByText("Parag Parikh Flexi Cap Fund")).toBeInTheDocument();
    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });
    await user.click(clearAllBtn);

    // Verify confirmation dialog
    expect(await screen.findByRole("heading", { name: /clear portfolio holdings snapshot\?/i })).toBeInTheDocument();
    expect(screen.getByText(/this will delete all 1 mutual fund holdings/i)).toBeInTheDocument();

    // Confirm clear all
    const confirmClearBtn = screen.getByRole("button", { name: /clear all data/i });
    await user.click(confirmClearBtn);

    // Verify success banner and empty state displayed
    await waitFor(() => {
      expect(screen.getByText(/all portfolio holdings snapshot data cleared successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/no mutual fund holdings added yet/i)).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});


