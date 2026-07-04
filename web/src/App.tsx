import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { TradingFloor } from "./components/TradingFloor";
import { Registry } from "./components/Registry";
import { Markets } from "./components/Markets";
import { getHealth } from "./api";
import { subtle, cn } from "./lib/ui";

export function App() {
  const [tab, setTab] = useState<"markets" | "floor" | "registry">("markets");
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    getHealth().then((h) => setAiEnabled(h.aiEnabled)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <Header tab={tab} setTab={setTab} aiEnabled={aiEnabled} />
      <main className="mx-auto max-w-6xl px-5 py-8">
        {tab === "markets" ? <Markets /> : tab === "floor" ? <TradingFloor /> : <Registry />}
      </main>
      <footer className={cn("mx-auto max-w-6xl px-5 pb-10 pt-4 text-center text-xs", subtle)}>
        Handshake · one buyer agent, many seller agents, one autonomous market — settled on Monad.
      </footer>
    </div>
  );
}
