"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { EXPECTED_CHAIN_ID } from "@/lib/contracts/addresses";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: never[]) => void) => void;
  removeListener: (event: string, handler: (...args: never[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

interface WalletState {
  account: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  isConnecting: boolean;
  error: string | null;
  hasMetaMask: boolean;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

/**
 * window.ethereum is usually present before our scripts run, but not always:
 * an extension can inject late and announce itself with `ethereum#initialized`.
 * Subscribing to that (plus a short fallback poll) means a late injection is
 * picked up instead of the UI being stuck on "install MetaMask".
 */
function subscribeToEthereum(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("ethereum#initialized", onChange);

  // Fallback for wallets that inject without announcing. Bounded, so this is
  // not a permanent timer.
  let checks = 0;
  const interval = window.setInterval(() => {
    checks += 1;
    if (window.ethereum || checks > 10) {
      window.clearInterval(interval);
      onChange();
    }
  }, 200);

  return () => {
    window.removeEventListener("ethereum#initialized", onChange);
    window.clearInterval(interval);
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Injected-provider presence is external state that differs between server
  // and client, so it is read through useSyncExternalStore rather than being
  // assigned in an effect.
  const hasMetaMask = useSyncExternalStore(
    subscribeToEthereum,
    () => !!window.ethereum,
    () => false
  );

  const syncFromProvider = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const browserProvider = new BrowserProvider(window.ethereum);
    const accounts = (await window.ethereum.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts.length) {
      setAccount(null);
      setSigner(null);
      return;
    }

    const network = await browserProvider.getNetwork();
    const nextSigner = await browserProvider.getSigner();

    setProvider(browserProvider);
    setSigner(nextSigner);
    setAccount(accounts[0]);
    setChainId(Number(network.chainId));
  }, []);

  const connect = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined" || !window.ethereum) {
      setError(
        "MetaMask was not detected. Install the extension, then reload this page."
      );
      return;
    }

    setIsConnecting(true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await syncFromProvider();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet";
      // 4001 is the EIP-1193 user-rejected code; not worth surfacing as a fault.
      setError(
        /user rejected|4001/i.test(message)
          ? "Connection request was rejected in MetaMask."
          : message
      );
    } finally {
      setIsConnecting(false);
    }
  }, [syncFromProvider]);

  const disconnect = useCallback(() => {
    // MetaMask has no programmatic disconnect; clear local state only.
    setAccount(null);
    setSigner(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    // Read the already-authorised account on mount. Every setState inside
    // syncFromProvider runs after an await, so this does not cause the
    // cascading synchronous renders the rule guards against, but the rule
    // cannot see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncFromProvider();

    const onAccountsChanged = () => void syncFromProvider();
    const onChainChanged = () => void syncFromProvider();

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener("chainChanged", onChainChanged);
    };
  }, [syncFromProvider]);

  const value = useMemo<WalletState>(
    () => ({
      account,
      chainId,
      provider,
      signer,
      isConnecting,
      error,
      hasMetaMask,
      isWrongNetwork: chainId !== null && chainId !== EXPECTED_CHAIN_ID,
      connect,
      disconnect,
    }),
    [
      account,
      chainId,
      provider,
      signer,
      isConnecting,
      error,
      hasMetaMask,
      connect,
      disconnect,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside a WalletProvider");
  }
  return ctx;
}
