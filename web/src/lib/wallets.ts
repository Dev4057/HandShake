/**
 * Wallet connectors — MetaMask and Phantom via their injected EVM providers,
 * WalletConnect via the official SDK (QR modal, any mobile wallet).
 * Each returns a checksum-ish 0x address or throws with a human message.
 */

export type WalletKind = "metamask" | "phantom" | "walletconnect";

interface EthProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  providers?: EthProvider[];
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

function injected(kind: "metamask" | "phantom"): EthProvider | null {
  const w = window as unknown as { ethereum?: EthProvider; phantom?: { ethereum?: EthProvider } };
  if (kind === "phantom") {
    const p = w.phantom?.ethereum ?? w.ethereum?.providers?.find((x) => x.isPhantom);
    return p ?? (w.ethereum?.isPhantom ? w.ethereum : null);
  }
  // metamask — when several extensions inject, pick the real one from the list
  if (w.ethereum?.providers?.length) return w.ethereum.providers.find((x) => x.isMetaMask) ?? null;
  if (w.ethereum?.isMetaMask) return w.ethereum;
  // a single non-flagged injected provider still works as a browser wallet
  return w.ethereum && !w.ethereum.isPhantom ? w.ethereum : null;
}

export function walletAvailable(kind: WalletKind): boolean {
  if (kind === "walletconnect") return true; // SDK-based, no extension needed
  return injected(kind) !== null;
}

export async function connectWallet(kind: WalletKind): Promise<string> {
  if (kind === "walletconnect") return connectWalletConnect();

  const provider = injected(kind);
  if (!provider) {
    throw new Error(kind === "metamask" ? "MetaMask not detected — install the extension." : "Phantom not detected — install the extension.");
  }
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const addr = accounts?.[0];
  if (!addr || !ADDR_RE.test(addr)) throw new Error("No account returned by the wallet.");
  return addr.toLowerCase(); // one canonical form — ownership matching is exact
}

async function connectWalletConnect(): Promise<string> {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  if (!projectId) {
    throw new Error("WalletConnect needs a project id — set VITE_WALLETCONNECT_PROJECT_ID in web/.env (free at cloud.reown.com).");
  }
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const wc = await EthereumProvider.init({
    projectId,
    optionalChains: [10143], // Monad testnet
    rpcMap: { 10143: "https://testnet-rpc.monad.xyz" },
    showQrModal: true,
    metadata: {
      name: "Handshake",
      description: "Autonomous agent marketplace on Monad",
      url: window.location.origin,
      icons: [],
    },
  });
  // WalletConnect persists sessions — drop any old one so the QR always shows
  // and YOU choose which wallet/account to connect this time.
  if (wc.session) {
    try {
      await wc.disconnect();
    } catch { /* stale session — safe to ignore */ }
  }
  await wc.enable(); // opens the QR modal
  const addr = wc.accounts[0];
  if (!addr || !ADDR_RE.test(addr)) throw new Error("No account returned by WalletConnect.");
  return addr.toLowerCase();
}
