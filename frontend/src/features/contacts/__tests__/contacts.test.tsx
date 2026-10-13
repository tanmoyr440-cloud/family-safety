import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { makeContact } from "@/shared/testing/factories";
import { ContactsPage } from "../pages/ContactsPage";
import { VerifyContactPage } from "../pages/VerifyContactPage";

describe("Contacts Feature (Phase 5)", () => {
  it("renders contact list with masked phone, relation badge, and verified status, passing axe", async () => {
    server.use(
      http.get(new RegExp("/api/v1/contacts$"), () => {
        return HttpResponse.json([
          makeContact({
            id: "ct_1",
            name: "Sunita Sharma",
            relation: "mother",
            phone: "+919876543210",
            email: "sunita@example.com",
            priority: 1,
            consent: "VERIFIED",
            consent_verified_at: "2026-03-01T12:00:00Z",
          }),
        ]);
      }),
    );

    const { container } = renderWithProviders(<ContactsPage />, { route: "/contacts" });

    expect(
      screen.getByRole("heading", { level: 1, name: /trusted contacts/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Sunita Sharma")).toBeInTheDocument();
    });

    expect(screen.getByText(/mother/i)).toBeInTheDocument();
    expect(screen.getByText("+91 98*** **210")).toBeInTheDocument();
    expect(screen.getByText("sunita@example.com")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("validates add contact form: rejects invalid phone and submits valid +91 phone", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(new RegExp("/api/v1/contacts$"), () => {
        return HttpResponse.json([]);
      }),
    );

    const { container } = renderWithProviders(<ContactsPage />, { route: "/contacts" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add your first contact/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add your first contact/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/add trusted contact/i)).toBeInTheDocument();

    // Fill invalid phone
    const nameInput = within(dialog).getByLabelText(/full name/i);
    const phoneInput = within(dialog).getByLabelText(/mobile phone number/i);
    const emailInput = within(dialog).getByLabelText(/email address/i);

    await user.type(nameInput, "Amit Kumar");
    await user.type(phoneInput, "12345"); // invalid phone
    await user.type(emailInput, "amit@example.com");

    const submitBtn = within(dialog).getByRole("button", { name: /^add contact$/i });
    await user.click(submitBtn);

    expect(
      await within(dialog).findByText(
        /enter a valid 10-digit mobile number or international phone/i,
      ),
    ).toBeInTheDocument();

    // Fix phone with standard 10 digit
    await user.clear(phoneInput);
    await user.type(phoneInput, "9876543210");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows resend button for PENDING consent and explanation with NO resend for OPTED_OUT", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(new RegExp("/api/v1/contacts$"), () => {
        return HttpResponse.json([
          makeContact({
            id: "ct_pending",
            name: "Rohit Sharma",
            consent: "PENDING",
            phone: "+919876543212",
          }),
          makeContact({
            id: "ct_opted_out",
            name: "Kavita Devi",
            consent: "OPTED_OUT",
            phone: "+919876543213",
          }),
        ]);
      }),
    );

    const { container } = renderWithProviders(<ContactsPage />, { route: "/contacts" });

    await waitFor(() => {
      expect(screen.getByText("Rohit Sharma")).toBeInTheDocument();
      expect(screen.getByText("Kavita Devi")).toBeInTheDocument();
    });

    // PENDING has resend button
    const resendBtn = screen.getByRole("button", { name: /resend otp/i });
    expect(resendBtn).toBeInTheDocument();

    await user.click(resendBtn);
    await waitFor(() => {
      expect(
        screen.getByText(/verification otp simulated|local test code is 123456/i),
      ).toBeInTheDocument();
    });

    // OPTED_OUT has notice and NO resend button
    expect(screen.getByText(/contact opted out:/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /resend otp/i })).toHaveLength(1);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("displays high-urgency warning dialog when removing the LAST verified contact", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(new RegExp("/api/v1/contacts$"), () => {
        return HttpResponse.json([
          makeContact({
            id: "ct_sole_verified",
            name: "Father (Sole Verified)",
            consent: "VERIFIED",
          }),
          makeContact({
            id: "ct_unverified",
            name: "Brother (Pending)",
            consent: "PENDING",
          }),
        ]);
      }),
    );

    const { container } = renderWithProviders(<ContactsPage />, { route: "/contacts" });

    await waitFor(() => {
      expect(screen.getByText("Father (Sole Verified)")).toBeInTheDocument();
    });

    const removeBtns = screen.getAllByRole("button", { name: /remove/i });
    // Click remove on the sole verified contact
    await user.click(removeBtns[0]!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/remove last verified contact\?/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/warning: emergency alerts will not reach anyone!/i),
    ).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole("button", { name: /remove anyway/i });
    expect(confirmBtn).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("parent-facing /verify-contact page accepts OTP and confirms consent, with opt-out option", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<VerifyContactPage />, {
      route: "/verify-contact/tok_sample_123",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: /family safety net/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/confirm your contact consent/i)).toBeInTheDocument();

    // Check plain language explanation
    expect(
      screen.getByText(/you were added as a trusted emergency contact on family safety net/i),
    ).toBeInTheDocument();

    const otpInput = screen.getByLabelText(/enter the 6-digit otp/i);
    await user.type(otpInput, "123456");

    const confirmBtn = screen.getByRole("button", { name: /confirm consent/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/contact details verified/i)).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("parent-facing /verify-contact allows opt-out flow", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<VerifyContactPage />, {
      route: "/verify-contact/tok_sample_456",
    });

    await waitFor(() => {
      expect(screen.getByText(/i do not wish to be an emergency contact/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/i do not wish to be an emergency contact/i));

    const optOutBtn = screen.getByRole("button", { name: /confirm opt-out/i });
    await user.click(optOutBtn);

    await waitFor(() => {
      expect(screen.getByText(/you have opted out/i)).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
