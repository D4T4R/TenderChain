"use client";

import type { ReactElement } from "react";
import { useTheme, type ThemePreference } from "@/lib/theme/ThemeProvider";
import { cn } from "./primitives";

const OPTIONS: { key: ThemePreference; label: string; icon: ReactElement }[] = [
  {
    key: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1.5v1.25M8 13.25v1.25M14.5 8h-1.25M2.75 8H1.5M12.6 3.4l-.9.9M4.3 11.7l-.9.9M12.6 12.6l-.9-.9M4.3 4.3l-.9-.9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: "system",
    label: "System",
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
        <rect
          x="2"
          y="3"
          width="12"
          height="8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M6 13.5h4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
        <path
          d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

/**
 * Three-way control rather than a binary switch: "system" is a distinct choice
 * from light or dark, and collapsing it loses the ability to follow the OS.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = preference === option.key;
        return (
          <button
            key={option.key}
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setPreference(option.key)}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              active
                ? "bg-surface text-text shadow-sm"
                : "text-text-subtle hover:text-text"
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
