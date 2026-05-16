import { api } from './api.js';
import { store, ageString } from './store.js';

// --- Tab routing ---
document.querySelectorAll('#tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('main > section').forEach(s => s.classList.toggle('active', s.id === target));
    if (target === 'saved') renderSaved();
    if (target === 'progress') renderProgress();
    if (target === 'settings') refreshEmailStatus();
  });
});

// --- Profile (Progress tab) ---
const resumeEl = document.getElementById('profile-resume');
const introEl = document.getElementById('profile-intro');
const profile = store.getProfile();
resumeEl.value = profile.resume || '';
introEl.value = profile.introLetter || '';

function persistProfileFromUI() {
  store.setProfile({
    resume: resumeEl.value,
    introLetter: introEl.value,
    preferences: collectPreferences(),
  });
}
resumeEl.addEventListener('input', persistProfileFromUI);
introEl.addEventListener('input', persistProfileFromUI);

document.getElementById('resume-file').addEventListener('change', e => importTextInto(e, resumeEl));
document.getElementById('intro-file').addEventListener('change', e => importTextInto(e, introEl));
document.getElementById('resume-export').addEventListener('click', () => downloadText('resume.txt', resumeEl.value));
document.getElementById('intro-export').addEventListener('click', () => downloadText('intro-letter.txt', introEl.value));

async function importTextInto(e, el) {
  const f = e.target.files?.[0];
  if (!f) return;
  el.value = await f.text();
  persistProfileFromUI();
}
function downloadText(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- Hunt tab ---
function collectPreferences() {
  const splitList = s => s.split(',').map(x => x.trim()).filter(Boolean);
  return {
    titleKeywords: splitList(document.getElementById('pref-titles').value),
    locations: splitList(document.getElementById('pref-locations').value),
    excludeKeywords: splitList(document.getElementById('pref-exclude').value),
    remoteOnly: document.getElementById('pref-remote').checked,
    minSalary: Number(document.getElementById('pref-salary').value) || undefined,
  };
}

const huntStatus = document.getElementById('hunt-status');
document.getElementById('hunt-go').addEventListener('click', async () => {
  const urls = document.getElementById('hunt-urls').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!urls.length) return alert('Paste at least one URL');
  persistProfileFromUI();
  const prof = store.getProfile();
  if (!prof.resume?.trim()) return alert('Add your resume in the Progress tab first.');
  huntStatus.textContent = 'Squad working… (this can take 10–60s)';
  document.getElementById('hunt-results').innerHTML = '';
  try {
    const provider = store.getProviderOverride() || undefined;
    const { jobs } = await api.hunt(urls, prof, provider);
    renderSuggestions(jobs, document.getElementById('hunt-results'));
    huntStatus.textContent = `Found ${jobs.length} job(s).`;
  } catch (e) {
    huntStatus.textContent = `Error: ${e.message}`;
  }
});

// --- Job card rendering ---
function jobId(job) {
  return `${job.source || 'x'}-${job.externalId || job.url}`;
}

function renderStars(rating) {
  const r = Math.max(1, Math.min(5, Math.round(rating || 3)));
  return Array.from({ length: 5 }, (_, i) => `<span class="star ${i < r ? 'on' : ''}">★</span>`).join('');
}

function renderSuggestions(jobs, container) {
  container.innerHTML = '';
  const tpl = document.getElementById('job-card-template');
  for (const job of jobs) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.title').textContent = job.title;
    node.querySelector('.company').textContent = job.company;
    node.querySelector('.location').textContent = job.location || '—';
    node.querySelector('.rating').innerHTML = renderStars(job.rating);
    node.querySelector('.rating').title = job.reasoning || '';
    node.querySelector('.reasoning').textContent = job.reasoning || '';
    const sUl = node.querySelector('ul.strengths');
    const gUl = node.querySelector('ul.gaps');
    (job.strengths || []).forEach(s => {
      const li = document.createElement('li'); li.textContent = s; sUl.appendChild(li);
    });
    (job.gaps || []).forEach(s => {
      const li = document.createElement('li'); li.textContent = s; gUl.appendChild(li);
    });
    const link = node.querySelector('a.link');
    link.href = job.url; link.textContent = 'Open listing';
    const id = jobId(job);
    job.id = id;

    node.querySelector('.discard').addEventListener('click', () => node.remove());
    node.querySelector('.save').addEventListener('click', () => {
      store.upsertSaved(job, 'saved');
      flash(node, 'Saved');
    });
    node.querySelector('.progress').addEventListener('click', async () => {
      store.upsertSaved(job, 'progress');
      flash(node, 'Drafting letter…');
      try {
        const prof = store.getProfile();
        const provider = store.getProviderOverride() || undefined;
        const { letter } = await api.letter(job, prof, provider);
        store.updateLetter(id, letter);
        flash(node, 'Letter drafted — see Progress tab');
      } catch (e) {
        flash(node, `Letter failed: ${e.message}`);
      }
    });
    container.appendChild(node);
  }
}

function flash(node, msg) {
  let el = node.querySelector('.flash');
  if (!el) {
    el = document.createElement('span');
    el.className = 'flash status';
    el.style.marginLeft = '8px';
    node.querySelector('footer.actions').appendChild(el);
  }
  el.textContent = msg;
}

// --- Saved tab ---
function renderSaved() {
  const container = document.getElementById('saved-list');
  container.innerHTML = '';
  const saved = store.getSaved();
  if (!saved.length) {
    container.innerHTML = '<p class="hint">No saved jobs yet. Hunt some first!</p>';
    return;
  }
  for (const job of saved) {
    const wrapper = document.createElement('article');
    wrapper.className = 'job-card';
    wrapper.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(job.title)}</h3>
          <p class="meta">
            <span>${escapeHtml(job.company)}</span> · <span>${escapeHtml(job.location || '—')}</span>
            · <span>${ageString(job.savedAt)}</span>
            · <span class="badge status-${job.status}">${job.status}</span>
          </p>
        </div>
        <div class="rating">${renderStars(job.rating)}</div>
      </header>
      <p class="reasoning">${escapeHtml(job.reasoning || '')}</p>
      <footer class="actions">
        <a class="link" target="_blank" rel="noopener" href="${escapeAttr(job.url)}">Open listing</a>
        <button data-act="progress">Progress (draft letter)</button>
        <button data-act="remove" class="danger">Remove</button>
      </footer>`;
    wrapper.querySelector('[data-act=remove]').addEventListener('click', () => {
      store.removeSaved(job.id);
      renderSaved();
    });
    wrapper.querySelector('[data-act=progress]').addEventListener('click', async () => {
      const prof = store.getProfile();
      const provider = store.getProviderOverride() || undefined;
      wrapper.querySelector('[data-act=progress]').textContent = 'Drafting…';
      try {
        const { letter } = await api.letter(job, prof, provider);
        store.updateLetter(job.id, letter);
        renderSaved();
        renderProgress();
        alert('Letter drafted — see Progress tab');
      } catch (e) {
        alert(`Letter failed: ${e.message}`);
      }
    });
    container.appendChild(wrapper);
  }
}

// --- Progress tab (in-progress applications + letter editing) ---
function renderProgress() {
  const container = document.getElementById('progress-list');
  container.innerHTML = '';
  const items = store.getSaved().filter(j => j.status === 'progress' || j.status === 'drafted');
  if (!items.length) {
    container.innerHTML = '<p class="hint">Nothing in progress yet. Save & progress a job to draft a letter.</p>';
    return;
  }
  for (const job of items) {
    const wrapper = document.createElement('article');
    wrapper.className = 'job-card';
    wrapper.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(job.title)}</h3>
          <p class="meta">
            <span>${escapeHtml(job.company)}</span> · <span>${escapeHtml(job.location || '—')}</span>
            · <span class="badge status-${job.status}">${job.status}</span>
          </p>
        </div>
        <div class="rating">${renderStars(job.rating)}</div>
      </header>
      <div class="letter-edit">
        <label>Subject<input class="subj" value="${escapeAttr(job.letter?.subject || `Application — ${job.title} @ ${job.company}`)}" /></label>
        <label>Body<textarea class="body" rows="14">${escapeHtml(job.letter?.body || '')}</textarea></label>
        <div class="actions">
          <button data-act="save-letter" class="primary">Save edits</button>
          <button data-act="regen">Re-draft</button>
          <button data-act="copy">Copy</button>
          <button data-act="export">Export .eml</button>
          <label class="btn">Import .txt<input type="file" hidden accept=".txt,.md,.eml" /></label>
          <button data-act="send-gmail">Send to Gmail drafts</button>
          <button data-act="send-ms">Send to Outlook drafts</button>
        </div>
      </div>`;
    const subj = wrapper.querySelector('.subj');
    const body = wrapper.querySelector('.body');

    wrapper.querySelector('[data-act=save-letter]').addEventListener('click', () => {
      store.updateLetter(job.id, { subject: subj.value, body: body.value });
      alert('Saved.');
    });
    wrapper.querySelector('[data-act=regen]').addEventListener('click', async () => {
      const prof = store.getProfile();
      const provider = store.getProviderOverride() || undefined;
      try {
        const { letter } = await api.letter(job, prof, provider);
        subj.value = letter.subject;
        body.value = letter.body;
        store.updateLetter(job.id, letter);
      } catch (e) { alert(e.message); }
    });
    wrapper.querySelector('[data-act=copy]').addEventListener('click', () => {
      navigator.clipboard.writeText(body.value);
    });
    wrapper.querySelector('[data-act=export]').addEventListener('click', () => {
      const eml = `Subject: ${subj.value}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body.value}`;
      const blob = new Blob([eml], { type: 'message/rfc822' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${job.company}-${job.title}.eml`.replace(/[^a-z0-9.-]+/gi, '_');
      a.click();
    });
    wrapper.querySelector('input[type=file]').addEventListener('change', async e => {
      const f = e.target.files?.[0];
      if (f) body.value = await f.text();
    });
    wrapper.querySelector('[data-act=send-gmail]').addEventListener('click', () => sendDraft('google', subj.value, body.value));
    wrapper.querySelector('[data-act=send-ms]').addEventListener('click', () => sendDraft('microsoft', subj.value, body.value));
    container.appendChild(wrapper);
  }
}

async function sendDraft(provider, subject, bodyText) {
  const to = prompt('Recipient email (or leave blank for a self-draft):', '') || '';
  try {
    const r = await api.emailDraft(provider, to, subject, bodyText);
    alert(`Draft created (${provider}). ID: ${r.id}`);
  } catch (e) {
    alert(`${provider} draft failed: ${e.message}\n\nMake sure you connected the account in Settings.`);
  }
}

// --- Demo panel ---
const DEMO_JOBS = [
  {
    source: 'demo', externalId: 'demo-1', url: 'https://example.com/jobs/demo-1',
    title: 'Senior Full-Stack Engineer', company: 'Acme Robotics', location: 'Remote (EU)',
    description: 'Build the operator console for our autonomous fleet. Stack: TypeScript, React, Node, Postgres, AWS. Looking for 5+ years and strong product instincts.',
    rating: 4, reasoning: 'Strong stack match; product instinct emphasis aligns with your background.',
    strengths: ['TypeScript + React (5+ yrs)', 'AWS / Postgres experience', 'Product-led delivery'],
    gaps: ['No robotics domain history'],
  },
  {
    source: 'demo', externalId: 'demo-2', url: 'https://example.com/jobs/demo-2',
    title: 'Staff Engineer, Platform', company: 'Nimbus Data', location: 'London / Hybrid',
    description: 'Owning the data plane for a real-time analytics platform. Go, Kafka, Kubernetes.',
    rating: 2, reasoning: 'Stack mostly outside your strongest areas; senior level but different domain.',
    strengths: ['Senior leadership experience'], gaps: ['No Go production work', 'Light on Kafka/K8s'],
  },
  {
    source: 'demo', externalId: 'demo-3', url: 'https://example.com/jobs/demo-3',
    title: 'Founding Engineer (AI Tooling)', company: 'Brightside AI', location: 'Remote',
    description: 'Help us ship a developer-facing AI workflow product. Looking for generalists who can do design, frontend, and backend.',
    rating: 5, reasoning: 'Founding-engineer generalist profile maps directly to your trajectory.',
    strengths: ['Generalist breadth', 'Shipping AI products', 'Early-stage mindset'],
    gaps: ['No formal founding-engineer title yet'],
  },
];

document.getElementById('demo-go').addEventListener('click', () => {
  const log = document.getElementById('demo-log');
  log.textContent = '';
  const steps = [
    '🛰  Hunter: scanning 3 sample boards…',
    '🔬 Scout: extracting structured fields (title, salary, requirements, tech stack)…',
    '⭐ Rater: comparing to your resume + preferences…',
    '✍  Writer: ready to draft a tailored letter if you click "Save & progress".',
    '✅ Squad complete.',
  ];
  let i = 0;
  const tick = () => {
    if (i >= steps.length) {
      renderSuggestions(JSON.parse(JSON.stringify(DEMO_JOBS)), document.getElementById('demo-results'));
      return;
    }
    log.textContent += steps[i++] + '\n';
    setTimeout(tick, 450);
  };
  tick();
});

// --- Settings tab ---
document.querySelectorAll('input[name=provider]').forEach(r => {
  if (r.value === store.getProviderOverride()) r.checked = true;
  r.addEventListener('change', () => store.setProviderOverride(r.value));
});

async function refreshEmailStatus() {
  const el = document.getElementById('email-status');
  try {
    const s = await api.emailStatus();
    el.textContent = `Gmail: ${s.google ? '✓ connected' : 'not connected'} · Outlook: ${s.microsoft ? '✓ connected' : 'not connected'}`;
  } catch (e) {
    el.textContent = `Status unavailable: ${e.message}`;
  }
}
document.getElementById('connect-google').addEventListener('click', () => {
  window.open('/api/email/oauth/google', 'oauth', 'width=520,height=640');
});
document.getElementById('connect-ms').addEventListener('click', () => {
  window.open('/api/email/oauth/microsoft', 'oauth', 'width=520,height=640');
});
window.addEventListener('message', e => {
  if (e.data?.type === 'oauth') refreshEmailStatus();
});

document.getElementById('export-all').addEventListener('click', () => {
  downloadText('job-agent-data.json', store.exportAll());
});
document.getElementById('import-all').addEventListener('change', async e => {
  const f = e.target.files?.[0];
  if (!f) return;
  store.importAll(await f.text());
  location.reload();
});
document.getElementById('wipe-all').addEventListener('click', () => {
  if (confirm('Delete all local data?')) {
    store.wipe();
    location.reload();
  }
});

// --- Utilities ---
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

// Restore preference inputs from stored profile.
(function restorePrefs() {
  const p = store.getProfile().preferences || {};
  document.getElementById('pref-titles').value = (p.titleKeywords || []).join(', ');
  document.getElementById('pref-locations').value = (p.locations || []).join(', ');
  document.getElementById('pref-exclude').value = (p.excludeKeywords || []).join(', ');
  document.getElementById('pref-remote').checked = Boolean(p.remoteOnly);
  document.getElementById('pref-salary').value = p.minSalary ?? '';
})();
