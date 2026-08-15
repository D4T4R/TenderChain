"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/lib/web3/WalletProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { EXPECTED_CHAIN_ID } from "@/lib/contracts/addresses";

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Header control showing both wallet and session state.
 *
 * These are distinct: a connected wallet only exposes an address, whereas being
 * signed in means the server has verified a signature from it.
 */
export function WalletButton() {
  const {
    account,
    connect,
    isConnecting,
    error: walletError,
    hasMetaMask,
    isWrongNetwork,
    chainId,
  } = useWallet();

  const { status, user, signIn, signOut, error: authError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // A brand-new wallet needs registration details, which only the sign-in page
  // renders. Without this the header button would appear to do nothing.
  useEffect(() => {
    if (status === "needsProfile" && pathname !== "/signin") {
      router.push(`/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

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
        {walletError && (
          <span className="max-w-xs text-right text-xs text-red-100">
            {walletError}
          </span>
        )}
      </div>
    );
  }

  const signedIn = status === "signedIn" && user;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {isWrongNetwork && (
          <span className="rounded-md bg-amber-400/90 px-2 py-1 text-xs font-medium text-amber-950">
            Chain {chainId}, expected {EXPECTED_CHAIN_ID}
          </span>
        )}

        {signedIn ? (
          <>
            <span className="flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-white">
                {user.fullName}
              </span>
              <span className="font-mono text-xs text-white/70">
                {shorten(user.walletAddress)} ·{" "}
                {user.userType.replace(/_/g, " ")}
              </span>
            </span>
            <button
              onClick={() => void signOut()}
              className="rounded-lg bg-white/20 px-3 py-2 text-sm text-white transition hover:bg-white/30"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <span className="rounded-lg bg-white/20 px-3 py-2 font-mono text-sm text-white">
              {shorten(account)}
            </span>
            <button
              onClick={() => void signIn()}
              disabled={status === "signingIn" || status === "loading"}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-to)] transition hover:bg-white/90 disabled:opacity-60"
            >
              {status === "signingIn" ? "Check wallet…" : "Sign in"}
            </button>
          </>
        )}
      </div>

      {authError && (
        <span className="max-w-xs text-right text-xs text-red-100">
          {authError}
        </span>
      )}
    </div>
  );
}
