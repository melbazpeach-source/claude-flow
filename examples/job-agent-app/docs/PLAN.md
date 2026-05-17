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

## Market reality: NZ first-tranche dynamics

The "less, but better" frame above is necessary but not sufficient.
In the NZ market specifically, getting your application into the
**first ~10 received** is what gets you read at all. After that,
attention drops sharply — a beautifully tailored application that
arrives 11th can be functionally invisible. Quality *and* speed
both matter.

This forces a redesign of how Sentinel and Tailor interact:

### Pre-emptive tailoring

When Sentinel finds a new role *at a watched company* and the Rater
scores it ≥4/5, the Tailor agent fires in the background
immediately — before the user sees the notification. By the time
the user opens the alert, the CV + cover letter are 90% drafted.
This shifts the user's job from "spend an hour building an
application" to "spend 15 minutes reviewing and personalising one."

### First-tranche mode (a fast lane through the UX)

A deliberately stripped variant of the single-job workspace:
notification → review pre-tailored packet → quick letter edit → submit.
Under an hour, end to end. The user opts in per-application
("this just dropped, fast lane it"). The careful-craft workspace
remains the default for everything else.

### Sentinel cadence revised

The brief's two-tier "hourly collect, daily digest" pattern is
wrong for first-tranche dynamics. Revised:

- **Critical tier** (Rater ≥4/5 at watched company) → near-real-time
  push (browser/desktop notification, in-app banner). Subject to
  pause-button override.
- **Standard tier** (everything else from Sentinel) → daily digest as
  originally planned.

Polling frequency on watched companies tightens to ~15 minutes for
the critical path; everything else stays hourly.

### Pipeline tracking gets a speed dimension

New per-application metrics:
- `applied_at - posted_at` — time-to-apply, the proxy when ATS
  position data isn't visible.
- `applied_at_rank` when leakage allows it (LinkedIn ranges, some
  ATS counters, Workable's "100+ applicants" thresholds).

Coach uses these as inputs: "your fastest applications got more
callbacks; the careful ones didn't" is a falsifiable claim the
system can make once we have ~20 data points.

### The pause button still wins

Critical-tier push can wait 24 hours. The pause button is sacred —
the system never breaks the user's quiet hours even if it costs a
tranche slot. The user can disable pause if they want, but the
default is inviolable. This is the ethical line and it must hold.

### Markets other than NZ

The same speed dynamics apply differently elsewhere — US tech
roles get 100+ applications in days, not hours, so first-tranche
matters less there than thoughtful tailoring. EU markets vary by
country. The system should make the speed-vs-care balance a per-user
setting, default to "match my market" detected from preferred
locations, and let the user explicitly tune it.

## Lifting from the field (audit pass 2)

A second sweep through 14 adjacent repos. Headline: **no pivot.** The
nearest comparable (santifer/career-ops) is a single-user CLI + markdown
tool; we're a typed-agent web app with real persistence. Different
category. Five specific ideas worth integrating:

### 1. Archetype detection as a pre-Rater step

career-ops' best move: before scoring, classify the role into one of
6 archetypes (LLMOps / Agentic / PM / Solutions / Frontend /
Transformation). Each archetype carries a different rubric weighting.
Currently our Rater uses one rubric for every job, which under-serves
specialised roles. Add a tiny upstream Archetyper agent (one LLM call,
single-token output) that selects the rubric Rater applies.

### 2. Story Bank — cross-job behavioural memory

The single most copyable idea in the audit. A new `story_bank` table
of competency-tagged STAR narratives, accumulated across evaluations.
Each entry: `{competency, situation, task, action, result, source_job_id, last_used_at}`.

The Story Bank feeds:
- The back of every behavioural Interview-Prep flashcard (pre-filled
  STAR scaffold instead of empty form)
- The Writer agent's cover-letter context (lift the most relevant
  story to anchor the letter)
- Coach's "you keep telling the same 3 stories" insight

This is the cross-job memory layer we don't have today, and it's what
makes pre-emptive tailoring not feel generic — by application #20 the
system knows you, not just the JD.

### 3. Ghosted state — computed from recipient-side activity only

The crowdsourced ghost-trackers (ghostscore, ghost-rate-tracker,
do-not-ghost-me) gave us bucket boundaries; the right state machine
is ours:

| State    | Days since *recipient-side* activity |
| -------- | ------------------------------------ |
| Active   | 0-7                                  |
| Cooling  | 8-14                                 |
| Stale    | 15-30                                |
| Ghosted  | 30+                                  |

**Recipient-side only.** User-side activity (sending a follow-up,
editing notes) does *not* reset the clock — otherwise users hide
ghosting from themselves. Exception: if an outbound follow-up is
unanswered for >7d, jump one bucket forward. A follow-up with no
reply is itself a ghosting signal. Terminal states
(`rejected`/`offer`/`withdrawn`) override — never "ghosted."

Implemented as a Postgres view or generated column over the jobs +
activity_events tables. The 30-day modal is consistent across all
three trackers' histograms.

### 4. Interviewer-Prep — concrete Phase 3 spec

The interview-prep cluster (5 alternates + open-interview UX) yields
a clean spec:

**Inputs:** job + ParsedProfile + latest Tailored CV + Rater's gaps
+ Story Bank + Archetype.

**Question taxonomy (4 buckets):**
1. **Behavioural** — competency-tagged, STAR-shaped. Backs pre-filled
   from Story Bank.
2. **Technical / role-specific** — derived from JD tools + Rater's
   strengths.
3. **Gap-probing** — directly attacks each entry in Rater's `gaps[]`.
   This is our differentiator — no other repo has pre-computed gaps to
   work from.
4. **Culture / company** — derived from company metadata + JD tone.

**Difficulty:** 3 tiers (warm-up / standard / pressure). Each question
carries `difficulty` + `competency_tag`.

**Two surfaces, not one (open-interview's lesson):**
- **Flashcard deck** in the single-job workspace — front: question +
  tag; back: STAR scaffold from Story Bank + "red flags to avoid."
  Browse, mark known/unknown. No chat.
- **Mock chat** as opt-in second surface — minimal loop (question →
  text answer → 8-dimension heuristic score 0-10 → next). No voice in
  Phase 3 — adds device complexity for low marginal value.

**The 60-second daily quiz card** (Today screen):
**Leitner-lite, not full spaced repetition.** Three queues: New /
Review / Mastered. Cards promote on "I knew it," demote on "didn't
know." Daily draw: 1 from Review (oldest-touched first), 1 from a
job in active pipeline, 1 random behavioural. Three cards × 20s = under
a minute. Don't implement SM-2 or Anki algorithms — Leitner queues are
~20 lines and 80% of the value.

### 5. PDF output for Tailor — `@react-pdf/renderer` only

reactive-resume is an app, not a published library. Skip vendoring;
lift the one library it pioneered (client-side PDF without Chromium).
~200 lines mapping ParsedProfile → react-pdf component tree. Keep
ParsedProfile as the source of truth; do **not** swap to JSON-Resume
— we'd lose ATS-coverage and gap metadata.

### Smaller things worth borrowing

- From ApplyForge: `PROMPT_*` env-config pattern so power users can
  tune Tailor / Writer / Coach system+user prompts without editing
  code.
- From cv-market-learning-planner: gap → exercise mechanic seeds the
  Coach agent ("here are the three things to learn before applying
  to another Staff role").

## Resequencing the phases

| Phase | Was             | Now                                                          |
| ----- | --------------- | ------------------------------------------------------------ |
| 2b    | Sentinel        | **Sentinel (with critical tier) + Today screen**             |
| 3     | Quest           | **Interview-Prep + Single-job workspace + Pre-emptive Tailor + First-tranche mode** |
| 4     | (was 4)         | **Coach (with speed metrics) + Pause + slim Quest**          |
| 5     | (new)           | **Negotiator + Follow-Upper + Connector**                    |

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
