"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/lib/web3/WalletProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { EXPECTED_CHAIN_ID } from "@/lib/contracts/addresses";
import { Badge, Button, cn } from "./ui";

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const ROLE_LABELS: Record<string, string> = {
  government_officer: "Officer",
  contractor: "Contractor",
  verifier: "Verifier",
  public_verifier: "Public verifier",
  admin: "Admin",
};

/**
 * Session control.
 *
 * Shows account and wallet as separate facts, because they are: you can be
 * signed in without a wallet (read, reports, profile) and connected without
 * being signed in. Conflating them is what made the old header misleading.
 */
export function WalletButton() {
  const {
    account,
    connect,
    isConnecting,
    hasMetaMask,
    isWrongNetwork,
    chainId,
  } = useWallet();

  const { status, user, sessionWallet, signIn, signOut, error: authError } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A brand-new wallet needs registration details, which only the sign-in page
  // renders. Without this the button would appear to do nothing.
  useEffect(() => {
    if (status === "needsProfile" && pathname !== "/signin") {
      router.push(`/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-sunken" />;
  }

  if (status !== "signedIn" || !user) {
    return (
      <Button size="sm" onClick={() => router.push("/signin")}>
        Sign in
      </Button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-subtle text-[10px] font-semibold text-accent">
          {user.fullName.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-xs font-medium text-text">
            {user.fullName}
          </span>
          <span className="block truncate text-[10px] text-text-subtle">
            {ROLE_LABELS[user.userType] ?? user.userType}
          </span>
        </span>
        <svg
          viewBox="0 0 16 16"
          className={cn(
            "size-3 shrink-0 text-text-subtle transition-transform",
            open && "rotate-180"
          )}
          fill="none"
          aria-hidden
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-72 rounded-card border border-border bg-surface-raised p-3 shadow-lg"
          >
            <div className="pb-2">
              <p className="truncate text-sm font-medium text-text">
                {user.fullName}
              </p>
              <p className="truncate text-xs text-text-muted">{user.email}</p>
            </div>

            <div className="space-y-2 border-t border-border pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-subtle">Wallet</span>
                {account ? (
                  <span className="font-mono text-xs text-text">
                    {shorten(account)}
                  </span>
                ) : (
                  <Badge tone="neutral">Not connected</Badge>
                )}
              </div>

              {account && isWrongNetwork && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-subtle">Network</span>
                  <Badge tone="warning">
                    Chain {chainId}, expected {EXPECTED_CHAIN_ID}
                  </Badge>
                </div>
              )}

              {!account && (
                <p className="text-xs leading-relaxed text-text-subtle">
                  You can browse and manage your profile without a wallet.
                  Connect one to sign transactions.
                </p>
              )}
            </div>

            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              {!account && hasMetaMask && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={isConnecting}
                  onClick={() => void connect()}
                  className="flex-1"
                >
                  Connect wallet
                </Button>
              )}
              {account && !sessionWallet && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void signIn()}
                  className="flex-1"
                >
                  Link wallet
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="flex-1"
              >
                Sign out
              </Button>
            </div>

            {authError && (
              <p className="mt-2 text-xs text-danger">{authError}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
