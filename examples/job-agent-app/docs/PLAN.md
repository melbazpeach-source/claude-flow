# Job Agent Squad — Designing for the user who has to eat

A reset on the remaining phases now that we know what we're really building.
This continues the work already shipped (5 base agents, Tailor, Phase 2a
Postgres) and reframes the rest around a single question: *does this
materially help a person whose runway is measured in weeks?*

## Who we're building for

The user is in one of three states, often more than one at once:

- **Out of work, runway < 3 months.** Anxious, prone to spray-and-pray,
  ATSed into oblivion, losing confidence by the week.
- **In work but on borrowed time** — layoff signals, toxic role, visa
  clock, partner moving cities.
- **Stuck in interview hell** — getting screens, not getting offers,
  can't tell why, no feedback loop.

What this person needs from us, in priority order:

1. **Less, but better.** Fewer applications, each one thoughtful. The
   product must resist the panic-driven spray-and-pray urge, not amplify it.
2. **Continuity.** When the recruiter replies after 12 days of silence,
   the system rebuilds context instantly — what was said, what's true
   now, what the next move is.
3. **An honest mirror.** "30 applications, 1 first-round. Something is
   broken; let's diagnose before we send 30 more." Diagnostic, never
   preachy.
4. **Resilience scaffolding.** Job hunting alone in a room is corrosive.
   The system should be a steady presence, not a Duolingo nag.
5. **Permission to rest.** A literal pause button. We optimize for
   *the user landing a job and not coming back* — never session duration.

## What we will NOT build

- **Mass-apply automation.** Floods ATSes, burns the candidate's
  referenceability, is a dark pattern even if users ask for it.
- **XP-for-XP gamification.** No fake streaks, no badges for trivial
  actions, no leaderboards, no social comparison.
- **LinkedIn/X chatter scraping.** TOS-hostile, brittle, and not
  actually useful to the user.
- **Engagement optimization.** This is a tool, not a casino.

## The redesigned flow

### Scene 1 — `Today` (replaces Hunt as the default landing)

The app opens to a single focused screen:

- **Today's three** — three roles ranked by `match × recency × company-fit`.
  Not "everything Sentinel found" — three. Each carries a one-line
  "Why this one" microcopy.
- **The one thing that moved** — "Acme replied to your Phase-1
  application 2 hours ago" / "Brightside's posting closed; your
  application is still in queue." One-click restored context.
- **Runway** — "5 weeks runway · 23 active applications · 2 in
  interview." Honest, not celebratory.

Hunt / Saved / Progress still exist but reaching them requires
intent. Cognitive load on home drops to near-zero.

### Scene 2 — Single-job workspace

Clicking a Today card opens *one screen* containing everything for
that application:

- **The role** — title, comp signal, requirements, match score, gaps.
- **Your packet** — tailored CV + cover letter, live-editable, with a
  diff against your master profile so changes are reversible.
- **Intelligence** — recent company news, founder bios, Glassdoor
  signal, funding, notable PRs, "people you know who worked here"
  (when LinkedIn export is available).
- **Interview prep deck** — for *this* role at *this* company: 10
  likely questions ranked by stack/level/archetype, your bullets
  pre-mapped to each, comp data from levels.fyi / Glassdoor, the
  right questions to ask the interviewer.
- **The thread** — chronological log: applied → ack → screen → onsite
  → ..., notes attachable, auto-suggested follow-up at day 7/14/21.

This screen is the most important surface in the product. It
collapses "where is everything for Acme" into one canvas.

### Scene 3 — Hunt, two modes

- **Targets mode** (default) — Sentinel surfaces new postings from
  the watchlist, five-at-a-time, never a wall.
- **Explorer mode** — the existing paste-URLs/keywords flow, for
  widening the net intentionally.

### Scene 4 — The pipeline

One timeline per application:
`Saved → Applied → Acknowledged → Phone screen → Onsite → Offer | Rejected | Ghosted`

**Ghosted is computed from inactivity, not user-set.** That single
choice is what makes the system feel intelligent — it does the
emotional labor the user shouldn't have to. "Show me everything I
said to Stripe" returns resume version + letter + replies in
chronological order, no context-switching.

## The agents still to build

On top of Tailor (shipped), Sentinel (Phase 2b), and a slimmed
Quest:

- **Coach** — 30-day rolling pattern analyzer. "Screens but not
  onsites — let's look at interview prep." Diagnostic, hard opt-out.
- **Interviewer-Prep** — generates the per-role question deck for any
  application in screen/onsite stage. Glassdoor when available;
  archetype + stack + level otherwise. Maps user bullets to questions.
- **Negotiator** — when an offer arrives: market-rate analysis,
  drafts the counter, role-plays "what's your range" in chat.
- **Follow-Upper** — drafts the polite, specific follow-up at day
  7/14/21. Distinct tone for "interviewing" vs "applied" stage.
- **Connector** — finds the warm-intro path from a user-uploaded
  LinkedIn connections CSV (TOS-safe; user-owned data). "2
  second-degree connections at Acme — here are draft DMs."

## The radically un-trendy thing

**A pause button.** Literal "I'm taking 24 hours off, do not show me
anything." Cards stop, banners stop, nudges stop. The system
understands fatigue is real and respects it.

## Resequencing the phases

| Phase | Was             | Now                                              |
| ----- | --------------- | ------------------------------------------------ |
| 2b    | Sentinel        | **Sentinel + Today screen** — biggest UX leap    |
| 3     | Quest           | **Interview-Prep + Single-job workspace**         |
| 4     | (was 4)         | **Coach + Pause + slim Quest**                   |
| 5     | (new)           | **Negotiator + Follow-Upper + Connector**         |

## What I'd cut from the previous plan

- **Full gamification.** Keep the `activity_events` table (Coach
  needs it), drop XP/badges/streaks. Real progress > vanity metrics.
- **Demo tab** once Today exists. Demote to a `?demo` query param.
- **Bulk-import features.** Volume is not the answer.

## The one decision I need from you

The agents can either be **visible** (squad-tile choreography,
reasoning traces, "Rater is working…" — the user sees the system
think) or **invisible** (the user sees results; agents are
mechanism). It affects every UI surface.

- *Visible* sells the architecture and makes good demos.
- *Invisible* sells the outcome. The user is exhausted and just
  needs the next move.

My recommendation: **invisible by default, visible on demand.** A
"show me how" toggle exposes the reasoning trace for users who want
to see it. Best of both — but I need your read before I start
Phase 2b.

## Cost of this redesign

The plan adds three agents beyond the original spec (Coach,
Negotiator, Interviewer-Prep, Follow-Upper, Connector — that's
five, but Follow-Upper and Negotiator are small) and reshuffles
the existing roadmap. Net: ~30% more agent surface area, but the
UI surface area *shrinks* because the Today screen does the work
of three current tabs. The trade is good.

Nothing here invalidates Phase 2a (Postgres). Sentinel still rides
on the schema we just shipped, with `watchlist` / `seen_jobs` /
`fetch_run` added in 2b. The new agents in Phase 3+ slot cleanly
into the same `server/agents.ts` pattern.
