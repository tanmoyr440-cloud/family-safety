import { describe, it, expect } from "vitest";
import { ApiError, codeToMessage, unwrap } from "./errors";

describe("ApiError", () => {
  it("initializes with status, code, detail, and field errors", () => {
    const error = new ApiError(422, "VALIDATION_ERROR", "Invalid input", [
      { field: "phone", message: "Must be in E.164 format" },
    ]);

    expect(error.status).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.detail).toBe("Invalid input");
    expect(error.fieldErrors).toHaveLength(1);
    expect(error.fieldErrors?.[0]?.field).toBe("phone");
  });

  it("falls back to codeToMessage when detail is omitted", () => {
    const error = new ApiError(401, "UNAUTHORIZED");
    expect(error.message).toContain("session has expired");
  });
});

describe("codeToMessage", () => {
  it("returns human friendly text for known codes", () => {
    expect(codeToMessage("CONTACT_NOT_VERIFIED")).toContain("consent");
    expect(codeToMessage("RATE_LIMIT_EXCEEDED")).toContain("Too many attempts");
    expect(codeToMessage("OTP_LOCKED_OUT")).toContain("15 minutes");
  });

  it("returns fallback for unknown codes", () => {
    expect(codeToMessage("SOME_RANDOM_CODE", "Custom fallback")).toBe("Custom fallback");
  });
});

describe("unwrap helper", () => {
  it("returns data on successful response", () => {
    const data = { id: "123", name: "Test" };
    const res = new Response(JSON.stringify(data), { status: 200 });
    const result = unwrap({ data, response: res });
    expect(result).toEqual(data);
  });

  it("throws ApiError on HTTP error status with problem detail error", () => {
    const res = new Response(null, { status: 409, statusText: "Conflict" });
    const errorPayload = {
      code: "CONTACT_NOT_VERIFIED",
      detail: "Contact must verify consent first.",
    };

    expect(() =>
      unwrap({
        error: errorPayload,
        response: res,
      }),
    ).toThrowError(ApiError);

    try {
      unwrap({ error: errorPayload, response: res });
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe("CONTACT_NOT_VERIFIED");
      expect(apiErr.detail).toBe("Contact must verify consent first.");
    }
  });

  it("throws ApiError on empty response", () => {
    const res = new Response(null, { status: 200 });
    expect(() => unwrap({ response: res })).toThrowError(ApiError);
  });
});
