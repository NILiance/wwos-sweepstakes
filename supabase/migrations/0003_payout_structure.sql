-- Payout structure is sweepstakes config (distinct from the payouts
-- disbursement table): ordered places plus optional side pots.
-- payout_structure: [{ "place": 1, "amount_cents": 1000000 }, ...]
-- side_pots: [{ "type": "weekly_high", "amount_cents": 50000 }, ...]

alter table sweepstakes
  add column if not exists payout_structure jsonb not null default '[]',
  add column if not exists side_pots jsonb not null default '[]';
