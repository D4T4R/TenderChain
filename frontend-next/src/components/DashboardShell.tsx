import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { WalletButton } from "./WalletButton";

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-6 md:p-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-white/70">{subtitle}</p>}
          </div>
          <WalletButton />
        </header>
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
