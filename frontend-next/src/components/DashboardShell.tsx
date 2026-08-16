import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { WalletButton } from "./WalletButton";
import { ThemeToggle } from "./ui";

export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky so the session controls stay reachable in long tables. */}
        <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-text">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-xs text-text-muted">{subtitle}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {actions}
              <ThemeToggle />
              <WalletButton />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
