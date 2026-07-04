import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { connectWallet, type WalletKind } from "./wallets";

/**
 * Account identity. Wallet-first: MetaMask, Phantom, or WalletConnect — the
 * address IS the identity and agent ownership binds to it. A plain handle
 * remains as a fallback for browsers without any wallet.
 */
const KEY = "hs-user";

const Ctx = createContext<{
  user: string | null;
  signIn: (handle: string) => boolean;
  connect: (kind: WalletKind) => Promise<void>; // throws with a human message
  signOut: () => void;
}>({
  user: null,
  signIn: () => false,
  connect: async () => {},
  signOut: () => {},
});

export const HANDLE_RE = /^[\w.-]{2,42}$/;

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem(KEY));

  useEffect(() => {
    if (user) localStorage.setItem(KEY, user);
    else localStorage.removeItem(KEY);
  }, [user]);

  const signIn = (handle: string): boolean => {
    let h = handle.trim().replace(/^@/, "");
    if (!HANDLE_RE.test(h)) return false;
    if (/^0x[0-9a-fA-F]{40}$/.test(h)) h = h.toLowerCase(); // addresses: one canonical form
    setUser(h);
    return true;
  };

  const connect = async (kind: WalletKind): Promise<void> => {
    setUser(await connectWallet(kind));
  };

  return (
    <Ctx.Provider value={{ user, signIn, connect, signOut: () => setUser(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useUser = () => useContext(Ctx);
