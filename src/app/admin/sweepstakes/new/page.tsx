import { requireStaff } from "@/lib/admin-guard";
import { SweepstakesForm } from "../sweepstakes-form";

export const metadata = { title: "New Sweepstakes — Admin" };

export default async function NewSweepstakesPage() {
  await requireStaff("sweepstakes");
  return (
    <div>
      <h2 className="text-lg font-bold">New sweepstakes</h2>
      <p className="mt-1 text-sm text-muted">
        Created as a draft — open enrollment from the Sweepstakes list when
        ready.
      </p>
      <div className="mt-6">
        <SweepstakesForm values={{}} />
      </div>
    </div>
  );
}
