/**
 * MSW HTTP mock request handlers matching backend OpenAPI endpoints.
 */

import { http, HttpResponse } from "msw";
import {
  makeBankAccount,
  makeContact,
  makeDocument,
  makeInstallment,
  makeLoan,
  makeMonitorStatus,
  makeNotificationItem,
  makeOwner,
  makeOwnerExport,
  makePacketPreview,
  makePacketShare,
  makePublicPacketInfo,
  makePublicPacketOtpVerify,
  makeSchedulerHealth,
} from "./factories";

export const handlers = [
  // Auth current user
  http.get(new RegExp("/api/v1/me$"), () => {
    return HttpResponse.json(makeOwner());
  }),
  http.get(new RegExp("/api/v1/owner/me$"), () => {
    return HttpResponse.json(makeOwner());
  }),

  // Export owner data
  http.get(new RegExp("/api/v1/me/export$"), () => {
    return HttpResponse.json(makeOwnerExport());
  }),

  // Delete owner account
  http.delete(new RegExp("/api/v1/me$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Owner account deleted successfully",
    });
  }),

  // Auth login
  http.post(new RegExp("/api/v1/auth/login$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      mfa_code?: string;
    };
    if (body.email === "mfa@example.com" && !body.mfa_code) {
      return HttpResponse.json({
        owner: makeOwner({ email: "mfa@example.com", mfa_enabled: true }),
        csrf_token: "csrf_mock_token_123",
        mfa_required: true,
      });
    }
    if (body.password === "wrongpassword") {
      return HttpResponse.json(
        {
          code: "UNAUTHORIZED",
          detail: "Invalid credentials",
        },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      owner: makeOwner({ email: body.email || "tanmoy@example.com" }),
      csrf_token: "csrf_mock_token_123",
      mfa_required: false,
    });
  }),

  // Auth register
  http.post(new RegExp("/api/v1/auth/register$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      phone?: string;
    };
    return HttpResponse.json(
      makeOwner({
        name: body.name || "Tanmoy Sharma",
        email: body.email || "tanmoy@example.com",
        phone: body.phone || "+919876543210",
      }),
      { status: 201 },
    );
  }),

  // Auth logout
  http.post(new RegExp("/api/v1/auth/logout$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  }),

  // Auth session refresh
  http.post(new RegExp("/api/v1/auth/refresh$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Session token rotated",
    });
  }),

  // MFA enroll
  http.post(new RegExp("/api/v1/auth/mfa/enroll$"), () => {
    return HttpResponse.json({
      secret: "JBSWY3DPEHPK3PXP",
      otpauth_url:
        "otpauth://totp/FamilySafetyNet:tanmoy@example.com?secret=JBSWY3DPEHPK3PXP&issuer=FamilySafetyNet",
    });
  }),

  // MFA verify
  http.post(new RegExp("/api/v1/auth/mfa/verify$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { code?: string };
    if (body.code !== "123456") {
      return HttpResponse.json(
        { code: "INVALID_MFA_CODE", detail: "Invalid verification code" },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      success: true,
      message: "MFA enabled successfully",
    });
  }),

  // Monitor status
  http.get(new RegExp("/api/v1/monitor$"), () => {
    return HttpResponse.json(makeMonitorStatus());
  }),

  // Activity check-in
  http.post(new RegExp("/api/v1/activity/check-in$"), () => {
    return HttpResponse.json({
      success: true,
      recorded_at: new Date().toISOString(),
    });
  }),

  // Magic link check-in
  http.post(new RegExp("/api/v1/activity/check-in/link/(?<token>[^/]+)$"), ({ params }) => {
    const { token } = params as { token: string };
    if (token === "expired-token" || token === "invalid-token") {
      return HttpResponse.json(
        {
          code: "LINK_EXPIRED",
          detail: "This check-in link has expired or has already been used.",
        },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      success: true,
      recorded_at: new Date().toISOString(),
    });
  }),

  // Update monitor config (thresholds and warning days)
  http.put(new RegExp("/api/v1/monitor/config$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      threshold_days?: number;
      warning_days?: number[];
      parent_repeat_every_days?: number;
    };
    if (
      body.threshold_days &&
      body.warning_days &&
      body.warning_days.some((w) => w >= body.threshold_days!)
    ) {
      return HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          detail: "Warning days must be strictly less than threshold days",
        },
        { status: 422 },
      );
    }
    return HttpResponse.json({
      success: true,
      message: "Monitor configuration updated successfully",
    });
  }),

  // Pause monitor
  http.post(new RegExp("/api/v1/monitor/pause$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { until?: string };
    if (!body.until) {
      return HttpResponse.json(
        { code: "VALIDATION_ERROR", detail: "Until date is required" },
        { status: 422 },
      );
    }
    return HttpResponse.json({
      success: true,
      message: "Monitoring paused",
    });
  }),

  // Resume monitor
  http.delete(new RegExp("/api/v1/monitor/pause$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Monitoring resumed",
    });
  }),

  // Loans list
  http.get(new RegExp("/api/v1/loans$"), () => {
    return HttpResponse.json([makeLoan()]);
  }),

  // Create loan
  http.post(new RegExp("/api/v1/loans$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      lender?: string;
      account_number?: string;
      emi_paise?: number;
      due_day?: number;
      grace_days?: number;
      payment_instructions?: {
        upi_id?: string | null;
        portal_url?: string | null;
        notes?: string | null;
      };
    };
    return HttpResponse.json(
      makeLoan({
        id: "loan_new_123",
        lender: body.lender || "HDFC Bank",
        account_masked: body.account_number ? `XXXX${body.account_number.slice(-4)}` : "XXXX1234",
        emi_paise: body.emi_paise || 1616600,
        due_day: body.due_day || 24,
        grace_days: body.grace_days ?? 1,
        payment_instructions: body.payment_instructions || {
          upi_id: "carloan@hdfc",
          portal_url: "https://netbanking.hdfcbank.com",
          notes: null,
        },
      }),
      { status: 201 },
    );
  }),

  // Update loan
  http.patch(new RegExp("/api/v1/loans/(?<id>[^/]+)$"), async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json().catch(() => ({}))) as {
      lender?: string;
      emi_paise?: number;
      due_day?: number;
      grace_days?: number;
    };
    return HttpResponse.json(
      makeLoan({
        id,
        ...(body.lender ? { lender: body.lender } : {}),
        ...(body.emi_paise ? { emi_paise: body.emi_paise } : {}),
        ...(body.due_day ? { due_day: body.due_day } : {}),
        ...(body.grace_days !== undefined ? { grace_days: body.grace_days } : {}),
      }),
    );
  }),

  // Loan installments
  http.get(new RegExp("/api/v1/loans/[^/]+/installments$"), () => {
    return HttpResponse.json([makeInstallment()]);
  }),

  // Mark installment paid
  http.post(
    new RegExp("/api/v1/loans/(?<id>[^/]+)/installments/(?<yyyy_mm>[^/]+)/mark-paid$"),
    async ({ params, request }) => {
      const { yyyy_mm } = params as { yyyy_mm: string };
      const body = (await request.json().catch(() => ({}))) as {
        reference?: string | null;
        note?: string | null;
      };
      return HttpResponse.json(
        makeInstallment({
          year_month: yyyy_mm,
          due_date: `${yyyy_mm}-24`,
          status: "PAID",
          paid_at: new Date().toISOString(),
          evidence: body.reference || "Paid manually",
        }),
      );
    },
  ),

  // Contacts list
  http.get(new RegExp("/api/v1/contacts$"), () => {
    return HttpResponse.json([makeContact()]);
  }),

  // Create contact
  http.post(new RegExp("/api/v1/contacts$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      relation?: string;
      phone?: string;
      email?: string;
      priority?: number;
      locale?: string;
    };
    return HttpResponse.json(
      makeContact({
        id: "ct_mock_new_123",
        name: body.name || "New Contact",
        relation: body.relation || "relative",
        phone: body.phone || "+919876543210",
        email: body.email || "relative@example.com",
        priority: body.priority ?? 1,
        consent: "PENDING",
        consent_verified_at: null,
      }),
      { status: 201 },
    );
  }),

  // Update contact
  http.patch(new RegExp("/api/v1/contacts/(?<id>[^/]+)$"), async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      relation?: string;
      phone?: string;
      email?: string;
      priority?: number;
    };
    return HttpResponse.json(
      makeContact({
        id,
        ...(body.name ? { name: body.name } : {}),
        ...(body.relation ? { relation: body.relation } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
      }),
    );
  }),

  // Delete contact
  http.delete(new RegExp("/api/v1/contacts/(?<id>[^/]+)$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Contact deleted successfully.",
    });
  }),

  // Resend contact verification OTP
  http.post(new RegExp("/api/v1/contacts/(?<id>[^/]+)/verify/send$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Consent verification OTP sent.",
    });
  }),

  // Public verify contact OTP
  http.post(new RegExp("/api/v1/public/contacts/verify$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string; otp?: string };
    if (body.otp === "000000") {
      return HttpResponse.json(
        { code: "INVALID_OTP", detail: "Invalid or expired OTP." },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      success: true,
      message: "Contact consent verified successfully.",
    });
  }),

  // Public opt-out contact
  http.post(new RegExp("/api/v1/public/contacts/opt-out$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Contact successfully opted out.",
    });
  }),

  // Groww account
  http.get(new RegExp("/api/v1/accounts/groww$"), () => {
    return HttpResponse.json({
      connected: true,
      masked_account: "XXXX5678",
      last_synced_at: "2026-10-10T12:00:00Z",
      holdings_count: 12,
    });
  }),

  http.put(new RegExp("/api/v1/accounts/groww$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Groww connection settings updated successfully.",
    });
  }),

  http.post(new RegExp("/api/v1/accounts/groww/refresh-holdings$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Holdings refreshed successfully.",
    });
  }),

  // Mutual funds & CAS import
  http.get(new RegExp("/api/v1/mutual-funds/holdings$"), () => {
    return HttpResponse.json([]);
  }),

  http.post(new RegExp("/api/v1/mutual-funds/import-cas$"), () => {
    return HttpResponse.json({
      imported_count: 2,
      total_value_paise: 25000000,
      message: "Successfully imported 2 holdings from CAS statement.",
      holdings: [],
    });
  }),

  http.get(new RegExp("/api/v1/mutual-funds/search$"), () => {
    return HttpResponse.json([
      { scheme_code: 122639, scheme_name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" },
    ]);
  }),

  http.get(new RegExp("/api/v1/mutual-funds/(?<scheme_code>\\d+)/nav$"), () => {
    return HttpResponse.json({
      scheme_code: 122639,
      scheme_name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
      fund_house: "PPFAS Mutual Fund",
      nav: 85.5,
      nav_date: "12-Oct-2026",
    });
  }),

  // Bank accounts
  http.get(new RegExp("/api/v1/bank-accounts$"), () => {
    return HttpResponse.json([makeBankAccount()]);
  }),

  http.post(new RegExp("/api/v1/bank-accounts$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      bank_name?: string;
      account_number?: string;
      ifsc_code?: string;
      branch_name?: string;
      account_type?: string;
      holder_name?: string;
    };
    return HttpResponse.json(
      makeBankAccount({
        id: "ba_mock_new_123",
        bank_name: body.bank_name || "HDFC Bank",
        account_number_masked: `XXXX${(body.account_number || "1234").slice(-4)}`,
        ifsc_code: (body.ifsc_code || "HDFC0000001").toUpperCase(),
        branch_name: body.branch_name || null,
        account_type: body.account_type || "SAVINGS",
        holder_name: body.holder_name || null,
      }),
      { status: 201 },
    );
  }),

  http.delete(new RegExp("/api/v1/bank-accounts/(?<id>[^/]+)$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Bank account deleted successfully.",
    });
  }),

  // Documents list
  http.get(new RegExp("/api/v1/documents$"), () => {
    return HttpResponse.json([makeDocument()]);
  }),

  // Upload document
  http.post(new RegExp("/api/v1/documents$"), async () => {
    return HttpResponse.json(
      makeDocument({
        id: "doc_mock_new_123",
        title: "Car Loan Agreement",
        filename: "car_loan.pdf",
        category: "financial",
        size_bytes: 1024 * 1024,
      }),
      { status: 201 },
    );
  }),

  // Delete document
  http.delete(new RegExp("/api/v1/documents/(?<id>[^/]+)$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Document deleted successfully.",
    });
  }),

  // Notifications delivery log
  http.get(new RegExp("/api/v1/notifications"), () => {
    return HttpResponse.json([makeNotificationItem()]);
  }),

  // Packet preview
  http.get(new RegExp("/api/v1/packet/preview"), () => {
    return HttpResponse.json(makePacketPreview());
  }),

  // Packet shares list
  http.get(new RegExp("/api/v1/packet/shares$"), () => {
    return HttpResponse.json([makePacketShare()]);
  }),

  // Create packet share
  http.post(new RegExp("/api/v1/packet/shares$"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { contact_id?: string };
    return HttpResponse.json(
      makePacketShare({
        id: "share_mock_new_123",
        contact_id: body.contact_id || "ct_mock_001",
      }),
      { status: 201 },
    );
  }),

  // Revoke packet share
  http.delete(new RegExp("/api/v1/packet/shares/(?<id>[^/?]+)$"), () => {
    return HttpResponse.json({
      success: true,
      message: "Packet share revoked.",
    });
  }),

  // Scheduler watchdog health
  http.get(new RegExp("/api/v1/health/scheduler$"), () => {
    return HttpResponse.json(makeSchedulerHealth());
  }),

  // Public packet session data
  http.get(new RegExp("/api/v1/public/packet/session$"), ({ request }) => {
    const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
    const url = new URL(request.url);
    const sessionTokenQuery = url.searchParams.get("session_token");
    const token = authHeader || sessionTokenQuery || "";
    if (token.includes("expired_session")) {
      return HttpResponse.json(
        {
          code: "SESSION_EXPIRED",
          message: "Session has expired. Please verify your phone again.",
        },
        { status: 401 },
      );
    }
    return HttpResponse.json(makePacketPreview());
  }),

  // Public packet document download
  http.get(new RegExp("/api/v1/public/packet/session/documents/(?<id>[^/]+)$"), ({ request }) => {
    const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
    const url = new URL(request.url);
    const sessionTokenQuery = url.searchParams.get("session_token");
    const token = authHeader || sessionTokenQuery || "";
    if (token.includes("expired_session")) {
      return HttpResponse.json(
        {
          code: "SESSION_EXPIRED",
          message: "Session has expired. Please verify your phone again.",
        },
        { status: 401 },
      );
    }
    return new HttpResponse("mock document content", {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="document.pdf"',
      },
    });
  }),

  // Public packet send OTP
  http.post(new RegExp("/api/v1/public/packet/(?<token>[^/]+)/otp/send$"), ({ params }) => {
    const { token } = params as { token: string };
    if (token === "invalid-token") {
      return HttpResponse.json(
        { code: "TOKEN_INVALID", message: "Invalid or expired packet link." },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      success: true,
      message: "Security code sent to your registered phone.",
    });
  }),

  // Public packet verify OTP
  http.post(
    new RegExp("/api/v1/public/packet/(?<token>[^/]+)/otp/verify$"),
    async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { otp?: string };
      if (body.otp === "000000") {
        return HttpResponse.json(
          {
            code: "OTP_LOCKED_OUT",
            message: "Too many failed attempts. Access is temporarily locked for 15 minutes.",
          },
          { status: 429 },
        );
      }
      if (body.otp !== "123456") {
        return HttpResponse.json(
          {
            code: "INVALID_OTP",
            message: "The verification code is incorrect. Please check and try again.",
          },
          { status: 400 },
        );
      }
      return HttpResponse.json(makePublicPacketOtpVerify());
    },
  ),

  // Public packet info (evaluated after specific /session routes)
  http.get(new RegExp("/api/v1/public/packet/(?<token>[^/]+)$"), ({ params }) => {
    const { token } = params as { token: string };
    if (token === "invalid-token" || token === "revoked-token") {
      return HttpResponse.json(
        {
          code: "TOKEN_INVALID",
          message: "This safety packet link is invalid or has been revoked.",
        },
        { status: 404 },
      );
    }
    if (token === "expired-token") {
      return HttpResponse.json(
        { code: "TOKEN_EXPIRED", message: "This safety packet link has expired." },
        { status: 410 },
      );
    }
    return HttpResponse.json(makePublicPacketInfo());
  }),
];
