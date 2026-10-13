import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { LoansPage } from "../pages/LoansPage";
import { makeLoan, makeInstallment } from "@/shared/testing/factories";

describe("Loans Feature (Phase 4)", () => {
  it("renders loading skeletons initially and has no accessibility violations", async () => {
    server.use(
      http.get(new RegExp("/api/v1/loans$"), async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json([makeLoan()]);
      }),
    );

    const { container } = renderWithProviders(<LoansPage />);

    expect(screen.getByRole("status", { name: /loading loans/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders empty state when no loan is configured and opens create form", async () => {
    server.use(
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json([]);
      }),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<LoansPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /no loan obligation configured/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /configure car loan/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    // Click configure car loan button to open create form
    await user.click(screen.getByRole("button", { name: /configure car loan/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /register car loan/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/lender \/ bank name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loan account number/i)).toBeInTheDocument();
  });

  it("renders loan details and installment timeline formatting paise in INR", async () => {
    server.use(
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json([
          makeLoan({
            lender: "HDFC Bank",
            account_masked: "XXXX5678",
            emi_paise: 1616600,
            due_day: 24,
            grace_days: 2,
          }),
        ]);
      }),
      http.get(new RegExp("/api/v1/loans/[^/]+/installments$"), () => {
        return HttpResponse.json([
          makeInstallment({
            year_month: "2026-10",
            due_date: "2026-10-24",
            amount_paise: 1616600,
            status: "UPCOMING",
          }),
          makeInstallment({
            year_month: "2026-09",
            due_date: "2026-09-24",
            amount_paise: 1616600,
            status: "PAID",
            paid_at: "2026-09-23T10:00:00+05:30",
            evidence: "UPI-REF-998877",
          }),
        ]);
      }),
    );

    const { container } = renderWithProviders(<LoansPage />);

    await waitFor(() => {
      expect(screen.getByText("HDFC Bank")).toBeInTheDocument();
    });

    expect(screen.getByText(/ending in xxxx5678/i)).toBeInTheDocument();
    // Money formatted with formatPaise (₹16,166)
    expect(screen.getAllByText("₹16,166").length).toBeGreaterThan(0);
    expect(screen.getByText(/day 24/i)).toBeInTheDocument();
    expect(screen.getByText(/\(\+2d grace\)/i)).toBeInTheDocument();

    // Timeline items
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "2026-10" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { level: 3, name: "2026-09" })).toBeInTheDocument();
    expect(screen.getByText(/ref: upi-ref-998877/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles 'I paid' flow with optional reference and note, and idempotently updates timeline", async () => {
    let markPaidCalls = 0;
    let submittedReference: string | null = null;

    server.use(
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json([
          makeLoan({
            id: "loan_1",
            emi_paise: 1616600,
          }),
        ]);
      }),
      http.get(new RegExp("/api/v1/loans/[^/]+/installments$"), () => {
        return HttpResponse.json([
          makeInstallment({
            year_month: "2026-10",
            due_date: "2026-10-24",
            amount_paise: 1616600,
            status: markPaidCalls > 0 ? "PAID" : "DUE",
            paid_at: markPaidCalls > 0 ? "2026-10-24T12:00:00+05:30" : null,
            evidence: submittedReference,
          }),
        ]);
      }),
      http.post(
        new RegExp("/api/v1/loans/(?<id>[^/]+)/installments/(?<yyyy_mm>[^/]+)/mark-paid$"),
        async ({ request }) => {
          markPaidCalls += 1;
          const body = (await request.json()) as { reference?: string; note?: string };
          submittedReference = body.reference || "Paid";
          return HttpResponse.json(
            makeInstallment({
              year_month: "2026-10",
              status: "PAID",
              paid_at: "2026-10-24T12:00:00+05:30",
              evidence: body.reference,
            }),
          );
        },
      ),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<LoansPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /mark paid/i })).toBeInTheDocument();
    });

    // 1. Open "I paid" dialog
    await user.click(screen.getByRole("button", { name: /mark paid/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /record emi payment/i })).toBeInTheDocument();
    });

    // 2. Fill reference & notes
    const refInput = screen.getByLabelText(/payment reference \/ utr/i);
    await user.type(refInput, "HDFC-UTR-445566");

    const noteInput = screen.getByLabelText(/payment notes/i);
    await user.type(noteInput, "Auto-debit from salary");

    // 3. Confirm payment
    await user.click(screen.getByRole("button", { name: /confirm payment/i }));

    await waitFor(() => {
      expect(screen.getByText(/payment recorded/i)).toBeInTheDocument();
    });

    expect(markPaidCalls).toBe(1);
    expect(submittedReference).toBe("HDFC-UTR-445566");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles MISSED installment state and resolves when paying late", async () => {
    let resolved = false;

    server.use(
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json([
          makeLoan({
            id: "loan_missed_test",
            lender: "ICICI Bank",
            emi_paise: 1616600,
          }),
        ]);
      }),
      http.get(new RegExp("/api/v1/loans/[^/]+/installments$"), () => {
        return HttpResponse.json([
          makeInstallment({
            year_month: "2026-09",
            due_date: "2026-09-24",
            amount_paise: 1616600,
            status: resolved ? "PAID" : "MISSED",
          }),
        ]);
      }),
      http.post(
        new RegExp("/api/v1/loans/(?<id>[^/]+)/installments/(?<yyyy_mm>[^/]+)/mark-paid$"),
        () => {
          resolved = true;
          return HttpResponse.json(
            makeInstallment({
              year_month: "2026-09",
              status: "PAID",
              paid_at: new Date().toISOString(),
            }),
          );
        },
      ),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<LoansPage />);

    // Check missed banner content
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /missed car loan emi alert sent to family/i,
        }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/what your family was told:/i)).toBeInTheDocument();

    const notifLink = screen.getByRole("link", {
      name: /view alert details in notification log/i,
    });
    expect(notifLink).toBeInTheDocument();
    expect(notifLink).toHaveAttribute("href", "/notifications");

    // Click "I paid late"
    const payLateBtns = screen.getAllByRole("button", { name: /i paid late/i });
    expect(payLateBtns.length).toBeGreaterThan(0);
    await user.click(payLateBtns[0]!);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /record emi payment/i })).toBeInTheDocument();
    });

    // Submit dialog without reference
    await user.click(screen.getByRole("button", { name: /confirm payment/i }));

    await waitFor(() => {
      expect(resolved).toBe(true);
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("validates edit form: rejects invalid due day and zero EMI, shows next installment notice", async () => {
    server.use(
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json([
          makeLoan({
            id: "loan_edit_1",
            lender: "SBI",
            emi_paise: 1616600,
            due_day: 24,
          }),
        ]);
      }),
      http.get(new RegExp("/api/v1/loans/[^/]+/installments$"), () => {
        return HttpResponse.json([]);
      }),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<LoansPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /edit loan/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /edit loan/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /edit loan details/i }),
      ).toBeInTheDocument();
    });

    // 1. Enter invalid due day (35 > 31)
    const dueDayInput = screen.getByLabelText(/monthly due day/i);
    await user.clear(dueDayInput);
    await user.type(dueDayInput, "35");

    // 2. Enter zero EMI
    const emiInput = screen.getByLabelText(/monthly emi \(₹\)/i);
    await user.clear(emiInput);
    await user.type(emiInput, "0");

    // Notice that changing due day/EMI triggered the inline note
    expect(screen.getByText(/this applies from the next installment\./i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    // Expect validation errors
    await waitFor(() => {
      expect(screen.getByText(/due day must be between 1 and 31/i)).toBeInTheDocument();
      expect(screen.getByText(/emi amount must be greater than zero/i)).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles server 422 errors and maps them to form fields", async () => {
    server.use(
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json([
          makeLoan({
            id: "loan_server_err",
            due_day: 24,
          }),
        ]);
      }),
      http.patch(new RegExp("/api/v1/loans/[^/]+$"), () => {
        return HttpResponse.json(
          {
            detail: [
              {
                loc: ["body", "due_day"],
                msg: "Due day exceeds bank calendar limit",
                type: "value_error",
              },
            ],
          },
          { status: 422 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<LoansPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /edit loan/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /edit loan/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/monthly due day/i)).toBeInTheDocument();
    });

    const dueDayInput = screen.getByLabelText(/monthly due day/i);
    await user.clear(dueDayInput);
    await user.type(dueDayInput, "28");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/due day exceeds bank calendar limit/i).length).toBeGreaterThan(0);
    });
  });

  it("renders error card with retry button on query failure and passes axe", async () => {
    server.use(
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json(
          { code: "NETWORK_ERROR", detail: "Failed to connect to loan database" },
          { status: 500 },
        );
      }),
    );

    const { container } = renderWithProviders(<LoansPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /unable to load loan details/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/failed to connect to loan database/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
