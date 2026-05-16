# Job Agent Squad

A small AI agent squad that hunts job listings on user-supplied job-board URLs,
rates fit against your resume, drafts custom cover letters, and can create
email drafts in Gmail or Outlook.

Ships as a vanilla-JS web app **and** a Tauri desktop shell that both render
the same UI.

## The squad

| Agent     | Job                                                                 |
| --------- | ------------------------------------------------------------------- |
| Hunter    | Fetches listings from URLs; auto-detects known ATSes                |
| Scout     | Extracts structured fields (salary, requirements, tech stack)       |
| Rater     | Scores each job 1–5 against your resume + preferences               |
| Writer    | Drafts a tailored cover letter when you progress an application     |
| Mailman   | Pushes the letter into Gmail / Outlook drafts via OAuth             |

Each agent is a typed module under `server/agents.ts` that calls the LLM with
a specific prompt. Swap providers per-request via the Settings tab.

## Quick start

```bash
cd examples/job-agent-app
cp .env.example .env       # add at least one AI provider key
npm install
npm run dev                # serves the app on http://localhost:8787
```

The **Demo** tab works without any keys configured — it runs the squad on
bundled sample data so you can see the flow end-to-end.

### Tauri desktop build

```bash
# one-time: install Rust + tauri-cli
cargo install tauri-cli

npm run tauri:dev          # opens a native window pointed at the server
npm run tauri:build        # packages the desktop app
```

> First `tauri:build` will ask you to generate app icons:
> `cargo tauri icon path/to/source.png`

## Configuration

Edit `.env` (start from `.env.example`):

| Variable              | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `AI_PROVIDER`         | Default provider: `anthropic` \| `openai` \| `ollama`        |
| `ANTHROPIC_API_KEY`   | Claude API key                                               |
| `OPENAI_API_KEY`      | OpenAI API key                                               |
| `OLLAMA_BASE_URL`     | Local Ollama endpoint (default `http://localhost:11434`)     |
| `GOOGLE_CLIENT_ID`    | Gmail OAuth — Google Cloud Console → OAuth 2.0 Client IDs    |
| `MS_CLIENT_ID`        | Outlook OAuth — Azure Portal → App registrations             |

You can also override the provider per-request from the **Settings** tab in
the UI; the server-default is used when nothing is selected.

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
├── server/
│   ├── index.ts         Express server + API routes
│   ├── agents.ts        Hunter / Scout / Rater / Writer
│   ├── providers.ts     Anthropic / OpenAI / Ollama adapters
│   ├── ats.ts           Greenhouse / Lever / Ashby / Workable detectors
│   └── email.ts         Gmail + Outlook OAuth + draft creation
├── web/
│   ├── index.html       SPA shell, all five tabs
│   ├── style.css        Themed for light + dark
│   ├── app.js           Tab routing + rendering
│   ├── api.js           Backend client
│   └── store.js         LocalStorage wrapper
└── tauri/src-tauri/     Desktop shell pointing at the same web build
```

## API surface (for scripting)

| Endpoint                          | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| `POST /api/jobs/hunt`             | Full pipeline: hunt → scout → rate       |
| `POST /api/jobs/extract`          | Hunter + Scout for a single URL          |
| `POST /api/jobs/rate`             | Rater on a single job                    |
| `POST /api/letters/draft`         | Writer drafts a cover letter             |
| `GET  /api/email/status`          | Reports which providers are connected    |
| `GET  /api/email/oauth/google`    | Starts Gmail OAuth flow                  |
| `GET  /api/email/oauth/microsoft` | Starts Outlook OAuth flow                |
| `POST /api/email/draft`           | Creates a draft in the chosen provider   |
| `GET  /api/proxy/fetch`           | CORS proxy for arbitrary URLs            |

All `POST` endpoints accept JSON; see `web/api.js` for example payloads.

## Data

All user data — resume, intro letter, preferences, saved jobs, drafted
letters — lives in browser `localStorage` under the key `job-agent-app:v1`.
Export / import the full blob from **Settings → Data**.

OAuth tokens are stored server-side in `.tokens.json` (gitignored).

## Known limitations

- Aggregators like LinkedIn / Indeed are not supported and won't be.
- Gmail and Outlook drafts require completing your own OAuth client setup.
- The Tauri shell currently points at `http://localhost:8787`; for a real
  desktop release you'd bundle the Node server (e.g. via `pkg`) or rewrite
  the agent loop in Rust against the same `providers` interface.
