import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { MarketSession } from "../types";
import { eventsUrl, getMarkets } from "../api";

/**
 * One live connection for the whole app.
 *
 * Primary transport is the server's SSE stream (/api/events) — every session
 * mutation pushes a fresh snapshot, so markets update the moment a round lands.
 * If the stream drops, we fall back to polling until it reconnects; if polling
 * fails too, we're offline and the UI says so instead of silently going stale.
 */
export type Connection = "connecting" | "live" | "polling" | "offline";

interface MarketsCtx {
  sessions: MarketSession[]; // newest first
  connection: Connection;
  refresh: () => void;
}

const Ctx = createContext<MarketsCtx>({ sessions: [], connection: "connecting", refresh: () => {} });

const POLL_MS = 2_500;

export function MarketsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<MarketSession[]>([]);
  const [connection, setConnection] = useState<Connection>("connecting");
  const connectionRef = useRef<Connection>("connecting");

  const setConn = (c: Connection) => {
    connectionRef.current = c;
    setConnection(c);
  };

  const refresh = useCallback(() => {
    getMarkets()
      .then((r) => {
        setSessions(r.sessions);
        if (connectionRef.current !== "live") setConn("polling");
      })
      .catch(() => {
        if (connectionRef.current !== "live") setConn("offline");
      });
  }, []);

  useEffect(() => {
    const es = new EventSource(eventsUrl());
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const startPolling = () => {
      if (pollTimer) return;
      refresh();
      pollTimer = setInterval(refresh, POLL_MS);
    };

    es.onopen = () => {
      setConn("live");
      stopPolling();
    };
    es.addEventListener("markets", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { sessions: MarketSession[] };
        setSessions(data.sessions);
        if (connectionRef.current !== "live") setConn("live");
        stopPolling();
      } catch { /* malformed frame — next snapshot will correct it */ }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; poll while it's down
      if (connectionRef.current === "live" || connectionRef.current === "connecting") setConn("polling");
      startPolling();
    };

    return () => {
      es.close();
      stopPolling();
    };
  }, [refresh]);

  return <Ctx.Provider value={{ sessions, connection, refresh }}>{children}</Ctx.Provider>;
}

export const useMarkets = () => useContext(Ctx);
