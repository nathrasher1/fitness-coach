// "Tell us about you": one optional card (sheet), a one-time home card, a Settings entry,
// plus the small places the answers show up (go-easy badges, swap order, diet warnings).
// Answers are private: only this file and /api/about-you ever touch them.
(function () {
  const Q = window.AboutYou;
  let state = { answers: {}, filled: false, showHomeCard: false, group: null, policy: {} };
  let loaded = false;

  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isTeen = () => state.group === 'teen';

  let teenSupport = null;
  async function load() {
    try { state = await api('/about-you'); loaded = true; } catch (_) { loaded = false; }
    teenSupport = null;
    if (loaded && state.group === 'teen') { try { teenSupport = await api('/about-you/teen-support'); } catch (_) {} }
    renderHomeCard();
    renderSettingsEntry();
    renderTeenSupport();
    return state;
  }

  // Teen habit view (only when the private growth check suggests it). No numbers, no labels.
  function parentLine(t) {
    if (!t.parentsLinked) return `<p class="ts-parent">No parent is linked, so nothing is shared. ${h(t.noParentNote || '')}</p>`;
    return `<div class="ts-parent"><strong>What your linked parent${t.parentsLinked > 1 ? 's' : ''} can see:</strong>
      <ul>${t.parentSees.map((x) => `<li>${h(x)}</li>`).join('')}</ul>
      <strong>${t.shareBody ? 'You are sharing:' : 'Private unless you share them:'}</strong> ${h(t.privateUnlessShared.join(', ').toLowerCase())}.<br>
      <strong>Always private:</strong> ${h((t.alwaysPrivate || []).join(', ').toLowerCase())}. You and your parent never see a BMI number.</div>`;
  }
  function shareToggle(t) {
    if (!t || !t.teen) return '';
    return `<label class="ts-toggle"><input type="checkbox" data-ts-share ${t.shareBody ? 'checked' : ''}> <span>Share my weight and measurements with my parent<small>${t.parentsLinked ? 'Off by default. Turn it off anytime.' : 'Only matters once a parent is linked.'}</small></span></label>`;
  }
  function renderTeenSupport() {
    const el = document.getElementById('teen-support');
    if (!el) return;
    const t = teenSupport;
    if (!t || !t.flagged) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<div class="card ts-card">
      <div class="summary-kicker">For you</div>
      <h2>Healthy habits</h2>
      <p class="ts-note">${h(t.note)}</p>
      <div class="ts-habits">${t.habits.map((x) => `<div class="ts-habit"><strong>${h(x.title)}</strong><span>${h(x.text)}</span></div>`).join('')}</div>
      <h3 class="section-label">Foods to try</h3><div class="ay-chips">${t.suggestions.map((x) => `<span class="chip chip-static">${h(x)}</span>`).join('')}</div>
      <h3 class="section-label">Have less often</h3><div class="ay-chips">${t.cutBack.map((x) => `<span class="chip chip-static ts-less">${h(x)}</span>`).join('')}</div>
      ${parentLine(t)}
      ${shareToggle(t)}
    </div>`;
  }
  document.addEventListener('change', async (e) => {
    const cb = e.target.closest && e.target.closest('[data-ts-share]');
    if (!cb) return;
    try {
      const r = await api('/about-you/share-body', { method: 'PUT', body: JSON.stringify({ on: cb.checked }) });
      if (teenSupport) teenSupport.shareBody = r.shareBody;
      toast(r.shareBody ? 'Sharing weight and measurements with your parent' : 'Weight and measurements are private again');
      renderTeenSupport(); renderSettingsEntry();
    } catch (err) { cb.checked = !cb.checked; toast(err.message); }
  });

  function goalLabel(g) { return isTeen() && g[2] && g[2].teenLabel ? g[2].teenLabel : g[1]; }

  function chips(name, list, selected, multi, labelFn) {
    const sel = new Set(Array.isArray(selected) ? selected : selected ? [selected] : []);
    return `<div class="ay-chips" data-q="${name}" data-multi="${multi ? 1 : 0}" role="group">${list
      .map((it) => `<button type="button" class="ay-chip${sel.has(it[0]) ? ' on' : ''}" data-v="${it[0]}" aria-pressed="${sel.has(it[0])}">${h(labelFn ? labelFn(it) : it[1])}</button>`)
      .join('')}</div>`;
  }
  const why = (t) => `<p class="ay-why">${t}</p>`;

  function heightFields(cm) {
    if ((settings.lengthUnit || 'in') === 'in') {
      const totalIn = cm ? cm / 2.54 : null;
      const ft = totalIn ? Math.floor(totalIn / 12) : '';
      const inch = totalIn ? Math.round(totalIn - ft * 12) : '';
      return `<div class="ay-inline"><input type="number" id="ay-ft" min="3" max="8" inputmode="numeric" placeholder="ft" value="${ft}" aria-label="Height feet"><span>ft</span>
        <input type="number" id="ay-in" min="0" max="11" inputmode="numeric" placeholder="in" value="${inch}" aria-label="Height inches"><span>in</span></div>`;
    }
    return `<div class="ay-inline"><input type="number" id="ay-cm" min="100" max="250" inputmode="numeric" placeholder="cm" value="${cm || ''}" aria-label="Height in centimetres"><span>cm</span></div>`;
  }

  function open() {
    const a = state.answers || {};
    const teen = isTeen();
    const sheet = document.getElementById('about-you-sheet');
    sheet.innerHTML = `
      <div class="sheet ay-sheet" role="dialog" aria-modal="true" aria-labelledby="ay-title">
        <div class="sheet-grip" aria-hidden="true"></div>
        <div class="sheet-head"><div>
          <div class="summary-kicker">Optional · about 1 minute</div>
          <h2 id="ay-title" class="summary-title">Tell us about you</h2>
        </div><button type="button" class="btn btn-ghost btn-sm" data-ay-close aria-label="Close">✕</button></div>
        <p class="ay-private">🔒 Private to you. Never shown on your profile, in search, or in anything you share. Deleted with your account. Skip anything.</p>

        <div class="ay-q"><h3>What's your main goal?</h3>${chips('goal', Q.GOALS, a.goal, false, goalLabel)}
          ${why(teen ? 'Shapes your training focus. For members under 18 we suggest fuel for growth and training, never a calorie deficit.' : 'Sets whether your calorie target is a cut, bulk or maintain. You can fine-tune it on Goals.')}</div>

        ${`<div class="ay-q"><h3>Body basics</h3>
          <label class="ay-label">Height</label>${heightFields(a.heightCm)}
          <label class="ay-label">Current weight</label><div class="ay-inline"><input type="number" id="ay-weight" step="0.1" inputmode="decimal" placeholder="${settings.unit === 'kg' ? 'kg' : 'lbs'}"><span>${settings.unit === 'kg' ? 'kg' : 'lbs'}</span></div>
          <label class="ay-label">Sex (for the calorie formula)</label>${chips('sex', Q.SEX, a.sex, false)}
          ${why(teen ? 'Used privately to tailor habit tips for growing bodies. You won\'t see BMI or calorie cuts, and your weight stays private unless you choose to share it.' : 'Height, weight, age and sex give a <strong>starting</strong> calorie estimate before you have logs. "Prefer not to say" uses an average of the two formulas. Weight is saved as today\'s weigh-in.')}</div>`}

        <div class="ay-q"><h3>How active are you outside workouts?</h3>${chips('activity', Q.ACTIVITY, a.activity, false)}
          ${why('Everyday movement changes how much energy you use.')}</div>

        <div class="ay-q"><h3>Training experience</h3>${chips('experience', Q.EXPERIENCE, a.experience, false)}</div>

        <div class="ay-q"><h3>What can you train with?</h3>${chips('equipment', Q.EQUIPMENT, a.equipment, true)}
          ${why('Swap suggestions put exercises you can do with this first.')}</div>

        <div class="ay-q"><h3>Anything to go easy on?</h3>${chips('easyOn', Q.EASY_ON, a.easyOn, true)}
          ${why('We\'ll flag exercises that load these areas and offer a swap. This isn\'t medical advice. For pain or an injury, check with a doctor or physio.')}</div>

        <div class="ay-q"><h3>How do you eat?</h3>${chips('diet', Q.DIET, a.diet, true)}
          <label class="ay-label">Foods to avoid</label>${chips('avoid', Q.AVOID, a.avoid, true)}
          ${why('Foods whose <strong>names</strong> suggest a conflict get a warning. We can\'t check full ingredient lists, so always read the label for allergies.')}</div>

        <div class="ay-actions">
          <button type="button" class="btn btn-ghost" data-ay-skip>Skip for now</button>
          <button type="button" class="btn btn-primary" data-ay-save>Save</button>
        </div>
      </div>`;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
  }

  function close() {
    const sheet = document.getElementById('about-you-sheet');
    sheet.hidden = true;
    sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }

  function collect() {
    const sheet = document.getElementById('about-you-sheet');
    const out = {};
    sheet.querySelectorAll('.ay-chips').forEach((g) => {
      const vals = [...g.querySelectorAll('.ay-chip.on')].map((b) => b.dataset.v);
      out[g.dataset.q] = g.dataset.multi === '1' ? vals : vals[0] || '';
    });
    const ft = sheet.querySelector('#ay-ft'), inch = sheet.querySelector('#ay-in'), cm = sheet.querySelector('#ay-cm');
    if (ft && (ft.value || inch.value)) out.heightCm = Math.round(((Number(ft.value) || 0) * 12 + (Number(inch.value) || 0)) * 2.54 * 10) / 10;
    else if (cm && cm.value) out.heightCm = Number(cm.value);
    else out.heightCm = '';
    const w = sheet.querySelector('#ay-weight');
    if (w && w.value) out.weightLbs = fromInputWeight(w.value);
    return out;
  }

  async function save() {
    try {
      state = await api('/about-you', { method: 'PUT', body: JSON.stringify(collect()) });
      close();
      toast('Saved. Only you can see this');
      renderHomeCard();
      renderSettingsEntry();
      if (typeof loadDashboard === 'function') loadDashboard();
    } catch (err) { toast(err.message); }
  }

  async function dismiss() {
    try { state = await api('/about-you/dismiss', { method: 'POST' }); } catch (_) {}
    renderHomeCard();
    renderSettingsEntry();
  }

  function renderHomeCard() {
    const el = document.getElementById('about-you-home');
    if (!el) return;
    if (!loaded || !state.showHomeCard) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="card ay-home">
      <button type="button" class="ay-x" data-ay-dismiss aria-label="Dismiss">✕</button>
      <div class="summary-kicker">New · optional</div>
      <h2>Tell us about you</h2>
      <p>A few quick questions to tailor your ${isTeen() ? 'training and food tips' : 'calorie target, swaps and food tips'}. Private to you.</p>
      <div class="ay-home-actions"><button type="button" class="btn btn-primary" data-ay-open>Start (1 min)</button>
      <button type="button" class="btn btn-ghost" data-ay-dismiss>Not now</button></div>
    </div>`;
  }

  function summary() {
    const a = state.answers || {};
    const parts = [];
    const g = Q.GOALS.find((x) => x[0] === a.goal);
    if (g) parts.push(goalLabel(g));
    if (a.easyOn && a.easyOn.length) parts.push('Go easy: ' + a.easyOn.map((v) => Q.labelOf(Q.EASY_ON, v)).join(', '));
    if (a.diet && a.diet.length) parts.push(a.diet.map((v) => Q.labelOf(Q.DIET, v)).join(', '));
    if (a.avoid && a.avoid.length) parts.push('Avoid: ' + a.avoid.map((v) => Q.labelOf(Q.AVOID, v)).join(', '));
    return parts.join(' · ') || 'Saved';
  }

  function renderSettingsEntry() {
    const el = document.getElementById('about-you-settings');
    if (!el || !loaded) return;
    el.innerHTML = `<div class="card ay-settings${state.filled ? '' : ' ay-unfilled'}">
      <div class="ay-settings-row">
        <div><h2>About you ${state.filled ? '' : '<span class="ay-dot">Not filled in yet</span>'}</h2>
        <p class="hint">${state.filled ? h(summary()) : 'Tailor your calorie target, swaps and food warnings. Takes about a minute.'}</p></div>
        <button type="button" class="btn ${state.filled ? 'btn-ghost' : 'btn-primary'} btn-sm" data-ay-open>${state.filled ? 'Edit' : 'Fill in'}</button>
      </div>
      <p class="ay-private-sm">🔒 Private. Never on your profile, in search or in shares.</p>
      ${teenSupport && teenSupport.teen ? shareToggle(teenSupport) : ''}
    </div>`;
  }

  // ---- Places the answers show up ----
  function badgeHtml(ex) {
    const areas = (state.answers && state.answers.easyOn) || [];
    if (!areas.length || !ex) return '';
    const flags = Q.easyOnFlags(ex, areas);
    if (!flags.length) return '';
    return `<span class="ay-badge" title="You asked to go easy on these. Not medical advice.">⚠ Easy on ${h(flags.map((f) => Q.labelOf(Q.EASY_ON, f).toLowerCase()).join(', '))}</span>`;
  }
  function rankSwaps(swaps) { return Q.rankSwaps(swaps, state.answers || {}); }
  function dietHtml(name, opts = {}) {
    const w = Q.dietWarnings(name, state.answers || {});
    if (!w.length) return '';
    return `<span class="ay-diet">${w.map((x) => `<span class="ay-diet-chip">⚠ ${h(x)}</span>`).join('')}${opts.caveat ? '<small class="ay-diet-caveat">Based on the name only. Check the label; we can\'t see full ingredients.</small>' : ''}</span>`;
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-ay-open]')) return open();
    if (t.closest('[data-ay-dismiss]')) return dismiss();
    const sheet = document.getElementById('about-you-sheet');
    if (!sheet || sheet.hidden) return;
    if (t === sheet || t.closest('[data-ay-close]')) return close();
    if (t.closest('[data-ay-skip]')) { close(); return dismiss(); }
    if (t.closest('[data-ay-save]')) return save();
    const chip = t.closest('.ay-chip');
    if (chip) {
      const group = chip.parentElement;
      if (group.dataset.multi !== '1') group.querySelectorAll('.ay-chip').forEach((b) => { if (b !== chip) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); } });
      chip.classList.toggle('on');
      chip.setAttribute('aria-pressed', chip.classList.contains('on'));
    }
  });
  document.addEventListener('keydown', (e) => {
    const sheet = document.getElementById('about-you-sheet');
    if (e.key === 'Escape' && sheet && !sheet.hidden) close();
  });

  // Called after sign-in. New accounts see the card right away; everyone else gets the home card once.
  async function init(opts = {}) {
    await load();
    if (opts.justRegistered && !state.filled) open();
  }

  window.AboutYouUI = { init, load, open, close, badgeHtml, rankSwaps, dietHtml, get state() { return state; } };
})();
