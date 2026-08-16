"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther } from "ethers";
import { DashboardShell } from "@/components/DashboardShell";
import { AuthGate } from "@/components/AuthGate";
import { StepUpPrompt } from "@/components/StepUpPrompt";
import {
  Address,
  Badge,
  Card,
  DataTable,
  Notice,
  RequirementCard,
  Stat,
  StatusBadge,
  type Column,
} from "@/components/ui";
import { useContract } from "@/lib/web3/useContract";
import { useAuth } from "@/lib/auth/AuthProvider";

interface TenderRow {
  address: string;
}

export default function ContractorDashboard() {
  const tenderRepo = useContract("TenderRepo");
  const contractorRepo = useContract("ContractorRepo");
  const stakeManager = useContract("StakeManager");
  const { sessionWallet, canTransact } = useAuth();

  const [openTenders, setOpenTenders] = useState<TenderRow[]>([]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [staked, setStaked] = useState("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenderRepo) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const addresses: string[] = await tenderRepo.getAllTenders();
      const statuses = await Promise.all(
        addresses.map((a) => tenderRepo.getTenderStatus(a))
      );
      setOpenTenders(
        addresses
          .filter((_, i) => Number(statuses[i]) === 0)
          .map((address) => ({ address }))
      );

      if (sessionWallet && contractorRepo) {
        const node = await contractorRepo.getNodeAddress(sessionWallet);
        setVerified(
          node && node !== "0x0000000000000000000000000000000000000000"
            ? await contractorRepo.getVerificationStatus(node)
            : false
        );
      }

      if (sessionWallet && stakeManager) {
        setStaked(
          formatEther(await stakeManager.totalStakedByAddress(sessionWallet))
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to read chain state"
      );
    } finally {
      setLoading(false);
    }
  }, [tenderRepo, contractorRepo, stakeManager, sessionWallet]);

  useEffect(() => {
    // See note in the officer dashboard: state updates happen post-await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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
      render: () => (
        <StatusBadge status={{ label: "Accepting bids", tone: "success" }} />
      ),
    },
  ];

  return (
    <DashboardShell
      title="Bidding"
      subtitle="Browse open tenders and manage your stake"
    >
      <AuthGate roles={["contractor", "admin"]}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Open tenders"
            value={openTenders.length}
            loading={loading}
          />
          <Stat
            label="Verification"
            value={
              verified === null ? "—" : verified ? "Verified" : "Not verified"
            }
            tone={verified ? "success" : "warning"}
            hint={
              verified === false
                ? "A verifier must approve you before you can bid"
                : undefined
            }
            loading={loading}
          />
          <Stat
            label="Total staked"
            value={`${staked} ETH`}
            loading={loading}
          />
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        {!canTransact && <StepUpPrompt action="Submitting a bid" />}

        {sessionWallet && verified === false && (
          <RequirementCard tone="warning" title="Awaiting verification">
            Your contractor record hasn&apos;t been approved yet. A verifier
            checks your registration details before you can submit bids.
          </RequirementCard>
        )}

        <Card
          title="Open tenders"
          description="Tenders currently accepting bids"
          actions={
            <Badge tone="neutral">
              {openTenders.length} open
            </Badge>
          }
          padded={false}
        >
          <div className="p-5">
            <DataTable
              rows={openTenders}
              columns={columns}
              getRowKey={(r) => r.address}
              loading={loading}
              searchPlaceholder="Search tenders…"
              caption="Tenders open for bidding"
              empty={{
                title: "Nothing open right now",
                description:
                  "Tenders appear here while they are accepting bids.",
              }}
            />
          </div>
        </Card>
      </AuthGate>
    </DashboardShell>
  );
}
