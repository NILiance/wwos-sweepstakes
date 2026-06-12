# WWOS Sweepstakes — Project Scope

**Wide World of Sports Pool — "Best Pool Ever"**
A multi-sport, season-long pool platform built as a replicable product: one codebase that can run unlimited configurable sweepstakes across CFB, NFL, NBA, WNBA, NHL, CBB, PGA, LIV, and MLB.

**Stack:** Next.js (Vercel) · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) · GitHub (CI/CD) · Resend (email) · Stripe (commerce in) · PayPal Payouts API (prizes out) · third-party sports data API (scores, results, league calendars)

**Date:** June 12, 2026
**Status:** Draft for review

---

## 1. Concept Summary

Participants buy an item (merchandise purchase = entry) to join a sweepstakes pool. When the pool fills (default 15 entrants), a **live, animated random drawing** assigns each entrant a roster of teams/golfers across multiple sports (default: 4 CFB, 2 NFL, 4 CBB, 2 NBA, 2 NHL, 3 PGA, 1 LIV, 2 MLB). Teams earn points for wins per a configurable scoring matrix. Standings update in near-real-time all season. Top finishers win cash prizes (default: $10,000 / $2,500 / $1,500 / $1,000 from a 15 × $1,000 pool).

The platform is **multi-tenant by design**: every parameter above is configurable per sweepstakes so new pools (different sports mixes, entry prices, pool sizes, payouts) can be spun up from templates without code changes.

---

## 2. ⚠️ Legal & Compliance (read first)

This is the single biggest project risk and must be resolved **before** build decisions are locked:

- A pay-to-enter pool with cash prizes is, in most U.S. states, a **lottery/gambling product** (consideration + chance + prize). The random team drawing makes this chance-based, not skill-based — the safe harbor that protects fantasy sports does not obviously apply.
- The "purchase an item to enter" structure does **not** by itself convert this into a legal sweepstakes. U.S. sweepstakes law generally requires a free alternative method of entry ("No Purchase Necessary") and that the purchase not be consideration for the chance to win.
- **Required before launch:** gaming/promotions attorney review; decision on legal structure (sweepstakes with AMOE, skill-contest restructure, private social-pool exemptions, or licensed operation); state-by-state eligibility map and geo-blocking; official rules document; age verification (18+/21+); tax reporting for winners (W-9 / 1099-MISC for prizes ≥ $600).
- **Payment processing:** Stripe and most mainstream processors prohibit gambling on standard accounts. The merchandise-purchase framing must be cleared with the processor, or a high-risk/gaming processor used. This affects the commerce architecture, so it's a Phase 0 blocker.
- **Trademarks:** team names/logos (NFL, NCAA, etc.) are licensed property. Plan to use city/school text abbreviations and original iconography, not official logos.

The scope below assumes these questions get answered; nothing in the build prevents any of the candidate structures.

---

## 3. Roles

| Role | Description |
|---|---|
| **Platform Admin** | Creates/configures sweepstakes, manages scoring matrix, runs drawings, manages payouts, moderates boards, manages products. |
| **Commissioner** (optional, later) | Delegated admin for a single sweepstakes (white-label/franchise model). |
| **Entrant** | Purchases entry, owns or shares an entry, watches the draw, tracks standings, posts smack talk. |
| **Share partner** | A user who co-owns a split entry (e.g., "Dustin/JB", "Lance/Jack"). |
| **Spectator** (optional) | Can view public standings/draw without an entry. |

---

## 4. Functional Scope

### 4.1 Sweepstakes Configuration (the replicable model)
Admin can create a sweepstakes from scratch or **clone from a template** — either way through the **Setup Wizard** (4.1a). Configurable per sweepstakes:

- Name, branding (logo, colors, imagery — see 4.12), description, season label (e.g., "2026–27").
- **Visibility**: public (listed in the browse directory, anyone can enter) or **private/gated** (unlisted; entry requires an invite link, access code, or email allowlist).
- **House cut (rake)** — optional percentage or flat amount withheld from the pot before payouts are calculated; shown transparently on the payout table (e.g., "$15,000 pot − 10% house = $13,500 paid out"). Defaults to 0%.
- **Recurrence** — one-off, or part of a recurring **series** with returning-entrant lock-in (see 4.13).
- **Sports included** — any subset of: CFB, NFL, NBA, **WNBA**, NHL, CBB, PGA, LIV, MLB (architecture supports adding more leagues later, e.g., MLS, NCAA baseball).
- **Roster composition** — number of teams/players per sport per entry (defaults: CFB 4, NFL 2, CBB 4, NBA 2, NHL 2, PGA 3, LIV 1, MLB 2).
- **Pool size** — number of entries (default 15). Pool size × picks-per-sport must not exceed available teams (validation built in, e.g., 15 × 2 = 30 > 32 NFL teams ✓).
- **Entry item & price** — which product must be purchased and its cost (default $1,000). Multiple item options per sweepstakes supported (e.g., hat vs. jersey at same entry price).
- **Payout structure** — number of paid places and either fixed dollar amounts or percentages of the pot (defaults: 1st $10,000, 2nd $2,500, 3rd $1,500, 4th $1,000).
- **Optional side-pot tiers** (each independently on/off with its own prize): lowest season score, highest single-week score, most points by a single team/golfer, weekly high score (recurring weekly prize).
- **Scoring matrix** — per-sport points table, pre-filled with platform defaults (Appendix A) and editable per sweepstakes. Includes **scoring granularity** per sport: full-game win (default) and/or **per-half scoring** (points for winning the 1st half and points for winning the 2nd half, configured independently — e.g., 3 per half + 6 for the game). Architecture supports per-quarter/per-period later.
- **Team pool source per sport** — all teams, or "top N" auto-aggregated (see 4.4).
- **Schedule** — enrollment open/close, draw date/time, season start/end per sport, tiebreaker rules.
- Lifecycle states: `draft → enrolling → full → drawing → active → completed → archived`.

### 4.1a Setup Wizard (questionnaire)
A guided, plain-language flow so creating a sweepstakes takes minutes, not a config screen safari:

1. **Basics** — name, season, description, public or private.
2. **Sports & rosters** — pick the leagues, picks-per-sport (defaults pre-filled); live validation against pool size.
3. **Pool & entry** — pool size, entry item (pick from catalog or create one inline), price.
4. **Money** — payout places and amounts/percentages, optional house cut, optional side pots. A live "pot math" preview shows pot → house cut → payouts as you type.
5. **Scoring** — accept the default matrix or open the editor to tweak values.
6. **Schedule** — enrollment window, draw date/time; season start/end auto-suggested from the league schedule API (see 4.14).
7. **Branding** — logo, favicon, colors, hero image (see 4.12).
8. **Review & publish** — full summary, save as draft or open enrollment; "save as template" for next time.

Every step has sensible defaults from the chosen template, so the minimum path is: name it → confirm → publish.

### 4.2 Accounts & Multi-Sweepstakes Navigation
- Supabase Auth: email/password + magic link (Google/Apple OAuth optional).
- Profile: display name (the name shown in standings/smack talk), avatar, notification preferences.
- A user can hold entries in **multiple sweepstakes** and multiple entries in one sweepstakes (if config allows). A persistent **entry switcher** (top nav) jumps between "My Entries" — each showing that pool's standings, roster, and board.
- "My Dashboard" home: all my entries at a glance — rank, total points, points this week, next draw/event.

### 4.3 Commerce & Enrollment
- Product catalog (admin-managed): name, images, description, price, inventory, shipping required y/n.
- **Product showcase page** per sweepstakes: branded storefront-style page presenting the entry item — image gallery, description, price, what entry includes (roster breakdown, payout table), spots-remaining counter, and a prominent **Buy & Enter** button straight into Stripe Checkout.
- **Purchase = entry**: Stripe Checkout for the configured item; successful payment (webhook-verified) creates the entry and decrements pool capacity. Shipping address collected when the item is physical.
- **Split entries**: the purchaser becomes entry owner and can invite co-owners by email/link with defined split percentages (informational; payouts go to the owner unless admin overrides). Entry display name is customizable ("Dustin/JB").
- Pool-fill mechanics: live "12 of 15 spots filled" indicator; waitlist once full; automatic refund flow if the pool doesn't fill by deadline (admin-triggered).
- Receipts and order/shipping status emails via Resend.

### 4.4 Team Pool Building & Auto-Aggregation
- Pro leagues (NFL, NBA, WNBA, NHL, MLB): draw pool = all teams, or admin-curated subset.
- **CFB and CBB: automatic top-team aggregation.** Pull preseason/current rankings (AP poll and/or composite from the data provider) and auto-populate the draw pool with the top N teams (N = pool size × picks per entry, e.g., 60 CFB teams for 15 entrants × 4). Admin can review/override before locking.
- Golf: pull current OWGR / FedEx standings for PGA (top N) and LIV roster; admin review/override.
- Draw pool locks at drawing time; a snapshot is stored for auditability.
- Mid-season replacement rules (injury/withdrawal for golfers, e.g.) — configurable: no replacement (default, matches current pool) or admin substitution.

### 4.5 Live Drawing Experience 🎰
The signature feature — must feel like an event:

- Scheduled draw with countdown page; reminder emails (24h/1h) via Resend.
- **Live animated drawing** broadcast over Supabase Realtime: all connected entrants watch the same sequence simultaneously — slot-machine/lottery-ball style reveal, sport by sport, round by round (snake or random order, configurable). Confetti, sound, team reveal cards.
- Server-side cryptographically secure RNG (Edge Function); every assignment written to an **audit log** (seed, timestamp, sequence) so results are provable and replayable.
- Pacing controlled by admin (auto-advance every X seconds or manual "next pick" button — lets a host emcee it).
- Live reaction bar / emoji bursts + draw-night chat sidebar (ties into smack talk board).
- Replay video/recap page for anyone who missed it; full results email afterward.
- Fallback: if a draw must be re-run (config error), versioned draws with the audit trail preserved.

### 4.6 Scoring Engine & Data Ingestion

**Central sports data repository.** All league data — teams, schedules, game results, TV/broadcast info, league calendars, rankings — is ingested **once** into a shared, sweepstakes-agnostic repository. Every sweepstakes reads from it; none owns its own copy. A game's final score is stored one time and every pool with that team rostered scores from the same record. This means: one provider bill, one place to correct a bad score (the fix propagates to every sweepstakes automatically), and new sweepstakes get full historical/schedule data for free the moment they're created. Sweepstakes-specific data (rosters, scoring matrices, point events, standings) layers on top and references the central records.

- **Scoring matrix** (Appendix A defaults): per-sport regular-season win values plus event-specific values (bowl tiers, playoff rounds, majors, championship bonuses). Stored as data, not code — fully editable per sweepstakes, with WNBA defaults to be defined (proposed: mirror NBA values).
- **Per-half scoring (optional)**: any team sport's rules can award points for winning each half independently of the game result (e.g., NFL: 1st half win +3, 2nd half win +3, game win +12; halves can tie → no points, or configurable). Requires **line scores** (period-by-period) from the provider — available for the major leagues from the main candidates — and the manual entry console accepts period scores for gap-fill. Half results are computed and stored centrally on the game record so all pools read identical half outcomes. (Hockey/basketball variants: per-period or first/second-half splits as applicable per sport.)
- **Automated results ingestion**: scheduled jobs (Vercel Cron / Supabase scheduled Edge Functions) poll a sports data provider and write into the central repository: final scores, schedule changes, broadcast updates. A separate per-sweepstakes scoring pass then maps central results to rostered teams, applies each pool's matrix, and writes point events.
  - Candidate providers (decision needed): SportsDataIO, Sportradar, API-Sports, ESPN (unofficial). Selection criteria: covers all 9 leagues incl. golf + WNBA, **schedules with TV/broadcast listings** (powers "Your Upcoming Games"), league calendars, cost, latency, reliability.
- Point events are **immutable ledger entries** (team, game/event, rule applied, points, timestamp) — standings are always derivable and auditable; corrections are compensating entries, never edits.
- Update cadence: every 10–15 min during live windows, hourly otherwise (configurable). "Last updated" timestamp everywhere scores appear.
- **Missing-data detection & alerts**: the ingestion job knows what it *expects* — every scheduled game involving a rostered team should have a final result within a configurable window after its scheduled end (e.g., 6 hours). When a result doesn't arrive, the provider returns an error, or a game sits in an ambiguous state (postponed, suspended, provider gap — common for LIV and smaller events), an **alert fires to admin** (email via Resend + a badge in the admin Data Ops queue). Alerts also fire for stale schedules and missing broadcast data on upcoming rostered games.
- **Manual score entry console**: from the alert queue, admin can enter or correct any result by hand — winner, final score, event type (e.g., "FedEx playoff win") — written into the **central repository** with a `source: manual` flag and full audit trail, so every sweepstakes reading that game scores it identically. If the provider later delivers the result, a conflict check compares it against the manual entry and flags mismatches instead of silently overwriting.
- Admin manual adjustment tool (with reason + audit trail) for per-sweepstakes edge cases (ties, forfeits, rule disputes) — distinct from central score entry: adjustments affect one pool, score entry affects all.
- Golf scoring nuances handled: individual-win-only rules for LIV, multi-win events (FedEx playoffs ×2, majors ×4), champion bonuses. (Golf is the most likely candidate for manual entry — LIV data coverage is thin across providers.)

### 4.7 Standings, Trends & Accolades
- **Real-time standings** per sweepstakes: rank, entry name, total points, movement vs. last week (▲▼), points by sport (expandable to the full roster view mirroring the "Scores by Team" tab).
- **Weekly snapshots** (cron, e.g., Sunday night): power the trends features and preserve history (mirrors the dated columns in the Standings tab).
- **Trends & graphs**: line chart of every entry's cumulative points by week; rank-over-time bump chart; per-sport contribution breakdown (stacked bars); individual entry drill-down (which teams are carrying you).
- **Accolades**: automatic weekly awards — Weekly High Score 🏆, Biggest Climber, Hottest Team (most points by one team that week); season-long badges (wire-to-wire leader, comeback, etc.). Displayed on profiles and announced on the board + weekly recap email.
- **How Points Work (user-facing scoring guide)**: every sweepstakes has a public, plainly-written scoring page generated from its scoring matrix — per sport: what a regular-season win is worth, what playoff rounds/bowls/majors pay, and champion bonuses — with worked examples ("Your NFL team wins Sunday → +12. They win the Super Bowl → +25 more."). Linked from the product showcase (so buyers understand the game before purchasing), the standings page, and onboarding. Updates automatically if the admin edits the matrix.
- **My Points History (per-entry ledger view)**: a user-facing drill-down showing exactly how an entry accumulated every point — chronological feed of point events: date, team, game result, rule applied, points earned ("Nov 12 · OHIO ST def. PURDUE · CFB regular-season win · +7"). Filterable by sport, team, and week, with running totals; tapping a team shows that team's full earnings timeline. Manual corrections/adjustments appear labeled so nothing looks like it changed silently. This is the trust feature: any entrant can audit their own score back to individual games.
- **Score disputes 🚩**: every point event and game record in My Points History carries a "Report a problem" action. The user picks a reason (wrong winner, missing game, wrong points value, duplicate) and adds a note; the dispute lands in the admin **Data Ops queue** alongside automated alerts. Admin resolves it by correcting the central score (fix propagates to all pools), applying a per-pool adjustment, or rejecting with an explanation — the disputing user is notified of the outcome by email and in-app, and the resolution note is visible on the event. Duplicate disputes on the same game auto-group. Dispute history is public on the game record ("score confirmed after review") to head off repeat reports, and a per-user rate limit keeps it from becoming a smack-talk channel.
- **Your Upcoming Games 📺**: every entry gets a schedule view of their rostered teams' next games — opponent, date, local time (user-timezone aware), and **TV/broadcast info** (network/station, streaming service where available), pulled from the sports data provider. Shown as a "this week" strip on the entry dashboard and a full schedule tab on the roster page; golf equivalents show the next tournament and coverage windows. Optional inclusion in the weekly recap email ("Your watch list this week").
- Tiebreakers: configurable rule chain (e.g., most championship-round points → most total wins → head-to-head weekly wins → coin flip), defined before season start.

### 4.8 Payouts
- Payout table per sweepstakes (places + amounts/percentages) shown on every standings page, **including the house cut line** when one is configured (pot → house cut → net payouts), so the math is transparent to entrants before they buy.
- **House cut allocation**: configured in the wizard (percent or flat); withheld automatically at close-out and recorded as a platform ledger entry per sweepstakes (feeds the admin financial summary).
- Side pots tracked and displayed as separate mini-leaderboards (e.g., "Lowest Score race", "Weekly High Score winners list").
- **Automatic payouts via PayPal or Venmo**: in payout settings each user enters a **PayPal email and/or a Venmo handle** (phone or @username) and picks their preferred method. Both are disbursed through the **PayPal Payouts API** (Venmo is a supported wallet type on the same batch API, US-only). At season close-out, admin reviews and approves the payout run; the platform pushes prizes automatically with per-item status tracking (pending/success/unclaimed/failed), automatic retry/refund of failed items, and email confirmations. Manual methods (check/Zelle) remain as fallback.
- Payout preconditions enforced per winner: payout method on file, W-9 collected for prizes ≥ $600, identity confirmed for large prizes.
- Season close-out flow: admin finalizes standings → winners notified (email) → missing payout info chased automatically (reminder emails) → payout run executed → all transactions logged with PayPal batch/item IDs.
- ⚠️ Dependency: PayPal Payouts requires an approved business account, and prize disbursement falls under the same legal/processor review as Section 2 — confirm during Phase 0.

### 4.8a Prize Pool Custody (holding the funds)
Entry money must be visibly and safely held between purchase and payout. Stripe does **not** offer true escrow — its terms prohibit using the platform as an escrow service, and standard settlements pay out to the merchant bank account on a rolling basis. The design therefore separates *custody* (where dollars sit) from *accounting* (what the app tracks):

- **In-app pot ledger (all options)**: every entry payment, refund, house cut, and payout is a ledger entry tagged to its sweepstakes, so each pool's balance is provable at any moment ("WWOS V pot: $13,000 of $15,000 collected — held"). The standings page can show a "pot secured" indicator.
- **Custody options (Phase 0 decision, with counsel):**
  1. **Segregated bank account (recommended start)** — Stripe settles into a dedicated "prize pool" bank account used for nothing else; the app ledger reconciles against it. Simple, cheap, auditable; trust is procedural rather than legal escrow.
  2. **Stripe Treasury / BaaS FBO accounts** — programmatic financial accounts (Stripe Treasury, Unit, Treasury Prime) that hold each pool's funds "for benefit of" entrants with per-pool balances. True separation and API-driven, but requires platform approval and more compliance lift.
  3. **Third-party escrow service** — a licensed escrow provider holds the pot and releases on instruction. Strongest trust story, highest fees; probably overkill unless the legal review demands it.
- Either way, **funds are never spendable by the platform** beyond the configured house cut, and refund liability (pool fails to fill, season canceled) is always fully covered by the held balance — the ledger blocks house-cut withdrawal until payouts and refund windows clear.
- ⚠️ Note for counsel: holding other people's money in transit can trigger **money transmitter** rules depending on structure/state — fold into the Section 2 review.

### 4.9 Smack Talk Board 💬
- Per-sweepstakes message board (Supabase Realtime): text posts, replies, emoji reactions, GIF support, @mentions, image attachments (Supabase Storage).
- Auto-posted system messages as conversation fuel: weekly results, accolades, lead changes ("Dustin/JB extends the lead 🚨").
- Moderation: report, admin delete/mute, profanity filter toggle, pinned posts (rules/announcements).
- Optional draw-night live chat mode (high-velocity stream during drawings).

### 4.10 Notifications (Resend)
- Transactional: account verification, receipt/entry confirmation, shipping updates, draw reminders, draw results, winner notifications, refunds.
- Engagement (per-user opt-in): **weekly recap** (your rank, points gained, accolades, standings snapshot, hot teams), lead-change alerts, smack-talk mention alerts, enrollment-open announcements for new sweepstakes.
- Branded React Email templates; one-click unsubscribe per category.

### 4.11 Admin Dashboard
- **Payout center**: payout-run builder, PayPal batch status, house-cut ledger, tax-doc tracker.
- **Branding/theme editor** (4.12) and **series/renewal manager** (4.13).
- Sweepstakes CRUD + template library + clone.
- Enrollment monitor (entries, payments, shipping queue, refunds).
- Draw control room (configure, schedule, run, pace, audit).
- **Data Ops queue**: missing/ambiguous result alerts, **user score disputes** (grouped by game, with resolve/adjust/reject actions and outcome notifications), manual score entry console, provider conflict review, ingestion health (last sync per league, provider errors), per-pool manual adjustments, recalculation tool.
- Scoring matrix and payout editors.
- User management, board moderation, broadcast email composer.
- Financial summary per sweepstakes: gross entries, item costs, pot, house cut, payouts.

### 4.12 Theming, Branding & Media 🎨
The look of the site — and of each sweepstakes — is admin-customizable without code:

- **Site-level branding**: logo, **favicon**, wordmark, color palette (primary/accent/dark-mode variants), default fonts, social share image (OG image). Platform defaults come from the WWOS badge logo — see **Appendix D Brand Guide** (navy/red/sky palette, retro-script display type, badge motifs).
- **Per-sweepstakes branding overrides**: logo, hero/banner image, accent colors, product photography — so each pool can have its own identity while inheriting site defaults.
- **Media library on a Supabase Storage bucket**: drag-and-drop image uploads (logos, favicons, heroes, product shots, board attachments), automatic resizing/optimization via Supabase image transformations, organized per sweepstakes, with usage shown ("used as hero on WWOS V").
- Theme tokens flow through the whole app (storefront, standings, draw screen, emails) — the draw broadcast and Resend templates pick up the sweepstakes branding automatically.
- Live preview in the wizard's branding step before publishing.

### 4.13 Recurring Series & Renewal Lock-In 🔁
A sweepstakes can belong to a **series** (e.g., "WWOS" → WWOS IV, WWOS V, …) so the pool perpetuates year over year:

- When a season completes, admin (or an automatic rule) spins up next season's edition from the same config — one click, dates shifted forward via the league schedule API.
- **Returning entrants are locked in**: their spot is reserved in the next edition. They must **repurchase by a renewal deadline** to keep it.
- Renewal flow: renewal window opens → reserved-spot email with one-click repurchase (Stripe) → reminders at configurable intervals (e.g., 30/14/3 days) → at the deadline, unrenewed spots are released to the waitlist, then to public/invited enrollment.
- Renewal status dashboard for admin: who's renewed, who's pending, projected open spots.
- Series history carries over: champions wall, all-time records, head-to-head stats across seasons — strong retention hook.
- Split entries renew as a unit (owner renews; co-owner invites re-issued automatically).

### 4.14 Seasons Calendar & Discovery 📅
- **Active-season indicator** everywhere relevant: each sweepstakes shows which sport seasons are currently live ("CFB · NFL active now"), pulled automatically from the sports data provider's league calendars — no manual date entry.
- **Upcoming seasons timeline**: "NBA tips off Oct 21 · NHL starts Oct 7 · CBB Nov 3" — auto-populated per sweepstakes from the API, shown on the dashboard and public pages so entrants always know what's scoring now and what's next.
- Season transitions fire automatically: when a league's first game day arrives, ingestion for that league activates and a "now scoring" announcement posts to the board / weekly email.
- **Browse & discover**: a public directory of open sweepstakes — card grid with branding, entry price, spots remaining, sports included, payout headline ("$10,000 to win") — filterable by sport, price, and status. Users can enter directly from a card (→ product showcase page).
- **Private/gated sweepstakes** never appear in the directory; access is via invite link, access code, or email allowlist. Gated pages show a tasteful "private pool" lock screen to anyone without access.

### 4.15 Game Modes (incl. March Madness Bracket) 🏀
The platform is architected around **game modes** — a sweepstakes declares its mode, and the mode determines how entrants get teams and how points accrue. Everything else (accounts, commerce/entry, payouts + house cut + escrow ledger, browse/private pools, recurring series, smack talk, notifications, theming, central sports data) is mode-agnostic and shared.

- **Mode 1 — Draw Roster (v1, the WWOS game):** random live drawing assigns rosters; points accumulate per the scoring matrix all season. Everything in 4.4–4.7.
- **Mode 2 — Bracket Challenge (v1.5/v2):** a traditional March Madness pool as a sweepstakes type:
  - Entrants fill out a **bracket picker** (the classic 64/68-team grid, mobile-friendly) between Selection Sunday and tip-off; picks lock at the first game.
  - Round-based scoring matrix (e.g., R1 1 · R2 2 · Sweet 16 4 · Elite 8 8 · Final 4 16 · Champion 32 — fully editable, upset bonuses optional e.g., + seed differential).
  - Live bracket view: wins/losses paint the bracket, busted picks struck through, points possible remaining ("max points left") per entry.
  - Leaderboard replaces the season standings view; same payouts/side pots machinery (e.g., side pot for best first round).
  - The **central data repository already carries the NCAA tournament** (it scores CBB for Draw Roster pools), so brackets reuse the same games, schedules, TV info, and manual-entry fallback — no new ingestion.
  - Tiebreaker: traditional championship-game total-points prediction, collected with the bracket.
  - Same mechanics extend to any single-elimination event later (NIT, conference tourneys, World Cup).
- The same series can run both modes year-round: WWOS main pool (Draw Roster) + a March bracket sweepstakes each spring — same brand, same users, two purchases.

---

## 5. Non-Functional Requirements

- **Mobile-first** responsive web app (the standings check and smack talk are phone behaviors); PWA installable. Native apps out of scope for v1.
- Realtime fan-out sized for hundreds of concurrent draw viewers per pool (Supabase Realtime channels).
- Scoring correctness > speed: ledger model, idempotent ingestion jobs (re-running a sync never double-counts).
- Auditability: draws, point events, manual adjustments, payout records all logged.
- Security: RLS on all tables (entrants see their pools; admin-only mutations), Stripe webhooks verified, rate limiting on the board.
- Accessibility (WCAG AA) and dark mode (sports audience, evening usage).
- Environments: local → preview (Vercel preview deploys per PR) → production; GitHub Actions for tests/lint/migrations.

---

## 6. Architecture & Data Model (outline)

**App:** Next.js App Router on Vercel. Server components for standings pages; Supabase Realtime subscriptions for live standings/draw/board.
**Data layering:** two tiers — a **central sports data repository** (`sports`, `teams`, `games`, `league_seasons`, rankings; sweepstakes-agnostic, written only by ingestion jobs and the manual entry console) and **per-sweepstakes data** (rosters, scoring rules, point events, standings) that references it. One score correction in the central tier propagates to every pool on the next scoring pass.
**Jobs:** Vercel Cron → Supabase Edge Functions: `ingest-results` (per league → central repo), `score-sweepstakes` (central → per-pool point events), `detect-data-gaps` (expected-vs-received audit → alerts), `weekly-snapshot`, `accolade-calc`, `draw-engine`, `email-digests`.
**Payments:** Stripe Checkout + webhooks (`checkout.session.completed` → create entry).

Core tables (illustrative):

```
sports(id, key, name)                         -- CFB, NFL, NBA, WNBA, NHL, CBB, PGA, LIV, MLB
teams(id, sport_id, external_ref, name, abbrev, market)
sweepstakes(id, series_id, name, status, visibility, game_mode draw_roster|bracket,
            pool_size, entry_price, house_cut_pct, house_cut_flat, schedule…, theme_id)
series(id, name, recurrence_rule, renewal_window_days, renewal_deadline_rule)
renewals(id, series_id, prior_entry_id, user_id, status, deadline, renewed_order_id)
themes(id, scope site|sweepstakes, logo_url, favicon_url, colors jsonb, hero_url, og_url)
media_assets(id, bucket_path, kind, sweepstakes_id, uploaded_by, meta)
access_grants(sweepstakes_id, type code|email|link, value, uses_remaining)
league_seasons(sport_id, season_label, starts_at, ends_at, source synced_from_api)
payout_accounts(user_id, method paypal|venmo|check, identifier, verified_at)
sweepstakes_sports(sweepstakes_id, sport_id, picks_per_entry, pool_source, top_n)
scoring_rules(id, sweepstakes_id, sport_id, rule_key, label, points,
              scope full_game|half1|half2|period)   -- per-half scoring option
brackets(id, sweepstakes_id, entry_id, tiebreaker_total, locked_at)        -- bracket mode
bracket_picks(bracket_id, slot, picked_team_id, round, result pending|hit|miss)
products(id, sweepstakes_id, name, price, inventory, requires_shipping)
orders(id, user_id, product_id, stripe_session, status, shipping…)
entries(id, sweepstakes_id, owner_user_id, display_name, order_id, status)
entry_shares(entry_id, user_id, percent, invited_email, status)
draws(id, sweepstakes_id, version, seed_hash, started_at, completed_at)
draw_picks(draw_id, entry_id, team_id, sequence, revealed_at)
rosters(entry_id, team_id, sport_id)          -- materialized from final draw
games(id, sport_id, external_ref, starts_at, status, winner_team_id,
      home_team_id, away_team_id, broadcast jsonb /* network, stream */,
      line_score jsonb /* per half/period, powers half scoring */,
      result_source api|manual, meta)          -- CENTRAL: shared by all sweepstakes
data_alerts(id, type missing_result|provider_error|conflict|stale_schedule,
            game_id, detail, status open|resolved, resolved_by, created_at)
disputes(id, user_id, entry_id, game_id|point_event_id, reason, note,
         status open|under_review|fixed_central|adjusted_pool|rejected,
         resolution_note, resolved_by, created_at, resolved_at)
point_events(id, entry_id, team_id, game_id, rule_key, points, created_at, reversal_of)
standings_snapshots(sweepstakes_id, week, entry_id, rank, total_points, taken_at)
accolades(id, sweepstakes_id, entry_id, type, week, value)
payouts(id, sweepstakes_id, place|pot_type, entry_id, amount, status, tax_doc_status,
        paypal_batch_id, paypal_item_id)
pot_ledger(id, sweepstakes_id, type entry|refund|house_cut|payout|adjustment,
           amount, ref_order_id|ref_payout_id, recorded_at)   -- per-pool fund accounting
house_ledger(id, sweepstakes_id, amount, type cut|fee, recorded_at)
posts(id, sweepstakes_id, user_id, parent_id, body, attachments, created_at)
reactions(post_id, user_id, emoji)
audit_log(id, actor, action, target, detail, created_at)
```

---

## 7. Additional Ideas (the "what else" list)

Recommended for v1 where marked; others are backlog candidates.

1. **Provably fair draw audit page** (v1) — publish seed hash before the draw, reveal seed after; builds trust for $1,000 entries.
2. **Invite links / referrals** (v1) — entrants recruit friends to fill pools faster; referral leaderboard later.
3. **Pool-fill urgency mechanics** (v1) — "3 spots left" banners, waitlist auto-promote.
4. **Public landing page per sweepstakes** (v1) — shareable standings (names only), drives next season's signups.
5. **Season archive** (v1-lite) — past seasons' final standings and champions wall ("WWOS IV Champion: Dustin/JB").
6. Live game ticker — show rostered teams' in-progress games ("Your OHIO ST up 14–7 in Q3").
7. Projected points / "what you need" calculator during playoffs (e.g., "Scott S wins if KC takes the Super Bowl").
8. Trade or swap window between entrants (commissioner-approved) — changes the game model, flag for discussion.
9. ~~Schedule lookahead~~ → promoted to v1 as **Your Upcoming Games** (4.7).
10. Champion trophies & profile cases — digital trophies across seasons; physical trophy/merch fulfillment for winners.
11. Multi-pool franchise/white-label mode — let outside groups run their own branded WWOS instance (revenue model: platform fee).
12. SMS notifications (Twilio) for draw start and weekly recap — email open rates won't match the excitement level.
13. Draw-night co-streaming embed — host on camera via Mux/YouTube Live embedded next to the animation.
14. Pick-style variant — future game mode where entrants draft instead of random draw (engine already supports ordered picks; slots into the game-mode architecture of 4.15 alongside Bracket Challenge).
15. Anomaly alerts to admin — provider score discrepancies, entries with zero point movement during active weeks (signals a mapping bug like the $0 golf rows in the sample sheet).

---

## 8. Open Questions

1. **Legal structure** (Section 2) — blocking; determines payments and enrollment design.
2. Sports data provider & budget — golf + WNBA coverage narrows the list; needs a pricing pass.
3. Split-entry payouts — single payee (owner) or platform splits to all share partners?
4. Refund policy specifics — pool doesn't fill, entrant withdraws pre-draw, season cancellation.
5. WNBA default scoring values — mirror NBA, or different (shorter season → higher per-win points)?
6. Are entry items real merchandise needing fulfillment/inventory, or nominal? Drives the commerce build size.
7. Who runs the draw live — automated only, or always host-paced with an emcee?
8. Tiebreaker default — confirm the rule chain.
9. Should spectators (non-entrants) see standings and the board, or is everything behind entry?
10. House cut: disclosed as a flat "house fee" or baked into the payout table? Any cap? (Transparency affects trust at $1,000 entries — recommend always showing the line item.)
11. PayPal Payouts requires an approved business account and has per-transaction limits (~$20K/item typical, varies by account) — confirm $10,000 single payouts are approved for the account; fallback method if PayPal declines a recipient?
12. Renewal lock-in: how long is the renewal window, and do returning entrants get the same price guaranteed or current-season pricing?
13. Private pools: invite link only, or also access codes / email allowlists? (Scope assumes all three; trim if simpler is fine.)
14. League calendars from the data provider vs. manually confirmed each season — auto-trust the API or require admin confirmation before season-active flips?
15. Prize pool custody (4.8a): segregated bank account, Stripe Treasury/FBO, or licensed escrow? Needs counsel input on money-transmitter exposure.
16. Per-half scoring: which sports offer it by default, and how do tied halves score (0, split, or carry)? Confirm the chosen data provider returns line scores for every covered league.
17. Bracket Challenge timing: target v1.5 (this season's March Madness) or v2? Affects whether the bracket picker starts design during Phase 4.

---

## 9. Phased Delivery

**Phase 0 — Foundations (1–2 wks):** legal/payments decisions (incl. prize-pool custody model and PayPal/Venmo payout account approval), data provider selection & contract, repo + Supabase + Vercel + Resend setup, design system & branding.

**Phase 1 — Core platform (5–7 wks):** auth/profiles, sweepstakes setup wizard & templates, theming/branding system + media bucket (logo, favicon, hero), product showcase pages + Stripe checkout + entries + split invites, pool-fill flow, public browse directory + private/gated access, admin CRUD, transactional emails.

**Phase 2 — Draw & rosters (3–4 wks):** team ingestion + top-N aggregation (CFB/CBB/golf), draw engine + audit, live animated draw experience, rosters, draw emails.

**Phase 3 — Scoring & standings (4–6 wks):** central sports data repository, results + schedule ingestion for all leagues (incl. TV/broadcast data), missing-data detection + alert queue + manual score entry console, league season calendars + active/upcoming season automation, "Your Upcoming Games" views, scoring engine + matrix editor, "How Points Work" guide + "My Points History" ledger views, score dispute flow, real-time standings, roster/score views, weekly snapshots, per-pool adjustment tools.

**Phase 4 — Engagement (3–4 wks):** trends & graphs, accolades, side pots, smack talk board, weekly recap emails, multi-entry dashboard & switcher.

**Phase 5 — Money & season ops (3–4 wks):** payout close-out flow with house cut, PayPal Payouts integration (payout accounts, batch runs, status tracking), tax doc collection, recurring series + renewal lock-in flow, archives, moderation, load test the draw, beta with the existing 15-person group.

**Phase 6 — Bracket Challenge mode (v1.5, 4–5 wks):** bracket picker UI, round-based bracket scoring, live bracket view + leaderboard, tournament tiebreaker — reusing commerce, payouts, boards, and the central data repository. Timed to land before Selection Sunday.

**Total: roughly 19–28 weeks** to full v1 (Phases 0–5); a working pilot (Phases 0–3) in ~13–19 weeks, in time for a CFB/NFL season start if Phase 0 begins promptly. (Renewal lock-in isn't needed until season 1 ends, so Phase 5 can run during the live season; Phase 6 can run any time before March.)

---

## Appendix A — Default Scoring Matrix (from WWOS 4 workbook)

**Roster composition per entry:** Golf 4 (3 PGA + 1 LIV) · MLB 2 · CFB 4 · NFL 2 · NBA 2 · NHL 2 · CBB 4 — 20 picks total. *(WNBA to be added with config-driven count.)*

**Regular-season win:** Golf 10 (PGA win; LIV individual wins only 10) · MLB 1 · CFB 7 · NFL 12 · NBA 2 · NHL 2 · CBB 3

| Sport | Event | Points |
|---|---|---|
| Golf | FedEx playoff win (each of 2) | 15 |
| Golf | FedEx Champion | 25 |
| Golf | PGA Major win (each of 4) | 25 |
| Golf | LIV Individual Champion | 20 |
| MLB | Wildcard win | 3 |
| MLB | Division Series win | 5 |
| MLB | ALCS/NLCS win | 7 |
| MLB | World Series win | 10 |
| MLB | World Series Champion bonus | 10 |
| CFB | Non-playoff bowl win | 10 |
| CFB | Playoff 1st-round win | 12 |
| CFB | Sugar/Peach/Fiesta/Rose Bowl win | 15 |
| CFB | Cotton/Orange Bowl win | 20 |
| CFB | Championship win | 25 |
| NFL | Wildcard win | 7 |
| NFL | Divisional win | 12 |
| NFL | Conference Championship win | 15 |
| NFL | Super Bowl win | 25 |
| NBA | 1st Rd 3 · 2nd Rd 5 · Conf Finals 7 · Finals 10 · Champion bonus 10 | — |
| NHL | 1st Rd 3 · 2nd Rd 5 · Conf Finals 7 · Finals 10 · Cup bonus 10 | — |
| CBB | NCAA: R1 3 · R2 5 · Sweet 16 7 · Elite 8 10 · Final 4 15 · Champion 25 | — |
| CBB | NIT: R1 2 · R2 3 · QF 4 · SF 5 · Champion 10 | — |

## Appendix B — Default Payout Table (from workbook)

15 entries × $1,000 = $15,000 pot → 1st **$10,000** · 2nd **$2,500** · 3rd **$1,500** · 4th **$1,000**

## Appendix C — Reference Data in Sample Workbook

- *Scores by Team*: 15 entries with full 20-pick rosters and per-team season points — use as seed/demo data and as the spec for the roster score view.
- *Standings*: rank + total points snapshotted on 3 dates (8/16, 8/20, 8/24/25) — the model for weekly snapshots and trends.
- *Scoring*: the matrix captured in Appendix A.

## Appendix D — Brand Guide (from the WWOS logo)

The site's default theme derives entirely from the supplied "Wide World of Sports — Sweepstakes" badge logo (retro athletic crest: red script "Sports" over a light-blue globe inside a navy circular badge with arc text and red/white ring accents).

**Color palette** *(hex values approximated from the logo — sample exact values from the source file during design setup)*:

| Token | Color | Approx. hex | Usage |
|---|---|---|---|
| `navy` (primary) | Deep navy blue | `#1B2A4A` | Page backgrounds (dark), nav, badge surfaces, footer |
| `red` (accent) | Athletic red | `#C0273D` | CTAs (Buy & Enter), highlights, score deltas, live indicators |
| `sky` (secondary) | Light globe blue | `#A9D3EC` | Charts, info surfaces, hover states, accents on navy |
| `silver` | Warm gray | `#A7A9AC` | Secondary text, arc-text style labels, dividers |
| `white` | White | `#FFFFFF` | Text on navy/red, outlines, card surfaces (light mode) |

**Typography direction:** display type echoes the logo's bold retro script *for brand moments only* (hero headlines, draw-night reveals, champion announcements — a script face like an athletic-script Google font or licensed equivalent); all UI/body text uses a clean geometric sans (e.g., Inter/Geist) for legibility. Arc-text and badge motifs reserved for accolades, trophies, and section seals.

**Motifs:** circular badge/crest frames for accolades, champion trophies, and team reveal cards during the draw; the globe mark as a standalone icon; red-white-red ring borders as section dividers; subtle halftone/vintage texture acceptable on hero surfaces, never behind data.

**Derived assets to produce in Phase 0/1:** favicon + app icons (globe-only or "S" monogram crop of the badge), OG/social share card (badge on navy), email header (horizontal lockup), draw-screen backdrop, monochrome/one-color variants (white-on-navy, navy-on-white) for contexts where full color fails.

**Dark mode is the brand's home:** navy-dominant UI is the default look; light mode inverts to white cards on pale-gray with navy text and the same red/sky accents.

**Asset locations:** place source files (vector SVG/AI + transparent PNGs) in `C:\projects\wwos-sweepstakes\brand\` now; they become the seed of the in-app media library (4.12) at build time. The WWOS sweepstakes itself uses this as its theme; other sweepstakes on the platform may override per 4.12.
