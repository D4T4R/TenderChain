"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge, EmptyState, SkeletonRows, cn } from "./primitives";

export interface Column<T> {
  key: string;
  header: string;
  /** Cell content. */
  render: (row: T) => ReactNode;
  /** Plain text used for searching and sorting; omit to exclude the column. */
  value?: (row: T) => string | number;
  align?: "left" | "right";
  /** Hidden below md, for columns that are detail rather than identity. */
  secondary?: boolean;
}

export interface Filter {
  key: string;
  label: string;
  count?: number;
}

/**
 * Records table with search, filtering and sorting.
 *
 * Sorting and filtering are in-memory because these lists are read from chain
 * state a page at a time; if a dataset ever outgrows that it should move to a
 * server-side query rather than growing this component.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  loading = false,
  searchPlaceholder = "Search…",
  filters,
  activeFilter,
  onFilterChange,
  empty,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  searchPlaceholder?: string;
  filters?: Filter[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  empty?: { title: string; description?: string };
  caption?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    null
  );

  const searchable = useMemo(
    () => columns.filter((c) => c.value),
    [columns]
  );

  const visible = useMemo(() => {
    let out = rows;

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((row) =>
        searchable.some((col) =>
          String(col.value!(row)).toLowerCase().includes(q)
        )
      );
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.value) {
        out = [...out].sort((a, b) => {
          const av = col.value!(a);
          const bv = col.value!(b);
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }

    return out;
  }, [rows, query, sort, columns, searchable]);

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  return (
    <div className="space-y-3">
      {(searchable.length > 0 || filters) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable.length > 0 && (
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-text-subtle"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="7"
                  cy="7"
                  r="4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="m10.5 10.5 3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm text-text transition-colors outline-none placeholder:text-text-subtle hover:border-border-strong focus:border-accent"
              />
            </div>
          )}

          {filters && (
            <div
              role="tablist"
              aria-label="Filter"
              className="flex gap-1 rounded-lg border border-border bg-surface-sunken p-0.5"
            >
              {filters.map((f) => {
                const active = activeFilter === f.key;
                return (
                  <button
                    key={f.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => onFilterChange?.(f.key)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-surface text-text shadow-sm"
                        : "text-text-muted hover:text-text"
                    )}
                  >
                    {f.label}
                    {typeof f.count === "number" && (
                      <span className="tabular ml-1.5 text-text-subtle">
                        {f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            query
              ? "No matches"
              : (empty?.title ?? "Nothing here yet")
          }
          description={
            query
              ? `Nothing matches “${query}”.`
              : empty?.description
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b border-border bg-surface-sunken">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-4 py-2.5 text-xs font-medium text-text-muted",
                      col.align === "right" && "text-right",
                      col.secondary && "hidden md:table-cell"
                    )}
                  >
                    {col.value ? (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-text"
                        aria-label={`Sort by ${col.header}`}
                      >
                        {col.header}
                        <span
                          aria-hidden
                          className={cn(
                            "text-[9px] transition-opacity",
                            sort?.key === col.key ? "opacity-100" : "opacity-30"
                          )}
                        >
                          {sort?.key === col.key && sort.dir === "desc"
                            ? "▼"
                            : "▲"}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className="border-b border-border transition-colors last:border-0 hover:bg-surface-hover"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 align-middle",
                        col.align === "right" && "tabular text-right",
                        col.secondary && "hidden md:table-cell"
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <p className="text-xs text-text-subtle">
          Showing <span className="tabular">{visible.length}</span>
          {visible.length !== rows.length && (
            <>
              {" "}
              of <span className="tabular">{rows.length}</span>
            </>
          )}{" "}
          {rows.length === 1 ? "record" : "records"}
        </p>
      )}
    </div>
  );
}

/** Compact inline status, kept consistent across every table. */
export function StatusBadge({
  status,
}: {
  status: { label: string; tone: "neutral" | "success" | "warning" | "info" | "danger" | "accent" };
}) {
  return (
    <Badge tone={status.tone} dot>
      {status.label}
    </Badge>
  );
}
