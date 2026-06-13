"use client";

import { SweepstakesForm } from "@/app/admin/sweepstakes/sweepstakes-form";
import { createCommissionerLeague } from "@/app/commissioner/actions";

export function CommissionerLeagueForm() {
  return <SweepstakesForm values={{}} createAction={createCommissionerLeague} />;
}
