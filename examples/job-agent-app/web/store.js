const KEY = 'job-agent-app:v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const store = {
  getProfile() {
    const s = load();
    return s.profile || { resume: '', introLetter: '', preferences: {} };
  },
  setProfile(p) {
    const s = load();
    s.profile = p;
    save(s);
  },
  getSaved() {
    return load().saved || [];
  },
  upsertSaved(job, status = 'saved') {
    const s = load();
    const list = s.saved || [];
    const idx = list.findIndex(j => j.id === job.id);
    const record = { ...job, status, savedAt: job.savedAt || new Date().toISOString() };
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    s.saved = list;
    save(s);
    return record;
  },
  removeSaved(id) {
    const s = load();
    s.saved = (s.saved || []).filter(j => j.id !== id);
    save(s);
  },
  updateLetter(id, letter) {
    const s = load();
    const list = s.saved || [];
    const j = list.find(x => x.id === id);
    if (j) {
      j.letter = letter;
      j.status = 'drafted';
    }
    save(s);
  },
  updateTailor(id, tailor) {
    const s = load();
    const list = s.saved || [];
    const j = list.find(x => x.id === id);
    if (j) {
      j.tailor = tailor;
      if (tailor?.coverLetter) j.letter = tailor.coverLetter;
      j.status = j.status === 'saved' ? 'progress' : j.status;
    }
    save(s);
  },
  getParsedProfile() {
    return load().parsedProfile || null;
  },
  setParsedProfile(parsed) {
    const s = load();
    s.parsedProfile = parsed;
    save(s);
  },
  getHints() {
    return load().cvHints || '';
  },
  setHints(text) {
    const s = load();
    s.cvHints = text;
    save(s);
  },
  setProviderOverride(p) {
    const s = load();
    s.provider = p;
    save(s);
  },
  getProviderOverride() {
    return load().provider || '';
  },
  exportAll() {
    return JSON.stringify(load(), null, 2);
  },
  importAll(json) {
    save(JSON.parse(json));
  },
  wipe() {
    localStorage.removeItem(KEY);
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
