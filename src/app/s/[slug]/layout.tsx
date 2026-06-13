import Link from "next/link";
import { notFound } from "next/navigation";
import { poolAccess } from "@/lib/pool-access";
import { SubNav } from "./sub-nav";

export default async function SweepstakesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await poolAccess(slug);
  if (!access.exists) notFound();

  if (!access.allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-5xl">🔒</p>
        <h1 className="mt-4 text-2xl font-bold">This pool is private</h1>
        <p className="mt-2 text-sm text-muted">
          {access.name} is invite-only. If you have an entry, sign in to view
          it.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {!access.signedIn && (
            <Link
              href={`/login?next=${encodeURIComponent(`/s/${slug}`)}`}
              className="rounded-md bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/browse"
            className="rounded-md border border-border px-5 py-2.5 font-semibold hover:bg-surface-raised"
          >
            Browse public pools
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SubNav slug={slug} name={access.name!} />
      {children}
    </div>
  );
}
