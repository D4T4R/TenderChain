"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/officer", label: "Government Officer", icon: "🏛" },
  { href: "/contractor", label: "Contractor", icon: "🏗" },
  { href: "/verifier", label: "Verifier", icon: "✅" },
  { href: "/public", label: "Public Transparency", icon: "🔎" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass hidden w-70 shrink-0 flex-col py-8 md:flex">
      <div className="mb-12 px-6">
        <Link href="/" className="block">
          <h1 className="text-2xl font-bold text-white">TenderChain</h1>
          <p className="text-sm text-white/70">Transparent public tendering</p>
        </Link>
      </div>

      <nav className="px-4">
        <ul className="space-y-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-white/25 text-white"
                      : "text-white/75 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto px-6 pt-8">
        <p className="text-xs leading-relaxed text-white/50">
          Local demo build. Not for production use.
        </p>
      </div>
    </aside>
  );
}
