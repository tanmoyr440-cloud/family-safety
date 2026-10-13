import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { makePublicPacketOtpVerify } from "@/shared/testing/factories";
import { PublicPacketPage } from "../pages/PublicPacketPage";

describe("Public Packet Feature (Phase 8)", () => {
  it("completes parent verification flow: requests OTP, verifies, displays calm packet, passes axe", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <PublicPacketPage tokenOverride="tok_sample_valid" />,
      { route: "/p/tok_sample_valid" },
    );

    // 1. Initial Pre-OTP View
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /emergency guidance for tanmoy sharma's family/i,
        }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("+91 98*** **211")).toBeInTheDocument();
    expect(
      screen.getByText(/tanmoy sharma configured you as their trusted emergency contact/i),
    ).toBeInTheDocument();

    const sendCodeBtn = screen.getByRole("button", { name: /send me a code/i });
    expect(sendCodeBtn).toBeInTheDocument();

    // Check axe on pre-OTP view
    expect(await axe(container)).toHaveNoViolations();

    // 2. Click Send me a code
    await user.click(sendCodeBtn);

    const otpInput = await screen.findByLabelText(/one-time verification code/i);
    expect(otpInput).toBeInTheDocument();

    // 3. Enter valid OTP
    await user.type(otpInput, "123456");

    const viewPacketBtn = screen.getByRole("button", { name: /view emergency packet/i });
    await user.click(viewPacketBtn);

    // 4. Emergency Packet Content Rendered
    await waitFor(() => {
      expect(screen.getByText(/groww investment records/i)).toBeInTheDocument();
    });

    // Overview & First Steps
    expect(screen.getByText(/what happened\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/we haven't been able to confirm tanmoy sharma is okay/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/please try to reach tanmoy sharma by phone first/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /all designated primary family contacts have been sent this notice so you can coordinate together/i,
      ),
    ).toBeInTheDocument();

    // Groww Investment Records
    expect(screen.getByText("XXXX5678")).toBeInTheDocument();

    // Mandatory Institutional Disclaimer & No Fund Access
    expect(
      screen.getByText(
        /claim requirements can change\. please confirm directly with the respective financial institutions\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /parents and trusted contacts cannot withdraw or claim funds through this packet/i,
      ),
    ).toBeInTheDocument();

    // Loan Obligations
    expect(screen.getByText(/active loan obligations/i)).toBeInTheDocument();
    expect(screen.getByText("₹16,166")).toBeInTheDocument();
    expect(screen.getByText("carloan@hdfc")).toBeInTheDocument();

    // Encrypted Emergency Documents
    expect(screen.getByText(/encrypted emergency documents/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();

    // Institutional Support
    expect(screen.getByText(/groww customer support/i)).toBeInTheDocument();
    expect(screen.getByText(/\+91 910 880 0604/)).toBeInTheDocument();

    // Print Button
    expect(screen.getByRole("button", { name: /print \/ save pdf/i })).toBeInTheDocument();

    // Full Page Accessibility check
    expect(await axe(container)).toHaveNoViolations();
  }, 15000);

  it("enforces calm copy guidelines: forbids 'missing' and 'danger', forbids fund access promises", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<PublicPacketPage tokenOverride="tok_copy_audit" />, {
      route: "/p/tok_copy_audit",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send me a code/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /send me a code/i }));

    const otpInput = await screen.findByLabelText(/one-time verification code/i);
    await user.type(otpInput, "123456");
    await user.click(screen.getByRole("button", { name: /view emergency packet/i }));

    await waitFor(() => {
      expect(screen.getByText(/groww investment records/i)).toBeInTheDocument();
    });

    const bodyText = container.textContent || "";

    // 1. Must NOT use alarmist words like "missing" or "danger"
    expect(bodyText.toLowerCase()).not.toContain("missing");
    expect(bodyText.toLowerCase()).not.toContain("danger");

    // 2. Must use calm, factual phrasing
    expect(bodyText).toContain("We haven't been able to confirm Tanmoy Sharma is okay");
    expect(bodyText).toContain("Please try to reach Tanmoy Sharma by phone first");

    // 3. Must NEVER imply parents can withdraw or access funds
    expect(bodyText.toLowerCase()).not.toContain("withdraw funds directly");
    expect(bodyText.toLowerCase()).not.toContain("claim funds directly");
    expect(bodyText).toContain(
      "Parents and trusted contacts cannot withdraw or claim funds through this packet",
    );

    // 4. Must include institutional disclaimer
    expect(bodyText).toContain(
      "Claim requirements can change. Please confirm directly with the respective financial institutions.",
    );
  });

  it("handles invalid or revoked packet token cleanly and passes axe", async () => {
    const { container } = renderWithProviders(<PublicPacketPage tokenOverride="invalid-token" />, {
      route: "/p/invalid-token",
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /unable to access emergency packet/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/this emergency packet link is invalid or has been revoked/i),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles expired packet token cleanly and passes axe", async () => {
    const { container } = renderWithProviders(<PublicPacketPage tokenOverride="expired-token" />, {
      route: "/p/expired-token",
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /unable to access emergency packet/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/this emergency packet link has expired/i)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles wrong OTP and temporary lockout error states", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicPacketPage tokenOverride="tok_otp_test" />, {
      route: "/p/tok_otp_test",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send me a code/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /send me a code/i }));

    const otpInput = await screen.findByLabelText(/one-time verification code/i);

    // 1. Wrong OTP (e.g. 999999)
    await user.type(otpInput, "999999");
    await user.click(screen.getByRole("button", { name: /view emergency packet/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/the verification code is incorrect\. please check and try again\./i),
      ).toBeInTheDocument();
    });

    // 2. Lockout code (000000 triggers 429 OTP_LOCKED_OUT)
    await user.clear(otpInput);
    await user.type(otpInput, "000000");
    await user.click(screen.getByRole("button", { name: /view emergency packet/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /too many failed attempts\. for your security, access is temporarily locked for 15 minutes\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("handles session expiry mid-read with non-destructive in-place re-verification modal", async () => {
    const user = userEvent.setup();

    // Start with a session token that triggers 401 SESSION_EXPIRED
    server.use(
      http.post(new RegExp("/api/v1/public/packet/(?<token>[^/]+)/otp/verify$"), () => {
        return HttpResponse.json(
          makePublicPacketOtpVerify({ session_token: "expired_session_123" }),
        );
      }),
    );

    const { container } = renderWithProviders(
      <PublicPacketPage tokenOverride="tok_session_exp" />,
      { route: "/p/tok_session_exp" },
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send me a code/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /send me a code/i }));

    const otpInput = await screen.findByLabelText(/one-time verification code/i);
    await user.type(otpInput, "123456");
    await user.click(screen.getByRole("button", { name: /view emergency packet/i }));

    // Session Expired modal should open automatically
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /session expired/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /emergency packet sessions expire automatically after 15 minutes of activity/i,
      ),
    ).toBeInTheDocument();

    // Check axe on modal state
    expect(await axe(container)).toHaveNoViolations();

    // Re-verify in place: update handler to return valid session
    server.use(
      http.post(new RegExp("/api/v1/public/packet/(?<token>[^/]+)/otp/verify$"), () => {
        return HttpResponse.json(
          makePublicPacketOtpVerify({ session_token: "renewed_session_456" }),
        );
      }),
    );

    const sendCodeModalBtn = screen.getByRole("button", { name: /send verification code/i });
    await user.click(sendCodeModalBtn);

    const modalOtpInput = await screen.findByLabelText(/enter 6-digit code/i);
    await user.type(modalOtpInput, "123456");

    const continueReadingBtn = screen.getByRole("button", { name: /continue reading/i });
    await user.click(continueReadingBtn);

    // Modal closes and packet is displayed
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /session expired/i })).not.toBeInTheDocument();
      expect(screen.getByText(/groww investment records/i)).toBeInTheDocument();
    });
  });

  it("triggers window.print when print button is clicked", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderWithProviders(<PublicPacketPage tokenOverride="tok_print_test" />, {
      route: "/p/tok_print_test",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send me a code/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /send me a code/i }));

    const otpInput = await screen.findByLabelText(/one-time verification code/i);
    await user.type(otpInput, "123456");
    await user.click(screen.getByRole("button", { name: /view emergency packet/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /print \/ save pdf/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /print \/ save pdf/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);

    printSpy.mockRestore();
  });
});
