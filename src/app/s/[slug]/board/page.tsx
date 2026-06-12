import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostForm } from "./post-form";

export const revalidate = 0;

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,slug")
    .eq("slug", slug)
    .single();
  if (!sw) notFound();

  // membership check (board is members-only)
  let isMember = false;
  if (user) {
    const { data: entry } = await admin
      .from("entries")
      .select("id")
      .eq("sweepstakes_id", sw.id)
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();
    isMember = !!entry;
    if (!isMember) {
      const { data: share } = await admin
        .from("entry_shares")
        .select("id,entries!inner(sweepstakes_id)")
        .eq("user_id", user.id)
        .eq("entries.sweepstakes_id", sw.id)
        .limit(1)
        .maybeSingle();
      isMember = !!share;
    }
  }

  const { data: posts } = isMember
    ? await admin
        .from("posts")
        .select("id,body,created_at,user_id,profiles:user_id(display_name)")
        .eq("sweepstakes_id", sw.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/s/${sw.slug}`} className="text-sm text-muted hover:text-foreground">
        ← {sw.name}
      </Link>
      <h1 className="brand-script mt-2 text-5xl text-brand-red">Smack Talk</h1>

      {!isMember ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-surface p-8 text-center text-muted">
          The board is entrants-only.{" "}
          {user ? (
            <>Grab a spot in the pool and join the conversation.</>
          ) : (
            <Link href="/login" className="text-info hover:underline">
              Sign in
            </Link>
          )}
        </div>
      ) : (
        <>
          <PostForm sweepstakesId={sw.id} slug={sw.slug} />
          <div className="mt-8 space-y-4">
            {(posts ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold">
                    {(p.profiles as unknown as { display_name: string })
                      ?.display_name ?? "System"}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(p.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">
                  {p.body}
                </p>
              </div>
            ))}
            {(posts ?? []).length === 0 && (
              <p className="text-center text-sm text-muted">
                Dead quiet in here. Someone say something regrettable.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
