"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { UserType } from "@/lib/api/types";
import { AuthPanel } from "./AuthPanel";
import { RequirementCard } from "./ui";

const ROLE_LABELS: Record<UserType, string> = {
  government_officer: "government officer",
  contractor: "contractor",
  verifier: "verifier",
  public_verifier: "public verifier",
  admin: "administrator",
};

/**
 * Renders children only for a signed-in user, optionally restricted by role.
 *
 * A UX guard, not a security boundary: the API enforces authorisation
 * independently. Hiding a button never protects an endpoint.
 */
export function AuthGate({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserType[];
}) {
  const { status, user } = useAuth();

  if (status !== "signedIn" || !user) {
    return (
      <div className="mx-auto max-w-md">
        <AuthPanel />
      </div>
    );
  }

  if (roles && !roles.includes(user.userType)) {
    return (
      <RequirementCard
        tone="info"
        title="This area is for a different role"
        action={
          <Link
            href="/public"
            className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-raised px-3 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
          >
            Go to public transparency
          </Link>
        }
      >
        You&apos;re signed in as a{" "}
        <strong className="text-text">{ROLE_LABELS[user.userType]}</strong>.
        This dashboard is for{" "}
        {roles.map((r) => ROLE_LABELS[r]).join(" or ")} accounts. Roles are
        granted by an administrator.
      </RequirementCard>
    );
  }

  return <>{children}</>;
}
