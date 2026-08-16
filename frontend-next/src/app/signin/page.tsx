"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { ThemeToggle } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";

const ROLE_HOME: Record<string, string> = {
  government_officer: "/officer",
  contractor: "/contractor",
  verifier: "/verifier",
  public_verifier: "/verifier",
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
    router.replace(next || ROLE_HOME[user.userType] || "/public");
  }, [status, user, params, router]);

  return null;
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <PostSignInRedirect />
      </Suspense>

      <header className="flex items-center justify-between px-5 py-4 md:px-8">
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
          <span className="text-sm font-semibold tracking-tight">
            TenderChain
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to TenderChain
            </h1>
            <p className="mt-1.5 text-sm text-text-muted">
              Use an email and password, or prove control of a wallet.
            </p>
          </div>

          <AuthPanel />

          <p className="text-center text-xs leading-relaxed text-text-subtle">
            A wallet is only required to sign transactions — publishing a
            tender, submitting a bid, or verifying work. Everything else works
            without one.
          </p>
        </div>
      </main>
    </div>
  );
}
