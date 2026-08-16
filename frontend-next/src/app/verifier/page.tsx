"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { AuthGate } from "@/components/AuthGate";
import {
  Address,
  ApprovalCard,
  Badge,
  Card,
  EmptyState,
  Notice,
  RequirementCard,
  SkeletonRows,
  Stat,
} from "@/components/ui";
import { useContract } from "@/lib/web3/useContract";
import { useAuth } from "@/lib/auth/AuthProvider";

interface Party {
  address: string;
  verified: boolean;
}

export default function VerifierDashboard() {
  const contractorRepo = useContract("ContractorRepo");
  const officerRepo = useContract("GovernmentOfficerRepo");
  const { sessionWallet } = useAuth();

  const [contractors, setContractors] = useState<Party[]>([]);
  const [officers, setOfficers] = useState<Party[]>([]);
  const [canVerify, setCanVerify] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractorRepo || !officerRepo) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const contractorAddrs: string[] = await contractorRepo.getContractors();
      const contractorRows = await Promise.all(
        contractorAddrs.map(async (address) => ({
          address,
          verified: await contractorRepo.getVerificationStatus(address),
        }))
      );

      const officerAddrs: string[] = await officerRepo.getOfficers();
      const officerRows = await Promise.all(
        officerAddrs.map(async (address) => ({
          address,
          verified: await officerRepo.getVerifiedStatus(address),
        }))
      );

      setContractors(contractorRows);
      setOfficers(officerRows);

      if (sessionWallet) {
        const role = await contractorRepo.VERIFIER_ROLE();
        setCanVerify(await contractorRepo.hasRole(role, sessionWallet));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to read chain state"
      );
    } finally {
      setLoading(false);
    }
  }, [contractorRepo, officerRepo, sessionWallet]);

  useEffect(() => {
    // See note in the officer dashboard: state updates happen post-await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function verify(kind: "contractor" | "officer", address: string) {
    const repo = kind === "contractor" ? contractorRepo : officerRepo;
    if (!repo) return;

    setPending(address);
    setError(null);
    try {
      const tx =
        kind === "contractor"
          ? await repo.verifyContractor(address)
          : await repo.verifyOfficer(address);
      await tx.wait();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Contract reverts are unreadable; translate the one users actually hit.
      setError(
        /AccessControl/i.test(message)
          ? "Your wallet doesn't hold VERIFIER_ROLE on this registry. A registry administrator has to grant it before you can verify."
          : /user rejected|4001/i.test(message)
            ? "You rejected the transaction in your wallet."
            : message
      );
    } finally {
      setPending(null);
    }
  }

  const pendingContractors = useMemo(
    () => contractors.filter((c) => !c.verified),
    [contractors]
  );
  const pendingOfficers = useMemo(
    () => officers.filter((o) => !o.verified),
    [officers]
  );

  const blocked = !sessionWallet || canVerify === false;
  const blockedReason = !sessionWallet
    ? "Connect and sign with a wallet to verify."
    : "Your wallet doesn't hold VERIFIER_ROLE.";

  function queue(
    kind: "contractor" | "officer",
    rows: Party[],
    emptyLabel: string
  ) {
    if (loading) return <SkeletonRows rows={2} />;
    if (rows.length === 0) {
      return <EmptyState title={emptyLabel} />;
    }
    return (
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <ApprovalCard
            key={row.address}
            title={<Address value={row.address} />}
            subtitle={
              kind === "contractor"
                ? "Registered contractor awaiting approval"
                : "Registered officer awaiting approval"
            }
            meta={<Badge tone="warning">Unverified</Badge>}
            approveLabel="Verify"
            onApprove={() => void verify(kind, row.address)}
            pending={pending === row.address}
            disabled={blocked}
            disabledReason={blocked ? blockedReason : undefined}
          />
        ))}
      </ul>
    );
  }

  return (
    <DashboardShell
      title="Verification"
      subtitle="Approve participants and attest to milestone completion"
    >
      <AuthGate roles={["verifier", "public_verifier", "admin"]}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Contractors pending"
            value={pendingContractors.length}
            tone={pendingContractors.length ? "warning" : "neutral"}
            loading={loading}
          />
          <Stat
            label="Officers pending"
            value={pendingOfficers.length}
            tone={pendingOfficers.length ? "warning" : "neutral"}
            loading={loading}
          />
          <Stat
            label="On-chain authority"
            value={canVerify === null ? "—" : canVerify ? "Granted" : "None"}
            tone={canVerify ? "success" : "warning"}
            hint={canVerify === false ? "VERIFIER_ROLE not held" : undefined}
            loading={loading}
          />
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        {!sessionWallet ? (
          <RequirementCard tone="info" title="Verification needs a wallet">
            Approving a participant writes to the registry, so it has to be
            signed. You can review the queues below without one.
          </RequirementCard>
        ) : (
          canVerify === false && (
            <RequirementCard
              tone="warning"
              title="Your wallet cannot verify yet"
            >
              Being marked a verifier in this application does not grant
              on-chain authority. A registry administrator must grant{" "}
              <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">
                VERIFIER_ROLE
              </code>{" "}
              to your wallet — the contracts enforce this independently, which
              is what stops the database becoming a second, weaker source of
              truth.
            </RequirementCard>
          )
        )}

        <Card
          title="Contractors awaiting verification"
          actions={
            pendingContractors.length > 0 ? (
              <Badge tone="warning">{pendingContractors.length}</Badge>
            ) : undefined
          }
        >
          {queue("contractor", pendingContractors, "Nothing awaiting approval")}
        </Card>

        <Card
          title="Officers awaiting verification"
          actions={
            pendingOfficers.length > 0 ? (
              <Badge tone="warning">{pendingOfficers.length}</Badge>
            ) : undefined
          }
        >
          {queue("officer", pendingOfficers, "Nothing awaiting approval")}
        </Card>
      </AuthGate>
    </DashboardShell>
  );
}
