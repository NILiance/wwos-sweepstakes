import { requireStaff } from "@/lib/admin-guard";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Invites — Admin" };
export const revalidate = 0;

export default async function InvitesPage() {
  await requireStaff("invites");
  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold">Invite players</h2>
      <p className="mt-1 text-sm text-muted">
        Send someone a one-click sign-in link so they can join and enter pools.
        This creates a standard <strong>player</strong> account — it never grants
        admin access. (Managing roles &amp; permissions is a Superadmin action.)
      </p>
      <InviteForm />
    </div>
  );
}
