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

export type ParsedProfile = {
  headline?: string;
  personalInfo?: { name?: string; email?: string; phone?: string; location?: string; links?: string[] };
  workExperience: Array<{ title: string; company: string; period?: string; bullets: string[] }>;
  education: Array<{ degree: string; school: string; period?: string }>;
  skills: { technical: string[]; tools?: string[]; other?: string[] };
  certifications?: string[];
  projects?: Array<{ name: string; description: string }>;
  workStyle?: string;
  goals?: string;
};

export type TailoredResume = ParsedProfile & {
  summary: string;       // 3-4 line tailored opener
  keywords: string[];    // ATS keywords chosen for this job
};

export type TailorResult = {
  resume: TailoredResume;
  resumeMarkdown: string;
  coverLetter: { subject: string; body: string };
  atsScore: number;          // 0-100, deterministic JD coverage
  raterScore: number;        // 1-5
  iterations: number;
  feedback: string[];        // gaps surfaced across iterations
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

/** Tailor: parse a free-text resume into a structured ParsedProfile. */
export async function parseProfile(resume: string, hints?: string, provider?: Provider): Promise<ParsedProfile> {
  const p = provider ?? getProvider();
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You parse a resume into structured JSON. Return strict JSON matching this shape: { headline?: string, personalInfo?: { name?, email?, phone?, location?, links? }, workExperience: [{ title, company, period?, bullets: string[] }], education: [{ degree, school, period? }], skills: { technical: string[], tools?: string[], other?: string[] }, certifications?: string[], projects?: [{ name, description }], workStyle?: string, goals?: string }. Preserve every fact in the resume — do not summarize away content. Bullets stay as written or lightly cleaned. Return JSON only.',
    },
    {
      role: 'user',
      content: `RESUME:\n${resume.slice(0, 12000)}${hints ? `\n\nGUIDANCE (preserve these intents):\n${hints.slice(0, 1500)}` : ''}\n\nReturn the JSON.`,
    },
  ];
  const reply = await p.complete(messages, { json: true, maxTokens: 3000 });
  const parsed = extractJson<ParsedProfile>(reply);
  parsed.workExperience = parsed.workExperience || [];
  parsed.education = parsed.education || [];
  parsed.skills = parsed.skills || { technical: [] };
  return parsed;
}

/** Render a TailoredResume into ATS-friendly markdown — single column, plain headers. */
export function renderResumeMarkdown(r: TailoredResume): string {
  const pi = r.personalInfo || {};
  const lines: string[] = [];
  if (pi.name) lines.push(`# ${pi.name}`);
  const contact = [pi.email, pi.phone, pi.location, ...(pi.links || [])].filter(Boolean).join(' · ');
  if (contact) lines.push(contact, '');
  if (r.headline) lines.push(`*${r.headline}*`, '');
  if (r.summary) {
    lines.push('## Summary', r.summary, '');
  }
  if (r.skills) {
    lines.push('## Skills');
    if (r.skills.technical?.length) lines.push(`**Technical:** ${r.skills.technical.join(', ')}`);
    if (r.skills.tools?.length) lines.push(`**Tools:** ${r.skills.tools.join(', ')}`);
    if (r.skills.other?.length) lines.push(`**Other:** ${r.skills.other.join(', ')}`);
    lines.push('');
  }
  if (r.workExperience?.length) {
    lines.push('## Experience');
    for (const w of r.workExperience) {
      lines.push(`### ${w.title} — ${w.company}${w.period ? `  *(${w.period})*` : ''}`);
      for (const b of w.bullets || []) lines.push(`- ${b}`);
      lines.push('');
    }
  }
  if (r.projects?.length) {
    lines.push('## Projects');
    for (const pr of r.projects) lines.push(`- **${pr.name}** — ${pr.description}`);
    lines.push('');
  }
  if (r.education?.length) {
    lines.push('## Education');
    for (const e of r.education) lines.push(`- ${e.degree}, ${e.school}${e.period ? ` *(${e.period})*` : ''}`);
    lines.push('');
  }
  if (r.certifications?.length) {
    lines.push('## Certifications');
    for (const c of r.certifications) lines.push(`- ${c}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Tokenize text for ATS coverage check: lowercase, strip punctuation, keep words/identifiers ≥3 chars. */
function tokenize(text: string): Set<string> {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9+#./\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3),
  );
}

/** Deterministic ATS coverage: % of job-derived keywords present in the resume content. */
export function atsCoverage(job: ExtractedJob, resume: TailoredResume): number {
  const jdParts: string[] = [
    job.title,
    (job.techStack || []).join(' '),
    (job.requirements || []).join(' '),
    (job.niceToHaves || []).join(' '),
    (job.description || '').slice(0, 2000),
  ];
  const jdTokens = tokenize(jdParts.join(' '));
  // Drop very common stopwords / noise.
  const stop = new Set(['the','and','for','with','you','our','are','will','your','that','this','from','have','has','any','all','not','use','using','strong','team','work','role','years','year','plus','experience','build','building']);
  const target = Array.from(jdTokens).filter(t => !stop.has(t));
  if (!target.length) return 0;
  const haystack = tokenize(
    [
      resume.summary,
      resume.keywords?.join(' '),
      resume.skills?.technical?.join(' '),
      resume.skills?.tools?.join(' '),
      resume.skills?.other?.join(' '),
      (resume.workExperience || []).map(w => `${w.title} ${w.company} ${(w.bullets || []).join(' ')}`).join(' '),
      (resume.projects || []).map(p => `${p.name} ${p.description}`).join(' '),
      (resume.certifications || []).join(' '),
    ].join(' '),
  );
  const hits = target.filter(t => haystack.has(t)).length;
  return Math.round((hits / target.length) * 100);
}

async function generateTailoredResume(
  base: ParsedProfile,
  job: ExtractedJob,
  hints: string | undefined,
  feedback: string[],
  provider: Provider,
): Promise<TailoredResume> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You tailor an existing resume for a specific job. Rules: (1) never invent experience, companies, dates, or skills not in the source; (2) emphasize the most relevant existing experience for this job; (3) rewrite the summary in 3-4 lines that mirror the job\'s key language; (4) pick 12-20 ATS keywords (the keywords array) that appear in both the job and the source resume; (5) reorder workExperience bullets so the most relevant come first; (6) you may sharpen bullet wording to mirror job phrasing but the underlying fact must come from the source. Return strict JSON matching: { headline?, personalInfo?, summary: string, keywords: string[], workExperience: [...], education: [...], skills: { technical: [], tools?: [], other?: [] }, certifications?, projects?, workStyle?, goals? }. No markdown, JSON only.',
    },
    {
      role: 'user',
      content: `SOURCE PROFILE (authoritative — do not invent beyond this):\n${JSON.stringify(base, null, 2).slice(0, 12000)}\n\nJOB:\nTitle: ${job.title}\nCompany: ${job.company}\nRequirements: ${(job.requirements || []).join('; ')}\nTechStack: ${(job.techStack || []).join(', ')}\n\nDescription:\n${(job.description || '').slice(0, 6000)}\n${hints ? `\nUSER GUIDANCE (must honor):\n${hints.slice(0, 1500)}\n` : ''}${feedback.length ? `\nFEEDBACK FROM PRIOR ITERATION (address what's addressable; do not invent):\n${feedback.join('\n')}\n` : ''}\nReturn the JSON.`,
    },
  ];
  const reply = await provider.complete(messages, { json: true, maxTokens: 3500 });
  const t = extractJson<TailoredResume>(reply);
  // Preserve original facts if generator drops fields.
  return {
    ...base,
    ...t,
    skills: { ...base.skills, ...t.skills, technical: t.skills?.technical || base.skills?.technical || [] },
    keywords: t.keywords || [],
    summary: t.summary || '',
  };
}

/** Tailor: GAN-style loop. Generator → Rater (existing) → re-Generator on feedback. Cap = 2 iters. */
export async function tailor(
  job: ExtractedJob,
  profile: UserProfile,
  parsed: ParsedProfile,
  hints?: string,
  providerName?: string,
): Promise<TailorResult> {
  const p = getProvider(providerName);
  const threshold = 4;
  const maxIter = 2;
  const feedback: string[] = [];
  let resume = await generateTailoredResume(parsed, job, hints, feedback, p);
  let raterScore = 3;
  let iterations = 1;

  for (let i = 0; i < maxIter; i++) {
    const synthetic: UserProfile = {
      resume: renderResumeMarkdown(resume),
      introLetter: profile.introLetter,
      preferences: profile.preferences,
    };
    const rated = await rater(job, synthetic, p);
    raterScore = rated.rating;
    const newFeedback = rated.gaps?.length ? rated.gaps : [];
    if (raterScore >= threshold || iterations >= maxIter) break;
    feedback.push(...newFeedback);
    resume = await generateTailoredResume(parsed, job, hints, feedback, p);
    iterations++;
  }

  const coverLetter = await writer({ ...job, rating: raterScore, reasoning: '', strengths: [], gaps: [] }, {
    resume: renderResumeMarkdown(resume),
    introLetter: profile.introLetter,
    preferences: profile.preferences,
  }, p);

  return {
    resume,
    resumeMarkdown: renderResumeMarkdown(resume),
    coverLetter,
    atsScore: atsCoverage(job, resume),
    raterScore,
    iterations,
    feedback,
  };
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
