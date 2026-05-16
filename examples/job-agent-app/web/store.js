import { api } from './api.js';

const LEGACY_KEY = 'job-agent-app:v1';

const defaults = {
  profile: { resume: '', introLetter: '', preferences: {}, hints: '', parsedProfile: null, providerOverride: '' },
  jobs: [],
};

let cache = {
  profile: { ...defaults.profile },
  jobs: [],
  hydrated: false,
  dbReachable: false,
};

const listeners = new Set();
function notify() { for (const fn of listeners) fn(); }
export function onStoreChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Detect legacy localStorage payload from the pre-DB version. */
export function legacyDump() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const hasContent = (parsed.profile?.resume?.length || 0) > 0 ||
      (Array.isArray(parsed.saved) && parsed.saved.length > 0);
    return hasContent ? parsed : null;
  } catch { return null; }
}
export function clearLegacy() {
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}

/** Boot-time hydration. Pulls profile + jobs from the DB into the in-memory cache. */
export async function hydrateStore() {
  try {
    const [p, j] = await Promise.all([api.getProfile(), api.listJobs()]);
    cache.profile = { ...defaults.profile, ...p.profile };
    cache.jobs = j.jobs || [];
    cache.dbReachable = true;
  } catch (e) {
    cache.dbReachable = false;
    console.warn('store: DB unreachable on hydrate —', e.message);
  } finally {
    cache.hydrated = true;
    notify();
  }
}

/** Push the legacy localStorage dump to the server, then re-hydrate. Clears localStorage on success. */
export async function importLegacy(dump) {
  if (!dump) return { profile: false, jobs: 0 };
  const r = await api.importStorage(dump);
  clearLegacy();
  await hydrateStore();
  return r;
}

function writeProfileBackground(snapshot) {
  api.putProfile(snapshot).catch(e => console.warn('store: profile save failed —', e.message));
}
function writeJobBackground(job) {
  api.putJob(job).catch(e => console.warn(`store: job ${job.id} save failed —`, e.message));
}
function deleteJobBackground(id) {
  api.deleteJob(id).catch(e => console.warn(`store: job ${id} delete failed —`, e.message));
}

export const store = {
  isHydrated() { return cache.hydrated; },
  isDbReachable() { return cache.dbReachable; },

  // ---------- profile ----------
  getProfile() {
    return {
      resume: cache.profile.resume,
      introLetter: cache.profile.introLetter,
      preferences: cache.profile.preferences || {},
    };
  },
  setProfile(p) {
    cache.profile = { ...cache.profile, resume: p.resume, introLetter: p.introLetter, preferences: p.preferences };
    writeProfileBackground(cache.profile);
    notify();
  },

  getParsedProfile() { return cache.profile.parsedProfile || null; },
  setParsedProfile(parsed) {
    cache.profile = { ...cache.profile, parsedProfile: parsed };
    writeProfileBackground(cache.profile);
    notify();
  },

  getHints() { return cache.profile.hints || ''; },
  setHints(text) {
    cache.profile = { ...cache.profile, hints: text };
    writeProfileBackground(cache.profile);
    notify();
  },

  getProviderOverride() { return cache.profile.providerOverride || ''; },
  setProviderOverride(p) {
    cache.profile = { ...cache.profile, providerOverride: p };
    writeProfileBackground(cache.profile);
    notify();
  },

  // ---------- jobs ----------
  getSaved() { return cache.jobs.slice(); },

  upsertSaved(job, status = 'saved') {
    const record = { ...job, status, savedAt: job.savedAt || new Date().toISOString() };
    const idx = cache.jobs.findIndex(j => j.id === record.id);
    if (idx >= 0) cache.jobs[idx] = record;
    else cache.jobs.unshift(record);
    writeJobBackground(record);
    notify();
    return record;
  },
  removeSaved(id) {
    cache.jobs = cache.jobs.filter(j => j.id !== id);
    deleteJobBackground(id);
    notify();
  },
  updateLetter(id, letter) {
    const j = cache.jobs.find(x => x.id === id);
    if (!j) return;
    j.letter = letter;
    if (j.status === 'saved' || j.status === 'progress') j.status = 'drafted';
    writeJobBackground(j);
    notify();
  },
  updateTailor(id, tailor) {
    const j = cache.jobs.find(x => x.id === id);
    if (!j) return;
    j.tailor = tailor;
    if (tailor?.coverLetter) j.letter = tailor.coverLetter;
    if (j.status === 'saved') j.status = 'progress';
    writeJobBackground(j);
    notify();
  },

  // ---------- backup ----------
  async exportAll() {
    const r = await Promise.all([api.getProfile(), api.listJobs()]);
    return JSON.stringify({ profile: r[0].profile, jobs: r[1].jobs }, null, 2);
  },
  async importAll(json) {
    const parsed = JSON.parse(json);
    const dump = {
      profile: parsed.profile,
      cvHints: parsed.profile?.hints,
      parsedProfile: parsed.profile?.parsedProfile,
      provider: parsed.profile?.providerOverride,
      saved: parsed.jobs || parsed.saved || [],
    };
    await api.importStorage(dump);
    await hydrateStore();
  },
  async wipe() {
    // Server-side: delete each job + reset profile. Best effort.
    for (const j of cache.jobs.slice()) await api.deleteJob(j.id).catch(() => {});
    await api.putProfile({ ...defaults.profile });
    clearLegacy();
    await hydrateStore();
  },
};

export function ageString(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return '1 day ago';
  if (d < 30) return `${d} days ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
