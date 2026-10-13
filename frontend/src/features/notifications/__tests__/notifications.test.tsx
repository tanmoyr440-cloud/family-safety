import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { NotificationsPage } from "../pages/NotificationsPage";
import {
  makeNotificationItem,
  makePacketPreview,
  makePacketShare,
  makeContact,
  makeLoan,
  makeDocument,
} from "@/shared/testing/factories";

describe("Notifications & Preview Feature (Phase 7)", () => {
  it("renders delivery log table with filters and passes axe accessibility", async () => {
    const notifications = [
      makeNotificationItem({
        id: "notif_1",
        recipient_label: "Father (+91 98765 43210)",
        channel: "SMS",
        template: "inactivity_notify_parents_sms",
        status: "DELIVERED",
        attempts: 1,
      }),
      makeNotificationItem({
        id: "notif_2",
        recipient_label: "Mother (mother@example.com)",
        channel: "EMAIL",
        template: "loan_missed_notify_parents_email",
        status: "SENT",
        attempts: 1,
      }),
    ];

    server.use(
      http.get(new RegExp("/api/v1/notifications"), () => {
        return HttpResponse.json(notifications);
      }),
    );

    const { container } = renderWithProviders(<NotificationsPage />, {
      route: "/notifications",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: /emergency notifications & preview/i }),
    ).toBeInTheDocument();

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(within(table).getByText("Father (+91 98765 43210)")).toBeInTheDocument();
    });

    expect(within(table).getByText("Mother (mother@example.com)")).toBeInTheDocument();
    expect(within(table).getByText("90-Day Emergency Alert (SMS)")).toBeInTheDocument();
    expect(within(table).getByText("Car Loan Missed Alert (Email)")).toBeInTheDocument();
    expect(within(table).getByText("DELIVERED")).toBeInTheDocument();
    expect(within(table).getByText("SENT")).toBeInTheDocument();

    // Verify axe accessibility
    expect(await axe(container)).toHaveNoViolations();
  });

  it("filters notification log by channel, status, and search query", async () => {
    const user = userEvent.setup();
    const notifications = [
      makeNotificationItem({
        id: "notif_sms",
        recipient_label: "Father (+91 98765 43210)",
        channel: "SMS",
        template: "inactivity_notify_parents_sms",
        status: "DELIVERED",
      }),
      makeNotificationItem({
        id: "notif_email",
        recipient_label: "Sister (sister@example.com)",
        channel: "EMAIL",
        template: "loan_missed_notify_parents_email",
        status: "QUEUED",
      }),
    ];

    server.use(
      http.get(new RegExp("/api/v1/notifications"), () => {
        return HttpResponse.json(notifications);
      }),
    );

    renderWithProviders(<NotificationsPage />, { route: "/notifications" });

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(within(table).getByText("Father (+91 98765 43210)")).toBeInTheDocument();
    });
    expect(within(table).getByText("Sister (sister@example.com)")).toBeInTheDocument();

    // Filter by channel: EMAIL
    const channelSelect = screen.getByLabelText(/filter by delivery channel/i);
    await user.selectOptions(channelSelect, "EMAIL");

    expect(within(table).queryByText("Father (+91 98765 43210)")).not.toBeInTheDocument();
    expect(within(table).getByText("Sister (sister@example.com)")).toBeInTheDocument();

    // Reset channel to ALL, then filter by search query
    await user.selectOptions(channelSelect, "ALL");
    const searchInput = screen.getByLabelText(/search notifications/i);
    await user.type(searchInput, "Father");

    expect(within(table).getByText("Father (+91 98765 43210)")).toBeInTheDocument();
    expect(within(table).queryByText("Sister (sister@example.com)")).not.toBeInTheDocument();
  });

  it("displays plain language retry explanation and link to fix contact for DEAD notifications", async () => {
    const deadNotification = makeNotificationItem({
      id: "notif_dead",
      recipient_label: "Uncle (+91 98765 00000)",
      channel: "SMS",
      template: "inactivity_notify_parents_sms",
      status: "DEAD",
      attempts: 3,
      error_code: "CARRIER_UNREACHABLE",
    });

    server.use(
      http.get(new RegExp("/api/v1/notifications"), () => {
        return HttpResponse.json([deadNotification]);
      }),
    );

    renderWithProviders(<NotificationsPage />, { route: "/notifications" });

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(within(table).getByText("Uncle (+91 98765 00000)")).toBeInTheDocument();
    });

    expect(within(table).getByText("DEAD")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /carrier reported carrier_unreachable\. message could not be reached after 3 tries\./i,
      )[0],
    ).toBeInTheDocument();

    // Check link to contacts
    const fixContactLinks = screen.getAllByRole("link", { name: /fix contact in contacts/i });
    expect(fixContactLinks[0]).toHaveAttribute("href", "/contacts");
  });

  it("renders Preview-as-Parent with safety banner, SMS, Email, and Packet tabs passing axe", async () => {
    const user = userEvent.setup();
    const testContact = makeContact({
      id: "ct_parent_1",
      name: "Ramesh Sharma",
      relation: "father",
      phone: "+919876543210",
      email: "ramesh@example.com",
    });

    const testPreview = makePacketPreview({
      owner_name: "Tanmoy Sharma",
      days_idle: 92,
      loans: [
        makeLoan({
          id: "loan_1",
          lender: "HDFC Bank",
          emi_paise: 1616600,
          due_day: 24,
          account_masked: "XXXX1234",
          payment_instructions: {
            upi_id: "carloan@hdfc",
            portal_url: "https://netbanking.hdfcbank.com",
            notes: null,
          },
        }),
      ],
      documents: [
        makeDocument({
          id: "doc_1",
          title: "Vehicle Registration & Insurance",
        }),
      ],
    });

    server.use(
      http.get(new RegExp("/api/v1/contacts"), () => {
        return HttpResponse.json([testContact]);
      }),
      http.get(new RegExp("/api/v1/packet/preview"), () => {
        return HttpResponse.json(testPreview);
      }),
    );

    const { container } = renderWithProviders(<NotificationsPage />, {
      route: "/notifications",
    });

    // Switch to Preview as Parent tab
    const previewTab = screen.getByRole("tab", { name: /preview as parent/i });
    await user.click(previewTab);

    // Verify prominent banner
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /preview, nothing has been sent/i }),
      ).toBeInTheDocument();
    });

    // SMS tab (default channel tab) - wait for preview data
    await waitFor(() => {
      expect(screen.getByText("FAMILY-NET")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/we have not heard from tanmoy sharma in 92 days/i),
    ).toBeInTheDocument();

    // Switch to Email tab
    const emailTab = screen.getByRole("tab", { name: /^email$/i });
    await user.click(emailTab);

    await waitFor(() => {
      expect(
        screen.getByText(/important: please check on tanmoy sharma — family safety net notice/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { level: 3, name: /dear ramesh sharma,/i }),
    ).toBeInTheDocument();

    // Switch to Packet page tab
    const packetTab = screen.getByRole("tab", { name: /packet page/i });
    await user.click(packetTab);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: /emergency guidance for ramesh sharma/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("HDFC Bank")).toBeInTheDocument();
    expect(screen.getByText("Vehicle Registration & Insurance")).toBeInTheDocument();

    // Mandatory institutional disclaimer (never promise fund access)
    expect(
      screen.getByText(
        /claim requirements can change\. please confirm directly with the respective financial institutions\./i,
      ),
    ).toBeInTheDocument();

    // Axe accessibility verification
    expect(await axe(container)).toHaveNoViolations();
  });

  it("manages active packet shares with creation and revocation modal", async () => {
    const user = userEvent.setup();
    const testContact = makeContact({
      id: "ct_share_test",
      name: "Savitri Sharma",
      relation: "mother",
    });

    const activeShare = makePacketShare({
      id: "share_active_1",
      contact_id: testContact.id,
      contact_name: "Savitri Sharma",
      token: "tok_secret_share_abc",
      revoked: false,
      expires_at: "2026-11-01T00:00:00Z",
    });

    server.use(
      http.get(new RegExp("/api/v1/contacts"), () => {
        return HttpResponse.json([testContact]);
      }),
      http.get(new RegExp("/api/v1/packet/shares$"), () => {
        return HttpResponse.json([activeShare]);
      }),
    );

    const { container } = renderWithProviders(<NotificationsPage />, {
      route: "/notifications",
    });

    // Switch to Active Packet Shares tab
    const sharesTab = screen.getByRole("tab", { name: /active packet shares/i });
    await user.click(sharesTab);

    await waitFor(() => {
      expect(screen.getByText("Savitri Sharma")).toBeInTheDocument();
    });

    expect(screen.getByText("Active Link")).toBeInTheDocument();
    expect(screen.getByText(/\/p\/tok_secr\.\.\./i)).toBeInTheDocument();

    // Axe test on shares tab
    expect(await axe(container)).toHaveNoViolations();

    // Click Revoke Access
    const revokeBtn = screen.getByRole("button", { name: /revoke access/i });
    await user.click(revokeBtn);

    // Dialog appears
    await waitFor(() => {
      expect(screen.getByText(/revoke packet access\?/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/are you sure you want to revoke the emergency packet link issued to/i),
    ).toBeInTheDocument();

    // Confirm revocation
    const confirmRevokeBtn = screen.getByRole("button", { name: /^revoke access$/i });
    await user.click(confirmRevokeBtn);

    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByText(/revoke packet access\?/i)).not.toBeInTheDocument();
    });
  });

  it("opens Send Emergency Alert modal and dispatches alert email with attached documents", async () => {
    const user = userEvent.setup();
    const testContact = makeContact({
      id: "ct_primary_1",
      name: "Ramesh Sharma",
      relation: "father",
      phone: "+919876543210",
      email: "ramesh@example.com",
      consent: "VERIFIED",
    });

    server.use(
      http.get(new RegExp("/api/v1/contacts"), () => {
        return HttpResponse.json([testContact]);
      }),
      http.post(new RegExp("/api/v1/notifications/send-emergency-alert"), async () => {
        return HttpResponse.json({
          status: "SENT",
          recipient: "ramesh@example.com",
          channel: "EMAIL",
          subject: "Emergency Alert & Verified Financial Dossier: Tanmoy Sharma",
          message_id: "msg_test_alert_999",
          attached_documents: ["aadhaar_card.pdf", "car_loan_agreement.pdf"],
          total_holdings: 2,
          total_loans: 1,
          total_bank_accounts: 2,
        });
      }),
    );

    const { container } = renderWithProviders(<NotificationsPage />, {
      route: "/notifications",
    });

    // 1. Click 'Send Emergency Alert Email' button
    const openAlertBtn = screen.getByRole("button", { name: /send emergency alert email/i });
    await user.click(openAlertBtn);

    // 2. Verify modal opened
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /send emergency alert email/i }),
      ).toBeInTheDocument();
    });

    // Verify overview notice contents
    expect(
      screen.getByText(/what will be included in this emergency email:/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/groww\/cas portfolio with folios/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly emi of ₹16,166 due on 24th/i)).toBeInTheDocument();
    expect(
      screen.getByText(/all uploaded emergency documents \(aadhaar, loan agreement, insurance\)/i),
    ).toBeInTheDocument();

    // Verify axe accessibility with open dialog
    expect(await axe(container)).toHaveNoViolations();

    // 3. Click 'Send Alert Email with Attachments'
    const sendBtn = screen.getByRole("button", { name: /send alert email with attachments/i });
    await user.click(sendBtn);

    // 4. Verify success state rendered
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: /emergency alert dispatched successfully/i,
        }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("aadhaar_card.pdf")).toBeInTheDocument();
    expect(screen.getByText("car_loan_agreement.pdf")).toBeInTheDocument();
    expect(
      screen.getByText(/2 mutual funds • 1 loans • 2 bank accounts/i),
    ).toBeInTheDocument();

    // 5. Click Done
    const doneBtn = screen.getByRole("button", { name: /done/i });
    await user.click(doneBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          level: 3,
          name: /emergency alert dispatched successfully/i,
        }),
      ).not.toBeInTheDocument();
    });
  });
});
