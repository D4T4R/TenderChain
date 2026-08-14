import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";

const ROLES = [
  {
    href: "/officer",
    title: "Government Officer",
    description: "Publish tenders, review bids and award contracts.",
    icon: "🏛",
  },
  {
    href: "/contractor",
    title: "Contractor",
    description: "Browse open tenders and submit stake-backed bids.",
    icon: "🏗",
  },
  {
    href: "/verifier",
    title: "Verifier",
    description: "Verify participants and confirm milestone completion.",
    icon: "✅",
  },
  {
    href: "/public",
    title: "Public",
    description: "Inspect tender summaries and raise claims. No wallet needed.",
    icon: "🔎",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="mb-16 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">TenderChain</h1>
          <p className="text-sm text-white/70">Transparent public tendering</p>
        </div>
        <WalletButton />
      </header>

      <section className="mb-14 max-w-3xl">
        <h2 className="text-4xl font-bold leading-tight text-white md:text-5xl">
          Public tendering, on a chain anyone can audit
        </h2>
        <p className="mt-4 text-lg text-white/80">
          Tenders, bids and milestone verification are recorded on-chain, backed
          by verifier stakes that are slashed for false attestations. Tender
          documents are summarised automatically so the public can follow along.
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        {ROLES.map((role) => (
          <Link
            key={role.href}
            href={role.href}
            className="glass-card group rounded-2xl p-6 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <span className="text-3xl" aria-hidden>
              {role.icon}
            </span>
            <h3 className="mt-3 text-xl font-semibold text-slate-800">
              {role.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{role.description}</p>
            <span className="mt-4 inline-block text-sm font-medium text-[color:var(--brand-to)] group-hover:underline">
              Open dashboard →
            </span>
          </Link>
        ))}
      </section>

      <footer className="mt-auto pt-14">
        <p className="rounded-xl border border-amber-200/40 bg-amber-400/15 p-4 text-sm text-amber-50">
          <strong>Local demo build.</strong> Smart contract access control has
          been added but the backend API is still largely unimplemented. Do not
          deploy to a public network or use with real funds.
        </p>
      </footer>
    </div>
  );
}
