const API = '';

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function get(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

export const api = {
  health: () => get('/api/health'),
  hunt: (urls, profile, provider) => post('/api/jobs/hunt', { urls, profile, provider }),
  extract: (url, provider) => post('/api/jobs/extract', { url, provider }),
  rate: (job, profile, provider) => post('/api/jobs/rate', { job, profile, provider }),
  letter: (job, profile, provider) => post('/api/letters/draft', { job, profile, provider }),
  emailStatus: () => get('/api/email/status'),
  emailDraft: (provider, to, subject, body) => post('/api/email/draft', { provider, to, subject, body }),
};
