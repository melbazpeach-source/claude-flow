import { ChatMessage, extractJson, getProvider, Provider } from './providers.js';
import { detectAts, fetchFromAts, fetchRawHtml, RawJob, stripHtml } from './ats.js';

export type UserProfile = {
  resume: string;
  introLetter?: string;
  preferences: {
    titleKeywords?: string[];
    excludeKeywords?: string[];
    locations?: string[];
    remoteOnly?: boolean;
    minSalary?: number;
  };
};

export type ExtractedJob = RawJob & {
  salary?: string;
  remote?: boolean;
  requirements?: string[];
  niceToHaves?: string[];
  techStack?: string[];
};

export type RatedJob = ExtractedJob & {
  rating: number; // 1-5
  reasoning: string;
  strengths: string[];
  gaps: string[];
};

/** Hunter: takes user-supplied URLs/queries, returns RawJob[] using ATS APIs or HTML fetch. */
export async function hunter(input: { urls: string[]; provider?: Provider }): Promise<RawJob[]> {
  const provider = input.provider ?? getProvider();
  const out: RawJob[] = [];
  for (const raw of input.urls) {
    const url = raw.trim();
    if (!url) continue;
    const ats = detectAts(url);
    if (ats) {
      try {
        const jobs = await fetchFromAts(ats.detector, ats.board, ats.jobId);
        out.push(...jobs);
        continue;
      } catch (e) {
        console.warn(`ATS fetch failed for ${url}:`, e);
      }
    }
    // Fallback: fetch HTML, hand off to Scout for AI extraction.
    try {
      const html = await fetchRawHtml(url);
      const text = stripHtml(html).slice(0, 12000);
      const extracted = await scoutFromText(text, url, provider);
      out.push(extracted);
    } catch (e) {
      console.warn(`HTML extract failed for ${url}:`, e);
    }
  }
  return out;
}

/** Scout: given unstructured text + URL, return a structured RawJob via LLM. */
async function scoutFromText(text: string, url: string, provider: Provider): Promise<RawJob> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You extract structured job listing data. Return strict JSON with keys: title, company, location, description, postedAt. Use null when unknown.',
    },
    { role: 'user', content: `URL: ${url}\n\nPAGE TEXT:\n${text}\n\nReturn the JSON only.` },
  ];
  const reply = await provider.complete(messages, { json: true, maxTokens: 1200 });
  const j = extractJson<{ title: string; company: string; location?: string; description: string; postedAt?: string }>(
    reply,
  );
  return {
    source: 'html',
    externalId: url,
    title: j.title || 'Unknown role',
    company: j.company || new URL(url).hostname,
    location: j.location,
    url,
    description: j.description || '',
    postedAt: j.postedAt,
  };
}

/** Scout (post-process): enrich a RawJob with salary, remote, requirements, etc. */
export async function scout(job: RawJob, provider?: Provider): Promise<ExtractedJob> {
  const p = provider ?? getProvider();
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'Extract structured details from a job posting. Return JSON with keys: salary (string|null), remote (bool), requirements (string[]), niceToHaves (string[]), techStack (string[]). Be conservative — empty arrays are fine.',
    },
    { role: 'user', content: `Title: ${job.title}\nCompany: ${job.company}\n\n${job.description.slice(0, 8000)}` },
  ];
  const reply = await p.complete(messages, { json: true, maxTokens: 800 });
  const extra = extractJson<Partial<ExtractedJob>>(reply);
  return { ...job, ...extra };
}

/** Rater: score 1-5 based on user profile. */
export async function rater(job: ExtractedJob, profile: UserProfile, provider?: Provider): Promise<RatedJob> {
  const p = provider ?? getProvider();
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a job-fit rater. Given a candidate resume + preferences and a job description, return JSON with rating (integer 1-5), reasoning (short), strengths (string[]), gaps (string[]). 5 = exceptional fit, 3 = decent fit with gaps, 1 = poor fit.',
    },
    {
      role: 'user',
      content: `CANDIDATE RESUME:\n${profile.resume.slice(0, 6000)}\n\nPREFERENCES: ${JSON.stringify(profile.preferences)}\n\nJOB:\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location ?? ''}\nRequirements: ${(job.requirements || []).join('; ')}\nTechStack: ${(job.techStack || []).join(', ')}\n\nDescription:\n${job.description.slice(0, 6000)}\n\nReturn JSON only.`,
    },
  ];
  const reply = await p.complete(messages, { json: true, maxTokens: 600 });
  const r = extractJson<{ rating: number; reasoning: string; strengths: string[]; gaps: string[] }>(reply);
  const rating = Math.max(1, Math.min(5, Math.round(r.rating)));
  return { ...job, rating, reasoning: r.reasoning, strengths: r.strengths || [], gaps: r.gaps || [] };
}

/** Writer: draft a custom cover letter for a job. */
export async function writer(
  job: RatedJob | ExtractedJob,
  profile: UserProfile,
  provider?: Provider,
): Promise<{ subject: string; body: string }> {
  const p = provider ?? getProvider();
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'Write a concise, specific cover letter tailored to this exact role. 3-4 short paragraphs. Reference 2-3 concrete resume points that map to the job requirements. Return JSON: { subject: string, body: string }. No invented experience.',
    },
    {
      role: 'user',
      content: `CANDIDATE RESUME:\n${profile.resume.slice(0, 6000)}\n\nEXISTING INTRO LETTER (style reference):\n${(profile.introLetter || '').slice(0, 2000)}\n\nJOB:\nTitle: ${job.title}\nCompany: ${job.company}\nDescription:\n${job.description.slice(0, 6000)}\n\nReturn JSON only.`,
    },
  ];
  const reply = await p.complete(messages, { json: true, maxTokens: 1500 });
  return extractJson<{ subject: string; body: string }>(reply);
}

/** Convenience: run hunter → scout → rater on a list of URLs. */
export async function huntAndRate(
  urls: string[],
  profile: UserProfile,
  providerName?: string,
): Promise<RatedJob[]> {
  const provider = getProvider(providerName);
  const raw = await hunter({ urls, provider });
  const out: RatedJob[] = [];
  for (const job of raw) {
    try {
      const enriched = await scout(job, provider);
      const rated = await rater(enriched, profile, provider);
      out.push(rated);
    } catch (e) {
      console.warn(`Rate failed for ${job.url}:`, e);
      out.push({ ...job, rating: 3, reasoning: 'Could not evaluate', strengths: [], gaps: [] });
    }
  }
  return out;
}
