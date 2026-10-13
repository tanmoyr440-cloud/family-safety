import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { Route, Routes } from "react-router-dom";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { CheckInLandingPage } from "../pages/CheckInLandingPage";

describe("CheckInLandingPage (Magic Link)", () => {
  it("records check-in on load and displays success confirmation and passes axe", async () => {
    let checkInCalledWithToken = "";
    server.use(
      http.post(new RegExp("/api/v1/activity/check-in/link/(?<token>[^/]+)$"), ({ params }) => {
        checkInCalledWithToken = params.token as string;
        return HttpResponse.json({
          success: true,
          recorded_at: new Date().toISOString(),
        });
      }),
    );

    const { container } = renderWithProviders(
      <Routes>
        <Route path="/checkin/:token" element={<CheckInLandingPage />} />
      </Routes>,
      { route: "/checkin/valid-secret-token-123" },
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /thanks, you're checked in/i }),
      ).toBeInTheDocument();
    });

    expect(checkInCalledWithToken).toBe("valid-secret-token-123");
    expect(
      screen.getByText(
        /your 90-day clock has been reset\. your family will not receive any inactivity alerts/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in to your account/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles expired or invalid magic link token and passes axe", async () => {
    server.use(
      http.post(new RegExp("/api/v1/activity/check-in/link/(?<token>[^/]+)$"), () => {
        return HttpResponse.json(
          {
            code: "LINK_EXPIRED",
            detail: "This check-in link has expired or has already been used.",
          },
          { status: 400 },
        );
      }),
    );

    const { container } = renderWithProviders(
      <Routes>
        <Route path="/checkin/:token" element={<CheckInLandingPage />} />
      </Routes>,
      { route: "/checkin/expired-token" },
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /this link has expired/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/this check-in link has expired or has already been used/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in to your account/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
