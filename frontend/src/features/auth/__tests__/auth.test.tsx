import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/shared/testing/setup";
import { renderWithProviders, createTestQueryClient } from "@/shared/testing/utils";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { LoginForm } from "../components/LoginForm";
import { RegisterForm } from "../components/RegisterForm";
import { MfaEnrollCard } from "../components/MfaEnrollCard";
import { api } from "@/shared/api/client";
import { authKeys } from "../api/keys";
import { makeOwner } from "@/shared/testing/factories";
import { Route, Routes } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { useLogout } from "../api/useLogout";
import { Button } from "@/shared/ui/Button";

function LogoutTestComponent() {
  const { mutate: logout } = useLogout();
  return <Button onClick={() => logout()}>Sign Out</Button>;
}

describe("Auth Feature", () => {
  it("redirects unauthenticated user from protected route to /login with return_to", async () => {
    server.use(
      http.get(new RegExp("/api/v1/me$"), () => {
        return HttpResponse.json(
          { code: "UNAUTHORIZED", detail: "Not logged in" },
          { status: 401 },
        );
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login Page Mock</div>} />
        <Route
          path="/loans"
          element={
            <ProtectedRoute>
              <div>Protected Loans Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { route: "/loans" },
    );

    await waitFor(() => {
      expect(screen.getByText("Login Page Mock")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected Loans Content")).not.toBeInTheDocument();
  });

  it("submits login form and navigates back to return_to route after success", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(new RegExp("/api/v1/me$"), () => {
        return HttpResponse.json(
          { code: "UNAUTHORIZED", detail: "Not logged in" },
          { status: 401 },
        );
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/loans" element={<div>Returned To Loans</div>} />
      </Routes>,
      { route: "/login?return_to=%2Floans" },
    );

    expect(
      screen.getByRole("heading", { name: /sign in to family safety net/i }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email address/i), "tanmoy@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Returned To Loans")).toBeInTheDocument();
    });
  });

  it("prompts for MFA code when login requires two-factor authentication", async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    renderWithProviders(<LoginForm onSuccess={handleSuccess} />);

    await user.type(screen.getByLabelText(/email address/i), "mfa@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/two-factor code/i)).toBeInTheDocument();
    });
    expect(handleSuccess).toHaveBeenCalledWith(true);
  });

  it("submits registration and triggers success callback", async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    renderWithProviders(<RegisterForm onSuccess={handleSuccess} />);

    await user.type(screen.getByLabelText(/full name/i), "Tanmoy Sharma");
    await user.type(screen.getByLabelText(/email address/i), "tanmoy@example.com");
    await user.type(screen.getByLabelText(/mobile number/i), "9876543210");
    await user.type(screen.getByLabelText(/password/i), "securePassword123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it("completes MFA enrollment with secret display and code verification", async () => {
    const user = userEvent.setup();
    const handleEnrolled = vi.fn();

    renderWithProviders(<MfaEnrollCard onEnrolled={handleEnrolled} />);

    // Step 1: Start enrollment
    await user.click(screen.getByRole("button", { name: /set up two-factor authentication/i }));

    await waitFor(() => {
      expect(screen.getByTestId("mfa-secret-key")).toHaveTextContent("JBSWY3DPEHPK3PXP");
    });

    // Step 2: Enter 6-digit code
    await user.type(screen.getByLabelText(/verification code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify & enable mfa/i }));

    await waitFor(() => {
      expect(screen.getByText(/two-factor authentication active/i)).toBeInTheDocument();
    });
    expect(handleEnrolled).toHaveBeenCalled();
  });

  it("triggers a single shared session refresh on concurrent 401 errors then retries", async () => {
    let refreshCalls = 0;
    let monitorAttempts = 0;

    server.use(
      http.post(new RegExp("/api/v1/auth/refresh$"), () => {
        refreshCalls++;
        return HttpResponse.json({ success: true, message: "Token refreshed" });
      }),
      http.get(new RegExp("/api/v1/monitor$"), () => {
        monitorAttempts++;
        if (monitorAttempts <= 2) {
          // First two concurrent calls return 401
          return HttpResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
        }
        return HttpResponse.json({ status: "OK", days_idle: 5 });
      }),
    );

    // Fire two concurrent calls that both get 401
    const [res1, res2] = await Promise.all([
      api.GET("/api/v1/monitor"),
      api.GET("/api/v1/monitor"),
    ]);

    // Single refresh endpoint was called exactly once
    expect(refreshCalls).toBe(1);

    // Both requests successfully retried and got 200 data
    expect(res1.response.status).toBe(200);
    expect(res2.response.status).toBe(200);
  });

  it("clears cached queries on logout", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();

    // Seed query cache with owner data
    queryClient.setQueryData(authKeys.me(), makeOwner());
    expect(queryClient.getQueryData(authKeys.me())).toBeDefined();

    renderWithProviders(<LogoutTestComponent />, { queryClient });

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      // Query cache cleared completely
      expect(queryClient.getQueryData(authKeys.me())).toBeUndefined();
    });
  });

  it("persists session in localStorage to keep user logged in across app restarts until token expires", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    server.use(
      http.get(new RegExp("/api/v1/me$"), () => {
        return HttpResponse.json(
          { code: "UNAUTHORIZED", detail: "Not logged in" },
          { status: 401 },
        );
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>,
      { route: "/login" },
    );

    await user.type(screen.getByLabelText(/email address/i), "tanmoy@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    // Check localStorage retains session tokens and user profile
    expect(localStorage.getItem("fsn_auth_access")).toBeTruthy();
    expect(localStorage.getItem("fsn_auth_user")).toBeTruthy();
  });
});
