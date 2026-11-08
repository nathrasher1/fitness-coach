// Flex / holiday days + sport / practice sessions UI.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function todayLocal() {
    if (typeof todayStr === 'function') return todayStr();
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  // ---------- Flex days (scale-free estimator) ----------
  const NUDGES = [['little', 'A little'], ['normal', 'Normal'], ['lot', 'A lot']];
  let picked = []; // [{ key?, foodId?, label, category, kcalPerG?, nudge }]
  let minor = false;

  function flexInputs() {
    return {
      foods: picked.map(({ key, foodId, label, category, kcalPerG, nudge }) => ({ key, foodId, label, category, kcalPerG, nudge })),
      fullness: (document.querySelector('input[name="flex-full"]:checked') || {}).value || 'comfortable',
      plates: Number((document.querySelector('input[name="flex-plates"]:checked') || {}).value || 1),
      dessertServings: Number($('flex-dessert').value || 0)
    };
  }

  function renderPicked() {
    const el = $('flex-picked'); if (!el) return;
    el.innerHTML = picked.map((f, i) => `<div class="flex-pick"><span>${esc(f.label)}</span><span class="nudge">${NUDGES.map(([k, l]) => `<button type="button" data-i="${i}" data-n="${k}" class="${f.nudge === k ? 'on' : ''}">${l}</button>`).join('')}<button type="button" data-rm="${i}" aria-label="Remove">×</button></span></div>`).join('');
    el.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { picked[Number(b.dataset.i)].nudge = b.dataset.n; renderPicked(); }));
    el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      const f = picked.splice(Number(b.dataset.rm), 1)[0];
      const box = f && f.key && document.querySelector(`#flex-menu input[value="${f.key}"]`); if (box) box.checked = false;
      renderPicked();
    }));
  }

  function renderEstimate(r) {
    const out = $('flex-estimate-out'); if (!out) return;
    if (!r) { out.innerHTML = ''; return; }
    const src = r.baselineSource === 'personal' ? 'your usual big meals' : r.baselineSource === 'blended' ? 'your logs + typical values' : 'typical values (log more meals to personalise)';
    out.innerHTML = `<div><span class="est-mid">≈${r.kcal.toLocaleString()} kcal</span><span class="est-badge">Estimate · ${esc(r.confidence)} confidence</span></div>
      <div class="hint">Likely ${r.low.toLocaleString()}–${r.high.toLocaleString()} kcal · based on ${esc(src)}${r.correction && r.correction !== 1 ? ` · adjusted ×${r.correction} from your weigh-ins` : ''}</div>
      <ul class="hint">${(r.items || []).map((it) => `<li>${esc(it.label)}: ~${it.kcal} kcal${it.grams ? ` (~${it.grams} g)` : ''}</li>`).join('')}</ul>
      <p class="hint">The middle number counts toward today's and this week's totals and your weight trend, marked as an estimate.</p>`;
  }

  async function loadFlex() {
    if (!$('flex-card')) return;
    try {
      const data = await api('/flex-days');
      minor = !!data.minor;
      const dateEl = $('flex-date');
      if (dateEl && !dateEl.value) dateEl.value = todayLocal();
      const hol = $('flex-holiday');
      if (hol) {
        const cur = hol.value;
        hol.innerHTML = '<option value="">Custom / none</option>' + (data.holidays || []).map((h) => `<option value="${esc(h.key)}" data-date="${esc(h.date)}">${esc(h.name)} (${esc(h.date)})</option>`).join('');
        hol.value = cur;
      }
      const menu = $('flex-menu');
      if (menu && !menu.dataset.ready) {
        menu.dataset.ready = '1';
        menu.innerHTML = (data.menu || []).map((m) => `<label class="check-tile"><input type="checkbox" value="${esc(m.key)}" data-label="${esc(m.label)}" data-cat="${esc(m.category)}" /><span>${esc(m.label)}</span></label>`).join('');
        menu.addEventListener('change', (e) => {
          const i = e.target; if (!i.value) return;
          if (i.checked) picked.push({ key: i.value, label: i.dataset.label, category: i.dataset.cat, nudge: 'normal' });
          else picked = picked.filter((f) => f.key !== i.value);
          renderPicked();
        });
      }
      $('flex-cap-hint').textContent = `${data.used} of ${data.cap} flex days used this month · ${data.remaining} left`;
      if ($('flex-cap')) $('flex-cap').value = String(data.cap);
      if ($('flex-buffer')) $('flex-buffer').checked = !!data.bufferOptIn;
      const list = $('flex-list');
      list.innerHTML = data.days.length ? data.days.map((d) => `<div class="food-log-item" data-flex="${esc(d.date)}">
          <div><strong>${esc(d.date)}</strong>${d.label ? ' · ' + esc(d.label) : ''}<div class="hint">${d.estimateKcal ? `≈${d.estimateKcal} kcal (${d.estimateLow}–${d.estimateHigh}) · estimate` : 'No estimate'}</div></div>
          <button type="button" class="btn btn-ghost-outline btn-sm" data-flex-del="${esc(d.date)}">Remove</button></div>`).join('') : '<p class="hint">No flex days marked this month.</p>';
      list.querySelectorAll('[data-flex-del]').forEach((btn) => btn.addEventListener('click', async () => {
        try { await api('/flex-days/' + btn.dataset.flexDel, { method: 'DELETE' }); toast('Flex day removed'); loadFlex(); if (window.Account) window.Account.loadStreak(); } catch (err) { toast(err.message); }
      }));
      syncFlexFormForDate();
    } catch (e) { /* ignore */ }
  }

  function syncFlexFormForDate() {
    const date = $('flex-date') && $('flex-date').value;
    if ($('btn-flex-clear')) $('btn-flex-clear').hidden = !(date && document.querySelector(`[data-flex="${date}"]`));
  }

  if ($('flex-holiday')) {
    $('flex-holiday').addEventListener('change', () => {
      const opt = $('flex-holiday').selectedOptions[0];
      if (opt && opt.dataset.date) { $('flex-date').value = opt.dataset.date; if (!$('flex-label').value) $('flex-label').value = opt.textContent.replace(/\s*\(.*\)$/, ''); }
      syncFlexFormForDate();
    });
  }
  if ($('flex-date')) $('flex-date').addEventListener('change', syncFlexFormForDate);

  // Food database search: adds a custom food (density from grams-based servings when available).
  let searchTimer = null;
  if ($('flex-food-search')) {
    $('flex-food-search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = $('flex-food-search').value.trim();
      if (q.length < 2) { $('flex-food-results').innerHTML = ''; return; }
      searchTimer = setTimeout(async () => {
        try {
          const foods = await api('/foods?q=' + encodeURIComponent(q) + '&limit=8');
          $('flex-food-results').innerHTML = foods.map((f, i) => `<div class="search-result" data-i="${i}">${esc(f.name)}</div>`).join('');
          $('flex-food-results').querySelectorAll('[data-i]').forEach((el) => el.addEventListener('click', () => {
            const f = foods[Number(el.dataset.i)];
            const grams = /^(g|gram|grams)$/i.test(f.servingUnit || '') ? f.servingSize : null;
            picked.push({ foodId: String(f._id), label: f.name, category: 'other', kcalPerG: grams ? f.calories / grams : undefined, nudge: 'normal' });
            $('flex-food-search').value = ''; $('flex-food-results').innerHTML = '';
            renderPicked();
          }));
        } catch { /* ignore */ }
      }, 250);
    });
  }

  if ($('btn-flex-estimate')) {
    $('btn-flex-estimate').addEventListener('click', async () => {
      try { renderEstimate(await api('/flex-days/estimate', { method: 'POST', body: JSON.stringify(flexInputs()) })); } catch (err) { toast(err.message); }
    });
  }
  if ($('btn-flex-save')) {
    $('btn-flex-save').addEventListener('click', async () => {
      const body = { date: $('flex-date').value, label: $('flex-label').value.trim(), holidayKey: $('flex-holiday').value || '', ...flexInputs() };
      try {
        const r = await api('/flex-days', { method: 'POST', body: JSON.stringify(body) });
        toast(`Flex day saved · ${r.estimateLabel}`);
        loadFlex();
        if (window.Account) window.Account.loadStreak();
        if (typeof loadDashboard === 'function') loadDashboard();
      } catch (err) { toast(err.message); }
    });
  }
  if ($('btn-flex-clear')) {
    $('btn-flex-clear').addEventListener('click', async () => {
      const date = $('flex-date').value; if (!date) return;
      try { await api('/flex-days/' + date, { method: 'DELETE' }); toast('Flex day removed'); loadFlex(); if (window.Account) window.Account.loadStreak(); } catch (err) { toast(err.message); }
    });
  }

  // ---------- Sport sessions ----------
  function updateLoadHint() {
    const d = Number($('sport-duration') && $('sport-duration').value);
    const e = Number($('sport-effort') && $('sport-effort').value);
    const el = $('sport-load-hint');
    if (!el) return;
    if (d > 0 && e >= 1 && e <= 10) el.textContent = `Training load: ${Math.round(d * e * 10) / 10} (minutes × effort)`;
    else el.textContent = '';
  }

  async function loadSport() {
    if (!$('sport-card')) return;
    try {
      if ($('sport-date') && !$('sport-date').value) $('sport-date').value = todayLocal();
      const data = await api('/sport-sessions?limit=15');
      const sel = $('sport-select');
      if (sel && !sel.dataset.ready) {
        sel.innerHTML = (data.presets || []).map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
        sel.dataset.ready = '1';
        sel.addEventListener('change', () => {
          $('sport-custom-row').hidden = !(sel.value === 'Other' || sel.value === 'Practice (general)');
        });
      }
      updateLoadHint();
      const list = $('sport-list');
      if (!data.sessions.length) {
        list.innerHTML = '<p class="hint">No sport sessions logged yet.</p>';
      } else {
        list.innerHTML = data.sessions.map((s) => `
          <div class="food-log-item">
            <div>
              <strong>${esc(s.sport)}</strong> · ${esc(s.date)}
              <div class="hint">${s.durationMin} min · effort ${s.effort} · load ${s.trainingLoad}${s.activeKcal != null ? ` · ~${s.activeKcal} kcal` : ''}${s.drills ? ` · ${esc(s.drills)}` : ''}</div>
            </div>
            <button type="button" class="btn btn-ghost-outline btn-sm" data-sport-del="${esc(s.id)}">Delete</button>
          </div>`).join('');
        list.querySelectorAll('[data-sport-del]').forEach((btn) => btn.addEventListener('click', async () => {
          try {
            await api('/sport-sessions/' + btn.dataset.sportDel, { method: 'DELETE' });
            toast('Session deleted');
            loadSport();
            if (window.Account) window.Account.loadStreak();
          } catch (err) { toast(err.message); }
        }));
      }
    } catch (e) { /* ignore */ }
  }

  ['sport-duration', 'sport-effort'].forEach((id) => {
    if ($(id)) $(id).addEventListener('input', updateLoadHint);
  });

  if ($('btn-sport-save')) {
    $('btn-sport-save').addEventListener('click', async () => {
      const sport = $('sport-select').value;
      const body = {
        date: $('sport-date').value,
        sport,
        customSport: $('sport-custom').value.trim(),
        durationMin: Number($('sport-duration').value),
        effort: Number($('sport-effort').value),
        drills: $('sport-drills').value.trim(),
        notes: $('sport-notes').value.trim()
      };
      try {
        const s = await api('/sport-sessions', { method: 'POST', body: JSON.stringify(body) });
        toast(`Logged ${s.sport} · load ${s.trainingLoad}`);
        $('sport-notes').value = '';
        $('sport-drills').value = '';
        loadSport();
        if (window.Account) window.Account.loadStreak();
        if (typeof loadActivity === 'function') loadActivity();
      } catch (err) { toast(err.message); }
    });
  }

  // ---------- Settings: flex cap + practice days ----------
  if ($('practice-days')) {
    $('practice-days').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) =>
      `<label class="check-tile"><input type="checkbox" value="${d}" /><span>${DAYS[d]}</span></label>`
    ).join('');
  }

  async function loadFlexSettings() {
    try {
      const [flex, streak] = await Promise.all([
        api('/flex-days').catch(() => null),
        api('/streak').catch(() => null)
      ]);
      if (flex && $('flex-cap')) $('flex-cap').value = String(flex.cap);
      if (flex && $('flex-buffer')) $('flex-buffer').checked = !!flex.bufferOptIn;
      const teen = !!(window.currentUser && window.currentUser.ageGroup === 'teen');
      if ($('flex-buffer-row')) $('flex-buffer-row').hidden = teen;
      const days = (streak && streak.practiceDays) || [];
      if ($('practice-days')) {
        $('practice-days').querySelectorAll('input').forEach((i) => { i.checked = days.includes(Number(i.value)); });
      }
    } catch (e) { /* ignore */ }
  }

  if ($('btn-save-flex-settings')) {
    $('btn-save-flex-settings').addEventListener('click', async () => {
      try {
        await api('/flex-days/settings', {
          method: 'PUT',
          body: JSON.stringify({
            flexDaysPerMonth: Number($('flex-cap').value),
            flexBufferOptIn: !!($('flex-buffer') && $('flex-buffer').checked)
          })
        });
        const practiceDays = [...$('practice-days').querySelectorAll('input')].filter((i) => i.checked).map((i) => Number(i.value));
        await api('/sport-sessions/practice-days', { method: 'PUT', body: JSON.stringify({ practiceDays }) });
        toast('Flex & practice settings saved');
        loadFlex();
        if (window.Account) window.Account.loadStreak();
      } catch (err) { toast(err.message); }
    });
  }

  // Hook into panel switches
  document.querySelectorAll('#main-nav button[data-panel]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.panel === 'dashboard') loadFlex();
      if (b.dataset.panel === 'workouts') loadSport();
      if (b.dataset.panel === 'settings') loadFlexSettings();
    });
  });

  window.FlexSport = { loadFlex, loadSport, loadFlexSettings };
  // Initial load after app enters
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { loadFlex(); loadSport(); }, 800);
  });
})();
