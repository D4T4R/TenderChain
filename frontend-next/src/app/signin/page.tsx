"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { Card } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";

const ROLE_HOME: Record<string, string> = {
  government_officer: "/officer",
  contractor: "/contractor",
  verifier: "/verifier",
  admin: "/officer",
};

/**
 * Redirects onward once signed in. Split out because useSearchParams suspends,
 * and without a boundary it fails static prerendering of this route.
 */
function PostSignInRedirect() {
  const { status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (status !== "signedIn" || !user) return;
    const next = params.get("next");
    router.replace(next || ROLE_HOME[user.userType] || "/");
  }, [status, user, params, router]);

  return null;
}

export default function SignInPage() {
  const { status } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <Suspense fallback={null}>
        <PostSignInRedirect />
      </Suspense>

      <header className="mb-12">
        <Link href="/" className="block">
          <h1 className="text-2xl font-bold text-white">TenderChain</h1>
          <p className="text-sm text-white/70">Transparent public tendering</p>
        </Link>
      </header>

      <div className="space-y-6">
        <AuthPanel />

        {status === "signedIn" && (
          <Card>
            <p className="text-sm text-slate-600">Signed in. Redirecting…</p>
          </Card>
        )}

        <p className="text-center text-xs text-white/60">
          Signing proves you control the wallet. It is not a transaction and
          costs no gas.
        </p>
      </div>
    </div>
  );
}
