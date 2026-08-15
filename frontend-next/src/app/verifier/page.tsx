"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, StatCard, EmptyState, ErrorNotice, Spinner } from "@/components/ui";
import { AuthGate } from "@/components/AuthGate";
import { useContract } from "@/lib/web3/useContract";
import { useWallet } from "@/lib/web3/WalletProvider";

interface Party {
  address: string;
  verified: boolean;
}

export default function VerifierDashboard() {
  const { account } = useWallet();
  const contractorRepo = useContract("ContractorRepo");
  const officerRepo = useContract("GovernmentOfficerRepo");

  const [contractors, setContractors] = useState<Party[]>([]);
  const [officers, setOfficers] = useState<Party[]>([]);
  const [canVerify, setCanVerify] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    // No wallet/provider yet: nothing to read, so stop showing the spinner.
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

      if (account) {
        const role = await contractorRepo.VERIFIER_ROLE();
        setCanVerify(await contractorRepo.hasRole(role, account));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read chain state");
    } finally {
      setLoading(false);
    }
  }, [contractorRepo, officerRepo, account]);

  useEffect(() => {
  // Fetch on mount. Every setState inside the loader runs after an await, so
  // this does not cause the cascading synchronous renders the rule guards
  // against, but the rule cannot see through the async boundary.
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
      setError(
        /AccessControl/i.test(message)
          ? "Your account does not hold VERIFIER_ROLE on this registry. Ask the admin to grant it."
          : message
      );
    } finally {
      setPending(null);
    }
  }

  const pendingContractors = contractors.filter((c) => !c.verified);
  const pendingOfficers = officers.filter((o) => !o.verified);

  function renderList(kind: "contractor" | "officer", rows: Party[]) {
    if (rows.length === 0) {
      return <EmptyState title="Nothing awaiting verification" />;
    }
    return (
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li
            key={row.address}
            className="flex items-center justify-between gap-4 py-3"
          >
            <span className="font-mono text-xs text-slate-700">
              {row.address}
            </span>
            <button
              onClick={() => void verify(kind, row.address)}
              disabled={pending === row.address || canVerify === false}
              className="rounded-lg bg-[color:var(--brand-to)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending === row.address ? "Verifying…" : "Verify"}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <DashboardShell
      title="Verifier"
      subtitle="Approve participants and attest to milestone completion"
    >
      <AuthGate roles={["verifier", "admin"]}>
      {account && canVerify === false && (
        <ErrorNotice message="This account does not hold VERIFIER_ROLE. Verification buttons are disabled. The registry admin can grant the role." />
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Contractors pending" value={pendingContractors.length} />
        <StatCard label="Officers pending" value={pendingOfficers.length} />
        <StatCard
          label="Your role"
          value={canVerify === null ? "—" : canVerify ? "Verifier" : "None"}
        />
      </div>

      {error && <ErrorNotice message={error} />}

      <Card title="Contractors awaiting verification">
        {loading ? (
          <Spinner label="Reading registries…" />
        ) : (
          renderList("contractor", pendingContractors)
        )}
      </Card>

      <Card title="Officers awaiting verification">
        {loading ? (
          <Spinner label="Reading registries…" />
        ) : (
          renderList("officer", pendingOfficers)
        )}
      </Card>
      </AuthGate>
    </DashboardShell>
  );
}
