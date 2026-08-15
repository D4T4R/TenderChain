"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { UserType } from "@/lib/api/types";
import { AuthPanel } from "./AuthPanel";
import { Card } from "./ui";

/**
 * Renders children only for a signed-in user, optionally restricted by role.
 *
 * This is a UX guard, not a security boundary: the API enforces authorisation
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
    return <AuthPanel />;
  }

  if (roles && !roles.includes(user.userType)) {
    return (
      <Card title="Not available for your role">
        <p className="text-sm text-slate-600">
          You&apos;re signed in as{" "}
          <strong>{user.userType.replace(/_/g, " ")}</strong>. This dashboard is
          for {roles.map((r) => r.replace(/_/g, " ")).join(" or ")}.
        </p>
      </Card>
    );
  }

  return <>{children}</>;
}
