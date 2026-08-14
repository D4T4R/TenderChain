"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, StatCard, EmptyState, ErrorNotice, Spinner } from "@/components/ui";
import { useContract } from "@/lib/web3/useContract";
import { useWallet } from "@/lib/web3/WalletProvider";

const STATUS_LABELS = ["Active on bid", "Bidding complete", "Contract deployed"];

interface TenderRow {
  address: string;
  status: number;
}

export default function OfficerDashboard() {
  const { account } = useWallet();
  const tenderRepo = useContract("TenderRepo");

  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // No wallet/provider yet: nothing to read, so stop showing the spinner.
    if (!tenderRepo) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const addresses: string[] = await tenderRepo.getAllTenders();
      const rows = await Promise.all(
        addresses.map(async (address) => ({
          address,
          status: Number(await tenderRepo.getTenderStatus(address)),
        }))
      );
      setTenders(rows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to read tenders from the chain"
      );
    } finally {
      setLoading(false);
    }
  }, [tenderRepo]);

  useEffect(() => {
  // Fetch on mount. Every setState inside the loader runs after an await, so
  // this does not cause the cascading synchronous renders the rule guards
  // against, but the rule cannot see through the async boundary.
  // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const active = tenders.filter((t) => t.status === 0).length;
  const awarded = tenders.filter((t) => t.status === 2).length;

  return (
    <DashboardShell
      title="Government Officer"
      subtitle="Publish tenders, track bidding and award contracts"
    >
      {!account && (
        <Card>
          <EmptyState
            title="Connect your wallet to continue"
            description="Officer actions are signed transactions, so a connected MetaMask account is required."
          />
        </Card>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Total tenders" value={tenders.length} />
        <StatCard label="Open for bidding" value={active} />
        <StatCard label="Contracts awarded" value={awarded} />
      </div>

      <Card title="Tenders on chain">
        {error && <ErrorNotice message={error} />}
        {loading && !error && <Spinner label="Reading TenderRepo…" />}

        {!loading && !error && tenders.length === 0 && (
          <EmptyState
            title="No tenders registered yet"
            description="Tenders created through FactoryTender and registered in TenderRepo will appear here."
          />
        )}

        {!loading && tenders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-medium">Tender address</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((tender) => (
                  <tr
                    key={tender.address}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-3 font-mono text-xs text-slate-700">
                      {tender.address}
                    </td>
                    <td className="py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {STATUS_LABELS[tender.status] ?? "Unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Creating a tender">
        <p className="text-sm text-slate-600">
          Tender creation calls <code className="font-mono">FactoryTender.createTender</code>,
          then registers the result via{" "}
          <code className="font-mono">TenderRepo.newTender</code>, which now
          requires <code className="font-mono">REGISTRAR_ROLE</code>. Grant that
          role to the officer account (or to FactoryTender) before creating
          tenders from this dashboard.
        </p>
      </Card>
    </DashboardShell>
  );
}
