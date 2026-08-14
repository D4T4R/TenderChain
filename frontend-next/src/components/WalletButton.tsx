"use client";

import { useWallet } from "@/lib/web3/WalletProvider";
import { EXPECTED_CHAIN_ID } from "@/lib/contracts/addresses";

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const {
    account,
    connect,
    disconnect,
    isConnecting,
    error,
    hasMetaMask,
    isWrongNetwork,
    chainId,
  } = useWallet();

  if (!hasMetaMask) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30"
      >
        Install MetaMask
      </a>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => void connect()}
          disabled={isConnecting}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-to)] transition hover:bg-white/90 disabled:opacity-60"
        >
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </button>
        {error && (
          <span className="max-w-xs text-right text-xs text-red-100">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isWrongNetwork && (
        <span className="rounded-md bg-amber-400/90 px-2 py-1 text-xs font-medium text-amber-950">
          Wrong network (chain {chainId}, expected {EXPECTED_CHAIN_ID})
        </span>
      )}
      <span className="rounded-lg bg-white/20 px-3 py-2 font-mono text-sm text-white">
        {shorten(account)}
      </span>
      <button
        onClick={disconnect}
        className="text-sm text-white/70 transition hover:text-white"
      >
        Disconnect
      </button>
    </div>
  );
}
