import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddUserForm, RoleEditor, UserActions } from "./user-forms";

export const metadata = { title: "Users — Admin" };
export const revalidate = 0;

export default async function UsersPage() {
  const adminId = await requireAdmin();
  const admin = createAdminClient();

  const [{ data: profiles }, usersRes] = await Promise.all([
    admin.from("profiles").select("*").order("created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const emailById = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? "—"]),
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">Add user or staff</h2>
        <p className="mt-1 text-sm text-muted">
          Staff see only the backend sections you check. New users sign in with
          a magic link to their email.
        </p>
        <AddUserForm />
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">Everyone ({profiles?.length ?? 0})</h2>
        <div className="mt-4 divide-y divide-border">
          {(profiles ?? []).map((p) => (
            <div key={p.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold">{p.display_name}</span>{" "}
                  <span className="text-sm text-muted">
                    {emailById.get(p.id)}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                    (p.role ?? (p.is_admin ? "admin" : "user")) === "admin"
                      ? "bg-accent/20 text-brand-red"
                      : (p.role ?? "user") === "staff"
                        ? "bg-info/10 text-info"
                        : "bg-surface-raised text-muted"
                  }`}
                >
                  {p.role ?? (p.is_admin ? "admin" : "user")}
                </span>
              </div>
              <RoleEditor
                userId={p.id}
                role={p.role ?? (p.is_admin ? "admin" : "user")}
                permissions={Array.isArray(p.permissions) ? p.permissions : []}
              />
              <UserActions
                userId={p.id}
                email={emailById.get(p.id) ?? ""}
                displayName={p.display_name}
                isSelf={p.id === adminId}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
