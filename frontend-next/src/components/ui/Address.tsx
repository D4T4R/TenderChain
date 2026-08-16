"use client";

import { useState, type ReactNode } from "react";
import { cn } from "./primitives";

/**
 * An on-chain address, shown the way a non-specialist can actually use it.
 *
 * A bare 42-character hex string is unreadable and unmemorable, so the human
 * label leads where we know one and the address becomes supporting detail.
 * The full value is always one click away, because for a transparency system
 * the exact identifier has to remain checkable - truncation must never be the
 * only representation.
 */
export function Address({
  value,
  label,
  explorerUrl,
  className,
  showCopy = true,
  mono = true,
}: {
  value: string;
  /** Human name for this address, when the system knows one. */
  label?: string;
  explorerUrl?: string;
  className?: string;
  showCopy?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const short = `${value.slice(0, 6)}…${value.slice(-4)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions): expanding still
      // lets the user select the value by hand.
      setExpanded(true);
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {label && (
        <span className="truncate text-sm font-medium text-text">{label}</span>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Show short form" : value}
        aria-label={`Address ${value}. Click to ${expanded ? "collapse" : "expand"}.`}
        className={cn(
          "rounded px-1 py-0.5 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text",
          mono && "font-mono"
        )}
      >
        {expanded ? value : short}
      </button>

      {showCopy && (
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy address"}
          className="rounded p-1 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
        >
          {copied ? (
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
              <path
                d="M13 4.5 6.5 11 3 7.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
              <rect
                x="5.5"
                y="5.5"
                width="8"
                height="8"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5V9A1.5 1.5 0 0 0 4 10.5h1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      )}

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="View on block explorer"
          className="rounded p-1 text-text-subtle transition-colors hover:bg-surface-hover hover:text-accent"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
            <path
              d="M6.5 3.5H4A1.5 1.5 0 0 0 2.5 5v7A1.5 1.5 0 0 0 4 13.5h7a1.5 1.5 0 0 0 1.5-1.5V9.5M9.5 2.5h4v4M13 3l-5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
    </span>
  );
}

/**
 * Progressive disclosure for chain detail.
 *
 * Officers and contractors do not need block numbers to do their job, but the
 * data has to stay inspectable for the audit trail to mean anything. Collapsed
 * by default, never removed.
 */
export function TechnicalDetails({
  summary = "Chain details",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="group mt-3 rounded-lg border border-border bg-surface-sunken/60">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:text-text">
        <svg
          viewBox="0 0 16 16"
          className="size-3 transition-transform group-open:rotate-90"
          fill="none"
          aria-hidden
        >
          <path
            d="m6 4 4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {summary}
      </summary>
      <dl className="space-y-2 border-t border-border px-3 py-2.5 text-xs">
        {children}
      </dl>
    </details>
  );
}

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-text-subtle">{label}</dt>
      <dd className="min-w-0 text-text-muted">{children}</dd>
    </div>
  );
}
