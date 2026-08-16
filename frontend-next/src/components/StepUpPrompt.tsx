"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useWallet } from "@/lib/web3/WalletProvider";
import { EXPECTED_CHAIN_ID } from "@/lib/contracts/addresses";
import { Button, Notice, RequirementCard } from "./ui";

/**
 * Explains why an on-chain action is unavailable and offers the fix.
 *
 * The three blocked states have different remedies and must not be collapsed:
 * no wallet connected (connect it), connected but not proven to the server
 * (sign), and proven but on the wrong network (switch). Showing one generic
 * "you can't do that" would leave the user with no way forward.
 */
export function StepUpPrompt({
  action = "This action",
  compact = false,
}: {
  /** What the user was trying to do, for the explanation. */
  action?: string;
  compact?: boolean;
}) {
  const { hasMetaMask, account, connect, isConnecting, isWrongNetwork, chainId } =
    useWallet();
  const { stepUp, isSteppingUp, sessionWallet, error } = useAuth();

  if (!hasMetaMask) {
    return (
      <RequirementCard tone="info" title="A wallet is required">
        {action} is recorded on chain, so it has to be signed by a wallet.
        Install MetaMask, then reload this page.
      </RequirementCard>
    );
  }

  const body = !account ? (
    <>
      <p>
        {action} is recorded on chain, so it has to be signed. Connect the
        wallet you want to sign with — you stay signed in either way.
      </p>
      <Button
        className="mt-3"
        size={compact ? "sm" : "md"}
        loading={isConnecting}
        onClick={() => void connect()}
      >
        Connect wallet
      </Button>
    </>
  ) : (
    <>
      <p>
        {sessionWallet
          ? "Your wallet needs re-confirming before you can sign again. This expires periodically on purpose."
          : `${action} is recorded on chain. Sign once to prove you control this wallet — it costs no gas and does not start a new session.`}
      </p>

      {isWrongNetwork && (
        <p className="mt-2 text-xs">
          Your wallet is on chain {chainId}; this deployment expects{" "}
          {EXPECTED_CHAIN_ID}. Switch networks first or the signature will be
          rejected.
        </p>
      )}

      <Button
        className="mt-3"
        size={compact ? "sm" : "md"}
        loading={isSteppingUp}
        onClick={() => void stepUp()}
      >
        {isSteppingUp ? "Check your wallet…" : "Confirm wallet to continue"}
      </Button>

      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
    </>
  );

  return (
    <RequirementCard
      tone={sessionWallet ? "warning" : "info"}
      title={
        sessionWallet ? "Confirm your wallet again" : "Confirm your wallet"
      }
    >
      {body}
    </RequirementCard>
  );
}

/**
 * Renders children only when the session can transact; otherwise explains what
 * is missing.
 *
 * A UX guard, not a security boundary — the API refuses independently. Its job
 * is to replace a dead button with a route forward.
 */
export function RequireTransact({
  children,
  action,
  fallback,
}: {
  children: ReactNode;
  action?: string;
  fallback?: ReactNode;
}) {
  const { canTransact } = useAuth();

  if (canTransact) return <>{children}</>;
  return <>{fallback ?? <StepUpPrompt action={action} />}</>;
}
