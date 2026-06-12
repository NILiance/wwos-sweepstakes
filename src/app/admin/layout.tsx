import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/sweepstakes", "Sweepstakes"],
  ["/admin/branding", "Branding"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Admin{" "}
          <span className="rounded-full border border-border px-2 py-0.5 align-middle text-xs font-semibold uppercase tracking-wide text-info">
            Platform
          </span>
        </h1>
      </div>
      <div className="mt-4 flex gap-1 border-b border-border">
        {NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-t-md px-4 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
