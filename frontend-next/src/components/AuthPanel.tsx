"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useWallet } from "@/lib/web3/WalletProvider";
import type { SignUpProfile, UserType } from "@/lib/api/types";
import { Card, ErrorNotice } from "./ui";

const ROLE_OPTIONS: { value: UserType; label: string }[] = [
  { value: "contractor", label: "Contractor" },
  { value: "government_officer", label: "Government Officer" },
  { value: "verifier", label: "Verifier" },
];

/**
 * Collects the fields the backend requires the first time a wallet signs in.
 */
function ProfileForm() {
  const { signIn, error, status } = useAuth();
  const [form, setForm] = useState<SignUpProfile>({
    fullName: "",
    email: "",
    phoneNumber: "",
    userType: "contractor",
  });

  const busy = status === "signingIn";

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[color:var(--brand-to)]";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void signIn(form);
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-600">
        This wallet hasn&apos;t been seen before. Add a few details to finish
        registering, then sign once more to confirm.
      </p>

      {error && <ErrorNotice message={error} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Full name
          </span>
          <input
            required
            minLength={2}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className={field}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Email
          </span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={field}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Phone number
          </span>
          <input
            required
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            title="10-digit Indian mobile number"
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            className={field}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Role
          </span>
          <select
            value={form.userType}
            onChange={(e) =>
              setForm({ ...form, userType: e.target.value as UserType })
            }
            className={field}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-slate-500">
        The role you pick here records how you intend to use the system. It does
        not grant on-chain authority: a registry admin still has to grant the
        matching role on the contracts before privileged actions will succeed.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[color:var(--brand-to)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Waiting for signature…" : "Register and sign in"}
      </button>
    </form>
  );
}

/**
 * Gate shown on protected pages. Walks the user through connect -> sign in.
 */
export function AuthPanel() {
  const { hasMetaMask, account, connect, isConnecting, isWrongNetwork, chainId } =
    useWallet();
  const { status, signIn, error, isRegistering } = useAuth();

  if (status === "loading") {
    return (
      <Card>
        <p className="text-sm text-slate-500">Restoring your session…</p>
      </Card>
    );
  }

  if (!hasMetaMask) {
    return (
      <Card title="MetaMask required">
        <p className="text-sm text-slate-600">
          This dashboard signs you in with your wallet. Install MetaMask, then
          reload this page.
        </p>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-lg bg-[color:var(--brand-to)] px-4 py-2 text-sm font-semibold text-white"
        >
          Get MetaMask
        </a>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card title="Connect your wallet">
        <p className="text-sm text-slate-600">
          Connect the wallet you want to sign in with. Nothing is sent to the
          server until you sign.
        </p>
        {error && <div className="mt-3"><ErrorNotice message={error} /></div>}
        <button
          onClick={() => void connect()}
          disabled={isConnecting}
          className="mt-4 rounded-lg bg-[color:var(--brand-to)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
      </Card>
    );
  }

  if (status === "needsProfile" || isRegistering) {
    return (
      <Card title="Finish registering">
        <ProfileForm />
      </Card>
    );
  }

  return (
    <Card title="Sign in">
      <p className="text-sm text-slate-600">
        Sign a message to prove you control{" "}
        <span className="font-mono text-xs">{account}</span>. This is a
        signature, not a transaction: it costs no gas.
      </p>

      {isWrongNetwork && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Your wallet is on chain {chainId}, but this deployment expects{" "}
          {process.env.NEXT_PUBLIC_CHAIN_ID ?? 1337}. Switch networks before
          signing, or the signature will be rejected.
        </p>
      )}

      {error && <div className="mt-3"><ErrorNotice message={error} /></div>}

      <button
        onClick={() => void signIn()}
        disabled={status === "signingIn"}
        className="mt-4 rounded-lg bg-[color:var(--brand-to)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {status === "signingIn" ? "Check your wallet…" : "Sign in with wallet"}
      </button>
    </Card>
  );
}
