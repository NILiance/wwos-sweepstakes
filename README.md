# WWOS Sweepstakes

**Wide World of Sports Pool — multi-sport, season-long sweepstakes platform.**

Full product scope: [SCOPE.md](./SCOPE.md). Brand guide: SCOPE.md Appendix D (assets in `brand/`).

## Stack

- **Next.js** (App Router, TypeScript, Tailwind v4) on **Vercel**
- **Supabase** — Postgres, Auth, Realtime, Storage, Edge Functions
- **Stripe** — entry purchases (commerce in)
- **PayPal Payouts API** — prize disbursement, PayPal + Venmo (money out)
- **Resend** — transactional + recap email
- Sports data provider — TBD (SCOPE.md open question #2)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase/Stripe/Resend keys
npm run dev
```

## Database

Schema migrations live in `supabase/migrations/`; platform seed data
(sports + the default WWOS scoring matrix) in `supabase/seed.sql`.

With the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push          # apply migrations
psql $DATABASE_URL -f supabase/seed.sql
```

Data is two-tier (SCOPE.md §6): a **central sports repository** (games,
schedules, TV, results — written only by ingestion jobs and the admin
manual-entry console) and **per-sweepstakes data** (entries, rosters,
scoring rules, point events) that references it.

## Status

Phase 1 foundation: brand theme, schema, app shell. See SCOPE.md §9 for
the phase plan and §8 for open questions (legal review is the launch
blocker — §2).
