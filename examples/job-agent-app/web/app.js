import { api } from './api.js';
import { store, ageString, hydrateStore, legacyDump, importLegacy } from './store.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escapeAttr = s => escapeHtml(s).replace(/'/g, '&#39;');
const timestamp = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// ============================================================
// TAB ROUTING (with arrow-key roving + aria-selected)
// ============================================================
const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = Array.from(document.querySelectorAll('main > section.panel'));

function activateTab(target, focus = false) {
  tabs.forEach(t => {
    const isActive = t.dataset.tab === target;
    t.setAttribute('aria-selected', String(isActive));
    t.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive && focus) t.focus();
  });
  panels.forEach(p => {
    const isActive = p.id === target;
    p.classList.toggle('active', isActive);
    if (isActive) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
  });
  if (target === 'saved') renderSaved();
  if (target === 'progress') renderProgress();
  if (target === 'settings') refreshEmailStatus();
}
window.activateTab = activateTab;

tabs.forEach((t, i) => {
  t.addEventListener('click', () => activateTab(t.dataset.tab));
  t.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = (i + dir + tabs.length) % tabs.length;
      activateTab(tabs[next].dataset.tab, true);
    } else if (e.key === 'Home') {
      e.preventDefault(); activateTab(tabs[0].dataset.tab, true);
    } else if (e.key === 'End') {
      e.preventDefault(); activateTab(tabs[tabs.length - 1].dataset.tab, true);
    }
  });
});

// ============================================================
// SQUAD TILE + LOG HELPERS
// ============================================================
function setSquadState(name, state) {
  const tile = document.querySelector(`.squad-tile[data-agent="${name}"]`);
  if (!tile) return;
  tile.classList.remove('active', 'done');
  if (state) tile.classList.add(state);
}
function resetSquad() {
  document.querySelectorAll('.squad-tile').forEach(t => t.classList.remove('active', 'done'));
}
function appendLog(bodyEl, agent, msg, opts = {}) {
  const line = document.createElement('div');
  line.className = `log-line ${agent}${opts.muted ? ' muted' : ''}`;
  line.innerHTML = `<span class="ts">${timestamp()}</span><span class="agent">${agent.toUpperCase()}</span><span class="msg">${escapeHtml(msg)}</span>`;
  bodyEl.appendChild(line);
  bodyEl.parentElement.scrollTop = bodyEl.parentElement.scrollHeight;
}

// ============================================================
// PROFILE BINDING (Progress tab) — seeded after hydrateStore()
// ============================================================
const resumeEl = document.getElementById('profile-resume');
const introEl = document.getElementById('profile-intro');

function collectPrefs() {
  const split = s => s.split(',').map(x => x.trim()).filter(Boolean);
  return {
    titleKeywords: split(document.getElementById('pref-titles').value),
    locations: split(document.getElementById('pref-locations').value),
    excludeKeywords: split(document.getElementById('pref-exclude').value),
    remoteOnly: document.getElementById('pref-remote').checked,
    minSalary: Number(document.getElementById('pref-salary').value) || undefined,
  };
}
function persistProfile() {
  store.setProfile({
    resume: resumeEl.value,
    introLetter: introEl.value,
    preferences: collectPrefs(),
  });
}
resumeEl.addEventListener('input', persistProfile);
introEl.addEventListener('input', persistProfile);

const hintsEl = document.getElementById('profile-hints');
hintsEl.addEventListener('input', () => store.setHints(hintsEl.value));

const parseStatus = document.getElementById('parse-status');
document.getElementById('reparse-profile').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (!resumeEl.value.trim()) { parseStatus.textContent = 'Add a resume first.'; return; }
  btn.classList.add('loading'); btn.disabled = true;
  parseStatus.textContent = 'Parsing…';
  try {
    const provider = store.getProviderOverride() || undefined;
    const { parsed } = await api.parseProfile(resumeEl.value, hintsEl.value, provider);
    store.setParsedProfile(parsed);
    parseStatus.textContent = `✓ Parsed (${parsed.workExperience?.length || 0} roles, ${parsed.skills?.technical?.length || 0} skills)`;
  } catch (err) {
    parseStatus.textContent = `Failed: ${err.message}`;
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
});

document.getElementById('resume-file').addEventListener('change', e => importTextInto(e, resumeEl));
document.getElementById('intro-file').addEventListener('change', e => importTextInto(e, introEl));
document.getElementById('resume-export').addEventListener('click', () => downloadText('resume.txt', resumeEl.value));
document.getElementById('intro-export').addEventListener('click', () => downloadText('intro-letter.txt', introEl.value));

async function importTextInto(e, el) {
  const f = e.target.files?.[0];
  if (!f) return;
  el.value = await f.text();
  persistProfile();
}
function downloadText(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function seedInputsFromStore() {
  const profile = store.getProfile();
  resumeEl.value = profile.resume || '';
  introEl.value = profile.introLetter || '';
  hintsEl.value = store.getHints();
  const p = profile.preferences || {};
  document.getElementById('pref-titles').value = (p.titleKeywords || []).join(', ');
  document.getElementById('pref-locations').value = (p.locations || []).join(', ');
  document.getElementById('pref-exclude').value = (p.excludeKeywords || []).join(', ');
  document.getElementById('pref-remote').checked = Boolean(p.remoteOnly);
  document.getElementById('pref-salary').value = p.minSalary ?? '';
  // Seed provider radios too.
  document.querySelectorAll('input[name=provider]').forEach(r => {
    r.checked = r.value === store.getProviderOverride();
  });
}

// Banner rendering for DB state + legacy import.
function renderBootBanners() {
  const main = document.querySelector('main');
  let host = document.getElementById('boot-banners');
  if (!host) {
    host = document.createElement('div');
    host.id = 'boot-banners';
    main.parentElement.insertBefore(host, main);
  }
  host.innerHTML = '';

  if (!store.isDbReachable()) {
    const b = document.createElement('div');
    b.className = 'banner banner-warn';
    b.innerHTML = `<span class="banner-icon">DB</span>
      <div>
        <strong>Database not reachable.</strong> Saved jobs, tailored CVs, and watchlists won't persist this session.
        Set <code>DATABASE_URL</code> in <code>.env</code> (Neon connection string) and restart the server. If you already have one set, check that your Neon project's IP allowlist includes this machine.
        <div class="actions" style="margin-top:8px">
          <button data-act="retry-db">Retry connection</button>
        </div>
      </div>`;
    b.querySelector('[data-act=retry-db]').addEventListener('click', async () => {
      await hydrateStore();
      seedInputsFromStore();
      renderBootBanners();
    });
    host.appendChild(b);
  }

  const dump = legacyDump();
  if (dump && store.getSaved().length === 0 && store.isDbReachable()) {
    const b = document.createElement('div');
    b.className = 'banner';
    const jobCount = (dump.saved || []).length;
    b.innerHTML = `<span class="banner-icon">↦</span>
      <div>
        <strong>Found data from a previous version.</strong> Import ${jobCount} saved job${jobCount === 1 ? '' : 's'} and your profile into the database?
        <div class="actions" style="margin-top:8px">
          <button data-act="import" class="primary">Import</button>
          <button data-act="dismiss">Discard</button>
        </div>
      </div>`;
    b.querySelector('[data-act=import]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.classList.add('loading');
      try {
        const r = await importLegacy(dump);
        seedInputsFromStore();
        b.remove();
        renderBootBanners();
        console.log(`Imported ${r.jobs} job(s), profile=${r.profile}`);
      } catch (err) {
        btn.classList.remove('loading');
        alert(`Import failed: ${err.message}`);
      }
    });
    b.querySelector('[data-act=dismiss]').addEventListener('click', () => {
      if (confirm('Discard the previous-version data permanently?')) {
        try { localStorage.removeItem('job-agent-app:v1'); } catch {}
        b.remove();
      }
    });
    host.appendChild(b);
  }
}

await hydrateStore();
seedInputsFromStore();
renderBootBanners();

// ============================================================
// HUNT — calls real backend, narrates around the fetch
// ============================================================
const huntStatus = document.getElementById('hunt-status');
const huntLog = document.getElementById('hunt-log');
const huntLogBody = document.getElementById('hunt-log-body');
const huntBtn = document.getElementById('hunt-go');

huntBtn.addEventListener('click', async () => {
  const urlsRaw = document.getElementById('hunt-urls');
  const urls = urlsRaw.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!urls.length) {
    urlsRaw.focus();
    huntStatus.textContent = 'Paste at least one URL.';
    return;
  }
  persistProfile();
  const prof = store.getProfile();
  if (!prof.resume?.trim()) {
    huntStatus.textContent = 'Add your resume in the Progress tab first.';
    activateTab('progress', true);
    return;
  }

  huntBtn.classList.add('loading');
  huntBtn.disabled = true;
  huntStatus.textContent = 'Squad working…';
  huntLog.style.display = 'block';
  huntLogBody.innerHTML = '';
  document.getElementById('hunt-results').innerHTML = '';
  resetSquad();

  const step = reduceMotion ? 0 : 420;
  const provider = store.getProviderOverride() || undefined;

  const narration = (async () => {
    setSquadState('hunter', 'active');
    appendLog(huntLogBody, 'hunter', `scanning ${urls.length} board(s)…`);
    await sleep(step);
    appendLog(huntLogBody, 'hunter', `→ ATS detectors: Greenhouse / Lever / Ashby / Workable; HTML fallback otherwise`, { muted: true });
    setSquadState('hunter', 'done');

    setSquadState('scout', 'active');
    await sleep(step / 2);
    appendLog(huntLogBody, 'scout', `extracting title, salary, requirements, tech stack…`);
    await sleep(step);
    setSquadState('scout', 'done');

    setSquadState('rater', 'active');
    await sleep(step / 2);
    appendLog(huntLogBody, 'rater', `comparing against your resume + preferences…`);
  })();

  try {
    const [_, res] = await Promise.all([narration, api.hunt(urls, prof, provider)]);
    setSquadState('rater', 'done');
    const jobs = res.jobs || [];
    appendLog(huntLogBody, 'done', `squad complete. ${jobs.length} role${jobs.length === 1 ? '' : 's'} returned.`);
    renderSuggestions(jobs, document.getElementById('hunt-results'));
    huntStatus.textContent = `Found ${jobs.length} role${jobs.length === 1 ? '' : 's'}.`;
  } catch (e) {
    setSquadState('rater', null);
    appendLog(huntLogBody, 'done', `error: ${e.message}`);
    huntStatus.textContent = `Error: ${e.message}`;
  } finally {
    huntBtn.classList.remove('loading');
    huntBtn.disabled = false;
    await sleep(800);
    resetSquad();
  }
});

// ============================================================
// CARD RENDERING
// ============================================================
function jobId(job) { return `${job.source || 'x'}-${job.externalId || job.url}`; }
function renderStars(rating) {
  const r = Math.max(1, Math.min(5, Math.round(rating || 3)));
  const stars = Array.from({length:5}, (_,i) => `<span class="star ${i < r ? 'on' : ''}" aria-hidden="true">★</span>`).join('');
  return `<span class="rating" role="img" aria-label="${r} of 5 stars">${stars}<span class="score">${r}/5</span></span>`;
}

function renderJobCard(job, mode) {
  const node = document.createElement('article');
  node.className = 'job-card reveal';

  const metaSaved = job.savedAt ? `<span class="sep">·</span><span>${ageString(job.savedAt)}</span>` : '';
  const badge = job.status ? `<span class="sep">·</span><span class="badge status-${job.status}">${job.status}</span>` : '';

  const detailsHtml = (job.strengths?.length || job.gaps?.length) ? `
    <details>
      <summary>Strengths &amp; gaps</summary>
      <div class="sg-grid">
        <div class="sg-col strengths">
          <h4>Strengths</h4>
          <ul>${(job.strengths||[]).map(s => `<li>${escapeHtml(s)}</li>`).join('') || '<li style="opacity:.5">—</li>'}</ul>
        </div>
        <div class="sg-col gaps">
          <h4>Gaps</h4>
          <ul>${(job.gaps||[]).map(s => `<li>${escapeHtml(s)}</li>`).join('') || '<li style="opacity:.5">—</li>'}</ul>
        </div>
      </div>
    </details>` : '';

  let footer = '';
  if (mode === 'suggest') {
    footer = `<footer class="actions">
      <a class="link" href="${escapeAttr(job.url)}" target="_blank" rel="noopener">Open listing</a>
      <button data-act="discard">Discard</button>
      <button data-act="save">Save</button>
      <button data-act="progress" class="primary">Save &amp; progress</button>
      <span class="flash"></span>
    </footer>`;
  } else if (mode === 'saved') {
    footer = `<footer class="actions">
      <a class="link" href="${escapeAttr(job.url)}" target="_blank" rel="noopener">Open listing</a>
      <button data-act="progress">Draft letter</button>
      <button data-act="remove" class="danger">Remove</button>
      <span class="flash"></span>
    </footer>`;
  }

  node.innerHTML = `
    <header>
      <div class="title-block">
        <h3 class="job-title">${escapeHtml(job.title)}</h3>
        <p class="meta">
          <span class="company">${escapeHtml(job.company)}</span>
          <span class="sep">·</span>
          <span>${escapeHtml(job.location || '—')}</span>
          ${metaSaved}
          ${badge}
        </p>
      </div>
      ${renderStars(job.rating)}
    </header>
    <p class="reasoning">${escapeHtml(job.reasoning || '')}</p>
    ${detailsHtml}
    ${footer}`;

  return node;
}

function setFlash(node, msg) {
  const flash = node.querySelector('.flash');
  if (!flash) return;
  flash.textContent = msg;
  flash.classList.add('show');
}

function renderSuggestions(jobs, container) {
  container.innerHTML = '';
  jobs.forEach((job, i) => {
    job.id = jobId(job);
    const node = renderJobCard(job, 'suggest');
    node.style.animationDelay = `${i * 80}ms`;
    container.appendChild(node);

    node.querySelector('[data-act=discard]').addEventListener('click', () => {
      node.style.transition = 'opacity .2s, transform .2s';
      node.style.opacity = '0';
      node.style.transform = 'translateX(-8px)';
      setTimeout(() => node.remove(), 200);
    });
    node.querySelector('[data-act=save]').addEventListener('click', () => {
      store.upsertSaved(job, 'saved');
      setFlash(node, '✓ Saved');
    });
    node.querySelector('[data-act=progress]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.classList.add('loading');
      store.upsertSaved(job, 'progress');
      setFlash(node, 'Drafting letter…');
      try {
        const provider = store.getProviderOverride() || undefined;
        const { letter } = await api.letter(job, store.getProfile(), provider);
        store.updateLetter(job.id, letter);
        setFlash(node, '✓ Letter drafted — see Progress tab');
      } catch (err) {
        setFlash(node, `Letter failed: ${err.message}`);
      } finally {
        btn.classList.remove('loading');
      }
    });
  });
}

// ============================================================
// SAVED TAB
// ============================================================
function renderSaved() {
  const container = document.getElementById('saved-list');
  container.innerHTML = '';
  const saved = store.getSaved();
  if (!saved.length) {
    container.innerHTML = `
      <div class="empty">
        <div class="glyph">∅</div>
        <p>No saved jobs yet. Hunt some roles or run the Demo, then click <strong>Save</strong> on anything that looks promising.</p>
        <div class="actions">
          <button onclick="activateTab('hunt')">Go to Hunt</button>
          <button class="primary" onclick="activateTab('demo')">Try the demo</button>
        </div>
      </div>`;
    return;
  }
  saved.forEach((job, i) => {
    const node = renderJobCard(job, 'saved');
    node.style.animationDelay = `${i * 60}ms`;
    container.appendChild(node);

    node.querySelector('[data-act=remove]').addEventListener('click', () => {
      node.style.transition = 'opacity .2s, transform .2s';
      node.style.opacity = '0';
      node.style.transform = 'translateX(-8px)';
      setTimeout(() => { store.removeSaved(job.id); renderSaved(); }, 200);
    });
    node.querySelector('[data-act=progress]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.classList.add('loading');
      try {
        const provider = store.getProviderOverride() || undefined;
        const { letter } = await api.letter(job, store.getProfile(), provider);
        store.updateLetter(job.id, letter);
        setFlash(node, '✓ Drafted — see Progress tab');
        setTimeout(() => { renderSaved(); }, 600);
      } catch (err) {
        setFlash(node, `Letter failed: ${err.message}`);
      } finally {
        btn.classList.remove('loading');
      }
    });
  });
}

// ============================================================
// PROGRESS TAB
// ============================================================
function renderProgress() {
  const container = document.getElementById('progress-list');
  container.innerHTML = '';
  const items = store.getSaved().filter(j => j.status === 'progress' || j.status === 'drafted');
  if (!items.length) {
    container.innerHTML = `
      <div class="empty">
        <div class="glyph">✎</div>
        <p>Nothing in progress yet. Hunt or run the Demo, then click <strong>Save &amp; progress</strong> on a job to have the Writer draft an outreach letter.</p>
      </div>`;
    return;
  }
  items.forEach((job, i) => {
    const wrap = document.createElement('article');
    wrap.className = 'job-card reveal';
    wrap.style.animationDelay = `${i * 60}ms`;
    const subject = job.letter?.subject || `Application — ${job.title} @ ${job.company}`;
    const body = job.letter?.body || '';
    wrap.innerHTML = `
      <header>
        <div class="title-block">
          <h3 class="job-title">${escapeHtml(job.title)}</h3>
          <p class="meta">
            <span class="company">${escapeHtml(job.company)}</span>
            <span class="sep">·</span>
            <span>${escapeHtml(job.location || '—')}</span>
            <span class="sep">·</span>
            <span class="badge status-${job.status}">${job.status}</span>
          </p>
        </div>
        ${renderStars(job.rating)}
      </header>
      <div class="tailor-edit">
        <div class="letter-edit-header">
          <h4>Tailored CV</h4>
          ${job.tailor
            ? `<span class="cv-stats"><span class="chip ats">ATS ${job.tailor.atsScore}%</span><span class="chip">Match ${job.tailor.raterScore}/5</span><span class="chip">${job.tailor.iterations} iter</span></span>`
            : '<span class="hint-inline">No CV tailored yet</span>'}
        </div>
        ${job.tailor ? `<pre class="cv-preview">${escapeHtml(job.tailor.resumeMarkdown || '')}</pre>` : ''}
        <div class="actions">
          <button data-act="tailor-cv" class="${job.tailor ? '' : 'primary'}">${job.tailor ? 'Re-tailor' : 'Tailor for this job'}</button>
          ${job.tailor ? `<button data-act="copy-cv">Copy</button><button data-act="export-cv">Export .md</button>` : ''}
          <span class="tailor-flash flash"></span>
        </div>
      </div>
      <div class="letter-edit">
        <div class="letter-edit-header">
          <h4>Outreach letter</h4>
          <span class="dirty-flag">unsaved changes</span>
        </div>
        <label for="subj-${i}">Subject</label>
        <input id="subj-${i}" class="subj" value="${escapeAttr(subject)}" />
        <label for="body-${i}">Body</label>
        <textarea id="body-${i}" class="body" rows="12">${escapeHtml(body)}</textarea>
        <div class="actions">
          <button data-act="save-letter" class="primary">Save edits</button>
          <button data-act="regen">Re-draft</button>
          <button data-act="copy">Copy</button>
          <button data-act="export">Export .eml</button>
          <label class="btn">Import .txt<input type="file" hidden accept=".txt,.md,.eml" /></label>
          <button data-act="send-gmail">Gmail draft</button>
          <button data-act="send-ms">Outlook draft</button>
          <span class="flash"></span>
        </div>
      </div>`;
    const letterEdit = wrap.querySelector('.letter-edit');
    const subj = wrap.querySelector('.subj');
    const bodyEl = wrap.querySelector('.body');
    const flash = wrap.querySelector('.flash');
    const showFlash = (msg) => { flash.textContent = msg; flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 2400); };
    const markDirty = () => letterEdit.classList.add('dirty');
    subj.addEventListener('input', markDirty);
    bodyEl.addEventListener('input', markDirty);

    wrap.querySelector('[data-act=save-letter]').addEventListener('click', () => {
      store.updateLetter(job.id, { subject: subj.value, body: bodyEl.value });
      letterEdit.classList.remove('dirty');
      showFlash('✓ Saved');
    });
    wrap.querySelector('[data-act=regen]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.classList.add('loading');
      try {
        const provider = store.getProviderOverride() || undefined;
        const { letter } = await api.letter(job, store.getProfile(), provider);
        subj.value = letter.subject;
        bodyEl.value = letter.body;
        store.updateLetter(job.id, letter);
        letterEdit.classList.remove('dirty');
        showFlash('✓ Re-drafted');
      } catch (err) {
        showFlash(`Failed: ${err.message}`);
      } finally {
        btn.classList.remove('loading');
      }
    });
    wrap.querySelector('[data-act=copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(bodyEl.value); showFlash('✓ Copied'); }
      catch { bodyEl.select(); document.execCommand?.('copy'); showFlash('✓ Copied'); }
    });
    wrap.querySelector('[data-act=export]').addEventListener('click', () => {
      const eml = `Subject: ${subj.value}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${bodyEl.value}`;
      const blob = new Blob([eml], { type: 'message/rfc822' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${job.company}-${job.title}.eml`.replace(/[^a-z0-9.-]+/gi,'_');
      a.click();
      URL.revokeObjectURL(a.href);
      showFlash('✓ Exported');
    });
    wrap.querySelector('input[type=file]').addEventListener('change', async e => {
      const f = e.target.files?.[0];
      if (f) { bodyEl.value = await f.text(); markDirty(); showFlash('✓ Imported'); }
    });
    wrap.querySelector('[data-act=send-gmail]').addEventListener('click', () => sendDraft('google', subj.value, bodyEl.value, showFlash));
    wrap.querySelector('[data-act=send-ms]').addEventListener('click', () => sendDraft('microsoft', subj.value, bodyEl.value, showFlash));

    // ---- Tailor controls ----
    const tailorFlashEl = wrap.querySelector('.tailor-flash');
    const showTailorFlash = (msg) => { tailorFlashEl.textContent = msg; tailorFlashEl.classList.add('show'); setTimeout(() => tailorFlashEl.classList.remove('show'), 2800); };

    wrap.querySelector('[data-act=tailor-cv]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.classList.add('loading');
      showTailorFlash('Tailoring CV — generator → rater loop…');
      try {
        const provider = store.getProviderOverride() || undefined;
        const profile = store.getProfile();
        const parsed = store.getParsedProfile() || undefined;
        const hints = store.getHints();
        const result = await api.tailor(job, profile, parsed, hints, provider);
        if (result.parsed) store.setParsedProfile(result.parsed);
        store.updateTailor(job.id, {
          resume: result.resume,
          resumeMarkdown: result.resumeMarkdown,
          coverLetter: result.coverLetter,
          atsScore: result.atsScore,
          raterScore: result.raterScore,
          iterations: result.iterations,
          feedback: result.feedback,
        });
        showTailorFlash(`✓ Tailored — ATS ${result.atsScore}% · Match ${result.raterScore}/5 · ${result.iterations} iter`);
        setTimeout(() => renderProgress(), 700);
      } catch (err) {
        showTailorFlash(`Tailor failed: ${err.message}`);
      } finally {
        btn.classList.remove('loading');
      }
    });

    wrap.querySelector('[data-act=copy-cv]')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(job.tailor.resumeMarkdown); showTailorFlash('✓ CV copied'); }
      catch { showTailorFlash('Copy failed'); }
    });
    wrap.querySelector('[data-act=export-cv]')?.addEventListener('click', () => {
      const blob = new Blob([job.tailor.resumeMarkdown], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${job.company}-${job.title}-CV.md`.replace(/[^a-z0-9.-]+/gi, '_');
      a.click();
      URL.revokeObjectURL(a.href);
      showTailorFlash('✓ Exported');
    });

    container.appendChild(wrap);
  });
}

async function sendDraft(provider, subject, body, showFlash) {
  const to = prompt('Recipient email (or leave blank for a self-draft):', '') || '';
  try {
    const r = await api.emailDraft(provider, to, subject, body);
    showFlash(`✓ ${provider} draft created (${r.id})`);
  } catch (e) {
    showFlash(`${provider} draft failed — connect account in Settings`);
  }
}

// ============================================================
// DEMO TAB
// ============================================================
const DEMO_JOBS = [
  {
    source: 'demo', externalId: 'demo-1', url: 'https://example.com/jobs/demo-1',
    title: 'Senior Full-Stack Engineer', company: 'Acme Robotics', location: 'Remote (EU)',
    description: 'Build the operator console for our autonomous fleet.',
    rating: 4, reasoning: 'Strong stack match; product instinct emphasis aligns with your background.',
    strengths: ['TypeScript + React (5+ yrs)', 'AWS / Postgres experience', 'Product-led delivery'],
    gaps: ['No robotics domain history'],
  },
  {
    source: 'demo', externalId: 'demo-2', url: 'https://example.com/jobs/demo-2',
    title: 'Founding Engineer (AI Tooling)', company: 'Brightside AI', location: 'Remote',
    description: 'Help us ship a developer-facing AI workflow product.',
    rating: 5, reasoning: 'Founding-engineer generalist profile maps directly to your trajectory.',
    strengths: ['Generalist breadth', 'Shipping AI products', 'Early-stage mindset'],
    gaps: ['No formal founding-engineer title yet'],
  },
  {
    source: 'demo', externalId: 'demo-3', url: 'https://example.com/jobs/demo-3',
    title: 'Staff Engineer, Platform', company: 'Nimbus Data', location: 'London / Hybrid',
    description: 'Owning the data plane for a real-time analytics platform.',
    rating: 2, reasoning: 'Stack mostly outside your strongest areas; senior level but different domain.',
    strengths: ['Senior leadership experience'],
    gaps: ['No Go production work', 'Light on Kafka/K8s'],
  },
];

const demoBtn = document.getElementById('demo-go');
const demoStatus = document.getElementById('demo-status');
const demoLog = document.getElementById('demo-log');
const demoLogBody = document.getElementById('demo-log-body');

demoBtn.addEventListener('click', async () => {
  demoBtn.classList.add('loading');
  demoBtn.disabled = true;
  demoStatus.textContent = 'Running…';
  demoLog.style.display = 'block';
  demoLogBody.innerHTML = '';
  document.getElementById('demo-results').innerHTML = '';

  const step = reduceMotion ? 0 : 420;
  appendLog(demoLogBody, 'hunter', `scanning sample boards (acmerobotics, brightside, nimbus)…`);
  await sleep(step);
  appendLog(demoLogBody, 'scout', `extracting structured fields…`);
  await sleep(step);
  appendLog(demoLogBody, 'rater', `scoring against your resume + preferences…`);
  await sleep(step);
  appendLog(demoLogBody, 'writer', `standing by to draft tailored letters on demand.`, { muted: true });
  await sleep(step);
  appendLog(demoLogBody, 'mailman', `queue ready; nothing dispatched in demo mode.`, { muted: true });
  await sleep(step / 2);
  appendLog(demoLogBody, 'done', `squad complete.`);

  renderSuggestions(JSON.parse(JSON.stringify(DEMO_JOBS)), document.getElementById('demo-results'));
  demoStatus.textContent = `Returned ${DEMO_JOBS.length} sample role(s).`;
  demoBtn.classList.remove('loading');
  demoBtn.disabled = false;
});

// ============================================================
// SETTINGS TAB
// ============================================================
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

document.getElementById('export-all').addEventListener('click', async () => {
  downloadText('job-agent-data.json', await store.exportAll());
});
document.getElementById('import-all').addEventListener('change', async e => {
  const f = e.target.files?.[0];
  if (!f) return;
  await store.importAll(await f.text());
  location.reload();
});
document.getElementById('wipe-all').addEventListener('click', async () => {
  if (confirm('Delete all data (server + local)?')) {
    await store.wipe();
    location.reload();
  }
});
