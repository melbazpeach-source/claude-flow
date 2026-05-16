import { eq, desc, sql } from 'drizzle-orm';
import { db, schema } from './db/index.js';

const ME = 'me';

export type ProfileRow = {
  resume: string;
  introLetter: string;
  preferences: Record<string, unknown>;
  hints: string;
  parsedProfile: unknown | null;
  providerOverride: string;
};

export type JobRow = {
  id: string;
  source: string;
  externalId?: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  techStack?: string[];
  requirements?: string[];
  niceToHaves?: string[];
  salary?: string;
  remote?: boolean;
  postedAt?: string;
  status: string;
  rating?: number;
  reasoning?: string;
  strengths: string[];
  gaps: string[];
  letter?: { subject: string; body: string } | null;
  tailor?: unknown;
  savedAt: string;
};

function requireDb() {
  const d = db();
  if (!d) {
    const err = new Error('DATABASE_URL not configured');
    (err as any).code = 'NO_DB';
    throw err;
  }
  return d;
}

// ---------- profile ----------

export async function getProfileRow(): Promise<ProfileRow> {
  const d = requireDb();
  const rows = await d.select().from(schema.profile).where(eq(schema.profile.userId, ME)).limit(1);
  if (!rows.length) {
    return {
      resume: '',
      introLetter: '',
      preferences: {},
      hints: '',
      parsedProfile: null,
      providerOverride: '',
    };
  }
  const r = rows[0];
  return {
    resume: r.resume,
    introLetter: r.introLetter,
    preferences: (r.preferences as Record<string, unknown>) ?? {},
    hints: r.hints,
    parsedProfile: r.parsedProfile,
    providerOverride: r.providerOverride,
  };
}

export async function setProfileRow(patch: Partial<ProfileRow>): Promise<ProfileRow> {
  const d = requireDb();
  const current = await getProfileRow();
  const next: ProfileRow = { ...current, ...patch };
  await d
    .insert(schema.profile)
    .values({
      userId: ME,
      resume: next.resume,
      introLetter: next.introLetter,
      preferences: next.preferences,
      hints: next.hints,
      parsedProfile: next.parsedProfile as any,
      providerOverride: next.providerOverride,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.profile.userId,
      set: {
        resume: next.resume,
        introLetter: next.introLetter,
        preferences: next.preferences,
        hints: next.hints,
        parsedProfile: next.parsedProfile as any,
        providerOverride: next.providerOverride,
        updatedAt: new Date(),
      },
    });
  return next;
}

// ---------- jobs ----------

function rowToJob(r: any): JobRow {
  const payload = (r.payload as Record<string, unknown>) ?? {};
  return {
    id: r.id,
    source: r.source,
    externalId: r.externalId ?? undefined,
    url: r.url,
    title: r.title,
    company: r.company,
    location: r.location ?? undefined,
    description: r.description ?? undefined,
    techStack: (payload.techStack as string[]) ?? undefined,
    requirements: (payload.requirements as string[]) ?? undefined,
    niceToHaves: (payload.niceToHaves as string[]) ?? undefined,
    salary: (payload.salary as string) ?? undefined,
    remote: (payload.remote as boolean) ?? undefined,
    postedAt: (payload.postedAt as string) ?? undefined,
    status: r.status,
    rating: r.rating ?? undefined,
    reasoning: r.reasoning ?? undefined,
    strengths: (r.strengths as string[]) ?? [],
    gaps: (r.gaps as string[]) ?? [],
    letter: r.letter ?? null,
    tailor: r.tailor ?? undefined,
    savedAt: r.savedAt instanceof Date ? r.savedAt.toISOString() : r.savedAt,
  };
}

function jobToRow(j: Partial<JobRow>) {
  // Pluck the "payload" fields off the flat shape the wire format uses.
  const payload: Record<string, unknown> = {};
  if (j.techStack !== undefined) payload.techStack = j.techStack;
  if (j.requirements !== undefined) payload.requirements = j.requirements;
  if (j.niceToHaves !== undefined) payload.niceToHaves = j.niceToHaves;
  if (j.salary !== undefined) payload.salary = j.salary;
  if (j.remote !== undefined) payload.remote = j.remote;
  if (j.postedAt !== undefined) payload.postedAt = j.postedAt;
  return {
    id: j.id!,
    userId: ME,
    source: j.source ?? 'x',
    externalId: j.externalId ?? null,
    url: j.url!,
    title: j.title ?? 'Unknown role',
    company: j.company ?? 'Unknown',
    location: j.location ?? null,
    description: j.description ?? null,
    payload: Object.keys(payload).length ? payload : null,
    status: j.status ?? 'saved',
    rating: j.rating ?? null,
    reasoning: j.reasoning ?? null,
    strengths: j.strengths ?? [],
    gaps: j.gaps ?? [],
    letter: (j.letter ?? null) as any,
    tailor: (j.tailor ?? null) as any,
    savedAt: j.savedAt ? new Date(j.savedAt) : new Date(),
    updatedAt: new Date(),
  };
}

export async function listJobs(): Promise<JobRow[]> {
  const d = requireDb();
  const rows = await d
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, ME))
    .orderBy(desc(schema.jobs.savedAt));
  return rows.map(rowToJob);
}

export async function getJob(id: string): Promise<JobRow | null> {
  const d = requireDb();
  const rows = await d.select().from(schema.jobs).where(eq(schema.jobs.id, id)).limit(1);
  return rows.length ? rowToJob(rows[0]) : null;
}

export async function upsertJob(job: Partial<JobRow>): Promise<JobRow> {
  const d = requireDb();
  if (!job.id) throw new Error('job.id required');
  const row = jobToRow(job);
  await d
    .insert(schema.jobs)
    .values(row)
    .onConflictDoUpdate({
      target: schema.jobs.id,
      set: {
        source: row.source,
        externalId: row.externalId,
        url: row.url,
        title: row.title,
        company: row.company,
        location: row.location,
        description: row.description,
        payload: row.payload as any,
        status: row.status,
        rating: row.rating,
        reasoning: row.reasoning,
        strengths: row.strengths,
        gaps: row.gaps,
        letter: row.letter,
        tailor: row.tailor,
        updatedAt: new Date(),
      },
    });
  const got = await getJob(job.id);
  return got!;
}

export async function patchJob(id: string, patch: Partial<JobRow>): Promise<JobRow> {
  const existing = await getJob(id);
  if (!existing) throw new Error(`job ${id} not found`);
  return upsertJob({ ...existing, ...patch, id });
}

export async function deleteJob(id: string): Promise<void> {
  const d = requireDb();
  await d.delete(schema.jobs).where(eq(schema.jobs.id, id));
}

// ---------- migration from localStorage ----------

export type MigrationDump = {
  profile?: { resume?: string; introLetter?: string; preferences?: Record<string, unknown> };
  cvHints?: string;
  parsedProfile?: unknown;
  provider?: string;
  saved?: Array<Partial<JobRow> & { id?: string; letter?: any; tailor?: any }>;
};

export async function importDump(dump: MigrationDump): Promise<{ profile: boolean; jobs: number }> {
  let jobsImported = 0;
  if (dump.profile || dump.cvHints || dump.parsedProfile || dump.provider !== undefined) {
    await setProfileRow({
      resume: dump.profile?.resume ?? '',
      introLetter: dump.profile?.introLetter ?? '',
      preferences: (dump.profile?.preferences as Record<string, unknown>) ?? {},
      hints: dump.cvHints ?? '',
      parsedProfile: dump.parsedProfile ?? null,
      providerOverride: dump.provider ?? '',
    });
  }
  for (const job of dump.saved ?? []) {
    if (!job.id) continue;
    await upsertJob(job as JobRow);
    jobsImported++;
  }
  return { profile: Boolean(dump.profile), jobs: jobsImported };
}

// ---------- health ----------

export async function storageHealth(): Promise<{ connected: boolean; jobs?: number; profile?: boolean; error?: string }> {
  const d = db();
  if (!d) return { connected: false, error: 'DATABASE_URL not configured' };
  try {
    const jobsCount = await d.execute(sql`SELECT count(*)::int AS n FROM jobs WHERE user_id = ${ME}`);
    const profileCount = await d.execute(sql`SELECT count(*)::int AS n FROM profile WHERE user_id = ${ME}`);
    const jobsN = (jobsCount as any)[0]?.n ?? (jobsCount as any).rows?.[0]?.n ?? 0;
    const profileN = (profileCount as any)[0]?.n ?? (profileCount as any).rows?.[0]?.n ?? 0;
    return { connected: true, jobs: jobsN, profile: profileN > 0 };
  } catch (e: any) {
    return { connected: false, error: String(e.message || e) };
  }
}
