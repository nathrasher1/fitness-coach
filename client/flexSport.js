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

  // ---------- Flex days ----------
  async function loadFlex() {
    if (!$('flex-card')) return;
    try {
      const data = await api('/flex-days');
      const dateEl = $('flex-date');
      if (dateEl && !dateEl.value) dateEl.value = todayLocal();
      const hol = $('flex-holiday');
      if (hol) {
        const cur = hol.value;
        hol.innerHTML = '<option value="">Custom / none</option>' + (data.holidays || []).map((h) =>
          `<option value="${esc(h.key)}" data-date="${esc(h.date)}">${esc(h.name)} (${esc(h.date)})</option>`
        ).join('');
        hol.value = cur;
      }
      $('flex-cap-hint').textContent = `${data.used} of ${data.cap} flex days used this month · ${data.remaining} left`;
      if ($('flex-cap')) $('flex-cap').value = String(data.cap);
      if ($('flex-buffer')) $('flex-buffer').checked = !!data.bufferOptIn;
      const list = $('flex-list');
      if (!data.days.length) {
        list.innerHTML = '<p class="hint">No flex days marked this month.</p>';
      } else {
        list.innerHTML = data.days.map((d) => {
          const est = d.estimate === 'none' ? 'No log' : `${d.estimate}${d.addKcal ? ` (+${d.addKcal} kcal)` : ''}`;
          return `<div class="food-log-item" data-flex="${esc(d.date)}">
            <div><strong>${esc(d.date)}</strong> ${d.label ? '· ' + esc(d.label) : ''}<div class="hint">${esc(est)}</div></div>
            <button type="button" class="btn btn-ghost-outline btn-sm" data-flex-del="${esc(d.date)}">Remove</button>
          </div>`;
        }).join('');
      }
      list.querySelectorAll('[data-flex-del]').forEach((btn) => btn.addEventListener('click', async () => {
        try {
          await api('/flex-days/' + btn.dataset.flexDel, { method: 'DELETE' });
          toast('Flex day removed');
          loadFlex();
          if (window.Account) window.Account.loadStreak();
        } catch (err) { toast(err.message); }
      }));
      // Prefill if selected date is already marked
      syncFlexFormForDate();
    } catch (e) { /* ignore */ }
  }

  function syncFlexFormForDate() {
    const date = $('flex-date') && $('flex-date').value;
    const clear = $('btn-flex-clear');
    if (!date || !clear) return;
    // Presence of a matching row in the list
    const marked = !!document.querySelector(`[data-flex="${date}"]`);
    clear.hidden = !marked;
  }

  if ($('flex-holiday')) {
    $('flex-holiday').addEventListener('change', () => {
      const opt = $('flex-holiday').selectedOptions[0];
      if (opt && opt.dataset.date) {
        $('flex-date').value = opt.dataset.date;
        if (!$('flex-label').value) $('flex-label').value = opt.textContent.replace(/\s*\(.*\)$/, '');
      }
      syncFlexFormForDate();
    });
  }
  if ($('flex-date')) $('flex-date').addEventListener('change', syncFlexFormForDate);
  document.querySelectorAll('input[name="flex-est"]').forEach((r) => r.addEventListener('change', () => {
    $('flex-add-row').hidden = r.value === 'none' && document.querySelector('input[name="flex-est"]:checked').value === 'none';
    const v = document.querySelector('input[name="flex-est"]:checked').value;
    $('flex-add-row').hidden = v === 'none';
  }));

  if ($('btn-flex-save')) {
    $('btn-flex-save').addEventListener('click', async () => {
      const estimate = (document.querySelector('input[name="flex-est"]:checked') || {}).value || 'none';
      const body = {
        date: $('flex-date').value,
        label: $('flex-label').value.trim(),
        holidayKey: $('flex-holiday').value || '',
        estimate
      };
      const custom = $('flex-add-kcal').value;
      if (custom !== '') body.addKcal = Number(custom);
      try {
        await api('/flex-days', { method: 'POST', body: JSON.stringify(body) });
        toast('Flex day marked — streak safe, left out of calorie average');
        loadFlex();
        if (window.Account) window.Account.loadStreak();
        if (typeof loadDashboard === 'function') loadDashboard();
      } catch (err) { toast(err.message); }
    });
  }
  if ($('btn-flex-clear')) {
    $('btn-flex-clear').addEventListener('click', async () => {
      const date = $('flex-date').value;
      if (!date) return;
      try {
        await api('/flex-days/' + date, { method: 'DELETE' });
        toast('Flex day removed');
        loadFlex();
        if (window.Account) window.Account.loadStreak();
      } catch (err) { toast(err.message); }
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
  const prev = window.Account && window.Account.loadStreak;
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { loadFlex(); loadSport(); }, 800);
  });
})();
