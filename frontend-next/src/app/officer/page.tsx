"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { AuthGate } from "@/components/AuthGate";
import {
  Address,
  Card,
  DataTable,
  Notice,
  RequirementCard,
  SectionHeader,
  Stat,
  StatusBadge,
  type Column,
} from "@/components/ui";
import { useContract } from "@/lib/web3/useContract";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Lifecycle states, named the way a procurement officer would describe them
 * rather than by their enum index.
 */
const STATUS = [
  { label: "Open for bidding", tone: "success" as const },
  { label: "Bidding closed", tone: "warning" as const },
  { label: "Contract awarded", tone: "info" as const },
];

interface TenderRow {
  address: string;
  status: number;
}

export default function OfficerDashboard() {
  const tenderRepo = useContract("TenderRepo");
  const { sessionWallet } = useAuth();

  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
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

  const counts = useMemo(
    () => ({
      all: tenders.length,
      open: tenders.filter((t) => t.status === 0).length,
      closed: tenders.filter((t) => t.status === 1).length,
      awarded: tenders.filter((t) => t.status === 2).length,
    }),
    [tenders]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return tenders;
    const wanted = { open: 0, closed: 1, awarded: 2 }[filter];
    return tenders.filter((t) => t.status === wanted);
  }, [tenders, filter]);

  const columns: Column<TenderRow>[] = [
    {
      key: "tender",
      header: "Tender",
      value: (r) => r.address,
      render: (r) => <Address value={r.address} />,
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => (
        <StatusBadge
          status={STATUS[r.status] ?? { label: "Unknown", tone: "neutral" }}
        />
      ),
    },
  ];

  return (
    <DashboardShell
      title="Tenders"
      subtitle="Publish tenders, track bidding and award contracts"
    >
      <AuthGate roles={["government_officer", "admin"]}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Total tenders" value={counts.all} loading={loading} />
          <Stat
            label="Open for bidding"
            value={counts.open}
            tone="success"
            loading={loading}
          />
          <Stat
            label="Contracts awarded"
            value={counts.awarded}
            tone="info"
            loading={loading}
          />
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        {!sessionWallet && (
          <RequirementCard tone="info" title="Read-only session">
            You&apos;re signed in without a wallet, so you can review everything
            here but cannot publish a tender or award a contract. Connect and
            sign with a wallet to act on chain.
          </RequirementCard>
        )}

        <Card
          title="Tenders on chain"
          description="Read directly from TenderRepo"
          padded={false}
        >
          <div className="p-5">
            <DataTable
              rows={filtered}
              columns={columns}
              getRowKey={(r) => r.address}
              loading={loading}
              searchPlaceholder="Search by address…"
              caption="Tenders registered on chain"
              filters={[
                { key: "all", label: "All", count: counts.all },
                { key: "open", label: "Open", count: counts.open },
                { key: "closed", label: "Closed", count: counts.closed },
                { key: "awarded", label: "Awarded", count: counts.awarded },
              ]}
              activeFilter={filter}
              onFilterChange={setFilter}
              empty={{
                title: "No tenders registered yet",
                description:
                  "Tenders created through FactoryTender and registered in TenderRepo appear here.",
              }}
            />
          </div>
        </Card>

        <div className="space-y-3">
          <SectionHeader
            title="Publishing a tender"
            description="What has to be in place before this works"
          />
          <Card>
            <p className="text-sm leading-relaxed text-text-muted">
              Creating a tender calls{" "}
              <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text">
                FactoryTender.createTender
              </code>
              , then registers the result through{" "}
              <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text">
                TenderRepo.newTender
              </code>
              , which requires{" "}
              <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text">
                REGISTRAR_ROLE
              </code>
              . A registry administrator grants that role to your wallet — being
              marked an officer in this application is not sufficient on its
              own, by design.
            </p>
          </Card>
        </div>
      </AuthGate>
    </DashboardShell>
  );
}
