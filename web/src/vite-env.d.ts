/// <reference types="vite/client" />

// css-only side-effect packages
declare module "@fontsource-variable/inter";
declare module "@fontsource/jetbrains-mono/*";

// injected by wallet extensions (MetaMask etc.)
interface Window {
  ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
}
