import Link from "next/link";
import { requireStaff, allowedSections } from "@/lib/admin-guard";

const NAV: [string, string, string][] = [
  ["overview", "/admin", "Overview"],
  ["sweepstakes", "/admin/sweepstakes", "Sweepstakes"],
  ["products", "/admin/products", "Products"],
  ["branding", "/admin/branding", "Branding"],
  ["simulator", "/admin/simulator", "Simulator"],
  ["users", "/admin/users", "Users"],
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStaff();
  const sections = allowedSections(ctx);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Admin{" "}
          <span className="rounded-full border border-border px-2 py-0.5 align-middle text-xs font-semibold uppercase tracking-wide text-info">
            {ctx.role === "admin" ? "Platform" : "Staff"}
          </span>
        </h1>
      </div>
      <div className="mt-4 flex flex-wrap gap-1 border-b border-border">
        {NAV.filter(([key]) => sections.includes(key as never)).map(
          ([, href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-t-md px-4 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
            >
              {label}
            </Link>
          ),
        )}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
