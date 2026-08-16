"use client";

import type { ReactNode } from "react";
import { Badge, Button, cn } from "./primitives";

/**
 * Confidence in a machine-generated result.
 *
 * Shown wherever an AI summary is displayed, never optional. A generated
 * summary presented without its confidence reads as fact, which is exactly the
 * failure mode a transparency system cannot afford - the reader has to be able
 * to tell an extraction from a guess.
 */
export function Confidence({
  value,
  className,
}: {
  /** 0-100. */
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const band =
    clamped >= 80 ? "high" : clamped >= 60 ? "medium" : "low";

  const TONE = {
    high: { bar: "bg-success", text: "text-success", label: "High confidence" },
    medium: { bar: "bg-warning", text: "text-warning", label: "Medium confidence" },
    low: { bar: "bg-danger", text: "text-danger", label: "Low confidence" },
  }[band];

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      title={`${TONE.label}: ${clamped}%. Generated automatically from the source document.`}
    >
      <span
        className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken"
        role="img"
        aria-label={`${TONE.label}, ${clamped} percent`}
      >
        <span
          className={cn("block h-full rounded-full transition-[width]", TONE.bar)}
          style={{ width: `${clamped}%` }}
        />
      </span>
      <span className={cn("tabular text-xs font-medium", TONE.text)}>
        {clamped}%
      </span>
    </span>
  );
}

/**
 * A single item awaiting a decision, with the action attached.
 *
 * The pattern the verifier queue needs: what is being asked, who it concerns,
 * and the one or two things you can do about it - without making the user open
 * a detail page to find out.
 */
export function ApprovalCard({
  title,
  subtitle,
  meta,
  children,
  onApprove,
  approveLabel = "Approve",
  onReject,
  rejectLabel = "Reject",
  pending = false,
  disabled = false,
  disabledReason,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  onApprove?: () => void;
  approveLabel?: string;
  onReject?: () => void;
  rejectLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <li className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium text-text">{title}</div>
          {subtitle && (
            <div className="text-xs text-text-muted">{subtitle}</div>
          )}
          {meta && <div className="flex flex-wrap gap-2 pt-1">{meta}</div>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onReject && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onReject}
              disabled={disabled || pending}
            >
              {rejectLabel}
            </Button>
          )}
          {onApprove && (
            <Button
              size="sm"
              onClick={onApprove}
              loading={pending}
              disabled={disabled}
              title={disabled ? disabledReason : undefined}
            >
              {approveLabel}
            </Button>
          )}
        </div>
      </div>

      {children && <div className="mt-3">{children}</div>}

      {disabled && disabledReason && (
        <p className="mt-2 text-xs text-text-subtle">{disabledReason}</p>
      )}
    </li>
  );
}

/**
 * A machine-generated summary, presented with its provenance.
 *
 * Confidence and source are part of the card rather than a footnote: the whole
 * point of publishing these is that a reader can judge how much to trust them.
 */
export function InsightCard({
  title,
  category,
  confidence,
  summary,
  facts,
  footer,
}: {
  title: ReactNode;
  category?: string;
  confidence?: number;
  summary?: string;
  facts?: { label: string; value: ReactNode }[];
  footer?: ReactNode;
}) {
  return (
    <li className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-text">{title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {category && <Badge tone="accent">{category}</Badge>}
          {typeof confidence === "number" && (
            <Confidence value={confidence} />
          )}
        </div>
      </div>

      {summary && (
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{summary}</p>
      )}

      {facts && facts.length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline gap-2 text-xs">
              <dt className="shrink-0 text-text-subtle">{f.label}</dt>
              <dd className="min-w-0 truncate text-text">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {footer && (
        <div className="mt-3 border-t border-border pt-3 text-xs text-text-subtle">
          {footer}
        </div>
      )}
    </li>
  );
}

/**
 * Explains what a screen needs from the user before it can do anything, rather
 * than leaving them at an empty table wondering what went wrong.
 */
export function RequirementCard({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "accent";
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const TONES = {
    info: "border-info/30 bg-info-subtle",
    warning: "border-warning/30 bg-warning-subtle",
    accent: "border-accent-border bg-accent-subtle",
  };

  return (
    <div className={cn("rounded-card border p-5", TONES[tone])}>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-1.5 text-sm leading-relaxed text-text-muted">
        {children}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
