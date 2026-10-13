/**
 * Typed model factories for MSW mock handlers and test fixtures.
 * All shapes adhere strictly to the generated OpenAPI schema types.
 */

import type { components } from "@/shared/api/schema";

export type OwnerResponse = components["schemas"]["OwnerResponse"];
export type MonitorStatusResponse = components["schemas"]["MonitorStatusResponse"];
export type LoanResponse = components["schemas"]["LoanResponse"];
export type InstallmentResponse = components["schemas"]["InstallmentResponse"];
export type ContactResponse = components["schemas"]["ContactResponse"];
export type DocumentResponse = components["schemas"]["DocumentResponse"];
export type NotificationLogItemResponse = components["schemas"]["NotificationLogItemResponse"];
export type PacketPreviewResponse = components["schemas"]["PacketPreviewResponse"];
export type SchedulerHealthResponse = components["schemas"]["SchedulerHealthResponse"];

export function makeOwner(overrides?: Partial<OwnerResponse>): OwnerResponse {
  return {
    id: "usr_mock_001",
    name: "Tanmoy Sharma",
    email: "tanmoy@example.com",
    phone: "+919876543210",
    timezone: "Asia/Kolkata",
    mfa_enabled: false,
    monitoring_paused_until: null,
    ...overrides,
  };
}

export function makeMonitorStatus(
  overrides?: Partial<MonitorStatusResponse>,
): MonitorStatusResponse {
  return {
    status: "OK",
    last_activity_at: "2026-10-01T08:12:00+05:30",
    days_idle: 10,
    threshold_days: 90,
    warning_days: [60, 80],
    next_stage: {
      stage: "WARN_OWNER_1",
      at: "2026-11-30",
    },
    paused_until: null,
    scheduler_healthy: true,
    ...overrides,
  };
}

export function makeLoan(overrides?: Partial<LoanResponse>): LoanResponse {
  return {
    id: "loan_mock_001",
    lender: "HDFC Bank",
    account_masked: "XXXX1234",
    emi_paise: 1616600, // Rs 16,166
    due_day: 24,
    grace_days: 1,
    payment_instructions: {
      upi_id: "carloan@hdfc",
      portal_url: "https://netbanking.hdfcbank.com",
      notes: "Auto-debit from salary account",
    },
    next_due: {
      year_month: "2026-10",
      due_date: "2026-10-24",
      status: "UPCOMING",
    },
    ...overrides,
  };
}

export function makeInstallment(overrides?: Partial<InstallmentResponse>): InstallmentResponse {
  return {
    year_month: "2026-10",
    due_date: "2026-10-24",
    amount_paise: 1616600,
    status: "UPCOMING",
    paid_at: null,
    evidence: null,
    ...overrides,
  };
}

export function makeContact(overrides?: Partial<ContactResponse>): ContactResponse {
  return {
    id: "ct_mock_001",
    name: "Father",
    relation: "father",
    phone: "+919876543211",
    email: "father@example.com",
    priority: 1,
    consent: "VERIFIED",
    consent_verified_at: "2026-02-01T10:00:00Z",
    last_delivery: "DELIVERED",
    ...overrides,
  };
}

export function makeDocument(overrides?: Partial<DocumentResponse>): DocumentResponse {
  return {
    id: "doc_mock_001",
    title: "Car Loan Sanction Letter",
    category: "loan",
    filename: "car_loan_sanction.pdf",
    size_bytes: 245000,
    created_at: "2026-03-01T12:00:00Z",
    ...overrides,
  };
}

export function makeNotificationItem(
  overrides?: Partial<NotificationLogItemResponse>,
): NotificationLogItemResponse {
  return {
    id: "ntf_mock_001",
    channel: "SMS",
    recipient_label: "Father (+91XXXXXX3211)",
    template: "inactivity_warn_owner_1_sms",
    status: "DELIVERED",
    attempts: 1,
    queued_at: "2026-10-01T09:00:00Z",
    sent_at: "2026-10-01T09:00:05Z",
    error_code: null,
    ...overrides,
  };
}

export type BankAccountResponse = components["schemas"]["BankAccountResponse"];

export function makeBankAccount(overrides?: Partial<BankAccountResponse>): BankAccountResponse {
  return {
    id: "ba_mock_001",
    bank_name: "State Bank of India",
    account_number_masked: "XXXX9012",
    ifsc_code: "SBIN0001234",
    branch_name: "Koramangala Branch",
    account_type: "SAVINGS",
    holder_name: "Tanmoy Sharma",
    created_at: "2026-10-10T10:00:00Z",
    ...overrides,
  };
}

export function makePacketPreview(
  overrides?: Partial<PacketPreviewResponse>,
): PacketPreviewResponse {
  return {
    owner_name: "Tanmoy Sharma",
    days_idle: 92,
    holdings_summary: {
      holdings_count: 5,
      as_of: "2026-10-10",
    },
    loans: [makeLoan()],
    bank_accounts: [makeBankAccount()],
    documents: [makeDocument()],
    instructions: "Please contact the family lawyer and verify bank auto-debits.",
    ...overrides,
  };
}

export type PacketShareResponse = components["schemas"]["PacketShareResponse"];

export function makePacketShare(overrides?: Partial<PacketShareResponse>): PacketShareResponse {
  return {
    id: "share_mock_001",
    contact_id: "ct_mock_001",
    contact_name: "Father",
    token: "tok_share_mock_123",
    expires_at: "2026-10-25T12:00:00Z",
    created_at: "2026-10-11T10:00:00Z",
    revoked: false,
    ...overrides,
  };
}

export function makeSchedulerHealth(
  overrides?: Partial<SchedulerHealthResponse>,
): SchedulerHealthResponse {
  return {
    status: "ok",
    heartbeat_at: "2026-10-12T00:00:00Z",
    ...overrides,
  };
}

export type PublicPacketInfoResponse = components["schemas"]["PublicPacketInfoResponse"];
export type PublicPacketOtpVerifyResponse = components["schemas"]["PublicPacketOtpVerifyResponse"];

export function makePublicPacketInfo(
  overrides?: Partial<PublicPacketInfoResponse>,
): PublicPacketInfoResponse {
  return {
    owner_name: "Tanmoy Sharma",
    recipient_phone_masked: "+91 98*** **211",
    expires_at: "2026-10-25T12:00:00Z",
    ...overrides,
  };
}

export function makePublicPacketOtpVerify(
  overrides?: Partial<PublicPacketOtpVerifyResponse>,
): PublicPacketOtpVerifyResponse {
  return {
    session_token: "sess_packet_mock_abc123",
    expires_at: "2026-10-12T13:00:00Z",
    ...overrides,
  };
}

export type OwnerExportResponse = components["schemas"]["OwnerExportResponse"];

export function makeOwnerExport(overrides?: Partial<OwnerExportResponse>): OwnerExportResponse {
  return {
    owner: makeOwner(),
    monitor: makeMonitorStatus(),
    contacts: [makeContact()],
    loans: [makeLoan()],
    documents: [makeDocument()],
    exported_at: "2026-10-12T12:00:00Z",
    ...overrides,
  };
}
