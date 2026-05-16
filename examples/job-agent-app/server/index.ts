import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { huntAndRate, writer, hunter, scout, rater, UserProfile } from './agents.js';
import { getProvider } from './providers.js';
import {
  googleAuthUrl,
  googleExchangeCode,
  microsoftAuthUrl,
  microsoftExchangeCode,
  createGmailDraft,
  createOutlookDraft,
  emailStatus,
} from './email.js';
import { detectAts, fetchRawHtml } from './ats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '..', 'web')));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: process.env.AI_PROVIDER || 'anthropic',
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/jobs/hunt', async (req, res) => {
  try {
    const { urls, profile, provider } = req.body as { urls: string[]; profile: UserProfile; provider?: string };
    if (!Array.isArray(urls) || !profile?.resume) {
      return res.status(400).json({ error: 'urls[] and profile.resume required' });
    }
    const jobs = await huntAndRate(urls, profile, provider);
    res.json({ jobs });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/jobs/extract', async (req, res) => {
  try {
    const { url, provider } = req.body as { url: string; provider?: string };
    const p = getProvider(provider);
    const raw = await hunter({ urls: [url], provider: p });
    if (!raw.length) return res.status(404).json({ error: 'No job found at URL' });
    const enriched = await scout(raw[0], p);
    res.json({ job: enriched });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/jobs/rate', async (req, res) => {
  try {
    const { job, profile, provider } = req.body;
    const p = getProvider(provider);
    const rated = await rater(job, profile, p);
    res.json({ job: rated });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/letters/draft', async (req, res) => {
  try {
    const { job, profile, provider } = req.body;
    const p = getProvider(provider);
    const letter = await writer(job, profile, p);
    res.json({ letter });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/proxy/fetch', async (req, res) => {
  try {
    const url = String(req.query.url || '');
    if (!url) return res.status(400).json({ error: 'url required' });
    const ats = detectAts(url);
    const text = await fetchRawHtml(url);
    res.json({ ats, html: text });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Email OAuth + drafts
app.get('/api/email/status', async (_req, res) => res.json(await emailStatus()));

app.get('/api/email/oauth/google', (_req, res) => {
  try {
    res.redirect(googleAuthUrl());
  } catch (e: any) {
    res.status(500).send(String(e.message));
  }
});
app.get('/api/email/oauth/google/callback', async (req, res) => {
  try {
    await googleExchangeCode(String(req.query.code));
    res.send('<script>window.opener?.postMessage({type:"oauth",provider:"google"},"*");window.close();</script>Connected.');
  } catch (e: any) {
    res.status(500).send(String(e.message));
  }
});
app.get('/api/email/oauth/microsoft', (_req, res) => {
  try {
    res.redirect(microsoftAuthUrl());
  } catch (e: any) {
    res.status(500).send(String(e.message));
  }
});
app.get('/api/email/oauth/microsoft/callback', async (req, res) => {
  try {
    await microsoftExchangeCode(String(req.query.code));
    res.send(
      '<script>window.opener?.postMessage({type:"oauth",provider:"microsoft"},"*");window.close();</script>Connected.',
    );
  } catch (e: any) {
    res.status(500).send(String(e.message));
  }
});

app.post('/api/email/draft', async (req, res) => {
  try {
    const { provider, to, subject, body } = req.body as {
      provider: 'google' | 'microsoft';
      to: string;
      subject: string;
      body: string;
    };
    const r = provider === 'google' ? await createGmailDraft({ to, subject, body }) : await createOutlookDraft({ to, subject, body });
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`job-agent-app listening on http://localhost:${port}`));
