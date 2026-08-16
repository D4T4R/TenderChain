"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Address,
  Badge,
  Button,
  Card,
  EmptyState,
  InsightCard,
  Notice,
  SkeletonRows,
  Stat,
} from "@/components/ui";
import { api, ApiError, type TenderSummary } from "@/lib/api/client";

export default function PublicDashboard() {
  const [summaries, setSummaries] = useState<TenderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setError(null);
    try {
      const data = await api.getPublicSummaries(
        query ? { search: query, limit: 25 } : { limit: 25 }
      );
      setSummaries(data.summaries ?? []);
      setTotal(data.total ?? data.summaries?.length ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? "Cannot reach the API. Start the backend with `npm start` in the backend directory."
          : err instanceof Error
            ? err.message
            : "Failed to load tender summaries"
      );
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // See note in the officer dashboard: state updates happen post-await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("");
  }, [load]);

  return (
    <DashboardShell
      title="Public Transparency"
      subtitle="Automatically generated summaries of published tender documents"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Summaries published" value={total} loading={loading} />
        <Stat
          label="Sign-in required"
          value="No"
          hint="This view is open to everyone"
        />
        <Stat
          label="Source"
          value="On-chain"
          hint="Summaries reference the tender contract"
        />
      </div>

      <Card
        title="Search summaries"
        description="Full-text search across published tender documents"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLoading(true);
            void load(search);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. road construction"
            aria-label="Search tender summaries"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent"
          />
          <Button type="submit">Search</Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setLoading(true);
                void load("");
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </Card>

      <Card
        title="Published summaries"
        description="Generated automatically from the uploaded document"
        actions={
          <Badge tone="accent">Machine generated</Badge>
        }
      >
        {error && <Notice tone="danger">{error}</Notice>}

        {loading && !error && <SkeletonRows rows={3} />}

        {!loading && !error && summaries.length === 0 && (
          <EmptyState
            title="No summaries published yet"
            description="Summaries appear once a government officer uploads a tender document."
          />
        )}

        {!loading && summaries.length > 0 && (
          <>
            <p className="mb-3 text-xs leading-relaxed text-text-subtle">
              These summaries are produced by automated text analysis, not by a
              person. The confidence score reflects how much of the source
              document the extractor could interpret — always check the original
              tender before relying on the detail.
            </p>

            <ul className="space-y-2.5">
              {summaries.map((item) => (
                <InsightCard
                  key={item._id}
                  title={`${item.summary?.workType ?? "Tender"} — ${item.tenderId}`}
                  category={item.category}
                  confidence={item.summary?.confidence}
                  summary={item.summary?.description}
                  facts={[
                    ...(item.summary?.location
                      ? [
                          {
                            label: "Location",
                            value: item.summary.location,
                          },
                        ]
                      : []),
                    ...(item.summary?.estimatedValue
                      ? [
                          {
                            label: "Estimated value",
                            value: item.summary.estimatedValue,
                          },
                        ]
                      : []),
                  ]}
                  footer={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Tender contract</span>
                      <Address value={item.tenderAddress} />
                    </span>
                  }
                />
              ))}
            </ul>
          </>
        )}
      </Card>
    </DashboardShell>
  );
}
