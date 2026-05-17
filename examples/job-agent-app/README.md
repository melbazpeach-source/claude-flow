# Job Agent Squad → G.Y.M. (Get Ya Mahi)

A small AI agent squad that hunts job listings on user-supplied job-board URLs,
rates fit against your resume, drafts custom cover letters and tailored CVs,
and can create email drafts in Gmail or Outlook.

**Codebase name:** `job-agent-app`. **NZ-facing product brand:** **G.Y.M.
(Get Ya Mahi)** — the kiwi "get a job or die trying" version. *Mahi* is te
reo Māori for work.

Ships as a vanilla-JS web app **and** a Tauri desktop shell that both render
the same UI.

> 📐 **Design vision & roadmap:** see [`docs/PLAN.md`](docs/PLAN.md) for the
> full plan — tab structure, NZ first-tranche dynamics, Phase 2b+ agents
> (Sentinel, Today screen, Interview-Prep, Coach, etc.), monorepo split for
> the employer-side product, and the ethical north-stars.
>
> 🎨 **UI preview:** [`demo.html`](demo.html) is a single-file standalone
> preview of the new design — open it in any browser, no install needed.

## The squad (today)

| Agent     | Job                                                                 |
| --------- | ------------------------------------------------------------------- |
| Hunter    | Fetches listings from URLs; auto-detects known ATSes                |
| Scout     | Extracts structured fields (salary, requirements, tech stack)       |
| Rater     | Scores each job 1–5 against your resume + preferences               |
| Tailor    | Generates a job-specific CV with a GAN-style refinement loop        |
| Writer    | Drafts a tailored cover letter when you progress an application     |
| Mailman   | Pushes the letter into Gmail / Outlook drafts via OAuth             |

Each agent is a typed module under `server/agents.ts` that calls the LLM with
a specific prompt. Swap providers per-request via the Settings tab.

Planned next (see `docs/PLAN.md`): **Sentinel** (watchlist + first-tranche
alerts), **Archetyper**, **Interviewer-Prep**, **Coach**, **Negotiator**,
**Follow-Upper**, **Connector**.

## Quick start

```bash
cd examples/job-agent-app
cp .env.example .env       # add at least one AI provider key
npm install
npm run dev                # serves the app on http://localhost:8787
```

The **Demo** tab works without any keys configured — it runs the squad on
bundled sample data so you can see the flow end-to-end.

### Standalone UI preview (no install)

Open [`demo.html`](demo.html) in any browser. Single-file, mocked data,
showcases the planned 5-tab structure (Today / Pipeline / Practice /
Insights / Settings) in the monochrome editorial design.

### Tauri desktop build

```bash
# one-time: install Rust + tauri-cli
cargo install tauri-cli

npm run tauri:dev          # opens a native window pointed at the server
npm run tauri:build        # packages the desktop app
```

## Configuration

Edit `.env` (start from `.env.example`):

| Variable              | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `AI_PROVIDER`         | Default provider: `anthropic` \| `openai` \| `ollama`        |
| `ANTHROPIC_API_KEY`   | Claude API key                                               |
| `OPENAI_API_KEY`      | OpenAI API key                                               |
| `OLLAMA_BASE_URL`     | Local Ollama endpoint (default `http://localhost:11434`)     |
| `DATABASE_URL`        | Neon Postgres connection string (optional — see below)       |
| `GOOGLE_CLIENT_ID`    | Gmail OAuth — Google Cloud Console → OAuth 2.0 Client IDs    |
| `MS_CLIENT_ID`        | Outlook OAuth — Azure Portal → App registrations             |

You can also override the provider per-request from the **Settings** tab in
the UI; the server-default is used when nothing is selected.

## Database (Neon — currently a placeholder)

Phase 2a wired the app to Neon Postgres via Drizzle for persistent storage
of profiles, saved jobs, tailored CVs, and letters. If `DATABASE_URL` is
unset the app falls back to a "DB not reachable" banner at the top and
runs in ephemeral mode — Hunt + Demo still work, nothing persists.

To enable persistence:

1. Create a Neon project (free tier is fine) → copy the pooled connection string
2. Paste into `.env` as `DATABASE_URL=postgresql://...`
3. Apply the schema **one of two ways:**
   - **From your terminal:** `npx drizzle-kit push` (creates `jobs` and `profile` tables)
   - **From Neon Console:** paste the contents of `server/db/migrations/0000_init.sql` into the SQL editor and Run
4. Restart the server. The boot banner will offer to import any existing
   browser `localStorage` data into the DB in one click.

> **Neon IP allowlist note:** if you have IP allowlisting enabled on your
> Neon project, either disable it temporarily for the initial schema push
> or use the SQL Editor method (which runs server-side and bypasses the
> allowlist).

## How job hunting works

The Hunter agent receives a list of URLs you paste into the Hunt tab.

1. If a URL matches a known ATS (Greenhouse, Lever, Ashby, Workable),
   the Hunter calls that ATS's public JSON API directly for a clean,
   structured result.
2. Otherwise it fetches the page HTML and hands the text to the Scout
   agent, which extracts structured fields via the LLM.

This avoids the headless-browser tax and stays inside each ATS's documented
public surface. Big aggregators (LinkedIn / Indeed) are intentionally not
supported — they actively block automation. Paste the underlying company
listing URL instead.

## Project layout

```
examples/job-agent-app/
├── docs/
│   └── PLAN.md           Design vision + roadmap (read this first)
├── demo.html             Standalone single-file UI preview
├── server/
│   ├── index.ts          Express server + API routes
│   ├── agents.ts         Hunter / Scout / Rater / Tailor / Writer
│   ├── storage.ts        DB-backed CRUD over the Drizzle schema
│   ├── providers.ts      Anthropic / OpenAI / Ollama adapters
│   ├── ats.ts            Greenhouse / Lever / Ashby / Workable detectors
│   ├── email.ts          Gmail + Outlook OAuth + draft creation
│   └── db/
│       ├── schema.ts     Drizzle schema (profile, jobs)
│       ├── index.ts      Drizzle client (HTTP via @neondatabase/serverless)
│       └── migrations/   Generated SQL — apply via drizzle-kit or Neon SQL editor
├── web/
│   ├── index.html        SPA shell — current 5 tabs (pre-redesign)
│   ├── style.css         Editorial monochrome design system
│   ├── app.js            Tab routing + rendering
│   ├── api.js            Backend client
│   └── store.js          In-memory cache hydrated from /api/*
└── tauri/src-tauri/      Desktop shell pointing at the same web build
```

## API surface (for scripting)

| Endpoint                          | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| `POST /api/jobs/hunt`             | Full pipeline: hunt → scout → rate       |
| `POST /api/jobs/extract`          | Hunter + Scout for a single URL          |
| `POST /api/jobs/rate`             | Rater on a single job                    |
| `POST /api/letters/draft`         | Writer drafts a cover letter             |
| `POST /api/letters/tailor`        | Tailor — job-specific CV (GAN loop)      |
| `POST /api/profile/parse`         | Parses free-text resume into structure   |
| `GET  /api/profile`               | Current profile (DB-backed)              |
| `PUT  /api/profile`               | Upsert profile                           |
| `GET  /api/jobs`                  | List saved jobs                          |
| `PUT  /api/jobs/:id`              | Upsert a job                             |
| `DELETE /api/jobs/:id`            | Remove a job                             |
| `POST /api/storage/import`        | One-shot localStorage → DB migration     |
| `GET  /api/storage/health`        | Reports DB reachability                  |
| `GET  /api/email/status`          | Reports which providers are connected    |
| `POST /api/email/draft`           | Creates a draft in the chosen provider   |
| `GET  /api/proxy/fetch`           | CORS proxy for arbitrary URLs            |

All `POST`/`PUT` endpoints accept JSON; see `web/api.js` for example payloads.

## Data

When `DATABASE_URL` is set, profile + jobs persist in Postgres. The
frontend cache hydrates from `/api/profile` and `/api/jobs` at boot.

Without `DATABASE_URL`, everything stays in the browser's in-memory cache
for that session — Hunt and Demo work, nothing survives a reload.

OAuth tokens are stored server-side in `.tokens.json` (gitignored).

## Known limitations

- Aggregators like LinkedIn / Indeed are not supported and won't be.
- Gmail and Outlook drafts require completing your own OAuth client setup.
- The Tauri shell currently points at `http://localhost:8787`; for a real
  desktop release you'd bundle the Node server (e.g. via `pkg`) or rewrite
  the agent loop in Rust against the same `providers` interface.
- The 5-tab redesign (Today / Pipeline / Practice / Insights / Settings)
  shown in `demo.html` has not yet been ported into the live `web/` build —
  Phase 2b in `docs/PLAN.md`.

