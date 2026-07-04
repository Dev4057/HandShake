import { ChevronLeft } from "lucide-react";
import { Header } from "./components/Header";
import { WalletPicker } from "./components/WalletPicker";
import { Home } from "./components/Home";
import { Registry } from "./components/Registry";
import { Markets } from "./components/Markets";
import { BuyerDesk } from "./components/BuyerDesk";
import { SellerTerminal } from "./components/SellerTerminal";
import { useHashRoute, type Tab } from "./lib/router";
import { MarketsProvider, useMarkets } from "./lib/markets";
import { UserProvider, useUser } from "./lib/user";
import { subtle, cn, card, btnPrimary, label } from "./lib/ui";

const PAGE_TITLE: Record<Exclude<Tab, "home">, string> = {
  markets: "Marketplace",
  buyer: "Buyer desk",
  seller: "Seller terminal",
  registry: "Registry",
};

export function App() {
  return (
    <UserProvider>
      <MarketsProvider>
        <Shell />
      </MarketsProvider>
    </UserProvider>
  );
}

function Shell() {
  const [route, navigate] = useHashRoute();
  const { connection } = useMarkets();
  const { user } = useUser();

  return (
    <div className="min-h-screen">
      <Header onHome={() => navigate("home")} connection={connection} />

      <main className="mx-auto max-w-6xl px-5 py-8">
        {route.tab !== "home" && (
          <div className="mb-6 flex items-center gap-2">
            <button
              onClick={() => navigate("home")}
              className={cn("inline-flex items-center gap-1 text-sm font-medium transition hover:text-neutral-900 dark:hover:text-white", subtle)}
            >
              <ChevronLeft size={15} strokeWidth={2.2} /> Dashboard
            </button>
            <span className={cn("text-sm", subtle)}>/</span>
            <span className={cn(label, "!text-[11px]")}>{PAGE_TITLE[route.tab]}</span>
          </div>
        )}

        {route.tab === "home" ? (
          <Home onNav={navigate} />
        ) : !user ? (
          <SignInGate />
        ) : route.tab === "markets" ? (
          <Markets selectedId={route.sessionId} onSelect={(id) => navigate("markets", id)} />
        ) : route.tab === "buyer" ? (
          <BuyerDesk />
        ) : route.tab === "seller" ? (
          <SellerTerminal />
        ) : (
          <Registry />
        )}
      </main>
      <footer className={cn("mx-auto max-w-6xl px-5 pb-10 pt-4 text-center text-xs", subtle)}>
        Handshake · one buyer agent, many seller agents, one autonomous market — settled on Monad.
      </footer>
    </div>
  );
}

function SignInGate() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className={cn(card, "flex w-full max-w-sm flex-col gap-4 p-7")}>
        <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
        <WalletPicker />
      </div>
    </div>
  );
}
