/**
 * Real-time WebSocket hook for Live Stock Market Price feeds.
 *
 * Provides real-time ups and downs just like trading apps (Groww, Zerodha Kite),
 * updating prices, percentage changes, day high/low, and animated visual flash cues.
 */

import * as React from "react";

export interface LiveStockTick {
  symbol: string;
  isin: string | null;
  name: string;
  price: number;
  prev_price: number;
  change: number;
  change_pct: number;
  direction: "up" | "down" | "same";
  day_high: number;
  day_low: number;
  timestamp: string;
}

export interface WebSocketMessage {
  type: "SNAPSHOT" | "TICK" | "PONG";
  data?: LiveStockTick | LiveStockTick[];
  timestamp: string;
}

export function getStockWebSocketUrl(): string {
  const customWs = import.meta.env.VITE_STOCK_WS_URL;
  if (customWs) return customWs;

  const rawBase = import.meta.env.VITE_API_BASE_URL;
  if (rawBase) {
    const clean = rawBase.replace(/\/+$/, "");
    const wsProto = clean.startsWith("https://") ? "wss://" : "ws://";
    const host = clean.replace(/^https?:\/\//, "");
    return `${wsProto}${host}/api/v1/ws/stocks`;
  }

  if (typeof window !== "undefined" && window.location) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/v1/ws/stocks`;
  }

  return "ws://127.0.0.1:8000/api/v1/ws/stocks";
}

export function getLiveStocksRestUrl(): string {
  const rawBase =
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== "undefined" && window.location ? window.location.origin : "http://localhost:8000");
  const clean = rawBase.replace(/\/+$/, "");
  return `${clean}/api/v1/stocks/live`;
}

export function useStockWebSocket(enabled: boolean = true) {
  const [ticks, setTicks] = React.useState<Record<string, LiveStockTick>>({});
  const [ticksByIsin, setTicksByIsin] = React.useState<Record<string, LiveStockTick>>({});
  const [flashStates, setFlashStates] = React.useState<Record<string, "up" | "down">>({});
  const [isConnected, setIsConnected] = React.useState<boolean>(false);
  const [lastTickAt, setLastTickAt] = React.useState<Date | null>(null);

  const socketRef = React.useRef<WebSocket | null>(null);
  const flashTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = React.useRef<number>(0);

  // Helper to ingest an array of incoming ticks
  const ingestTicks = React.useCallback(
    (newTicks: LiveStockTick[], triggerFlash: boolean = true) => {
      setTicks((prev) => {
        const next = { ...prev };
        for (const t of newTicks) {
          next[t.symbol] = t;
        }
        return next;
      });

      setTicksByIsin((prev) => {
        const next = { ...prev };
        for (const t of newTicks) {
          if (t.isin) {
            next[t.isin] = t;
          }
        }
        return next;
      });

      setLastTickAt(new Date());

      if (triggerFlash) {
        newTicks.forEach((t) => {
          if (t.direction === "up" || t.direction === "down") {
            const dir = t.direction;
            setFlashStates((prev) => ({
              ...prev,
              [t.symbol]: dir,
              ...(t.isin ? { [t.isin]: dir } : {}),
            }));

            // Clear previous timeout for this symbol if pending
            if (flashTimersRef.current[t.symbol]) {
              clearTimeout(flashTimersRef.current[t.symbol]);
            }

            flashTimersRef.current[t.symbol] = setTimeout(() => {
              setFlashStates((prev) => {
                const updated = { ...prev };
                delete updated[t.symbol];
                if (t.isin) delete updated[t.isin];
                return updated;
              });
              delete flashTimersRef.current[t.symbol];
            }, 1200);
          }
        });
      }
    },
    [],
  );

  // Initial HTTP fallback load for immediate data before WS handshake
  React.useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;

    async function loadSnapshot() {
      try {
        const res = await fetch(getLiveStocksRestUrl(), {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const list: LiveStockTick[] = await res.json();
          if (!isCancelled && Array.isArray(list) && list.length > 0) {
            ingestTicks(list, false);
          }
        }
      } catch {
        // Silently tolerate if offline or backend launching
      }
    }

    void loadSnapshot();
    return () => {
      isCancelled = true;
    };
  }, [enabled, ingestTicks]);

  // Connect and manage WebSocket
  React.useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // In Vitest / JSDOM test runner, avoid opening raw TCP socket that causes libuv assertions
    if (import.meta.env.MODE === "test") {
      setIsConnected(true);
      return;
    }

    let isDisposed = false;

    function connect() {
      if (isDisposed) return;
      const wsUrl = getStockWebSocketUrl();

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) {
            ws.close();
            return;
          }
          setIsConnected(true);
          reconnectAttemptRef.current = 0;

          // Start heartbeat ping every 20s
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: "ping" }));
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const msg: WebSocketMessage = JSON.parse(event.data);
            if (msg.type === "SNAPSHOT" && Array.isArray(msg.data)) {
              ingestTicks(msg.data, false);
            } else if (msg.type === "TICK") {
              const incoming = Array.isArray(msg.data)
                ? msg.data
                : msg.data
                  ? [msg.data]
                  : [];
              if (incoming.length > 0) {
                ingestTicks(incoming, true);
              }
            }
          } catch {
            // Ignore malformed payloads
          }
        };

        ws.onerror = () => {
          // Handled gracefully in onclose
        };

        ws.onclose = () => {
          setIsConnected(false);
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }

          if (!isDisposed) {
            // Reconnect with exponential backoff: 1.5s, 3s, 6s, max 10s
            const delay = Math.min(
              1500 * Math.pow(1.5, reconnectAttemptRef.current),
              10000,
            );
            reconnectAttemptRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
        };
      } catch {
        if (!isDisposed) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      isDisposed = true;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      // Clear all flash timers
      Object.values(flashTimersRef.current).forEach(clearTimeout);
      flashTimersRef.current = {};
    };
  }, [enabled, ingestTicks]);

  /**
   * Match holding to real-time live stock tick via ISIN or company keywords.
   */
  const getTick = React.useCallback(
    (holding?: {
      isin?: string | null;
      scheme_name?: string | null;
      fund_house?: string | null;
    }): LiveStockTick | undefined => {
      if (!holding) return undefined;

      // 1. Direct ISIN match
      if (holding.isin && ticksByIsin[holding.isin]) {
        return ticksByIsin[holding.isin];
      }

      const name = (holding.scheme_name || "").toUpperCase();

      // 2. High-precision known stock aliases
      if (name.includes("TATA MOTORS")) {
        return ticks["TMCV"] || ticksByIsin["INE1TAE01010"];
      }
      if (name.includes("TATA CONSULTANCY") || name.includes("TCS")) {
        return ticks["TCS"] || ticksByIsin["INE467B01029"];
      }
      if (name.includes("RELIANCE")) {
        return ticks["RELIANCE"] || ticksByIsin["INE002A01018"];
      }
      if (name.includes("INFOSYS") || name.includes("INFY")) {
        return ticks["INFY"] || ticksByIsin["INE009A01021"];
      }
      if (name.includes("HDFC BANK")) {
        return ticks["HDFCBANK"] || ticksByIsin["INE040A01034"];
      }
      if (name.includes("ICICI BANK")) {
        return ticks["ICICIBANK"] || ticksByIsin["INE090A01021"];
      }
      if (name.includes("STATE BANK") || name.includes("SBIN")) {
        return ticks["SBIN"] || ticksByIsin["INE062A01020"];
      }
      if (name.includes("BEES") || name.includes("NIFTY")) {
        return ticks["NIFTYBEES"] || ticksByIsin["INF732E01015"];
      }

      // 3. Fallback search against symbol / name
      for (const t of Object.values(ticks)) {
        if (t.symbol && name.includes(t.symbol)) {
          return t;
        }
      }

      return undefined;
    },
    [ticks, ticksByIsin],
  );

  /**
   * Helper to retrieve current visual tick flash direction for a given holding.
   */
  const getHoldingFlash = React.useCallback(
    (holding?: {
      isin?: string | null;
      scheme_name?: string | null;
    }): "up" | "down" | null => {
      const tick = getTick(holding);
      if (!tick) return null;
      return flashStates[tick.symbol] || (tick.isin ? flashStates[tick.isin] : null) || null;
    },
    [flashStates, getTick],
  );

  return {
    ticks,
    ticksByIsin,
    flashStates,
    isConnected,
    lastTickAt,
    getTick,
    getHoldingFlash,
  };
}
