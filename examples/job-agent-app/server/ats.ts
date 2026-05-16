export type RawJob = {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location?: string;
  url: string;
  description: string;
  postedAt?: string;
};

type Detector = {
  name: string;
  match: (url: URL) => { board: string; jobId?: string } | null;
  list?: (board: string) => Promise<RawJob[]>;
  one?: (board: string, jobId: string) => Promise<RawJob>;
};

const detectors: Detector[] = [
  {
    name: 'greenhouse',
    match(url) {
      // https://boards.greenhouse.io/<board>[/jobs/<id>]
      if (!/(^|\.)greenhouse\.io$/.test(url.hostname)) return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (!parts.length) return null;
      const board = parts[0];
      const jobIdx = parts.indexOf('jobs');
      const jobId = jobIdx >= 0 ? parts[jobIdx + 1] : undefined;
      return { board, jobId };
    },
    async list(board) {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
      if (!r.ok) throw new Error(`greenhouse list ${r.status}`);
      const data = (await r.json()) as { jobs: any[] };
      return data.jobs.map(j => ({
        source: 'greenhouse',
        externalId: String(j.id),
        title: j.title,
        company: board,
        location: j.location?.name,
        url: j.absolute_url,
        description: stripHtml(j.content || ''),
        postedAt: j.updated_at,
      }));
    },
    async one(board, jobId) {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`);
      if (!r.ok) throw new Error(`greenhouse one ${r.status}`);
      const j = (await r.json()) as any;
      return {
        source: 'greenhouse',
        externalId: String(j.id),
        title: j.title,
        company: board,
        location: j.location?.name,
        url: j.absolute_url,
        description: stripHtml(j.content || ''),
        postedAt: j.updated_at,
      };
    },
  },
  {
    name: 'lever',
    match(url) {
      // https://jobs.lever.co/<board>[/<id>]
      if (url.hostname !== 'jobs.lever.co') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (!parts.length) return null;
      return { board: parts[0], jobId: parts[1] };
    },
    async list(board) {
      const r = await fetch(`https://api.lever.co/v0/postings/${board}?mode=json`);
      if (!r.ok) throw new Error(`lever list ${r.status}`);
      const jobs = (await r.json()) as any[];
      return jobs.map(j => ({
        source: 'lever',
        externalId: j.id,
        title: j.text,
        company: board,
        location: j.categories?.location,
        url: j.hostedUrl,
        description: stripHtml(j.descriptionPlain || j.description || ''),
        postedAt: new Date(j.createdAt || Date.now()).toISOString(),
      }));
    },
    async one(board, jobId) {
      const r = await fetch(`https://api.lever.co/v0/postings/${board}/${jobId}?mode=json`);
      if (!r.ok) throw new Error(`lever one ${r.status}`);
      const j = (await r.json()) as any;
      return {
        source: 'lever',
        externalId: j.id,
        title: j.text,
        company: board,
        location: j.categories?.location,
        url: j.hostedUrl,
        description: stripHtml(j.descriptionPlain || j.description || ''),
        postedAt: new Date(j.createdAt || Date.now()).toISOString(),
      };
    },
  },
  {
    name: 'ashby',
    match(url) {
      // https://jobs.ashbyhq.com/<board>[/<id>]
      if (url.hostname !== 'jobs.ashbyhq.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (!parts.length) return null;
      return { board: parts[0], jobId: parts[1] };
    },
    async list(board) {
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`);
      if (!r.ok) throw new Error(`ashby list ${r.status}`);
      const data = (await r.json()) as { jobs: any[] };
      return (data.jobs || []).map(j => ({
        source: 'ashby',
        externalId: j.id,
        title: j.title,
        company: board,
        location: j.locationName,
        url: j.jobUrl,
        description: stripHtml(j.descriptionHtml || j.descriptionPlain || ''),
        postedAt: j.publishedAt,
      }));
    },
  },
  {
    name: 'workable',
    match(url) {
      // https://apply.workable.com/<board>[/j/<id>] or <sub>.workable.com
      if (!url.hostname.endsWith('workable.com')) return null;
      const parts = url.pathname.split('/').filter(Boolean);
      const board = url.hostname === 'apply.workable.com' ? parts[0] : url.hostname.split('.')[0];
      const jIdx = parts.indexOf('j');
      return board ? { board, jobId: jIdx >= 0 ? parts[jIdx + 1] : undefined } : null;
    },
    async list(board) {
      const r = await fetch(`https://apply.workable.com/api/v3/accounts/${board}/jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '', location: {}, department: [] }),
      });
      if (!r.ok) throw new Error(`workable list ${r.status}`);
      const data = (await r.json()) as { results: any[] };
      return (data.results || []).map(j => ({
        source: 'workable',
        externalId: j.shortcode,
        title: j.title,
        company: board,
        location: [j.city, j.country].filter(Boolean).join(', '),
        url: `https://apply.workable.com/${board}/j/${j.shortcode}/`,
        description: stripHtml(j.description || ''),
        postedAt: j.published_on,
      }));
    },
  },
];

export function detectAts(input: string): { detector: string; board: string; jobId?: string } | null {
  try {
    const url = new URL(input);
    for (const d of detectors) {
      const m = d.match(url);
      if (m) return { detector: d.name, ...m };
    }
  } catch {}
  return null;
}

export async function fetchFromAts(detectorName: string, board: string, jobId?: string): Promise<RawJob[]> {
  const d = detectors.find(x => x.name === detectorName);
  if (!d) throw new Error(`Unknown ATS detector: ${detectorName}`);
  if (jobId && d.one) return [await d.one(board, jobId)];
  if (d.list) return d.list(board);
  throw new Error(`Detector ${detectorName} cannot fetch`);
}

export async function fetchRawHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 JobAgentBot/0.1' },
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`Fetch ${url} → ${r.status}`);
  return r.text();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
