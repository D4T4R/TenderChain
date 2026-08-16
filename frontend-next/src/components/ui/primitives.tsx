import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "transition-[background-color,border-color,color,opacity,transform] duration-150 " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-sm",
  secondary:
    "bg-surface-raised text-text border border-border hover:bg-surface-hover hover:border-border-strong",
  ghost: "text-text-muted hover:bg-surface-hover hover:text-text",
  danger: "bg-danger text-white hover:opacity-90 shadow-sm",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-border bg-surface shadow-sm",
        className
      )}
    >
      {(title || actions) && (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4"
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-text">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-text-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------- Badge */

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-text-muted border-border",
  accent: "bg-accent-subtle text-accent border-accent-border",
  success: "bg-success-subtle text-success border-transparent",
  warning: "bg-warning-subtle text-warning border-transparent",
  danger: "bg-danger-subtle text-danger border-transparent",
  info: "bg-info-subtle text-info border-transparent",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-current opacity-80"
        />
      )}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ States */

export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent align-[-0.125em]",
        size === "sm" ? "size-3.5 border-[1.5px]" : "size-4 border-2"
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span className={cn("skeleton block rounded-md", className)}>
      <span className="skeleton-shimmer" />
    </span>
  );
}

/** Rows of skeletons, sized to the table they stand in for. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-surface-sunken/50 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-text-subtle">{icon}</div>}
      <p className="text-sm font-medium text-text">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "danger",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const TONE_STYLES: Record<Tone, string> = {
    neutral: "bg-surface-sunken border-border text-text-muted",
    accent: "bg-accent-subtle border-accent-border text-text",
    success: "bg-success-subtle border-transparent text-text",
    warning: "bg-warning-subtle border-transparent text-text",
    danger: "bg-danger-subtle border-transparent text-text",
    info: "bg-info-subtle border-transparent text-text",
  };

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4",
        TONE_STYLES[tone]
      )}
    >
      <div className="min-w-0 text-sm">
        {title && <p className="font-medium">{title}</p>}
        <div className={cn(title && "mt-0.5", "text-text-muted")}>
          {children}
        </div>
      </div>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- Stat card */

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  loading?: boolean;
}) {
  const VALUE_TONES: Record<Tone, string> = {
    neutral: "text-text",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
  };

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p
          className={cn(
            "tabular mt-1 text-2xl font-semibold tracking-tight",
            VALUE_TONES[tone]
          )}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-text-subtle">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ Section head */

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
