"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useWallet } from "@/lib/web3/WalletProvider";
import type { SignUpProfile, UserType } from "@/lib/api/types";
import { Badge, Button, Card, Notice, cn } from "./ui";

const ROLE_OPTIONS: { value: UserType; label: string; hint: string }[] = [
  { value: "contractor", label: "Contractor", hint: "Bid on public tenders" },
  {
    value: "public_verifier",
    label: "Public verifier",
    hint: "Scrutinise claims by staking",
  },
];

const field =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text " +
  "outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent";

const label = "mb-1.5 block text-xs font-medium text-text-muted";

type Mode = "signin" | "register";

/* ------------------------------------------------------------ password tab */

function PasswordForm({ mode }: { mode: Mode }) {
  const { signInWithPassword, register, status, error } = useAuth();
  const busy = status === "signingIn";

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phoneNumber: "",
    userType: "contractor" as UserType,
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === "signin") {
          void signInWithPassword(form.email, form.password);
        } else {
          void register(form);
        }
      }}
    >
      {error && <Notice tone="danger">{error}</Notice>}

      {mode === "register" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              required
              minLength={2}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              required
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              title="10-digit Indian mobile number"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              className={field}
            />
          </div>
        </div>
      )}

      <div>
        <label className={label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={field}
        />
      </div>

      <div>
        <label className={label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className={field}
        />
        {mode === "register" && (
          <p className="mt-1.5 text-xs text-text-subtle">
            At least 12 characters, mixing two of: lowercase, uppercase, digits,
            symbols.
          </p>
        )}
      </div>

      {mode === "register" && (
        <div>
          <label className={label} htmlFor="role">
            I am a
          </label>
          <select
            id="role"
            value={form.userType}
            onChange={(e) =>
              setForm({ ...form, userType: e.target.value as UserType })
            }
            className={field}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} — {r.hint}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-text-subtle">
            Officer and verifier accounts are granted by an administrator, not
            self-selected.
          </p>
        </div>
      )}

      <Button type="submit" loading={busy} className="w-full">
        {mode === "signin" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------- wallet-only path */

function ProfileForm() {
  const { signIn, error, status } = useAuth();
  const [form, setForm] = useState<SignUpProfile>({
    fullName: "",
    email: "",
    phoneNumber: "",
    userType: "contractor",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void signIn(form);
      }}
      className="space-y-3"
    >
      <p className="text-sm text-text-muted">
        This wallet hasn&apos;t been seen before. Add a few details to finish
        registering, then sign once more to confirm.
      </p>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Full name</label>
          <input
            required
            minLength={2}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Phone number</label>
          <input
            required
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label className={label}>I am a</label>
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
        </div>
      </div>

      <p className="text-xs leading-relaxed text-text-subtle">
        The role you pick records how you intend to use the system. It does not
        grant on-chain authority — a registry admin still has to grant the
        matching role before privileged actions succeed.
      </p>

      <Button type="submit" loading={status === "signingIn"} className="w-full">
        Register and sign in
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------- panel */

export function AuthPanel() {
  const { hasMetaMask, account, connect, isConnecting, isWrongNetwork, chainId } =
    useWallet();
  const { status, signIn, error, isRegistering } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");

  if (status === "loading") {
    return (
      <Card>
        <p className="text-sm text-text-muted">Restoring your session…</p>
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
    <Card padded={false}>
      <div className="flex border-b border-border">
        {(["signin", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-selected={mode === m}
            role="tab"
            className={cn(
              "flex-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              mode === m
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-5">
        <PasswordForm mode={mode} />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-text-subtle">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Wallet path. Presented as an alternative rather than a requirement,
            because a wallet is only needed to transact. */}
        <div className="space-y-2.5">
          {!hasMetaMask ? (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="flex h-10 w-full items-center justify-center rounded-lg border border-border bg-surface-raised text-sm font-medium text-text transition-colors hover:bg-surface-hover"
            >
              Install MetaMask to use a wallet
            </a>
          ) : !account ? (
            <Button
              variant="secondary"
              loading={isConnecting}
              onClick={() => void connect()}
              className="w-full"
            >
              Connect a wallet
            </Button>
          ) : (
            <>
              {isWrongNetwork && (
                <Notice tone="warning">
                  Your wallet is on chain {chainId}; this deployment expects{" "}
                  {process.env.NEXT_PUBLIC_CHAIN_ID ?? 1337}. Switch networks
                  before signing.
                </Notice>
              )}
              <Button
                variant="secondary"
                loading={status === "signingIn"}
                onClick={() => void signIn()}
                className="w-full"
              >
                Sign in with wallet
              </Button>
              <p className="text-center text-xs text-text-subtle">
                Signing proves you control{" "}
                <span className="font-mono">
                  {account.slice(0, 6)}…{account.slice(-4)}
                </span>
                . It costs no gas.
              </p>
            </>
          )}

          <p className="text-center text-xs text-text-subtle">
            <Badge tone="neutral">No wallet needed</Badge>{" "}
            <span className="ml-1">
              to browse tenders, read reports or manage your profile.
            </span>
          </p>
        </div>

        {error && status !== "signingIn" && (
          <Notice tone="danger">{error}</Notice>
        )}
      </div>
    </Card>
  );
}
