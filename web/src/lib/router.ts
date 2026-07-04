import { useCallback, useEffect, useState } from "react";

/**
 * Tiny hash router — zero deps. Routes:
 *   #/                   home (product)
 *   #/markets            marketplace (global spectator view)
 *   #/markets/<id>       marketplace with a session selected (deep-linkable)
 *   #/buyer              buyer desk — your buyer agents
 *   #/seller             seller terminal — your seller agent's POV
 *   #/registry           agent registry
 */
export type Tab = "home" | "markets" | "buyer" | "seller" | "registry";
export interface Route { tab: Tab; sessionId: string | null }

const TABS: Tab[] = ["home", "markets", "buyer", "seller", "registry"];

function parse(): Route {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const tab: Tab = TABS.includes(parts[0] as Tab) ? (parts[0] as Tab) : "home";
  return { tab, sessionId: tab === "markets" && parts[1] ? decodeURIComponent(parts[1]) : null };
}

export function routeHash(tab: Tab, sessionId?: string | null): string {
  if (tab === "home") return "#/";
  return sessionId && tab === "markets" ? `#/markets/${encodeURIComponent(sessionId)}` : `#/${tab}`;
}

export function useHashRoute(): [Route, (tab: Tab, sessionId?: string | null) => void] {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((tab: Tab, sessionId?: string | null) => {
    window.location.hash = routeHash(tab, sessionId);
  }, []);

  return [route, navigate];
}
