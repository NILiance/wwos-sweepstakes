import Link from "next/link";
import { requireCommissioner } from "@/lib/admin-guard";
import { CommissionerLeagueForm } from "./league-form";

export const metadata = { title: "New League — Commissioner" };

export default async function NewLeaguePage() {
  const { active } = await requireCommissioner();
  if (!active) {
    return (
      <div className="max-w-xl">
        <p className="text-muted">
          Your commissioner access isn&apos;t active.{" "}
          <Link href="/commissioner/join" className="text-info hover:underline">
            Renew →
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div>
      <Link href="/commissioner" className="text-sm text-muted hover:text-foreground">
        ← My leagues
      </Link>
      <h2 className="mt-2 text-lg font-bold">New league</h2>
      <p className="mt-1 text-sm text-muted">
        Created as a private draft — open enrollment from the league page when
        you&apos;re ready. You collect entry money your own way.
      </p>
      <div className="mt-6">
        <CommissionerLeagueForm />
      </div>
    </div>
  );
}
