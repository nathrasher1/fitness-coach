// Event calendar, results, recap, weight-class status, and readiness check-ins.
(function () {
  let presets = null;
  let draftKind = 'generic';

  const SLEEP_HINT = ['Poor', 'Great'];
  const SORE_HINT = ['None', 'Severe'];
  const MOOD_HINT = ['Low', 'Great'];
  const ENERGY_HINT = ['Low', 'High'];

  async function loadPresets() {
    if (presets) return presets;
    try { presets = await api('/events/presets'); } catch { presets = { types: [], sports: [], resultKinds: [], lifts: [], matchMethods: [] }; }
    return presets;
  }

  function classFromInput(val) {
    if (val == null || val === '') return '';
    const n = typeof fromInputWeight === 'function' ? fromInputWeight(val) : parseFloat(val);
    return Number.isFinite(n) ? n : '';
  }

  function classToDisplay(lbs) {
    if (lbs == null || lbs === '') return '';
    if (typeof settings !== 'undefined' && settings.unit === 'kg') return (Number(lbs) / 2.20462).toFixed(1);
    return Number(lbs).toFixed(1);
  }

  function typeLabel(key) {
    const t = (presets && presets.types || []).find((x) => x.key === key);
    return t ? t.label : key;
  }

  function renderWcBanner(plan) {
    if (!plan || !plan.ok) return plan && plan.error ? `<div class="wc-banner blocked">${esc(plan.error)}</div>` : '';
    const cls = plan.status || '';
    return `<div class="wc-banner ${esc(cls)}">${esc(plan.message)}</div>`;
  }

  function eventLine(ev) {
    const when = [ev.countdown && ev.countdown.label, ev.date, ev.time].filter(Boolean).join(' · ');
    const where = ev.place ? ` · ${ev.place}` : '';
    return `${ev.name} · ${ev.sport} · ${typeLabel(ev.type)} · ${when}${where}`;
  }

  async function refreshHome() {
    const card = document.getElementById('next-event-card');
    const body = document.getElementById('next-event-body');
    const readyBox = document.getElementById('readiness-today');
    if (!card || !body) return;
    try {
      const data = await api('/events/upcoming');
      presets = data.presets || presets;
      const ev = data.next;
      if (!ev) {
        body.innerHTML = '<p class="hint">Add a meet, game, race, or match to see a countdown here. Competition days count toward your streak.</p>';
      } else {
        const plan = ev.weightClassPlan;
        body.innerHTML = `
          <div class="event-countdown">${esc(ev.countdown && ev.countdown.label || ev.date)}</div>
          <p class="event-countdown-meta"><strong>${esc(ev.name)}</strong> · ${esc(ev.sport)} · ${esc(typeLabel(ev.type))}${ev.place ? ' · ' + esc(ev.place) : ''}</p>
          <p class="hint">${esc(ev.date)}${ev.time ? ' at ' + esc(ev.time) : ''}${ev.weightClassLbs ? ' · Class ' + esc(typeof toDisplayWeight === 'function' ? toDisplayWeight(ev.weightClassLbs) : ev.weightClassLbs + ' lbs') : ''}</p>
          ${plan ? renderWcBanner(plan) : ''}
          <div class="card-actions" style="margin-top:12px">
            <button type="button" class="btn btn-primary btn-block" id="next-event-open">Open event</button>
          </div>`;
        const open = document.getElementById('next-event-open');
        if (open) open.addEventListener('click', () => openEventSheet({ event: ev }));
      }
      if (readyBox) renderReadinessEditor(readyBox, data.today, data.readinessToday);
    } catch (e) {
      body.innerHTML = '<p class="hint">Could not load upcoming events.</p>';
    }
  }

  function scaleRow(id, label, hints, value) {
    const buttons = [1, 2, 3, 4, 5].map((n) =>
      `<button type="button" data-ready-field="${id}" data-n="${n}" class="${Number(value) === n ? 'on' : ''}">${n}</button>`
    ).join('');
    return `<div class="readiness-row">
      <label>${esc(label)}</label>
      <div class="readiness-scale-hint"><span>${esc(hints[0])}</span><span>${esc(hints[1])}</span></div>
      <div class="readiness-scale">${buttons}</div>
    </div>`;
  }

  function renderReadinessEditor(el, date, log) {
    if (!el) return;
    const cur = log || {};
    el.dataset.date = date;
    el.innerHTML = `
      <div class="readiness-grid">
        ${scaleRow('sleep', 'Sleep', SLEEP_HINT, cur.sleep)}
        ${scaleRow('soreness', 'Soreness', SORE_HINT, cur.soreness)}
        ${scaleRow('mood', 'Mood', MOOD_HINT, cur.mood)}
        ${scaleRow('energy', 'Energy', ENERGY_HINT, cur.energy)}
      </div>
      <button type="button" class="btn btn-secondary btn-block" id="btn-save-readiness" style="margin-top:12px">Save check-in</button>`;
    const picked = {
      sleep: cur.sleep || null,
      soreness: cur.soreness || null,
      mood: cur.mood || null,
      energy: cur.energy || null
    };
    el.querySelectorAll('[data-ready-field]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.readyField;
        const n = Number(btn.dataset.n);
        picked[field] = picked[field] === n ? null : n;
        el.querySelectorAll(`[data-ready-field="${field}"]`).forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === picked[field]));
      });
    });
    const save = el.querySelector('#btn-save-readiness');
    if (save) save.addEventListener('click', async () => {
      try {
        if (!picked.sleep && !picked.soreness && !picked.mood && !picked.energy) {
          toast('Tap at least one rating');
          return;
        }
        await api(`/readiness/${date}`, { method: 'PUT', body: JSON.stringify(picked) });
        toast('Check-in saved');
      } catch (err) { toast(err.message || 'Could not save'); }
    });
  }

  async function markCalendar(grid, from, to) {
    if (!grid) return;
    try {
      const data = await api(`/events?from=${from}&to=${to}`);
      (data.events || []).forEach((ev) => {
        const el = grid.querySelector(`[data-date="${ev.date}"]`);
        if (!el) return;
        el.classList.add('has-event');
        if (!el.querySelector('.cal-event')) el.insertAdjacentHTML('beforeend', '<span class="cal-event" title="Event" aria-label="Has event"></span>');
      });
    } catch (e) { /* calendar still works without marks */ }
  }

  function daySectionHtml(date, events, ready) {
    const list = events || [];
    const rows = list.length
      ? `<div class="event-list">${list.map((ev) => `<button type="button" class="event-row" data-open-event="${esc(ev.id)}"><strong>${esc(ev.name)}</strong><span class="hint">${esc(ev.sport)} · ${esc(typeLabel(ev.type))}${ev.time ? ' · ' + esc(ev.time) : ''}${ev.hasResult ? ' · Result logged' : ''}</span></button>`).join('')}</div>`
      : '<div class="empty">No events this day.</div>';
    const readyLine = ready
      ? `<p class="hint">Readiness: sleep ${ready.sleep ?? '—'}, soreness ${ready.soreness ?? '—'}, mood ${ready.mood ?? '—'}, energy ${ready.energy ?? '—'}</p>`
      : '<p class="hint">No readiness check-in this day. You can log one from Home.</p>';
    return `<div class="day-section">
      <button class="day-section-toggle" data-sec="ev">Events${list.length ? ` <em class="day-count">${list.length}</em>` : ''} <span>${list.length ? '▾' : '▸'}</span></button>
      <div class="day-section-body ${list.length ? 'open' : ''}" id="day-ev">
        ${rows}
        ${readyLine}
        <button type="button" class="btn btn-secondary btn-block" data-add-event-date="${esc(date)}" style="margin-top:8px">Add event</button>
      </div>
    </div>`;
  }

  function bindDaySection(root, date) {
    if (!root) return;
    root.querySelectorAll('[data-open-event]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const ev = await api(`/events/${btn.dataset.openEvent}`);
          openEventSheet({ event: ev });
        } catch (err) { toast(err.message || 'Could not open event'); }
      });
    });
    root.querySelectorAll('[data-add-event-date]').forEach((btn) => {
      btn.addEventListener('click', () => openEventSheet({ date: btn.dataset.addEventDate || date }));
    });
  }

  function closeEventSheet() {
    const sheet = document.getElementById('event-sheet');
    if (!sheet) return;
    sheet.hidden = true;
    sheet.innerHTML = '';
    const food = document.getElementById('food-sheet');
    const wo = document.getElementById('wo-sheet');
    const lb = document.getElementById('photo-lightbox');
    const edit = document.getElementById('food-edit-sheet');
    const diary = document.getElementById('diary-wo-sheet');
    if ((food && !food.hidden) || (wo && !wo.hidden) || (lb && !lb.hidden) || (edit && !edit.hidden) || (diary && !diary.hidden)) return;
    document.body.classList.remove('sheet-open');
  }

  function options(list, value, labelFn) {
    return (list || []).map((item) => {
      const key = item.key || item;
      const label = labelFn ? labelFn(item) : (item.label || item);
      return `<option value="${esc(key)}" ${String(value) === String(key) ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
  }

  function attemptVal(attempts, lift, n, field) {
    const row = (attempts || []).find((a) => a.lift === lift && Number(a.attempt) === n);
    if (!row) return '';
    if (field === 'weightLbs') return row.weightLbs == null ? '' : classToDisplay(row.weightLbs);
    return row[field] || '';
  }

  function resultFields(kind, ev) {
    const r = (ev && ev.result) || {};
    const generic = `
      <div class="grid-2">
        <div class="form-row"><label for="ev-place">Place</label><input type="text" id="ev-place" maxlength="40" value="${esc(r.place || '')}" /></div>
        <div class="form-row"><label for="ev-outcome">Outcome</label><select id="ev-outcome">
          <option value="">—</option>
          <option value="win" ${r.outcome === 'win' ? 'selected' : ''}>Win</option>
          <option value="loss" ${r.outcome === 'loss' ? 'selected' : ''}>Loss</option>
          <option value="draw" ${r.outcome === 'draw' ? 'selected' : ''}>Draw</option>
          <option value="other" ${r.outcome === 'other' ? 'selected' : ''}>Other</option>
        </select></div>
      </div>
      <div class="form-row"><label for="ev-score">Score or time</label><input type="text" id="ev-score" maxlength="40" value="${esc(r.score || '')}" /></div>`;
    if (kind === 'lifting') {
      const lifts = (presets && presets.lifts) || [];
      const rows = lifts.map((lift) => {
        const cells = [1, 2, 3].map((n) => {
          const w = attemptVal(r.attempts, lift.key, n, 'weightLbs');
          const o = attemptVal(r.attempts, lift.key, n, 'outcome') || 'skip';
          return `<td><input type="text" inputmode="decimal" data-att-lift="${lift.key}" data-att-n="${n}" data-att-field="weight" value="${esc(w)}" placeholder="${n}" /><select data-att-lift="${lift.key}" data-att-n="${n}" data-att-field="outcome">
            <option value="skip" ${o === 'skip' ? 'selected' : ''}>Skip</option>
            <option value="good" ${o === 'good' ? 'selected' : ''}>Good</option>
            <option value="no-lift" ${o === 'no-lift' ? 'selected' : ''}>No-lift</option>
          </select></td>`;
        }).join('');
        return `<tr><th>${esc(lift.label)}</th>${cells}</tr>`;
      }).join('');
      return `${generic}<div class="form-row"><label>Attempts</label>
        <table class="attempt-table"><thead><tr><th></th><th>1</th><th>2</th><th>3</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="hint">Best good attempt of each lift makes the total. Weights are in ${typeof settings !== 'undefined' && settings.unit === 'kg' ? 'kg' : 'lbs'}.</p>
      </div>`;
    }
    if (kind === 'race') {
      const splits = (r.splits && r.splits.length ? r.splits : [{ label: '', timeSec: null }, { label: '', timeSec: null }]);
      const splitRows = splits.map((s, i) => `<div class="split-row">
        <input type="text" data-split-label="${i}" placeholder="Split label" value="${esc(s.label || '')}" />
        <input type="text" data-split-time="${i}" placeholder="mm:ss" value="${esc(s.timeSec != null ? formatSplit(s.timeSec) : '')}" />
        <span class="hint">#${i + 1}</span>
      </div>`).join('');
      return `${generic}
        <div class="grid-2">
          <div class="form-row"><label for="ev-distance">Distance</label><input type="text" id="ev-distance" maxlength="40" value="${esc(r.distance || '')}" placeholder="e.g. 5K" /></div>
          <div class="form-row"><label for="ev-race-time">Finish time</label><input type="text" id="ev-race-time" value="${esc(r.timeSec != null ? formatSplit(r.timeSec) : '')}" placeholder="mm:ss or h:mm:ss" /></div>
        </div>
        <div class="form-row"><label>Splits</label>${splitRows}</div>`;
    }
    if (kind === 'match') {
      return `${generic}
        <div class="grid-2">
          <div class="form-row"><label for="ev-method">Method</label><select id="ev-method"><option value="">—</option>${options(presets && presets.matchMethods, r.method)}</select></div>
          <div class="form-row"><label for="ev-opponent">Opponent</label><input type="text" id="ev-opponent" maxlength="80" value="${esc(r.opponent || '')}" /></div>
        </div>`;
    }
    return generic;
  }

  function formatSplit(sec) {
    const s = Number(sec);
    if (!Number.isFinite(s) || s < 0) return '';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = Math.round(s - h * 3600 - m * 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(rem)}` : `${m}:${pad(rem)}`;
  }

  function readinessChart(rows) {
    if (!rows || !rows.length) return '<p class="hint">No readiness check-ins in the week leading in.</p>';
    const avg = (r) => {
      const vals = [r.sleep, r.mood, r.energy].filter((v) => v != null);
      if (r.soreness != null) vals.push(6 - r.soreness); // invert so higher is better
      if (!vals.length) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return `<div class="readiness-chart" aria-label="Readiness, week leading in">${rows.map((r) => {
      const v = avg(r);
      const h = Math.max(4, Math.round((v / 5) * 60));
      const lbl = (r.date || '').slice(5);
      return `<div class="readiness-bar" title="${esc(r.date)}"><i style="height:${h}px"></i>${esc(lbl)}</div>`;
    }).join('')}</div>`;
  }

  function recapHtml(data) {
    if (!data || !data.recap) return '';
    const recap = data.recap;
    const lead = recap.leadIn || {};
    const prev = recap.previous;
    const stats = [
      ['Workouts', lead.workouts ? String(lead.workouts) : '—'],
      ['Practice load', lead.trainingLoad ? String(lead.trainingLoad) : '—'],
      ['Weight change', lead.weightChangeLbs == null ? '—' : ((lead.weightChangeLbs > 0 ? '+' : '') + lead.weightChangeLbs + ' lbs')],
      ['Avg calories', lead.avgCalories != null ? String(lead.avgCalories) : '—']
    ];
    const compare = prev
      ? `<div class="recap-compare"><strong>Compared with ${esc(prev.event.name)}</strong> (${esc(prev.event.date)})<p class="hint" style="margin:6px 0 0">${esc(prev.summary || 'Log a result on both events to compare them.')}</p></div>`
      : '<p class="hint">No earlier event of the same sport or type to compare with yet.</p>';
    return `<div class="form-row" id="ev-recap-block">
      <h3 style="margin:16px 0 6px;font-size:16px">Recap</h3>
      ${compare}
      <div class="recap-stats">${stats.map(([l, v]) => `<div class="stat"><div class="value">${esc(v)}</div><div class="label">${esc(l)}</div></div>`).join('')}</div>
      <p class="hint">Readiness in the week leading in</p>
      ${readinessChart(lead.readiness)}
    </div>`;
  }

  function collectResult(kind) {
    const body = {
      kind,
      place: (document.getElementById('ev-place') || {}).value || '',
      outcome: (document.getElementById('ev-outcome') || {}).value || '',
      score: (document.getElementById('ev-score') || {}).value || '',
      notes: (document.getElementById('ev-result-notes') || {}).value || ''
    };
    if (kind === 'lifting') {
      body.attempts = [];
      document.querySelectorAll('#event-sheet [data-att-field="weight"]').forEach((inp) => {
        const lift = inp.dataset.attLift;
        const attempt = Number(inp.dataset.attN);
        const outcomeEl = document.querySelector(`#event-sheet [data-att-lift="${lift}"][data-att-n="${attempt}"][data-att-field="outcome"]`);
        const weightRaw = inp.value;
        let weightLbs = null;
        if (weightRaw !== '') weightLbs = classFromInput(weightRaw);
        body.attempts.push({ lift, attempt, weightLbs, outcome: (outcomeEl && outcomeEl.value) || 'skip' });
      });
    } else if (kind === 'race') {
      body.distance = (document.getElementById('ev-distance') || {}).value || '';
      body.time = (document.getElementById('ev-race-time') || {}).value || '';
      body.splits = [];
      document.querySelectorAll('#event-sheet [data-split-label]').forEach((inp) => {
        const i = inp.dataset.splitLabel;
        const timeEl = document.querySelector(`#event-sheet [data-split-time="${i}"]`);
        body.splits.push({ label: inp.value, time: timeEl ? timeEl.value : '' });
      });
    } else if (kind === 'match') {
      body.method = (document.getElementById('ev-method') || {}).value || '';
      body.opponent = (document.getElementById('ev-opponent') || {}).value || '';
    }
    return body;
  }

  function collectEvent() {
    const sport = document.getElementById('ev-sport').value;
    return {
      name: document.getElementById('ev-name').value,
      sport,
      customSport: (document.getElementById('ev-sport-custom') || {}).value || '',
      type: document.getElementById('ev-type').value,
      date: document.getElementById('ev-date').value,
      time: document.getElementById('ev-time').value,
      place: document.getElementById('ev-place-name').value,
      notes: document.getElementById('ev-notes').value,
      resultKind: document.getElementById('ev-result-kind').value,
      weightClassLbs: classFromInput(document.getElementById('ev-class').value) || '',
      weighInDate: document.getElementById('ev-weighin').value
    };
  }

  function syncCustomSport() {
    const sport = document.getElementById('ev-sport');
    const row = document.getElementById('ev-sport-custom-row');
    if (row && sport) row.hidden = sport.value !== 'Other';
  }

  function paintResult() {
    const kind = document.getElementById('ev-result-kind').value;
    draftKind = kind;
    const box = document.getElementById('ev-result-fields');
    const ev = box && box._event;
    if (box) box.innerHTML = resultFields(kind, ev);
    const notes = document.getElementById('ev-result-notes-wrap');
    if (notes) notes.hidden = false;
  }

  async function openEventSheet({ event, date } = {}) {
    await loadPresets();
    const sheet = document.getElementById('event-sheet');
    if (!sheet) return;
    const ev = event || null;
    draftKind = (ev && ev.resultKind) || 'generic';
    const today = typeof todayStr === 'function' ? todayStr() : '';
    const startDate = (ev && ev.date) || date || today;
    const unit = (typeof settings !== 'undefined' && settings.unit === 'kg') ? 'kg' : 'lbs';
    sheet.innerHTML = `
      <div class="sheet event-sheet" role="dialog" aria-modal="true" aria-labelledby="event-sheet-title">
        <div class="sheet-grip" aria-hidden="true"></div>
        <div class="sheet-head">
          <div>
            <div class="summary-kicker">${ev ? 'Event' : 'New event'}</div>
            <h2 id="event-sheet-title" class="food-sheet-title">${ev ? esc(ev.name) : 'Add event'}</h2>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-sheet-close aria-label="Close">✕</button>
        </div>
        <div class="form-row"><label for="ev-name">Name</label><input type="text" id="ev-name" maxlength="120" value="${esc(ev ? ev.name : '')}" placeholder="Winter Open, dual meet, 5K…" /></div>
        <div class="grid-2">
          <div class="form-row"><label for="ev-sport">Sport</label><select id="ev-sport">${options(presets.sports, ev ? ev.sport : '')}</select></div>
          <div class="form-row"><label for="ev-type">Type</label><select id="ev-type">${options(presets.types, ev ? ev.type : 'meet')}</select></div>
        </div>
        <div class="form-row" id="ev-sport-custom-row" hidden><label for="ev-sport-custom">Sport name</label><input type="text" id="ev-sport-custom" maxlength="80" value="${esc(ev && !(presets.sports.includes(ev.sport)) ? ev.sport : '')}" /></div>
        <div class="grid-2">
          <div class="form-row"><label for="ev-date">Date</label><input type="date" id="ev-date" value="${esc(startDate)}" /></div>
          <div class="form-row"><label for="ev-time">Time (optional)</label><input type="time" id="ev-time" value="${esc(ev && ev.time ? ev.time : '')}" /></div>
        </div>
        <div class="form-row"><label for="ev-place-name">Place (optional)</label><input type="text" id="ev-place-name" maxlength="120" value="${esc(ev ? ev.place : '')}" /></div>
        <div class="form-row"><label for="ev-notes">Notes</label><textarea id="ev-notes" maxlength="500" rows="2">${esc(ev ? ev.notes : '')}</textarea></div>
        <h3 style="margin:16px 0 6px;font-size:16px">Weight class (optional)</h3>
        <p class="hint">We never suggest a crash cut or dehydration. Members under 18 don't get cutting guidance. If the gap is too large for the time left, planning is blocked.</p>
        <div class="grid-2">
          <div class="form-row"><label for="ev-class">Class (${esc(unit)})</label><input type="text" inputmode="decimal" id="ev-class" value="${esc(ev && ev.weightClassLbs ? classToDisplay(ev.weightClassLbs) : '')}" /></div>
          <div class="form-row"><label for="ev-weighin">Weigh-in date</label><input type="date" id="ev-weighin" value="${esc(ev && ev.weighInDate ? ev.weighInDate : '')}" /></div>
        </div>
        <div id="ev-wc-banner">${ev && ev.weightClassPlan ? renderWcBanner(ev.weightClassPlan) : ''}</div>
        <h3 style="margin:16px 0 6px;font-size:16px">Result</h3>
        <div class="form-row"><label for="ev-result-kind">Result template</label><select id="ev-result-kind">${options(presets.resultKinds, draftKind)}</select></div>
        <div id="ev-result-fields"></div>
        <div class="form-row" id="ev-result-notes-wrap"><label for="ev-result-notes">Result notes</label><textarea id="ev-result-notes" maxlength="500" rows="2">${esc(ev && ev.result ? (ev.result.notes || '') : '')}</textarea></div>
        <div id="ev-recap"></div>
        <div class="card-actions" style="margin-top:16px">
          <button type="button" class="btn btn-primary btn-block" id="btn-save-event">${ev ? 'Save event' : 'Add event'}</button>
          <button type="button" class="btn btn-secondary btn-block" id="btn-save-result" ${ev ? '' : 'hidden'}>Save result</button>
          <button type="button" class="link-btn" id="btn-delete-event" ${ev ? '' : 'hidden'} style="margin-top:8px">Delete event</button>
        </div>
      </div>`;
    const fields = document.getElementById('ev-result-fields');
    if (fields) fields._event = ev;
    // If the sport isn't in the list, select Other and show custom.
    const sportSel = document.getElementById('ev-sport');
    if (ev && ev.sport && sportSel && ![...sportSel.options].some((o) => o.value === ev.sport)) {
      sportSel.value = 'Other';
      document.getElementById('ev-sport-custom').value = ev.sport;
    }
    syncCustomSport();
    paintResult();
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    sheet.onclick = (e) => { if (e.target === sheet || e.target.closest('[data-sheet-close]')) closeEventSheet(); };
    sportSel.addEventListener('change', syncCustomSport);
    document.getElementById('ev-result-kind').addEventListener('change', paintResult);
    document.getElementById('ev-sport').addEventListener('change', () => {
      const inferred = inferKindClient(document.getElementById('ev-sport').value, document.getElementById('ev-type').value);
      const kindSel = document.getElementById('ev-result-kind');
      if (kindSel && !ev) { kindSel.value = inferred; paintResult(); }
    });
    document.getElementById('ev-type').addEventListener('change', () => {
      const inferred = inferKindClient(document.getElementById('ev-sport').value, document.getElementById('ev-type').value);
      const kindSel = document.getElementById('ev-result-kind');
      if (kindSel && !ev) { kindSel.value = inferred; paintResult(); }
    });
    document.getElementById('btn-save-event').addEventListener('click', async () => {
      try {
        const payload = collectEvent();
        const saved = ev
          ? await api(`/events/${ev.id}`, { method: 'PUT', body: JSON.stringify(payload) })
          : await api('/events', { method: 'POST', body: JSON.stringify(payload) });
        toast(ev ? 'Event saved' : 'Event added');
        if (window.Account) window.Account.loadStreak();
        refreshHome();
        if (typeof loadCalendar === 'function') loadCalendar();
        closeEventSheet();
        openEventSheet({ event: saved });
      } catch (err) { toast(err.message || 'Could not save event'); }
    });
    document.getElementById('btn-save-result').addEventListener('click', async () => {
      if (!ev) return;
      try {
        const kind = document.getElementById('ev-result-kind').value;
        const saved = await api(`/events/${ev.id}/result`, { method: 'PUT', body: JSON.stringify(collectResult(kind)) });
        toast('Result saved');
        closeEventSheet();
        openEventSheet({ event: saved });
      } catch (err) { toast(err.message || 'Could not save result'); }
    });
    const del = document.getElementById('btn-delete-event');
    if (del) del.addEventListener('click', async () => {
      if (!ev || !confirm('Delete this event?')) return;
      try {
        await api(`/events/${ev.id}`, { method: 'DELETE' });
        toast('Event deleted');
        if (window.Account) window.Account.loadStreak();
        refreshHome();
        if (typeof loadCalendar === 'function') loadCalendar();
        if (typeof showDayDetail === 'function' && ev.date) showDayDetail(ev.date, { openSection: 'ev' });
        closeEventSheet();
      } catch (err) { toast(err.message || 'Could not delete'); }
    });
    if (ev && ev.date && today && ev.date <= today) {
      api(`/events/${ev.id}/recap`).then((data) => {
        const box = document.getElementById('ev-recap');
        if (box) box.innerHTML = recapHtml(data);
      }).catch(() => {});
    }
  }

  function inferKindClient(sport, type) {
    const t = String(type || '').toLowerCase();
    const s = String(sport || '').toLowerCase();
    if (t === 'race') return 'race';
    if (t === 'match') return 'match';
    if (/powerlift|olympic|weightlifting|weight ?lift|strongman/.test(s)) return 'lifting';
    if (/run|swim|cycl|triath|track|marathon|cross.?country|row|hyrox/.test(s)) return 'race';
    if (/wrestl|bjj|jiu|judo|box|mma|martial|sambo|muay|kick/.test(s)) return 'match';
    return 'generic';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const addHome = document.getElementById('next-event-add');
    const addCal = document.getElementById('cal-add-event');
    if (addHome) addHome.addEventListener('click', () => openEventSheet({}));
    if (addCal) addCal.addEventListener('click', () => openEventSheet({}));
    document.addEventListener('keydown', (e) => {
      const sheet = document.getElementById('event-sheet');
      if (e.key === 'Escape' && sheet && !sheet.hidden) closeEventSheet();
    });
  });

  window.Events = { refreshHome, markCalendar, daySectionHtml, bindDaySection, openEventSheet, closeEventSheet };
})();
