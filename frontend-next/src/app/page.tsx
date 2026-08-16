import Link from "next/link";
import { ThemeToggle } from "@/components/ui";

const ROLES = [
  {
    href: "/officer",
    title: "Government Officer",
    description: "Publish tenders, review bids and award contracts.",
    needsWallet: true,
  },
  {
    href: "/contractor",
    title: "Contractor",
    description: "Browse open tenders and submit stake-backed bids.",
    needsWallet: true,
  },
  {
    href: "/verifier",
    title: "Verifier",
    description: "Approve participants and confirm milestone completion.",
    needsWallet: true,
  },
  {
    href: "/public",
    title: "Public",
    description: "Inspect tender summaries and raise claims.",
    needsWallet: false,
  },
];

const PRINCIPLES = [
  {
    title: "Recorded on chain",
    body: "Tenders, bids and verifications are written to contracts with role-based access control, so the audit trail cannot be quietly edited.",
  },
  {
    title: "Backed by stake",
    body: "Verifiers put value at risk. A false attestation is slashed, which makes dishonest verification expensive rather than free.",
  },
  {
    title: "Readable by anyone",
    body: "Tender documents are summarised automatically and published with a confidence score, so the public can follow procurement without reading a 90-page PDF.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:px-8">
          <div className="flex items-center gap-2.5">
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
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/signin"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 md:px-8">
        <section className="border-b border-border py-16 md:py-24">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-subtle px-3 py-1 text-xs font-medium text-accent">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Local demo build
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Public tendering, on a chain{" "}
            <span className="text-accent">anyone can audit</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
            Procurement records that a citizen can verify and an official cannot
            quietly rewrite. No wallet needed to read anything.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/public"
              className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              Browse published tenders
            </Link>
            <Link
              href="/signin"
              className="inline-flex h-11 items-center rounded-lg border border-border bg-surface px-5 text-sm font-medium transition-colors hover:bg-surface-hover"
            >
              Sign in to your account
            </Link>
          </div>
        </section>

        <section className="grid gap-px border-b border-border bg-border md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="bg-bg px-1 py-10 md:px-6">
              <h2 className="text-sm font-semibold tracking-tight">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {p.body}
              </p>
            </div>
          ))}
        </section>

        <section className="py-14">
          <h2 className="text-lg font-semibold tracking-tight">
            Choose your dashboard
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Officer, contractor and verifier areas need a signed-in account.
            Public transparency is open to everyone.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {ROLES.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className="group rounded-card border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent-border hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{role.title}</h3>
                  {!role.needsWallet && (
                    <span className="rounded-md border border-border bg-surface-sunken px-2 py-0.5 text-xs text-text-muted">
                      No sign-in
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-text-muted">
                  {role.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Open
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
          <p className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm text-text-muted">
            <strong className="text-text">Local demo build.</strong> Smart
            contract access control has been added but is unaudited, and most
            backend domain routes are still stubs. Do not deploy to a public
            network or use with real funds.
          </p>
        </div>
      </footer>
    </div>
  );
}
