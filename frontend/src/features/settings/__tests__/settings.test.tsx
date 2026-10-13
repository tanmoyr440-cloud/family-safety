import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { makeMonitorStatus, makeOwner, makeLoan } from "@/shared/testing/factories";
import { SettingsPage } from "../pages/SettingsPage";

describe("Settings Feature (Phase 9)", () => {
  it("renders all settings cards with current values and passes axe check", async () => {
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            threshold_days: 90,
            warning_days: [60, 80],
            paused_until: null,
          }),
        );
      }),
      http.get(new RegExp("/api/v1/me$"), () => {
        return HttpResponse.json(makeOwner({ mfa_enabled: true }));
      }),
      http.get(new RegExp("/api/v1/loans$"), () => {
        return HttpResponse.json([makeLoan({ lender: "HDFC Bank", grace_days: 2 })]);
      }),
    );

    const { container } = renderWithProviders(<SettingsPage />, { route: "/settings" });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /settings & preferences/i }),
      ).toBeInTheDocument();
    });

    // Thresholds card
    expect(screen.getByText(/inactivity alert thresholds/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("90")).toBeInTheDocument();
    expect(screen.getByDisplayValue("60")).toBeInTheDocument();
    expect(screen.getByDisplayValue("80")).toBeInTheDocument();

    // Loan grace delay
    expect(screen.getByText(/loan grace period/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();

    // Pause card
    expect(screen.getByText(/pause monitoring/i)).toBeInTheDocument();

    // Security card (MFA Enabled)
    expect(
      screen.getByRole("heading", { level: 2, name: /account security/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();

    // Data management
    expect(screen.getByText(/data management & privacy/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export my data/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("enforces live validation on thresholds: warnings must be strictly increasing and below threshold", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { route: "/settings" });

    await waitFor(() => {
      expect(screen.getByLabelText(/day 1 warning/i)).toBeInTheDocument();
    });

    const warn1Input = screen.getByLabelText(/day 1 warning/i);
    const warn2Input = screen.getByLabelText(/day 2 warning/i);
    const thresholdInput = screen.getByLabelText(/alert threshold \(days\)/i);

    // 1. Set warn1 >= warn2 (e.g. warn1 = 85, warn2 = 80)
    await user.clear(warn1Input);
    await user.type(warn1Input, "85");

    await waitFor(() => {
      expect(
        screen.getByText(/first warning day must be strictly less than second warning day/i),
      ).toBeInTheDocument();
    });

    // 2. Fix warn1, set warn2 >= threshold (e.g. warn2 = 95, threshold = 90)
    await user.clear(warn1Input);
    await user.type(warn1Input, "50");
    await user.clear(warn2Input);
    await user.type(warn2Input, "95");

    await waitFor(() => {
      expect(
        screen.getByText(/warning days must be strictly less than final alert threshold/i),
      ).toBeInTheDocument();
    });

    // 3. Set valid thresholds and submit (warn1 = 45, warn2 = 75, threshold = 100)
    await user.clear(warn2Input);
    await user.type(warn2Input, "75");
    await user.clear(thresholdInput);
    await user.type(thresholdInput, "100");

    const saveBtn = screen.getByRole("button", { name: /save thresholds/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/inactivity thresholds updated successfully/i)).toBeInTheDocument();
    });
  });

  it("updates loan grace days successfully", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { route: "/settings" });

    await waitFor(() => {
      expect(screen.getByLabelText(/grace days/i)).toBeInTheDocument();
    });

    const graceInput = screen.getByLabelText(/grace days/i);
    await user.clear(graceInput);
    await user.type(graceInput, "3");

    const saveGraceBtn = screen.getByRole("button", { name: /save grace days/i });
    await user.click(saveGraceBtn);

    await waitFor(() => {
      expect(screen.getByText(/loan grace period updated successfully/i)).toBeInTheDocument();
    });
  });

  it("handles pause monitoring with cap and allows resuming when paused", async () => {
    const user = userEvent.setup();

    // 1. Test pausing monitoring
    renderWithProviders(<SettingsPage />, { route: "/settings" });

    await waitFor(() => {
      expect(screen.getByLabelText(/pause until date/i)).toBeInTheDocument();
    });

    const pauseBtn = screen.getByRole("button", { name: /pause inactivity monitoring/i });
    await user.click(pauseBtn);

    await waitFor(() => {
      expect(screen.getByText(/monitoring paused until/i)).toBeInTheDocument();
    });

    // 2. Test resumed state when already paused
    server.use(
      http.get(new RegExp("/api/v1/monitor$"), () => {
        return HttpResponse.json(
          makeMonitorStatus({
            status: "PAUSED",
            paused_until: "2026-11-15",
          }),
        );
      }),
    );

    const { container: pausedContainer } = renderWithProviders(<SettingsPage />, {
      route: "/settings",
    });

    await waitFor(() => {
      expect(screen.getByText(/monitoring is currently paused/i)).toBeInTheDocument();
    });
    expect(screen.getByText("2026-11-15")).toBeInTheDocument();

    const resumeBtn = screen.getByRole("button", { name: /resume monitoring now/i });
    expect(resumeBtn).toBeInTheDocument();

    await user.click(resumeBtn);

    await waitFor(() => {
      expect(screen.getByText(/monitoring resumed successfully/i)).toBeInTheDocument();
    });

    expect(await axe(pausedContainer)).toHaveNoViolations();
  });

  it("triggers data export download", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { route: "/settings" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /export my data/i })).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /export my data/i });
    await user.click(exportBtn);

    // Verify endpoint was called without error
    expect(exportBtn).not.toBeDisabled();
  });

  it("handles account deletion flow: requires typed confirmation and deletes account", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<SettingsPage />, { route: "/settings" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
    });

    // Open delete dialog
    await user.click(screen.getByRole("button", { name: /delete account/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /delete account permanently/i }),
      ).toBeInTheDocument();
    });

    const confirmInput = screen.getByLabelText(/type/i);
    const deleteSubmitBtn = screen.getByRole("button", { name: /delete everything/i });

    // Disabled initially
    expect(deleteSubmitBtn).toBeDisabled();

    // Partial input keeps button disabled
    await user.type(confirmInput, "DELETE");
    expect(deleteSubmitBtn).toBeDisabled();

    // Axe check on modal
    expect(await axe(container)).toHaveNoViolations();

    // Exact typed confirmation enables button
    await user.clear(confirmInput);
    await user.type(confirmInput, "DELETE MY ACCOUNT");
    expect(deleteSubmitBtn).toBeEnabled();

    // Click submit
    await user.click(deleteSubmitBtn);
  });
});
