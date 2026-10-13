import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { DashboardPage } from "../pages/DashboardPage";
import { makeMonitorStatus } from "@/shared/testing/factories";

describe("Dashboard Page", () => {
  it("renders loading skeletons initially and has no accessibility violations", async () => {
    // Delay the monitor response to check loading state
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json(makeMonitorStatus());
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    expect(screen.getByRole("status", { name: /loading dashboard/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders OK status state and passes axe check", async () => {
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            status: "OK",
            days_idle: 3,
            threshold_days: 90,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /all good/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    expect(screen.getByText(/last activity recorded 3 days ago/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i'm okay, check in today/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders WARN_OWNER_1 status state and passes axe check", async () => {
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            status: "WARN_OWNER_1",
            days_idle: 62,
            threshold_days: 90,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /it's been 62 days without activity/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/check-in needed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/please check in today so we don't worry your family/i),
    ).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders WARN_OWNER_2 status state and passes axe check", async () => {
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            status: "WARN_OWNER_2",
            days_idle: 82,
            threshold_days: 90,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /urgent: 82 days without activity/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/urgent warning/i)).toBeInTheDocument();
    expect(
      screen.getByText(/emergency alerts will reach your family if you remain inactive/i),
    ).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders NOTIFY_PARENTS status state and passes axe check", async () => {
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            status: "NOTIFY_PARENTS",
            days_idle: 91,
            threshold_days: 90,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /emergency alerts active/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/family notified/i)).toBeInTheDocument();
    expect(
      screen.getByText(/verified parents have been notified by sms and email/i),
    ).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders PAUSED status state with resume banner and passes axe check", async () => {
    let resumed = false;
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            status: "PAUSED",
            paused_until: "2026-11-15T00:00:00+05:30",
          }),
        );
      }),
      http.delete(new RegExp("/api/v1/monitor/pause$"), () => {
        resumed = true;
        return HttpResponse.json({ success: true, message: "Monitoring resumed" });
      }),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /monitoring is paused/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/safety net monitoring is paused/i)).toBeInTheDocument();
    const resumeBtn = screen.getByRole("button", { name: /resume monitoring now/i });
    expect(resumeBtn).toBeInTheDocument();

    await user.click(resumeBtn);

    await waitFor(() => {
      expect(resumed).toBe(true);
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles check-in click with pending state, success confirmation, and single API call", async () => {
    let checkInCalls = 0;
    server.use(
      http.post(new RegExp("/api/v1/activity/check-in$"), async () => {
        checkInCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json({
          success: true,
          recorded_at: new Date().toISOString(),
        });
      }),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /i'm okay, check in today/i })).toBeInTheDocument();
    });

    const checkInBtn = screen.getByRole("button", { name: /i'm okay, check in today/i });
    await user.click(checkInBtn);

    // Verify pending indicator
    expect(screen.getByText(/checking in\.\.\./i)).toBeInTheDocument();

    // Verify success confirmation appears
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /check-in recorded! your 90-day inactivity clock has been reset/i,
      );
    });

    expect(checkInCalls).toBe(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles check-in failure with clear retry button and no false success", async () => {
    server.use(
      http.post(new RegExp("/api/v1/activity/check-in$"), () => {
        return HttpResponse.json(
          { code: "INTERNAL_ERROR", detail: "Database temporarily busy" },
          { status: 500 },
        );
      }),
    );

    const user = userEvent.setup();
    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /i'm okay, check in today/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /i'm okay, check in today/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/database temporarily busy/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();

    // Verify no false success message exists
    expect(
      screen.queryByText(/check-in recorded! your 90-day inactivity clock has been reset/i),
    ).not.toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("displays attention item when scheduler is unhealthy and links to settings", async () => {
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            scheduler_healthy: false,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/scheduler heartbeat delayed/i)).toBeInTheDocument();
    });

    const viewStatusLink = screen.getByRole("link", { name: /view system status/i });
    expect(viewStatusLink).toBeInTheDocument();
    expect(viewStatusLink).toHaveAttribute("href", "/settings");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("displays attention item when there are zero verified contacts and links to contacts", async () => {
    server.use(
      http.get(new RegExp("/api/v1/contacts$"), () => {
        return HttpResponse.json([]);
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/no verified emergency contacts/i)).toBeInTheDocument();
    });

    const verifyContactsLink = screen.getByRole("link", { name: /verify contacts/i });
    expect(verifyContactsLink).toBeInTheDocument();
    expect(verifyContactsLink).toHaveAttribute("href", "/contacts");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("displays error card with retry button when monitor API fails and passes axe check", async () => {
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          { code: "NETWORK_ERROR", detail: "Network gateway failure" },
          { status: 502 },
        );
      }),
    );

    const { container } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /unable to load safety net status/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/network gateway failure/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
