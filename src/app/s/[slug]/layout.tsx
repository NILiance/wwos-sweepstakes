import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubNav } from "./sub-nav";

export default async function SweepstakesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: sw } = await admin
    .from("sweepstakes")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  if (!sw) notFound();

  return (
    <div>
      <SubNav slug={slug} name={sw.name} />
      {children}
    </div>
  );
}
