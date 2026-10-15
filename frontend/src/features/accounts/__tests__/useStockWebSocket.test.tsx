import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useStockWebSocket, getStockWebSocketUrl } from "../api/useStockWebSocket";

describe("useStockWebSocket Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs correct WebSocket endpoint URL", () => {
    const url = getStockWebSocketUrl();
    expect(url).toMatch(/^wss?:\/\//);
    expect(url).toContain("/api/v1/ws/stocks");
  });

  it("loads initial stock quote snapshot via REST fallback on mount", async () => {
    const { result } = renderHook(() => useStockWebSocket(true));

    await waitFor(() => {
      expect(result.current.ticks["TMCV"]).toBeDefined();
    });

    const tataMotors = result.current.getTick({
      scheme_name: "TATA MOTORS LIMITED EQ",
      isin: "INE1TAE01010",
    });
    expect(tataMotors).toBeDefined();
    expect(tataMotors?.symbol).toBe("TMCV");
    expect(tataMotors?.price).toBe(415.25);
  });

  it("matches stock by ISIN correctly", async () => {
    const { result } = renderHook(() => useStockWebSocket(true));

    await waitFor(() => {
      expect(result.current.ticks["TCS"]).toBeDefined();
    });

    const tcsTick = result.current.getTick({
      isin: "INE467B01029",
      scheme_name: "TATA CONSULTANCY SERVICES LIMITED EQ",
    });
    expect(tcsTick?.symbol).toBe("TCS");
    expect(tcsTick?.price).toBe(2304.9);
  });

  it("matches stock by company name when ISIN is missing", async () => {
    const { result } = renderHook(() => useStockWebSocket(true));

    await waitFor(() => {
      expect(result.current.ticks["TMCV"]).toBeDefined();
    });

    const match = result.current.getTick({
      scheme_name: "TATA MOTORS LIMITED EQ",
    });
    expect(match?.symbol).toBe("TMCV");
  });
});
