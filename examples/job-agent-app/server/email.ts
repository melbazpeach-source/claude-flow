import fs from 'fs/promises';
import path from 'path';

type Tokens = {
  google?: { access_token: string; refresh_token?: string; expiry?: number };
  microsoft?: { access_token: string; refresh_token?: string; expiry?: number };
};

const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');

async function loadTokens(): Promise<Tokens> {
  try {
    return JSON.parse(await fs.readFile(TOKEN_FILE, 'utf8'));
  } catch {
    return {};
  }
}
async function saveTokens(t: Tokens) {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(t, null, 2));
}

export function googleAuthUrl(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!id || !redirect) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_REDIRECT_URI not set');
  const scope = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose'].join(
    ' ',
  );
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function googleExchangeCode(code: string): Promise<void> {
  const id = process.env.GOOGLE_CLIENT_ID!;
  const secret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirect = process.env.GOOGLE_REDIRECT_URI!;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const tokens = await loadTokens();
  tokens.google = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expiry: Date.now() + j.expires_in * 1000,
  };
  await saveTokens(tokens);
}

export function microsoftAuthUrl(): string {
  const id = process.env.MS_CLIENT_ID;
  const redirect = process.env.MS_REDIRECT_URI;
  const tenant = process.env.MS_TENANT || 'common';
  if (!id || !redirect) throw new Error('MS_CLIENT_ID / MS_REDIRECT_URI not set');
  const params = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: redirect,
    response_mode: 'query',
    scope: 'offline_access Mail.Read Mail.ReadWrite Mail.Send',
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

export async function microsoftExchangeCode(code: string): Promise<void> {
  const id = process.env.MS_CLIENT_ID!;
  const secret = process.env.MS_CLIENT_SECRET!;
  const redirect = process.env.MS_REDIRECT_URI!;
  const tenant = process.env.MS_TENANT || 'common';
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token exchange ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const tokens = await loadTokens();
  tokens.microsoft = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expiry: Date.now() + j.expires_in * 1000,
  };
  await saveTokens(tokens);
}

async function gmailAccessToken(): Promise<string> {
  const t = await loadTokens();
  if (!t.google) throw new Error('Not authenticated with Google');
  // Refresh if near expiry.
  if (t.google.expiry && Date.now() > t.google.expiry - 60_000 && t.google.refresh_token) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: t.google.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Google refresh ${res.status}`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    t.google.access_token = j.access_token;
    t.google.expiry = Date.now() + j.expires_in * 1000;
    await saveTokens(t);
  }
  return t.google.access_token;
}

async function outlookAccessToken(): Promise<string> {
  const t = await loadTokens();
  if (!t.microsoft) throw new Error('Not authenticated with Microsoft');
  if (t.microsoft.expiry && Date.now() > t.microsoft.expiry - 60_000 && t.microsoft.refresh_token) {
    const tenant = process.env.MS_TENANT || 'common';
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID!,
        client_secret: process.env.MS_CLIENT_SECRET!,
        refresh_token: t.microsoft.refresh_token,
        grant_type: 'refresh_token',
        scope: 'offline_access Mail.Read Mail.ReadWrite Mail.Send',
      }),
    });
    if (!res.ok) throw new Error(`Microsoft refresh ${res.status}`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    t.microsoft.access_token = j.access_token;
    t.microsoft.expiry = Date.now() + j.expires_in * 1000;
    await saveTokens(t);
  }
  return t.microsoft.access_token;
}

export async function createGmailDraft(opts: { to: string; subject: string; body: string }): Promise<{ id: string }> {
  const token = await gmailAccessToken();
  const raw = Buffer.from(
    `To: ${opts.to}\r\nSubject: ${opts.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${opts.body}`,
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) throw new Error(`Gmail draft ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { id: string };
  return { id: j.id };
}

export async function createOutlookDraft(opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const token = await outlookAccessToken();
  const res = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      subject: opts.subject,
      body: { contentType: 'Text', content: opts.body },
      toRecipients: [{ emailAddress: { address: opts.to } }],
    }),
  });
  if (!res.ok) throw new Error(`Outlook draft ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { id: string };
  return { id: j.id };
}

export async function emailStatus(): Promise<{ google: boolean; microsoft: boolean }> {
  const t = await loadTokens();
  return { google: Boolean(t.google), microsoft: Boolean(t.microsoft) };
}
