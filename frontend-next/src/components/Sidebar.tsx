"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { UserType } from "@/lib/api/types";
import { cn } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: ReactElement;
  /** Roles this destination is meant for; undefined means everyone. */
  roles?: UserType[];
}

const NAV: NavItem[] = [
  {
    href: "/officer",
    label: "Tenders",
    roles: ["government_officer", "admin"],
    icon: (
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
        <path
          d="M2.5 6.5 8 2.5l5.5 4M3.5 7v6.5h9V7M6.5 13.5v-3.5h3v3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/contractor",
    label: "Bidding",
    roles: ["contractor", "admin"],
    icon: (
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
        <path
          d="M2.5 13.5h11M4 13.5V7l4-4.5L12 7v6.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/verifier",
    label: "Verification",
    roles: ["verifier", "public_verifier", "admin"],
    icon: (
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
        <path
          d="M8 1.75 13 4v4c0 3-2.1 5.4-5 6.25C5.1 13.4 3 11 3 8V4l5-2.25Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="m6 8 1.5 1.5L10.25 6.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/public",
    label: "Transparency",
    icon: (
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
        <path
          d="M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
              <path
                d="M8 1.5 14 5v6l-6 3.5L2 11V5l6-3.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M8 8v6.5M8 8 2 5M8 8l6-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-text">
            TenderChain
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            // Destinations outside the signed-in user's role stay visible but
            // are marked, rather than vanishing - a menu that changes shape on
            // sign-in is disorienting, and the gate explains the refusal.
            const forOtherRole =
              item.roles && user && !item.roles.includes(user.userType);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent-subtle font-medium text-accent"
                      : "text-text-muted hover:bg-surface-hover hover:text-text",
                    forOtherRole && !active && "opacity-45"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="text-xs leading-relaxed text-text-subtle">
          Local demo build.
          <br />
          Not for production use.
        </p>
      </div>
    </aside>
  );
}
