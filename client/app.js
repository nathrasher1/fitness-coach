// ========== State ==========
let currentUser = null;
let settings = { unit: 'lbs', calAvgDays: 14, interests: [] };
let selectedFood = null;
let currentPeriodDays = 7;

// ========== Helpers ==========
// Sent on every API call so the server uses the user's calendar day, not UTC.
function localDateHeaders() {
  return { 'X-Local-Date': todayStr(), 'X-TZ-Offset': String(new Date().getTimezoneOffset()) };
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...localDateHeaders(), ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.code = data.code; err.status = res.status; err.data = data;
    // The account needs its one-time details (or is locked): show that screen.
    if (res.status === 403 && (data.code === 'account_incomplete' || data.code === 'account_locked') && !path.startsWith('/auth/') && window.Account) window.Account.gate(data);
    throw err;
  }
  return data;
}

// Date keys ('YYYY-MM-DD') are always the user's LOCAL calendar day.
// (toISOString() is UTC and rolls over to tomorrow in the evening in the Americas.)
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() {
  return dateKey(new Date());
}

function formatDate(str) {
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function toDisplayWeight(w) {
  if (w == null) return '—';
  if (settings.unit === 'kg') return (w / 2.20462).toFixed(1) + ' kg';
  return Number(w).toFixed(1) + ' lbs';
}

function fromInputWeight(val) {
  if (settings.unit === 'kg') return parseFloat(val) * 2.20462;
  return parseFloat(val);
}

// ========== Auth ==========
// Signed in: show the app, or the one-time details / locked screen first.
async function enterApp(user, opts = {}) {
  currentUser = user;
  if (window.Account && window.Account.needsGate(user)) return window.Account.showGate(user);
  showApp();
  await loadSettings();
  renderAll();
  restoreWorkoutDraft();
  if (window.Account) { window.Account.loadStreak(); window.Account.applyLimits(); }
  if (window.AboutYouUI) window.AboutYouUI.init({ justRegistered: !!opts.justRegistered });
}

async function checkAuth() {
  let data;
  try { data = await api('/auth/me'); } catch { return showAuth(); }
  await enterApp(data.user);
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  const dt = document.getElementById('draft-toast'); if (dt) dt.hidden = true;
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('header-user').textContent = currentUser.displayName || currentUser.username;
  paintAvatar(document.getElementById('header-avatar'), currentUser);
  paintAvatar(document.getElementById('profile-avatar'), currentUser);
  renderAvatarPresets();
  setTimeout(() => window.Social && window.Social.loadUnread(), 0);
}

document.getElementById('tab-login').addEventListener('click', () => {
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-register').classList.remove('active');
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
});

document.getElementById('tab-register').addEventListener('click', () => {
  document.getElementById('tab-register').classList.add('active');
  document.getElementById('tab-login').classList.remove('active');
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('login-form').style.display = 'none';
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
      })
    });
    document.getElementById('login-password').value = '';
    await enterApp(data.user);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('reg-username').value,
        displayName: document.getElementById('reg-displayname').value,
        password: document.getElementById('reg-password').value,
        email: document.getElementById('reg-email').value.trim(),
        dob: document.getElementById('reg-dob').value
      })
    });
    document.getElementById('reg-password').value = '';
    await enterApp(data.user, { justRegistered: true });
  } catch (err) {
    if (err.code === 'under_13' && window.Account) return window.Account.showUnder13(err.message);
    errEl.textContent = err.message;
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  flushDraft();
  await api('/auth/logout', { method: 'POST' });
  draftReady = false; draftCheckedFor = null; draftHasSaved = false;
  currentWorkoutExercises = []; woPlanDay = ''; woEditing = null;
  stopWorkoutTimer(); stopRest(false); renderWorkoutExercises();
  currentUser = null;
  ['notif-count', 'people-badge'].forEach((id) => { document.getElementById(id).hidden = true; });
  if (window.Social) window.Social.closeSheet();
  showAuth();
});

// ========== Navigation ==========
document.getElementById('main-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#main-nav button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(btn.dataset.panel).classList.add('active');

  if (btn.dataset.panel === 'food') {
    loadFoodLog();
    loadQuickAdd();
  }
  if (btn.dataset.panel === 'recipes') loadRecipes();
  if (btn.dataset.panel === 'weight') loadWeightHistory();
  if (btn.dataset.panel === 'goals') loadGoal();
  if (btn.dataset.panel === 'calendar') loadCalendar();
  if (btn.dataset.panel === 'workouts') {
    loadPlans();
    loadWorkoutHistory();
    renderWorkoutExercises();
    renderRecommendedLifts();
    if (!document.getElementById('wo-date').value) {
      document.getElementById('wo-date').value = todayStr();
    }
  }
  if (btn.dataset.panel === 'body') {
    loadBodyMetrics();
    loadProgressPhotos();
    if (!document.getElementById('bm-date').value) {
      document.getElementById('bm-date').value = todayStr();
    }
  }
  if (btn.dataset.panel === 'settings') { loadShares(); window.Social && window.Social.loadPrivacy(); }
  if (btn.dataset.panel === 'people') window.Social && window.Social.loadPeople();
});

document.getElementById('nav-toggle').addEventListener('click', () => {
  const nav = document.getElementById('main-nav');
  const open = nav.classList.toggle('open');
  document.getElementById('nav-toggle').textContent = open ? '×' : '☰';
});
document.getElementById('main-nav').addEventListener('click', (e) => {
  if (e.target.closest('button')) {
    document.getElementById('main-nav').classList.remove('open');
    document.getElementById('nav-toggle').textContent = '☰';
  }
});
document.getElementById('avg-period-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#avg-period-tabs button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentPeriodDays = parseInt(btn.dataset.days, 10);
  loadDashboard();
});

// ========== Settings ==========
// Grouped activity catalog lives in lib/activities.js (shared with the server's program matching).
const ACT = window.Activities;

function renderInterestChecks() {
  const box = document.getElementById('interest-groups');
  if (!box) return;
  const saved = settings.interests || [];
  const on = new Set(saved.map((n) => (ACT.lookup(n) || { name: n }).name.toLowerCase()));
  const groups = ACT.GROUPS.map((g) => ({ label: g.label, items: g.items.map((x) => x[0]) }));
  // Saved interests that are not in the catalog (older free-form or retired items) stay visible and checked.
  const extra = [...new Set(saved.filter((n) => !ACT.lookup(n)))];
  if (extra.length) groups.push({ label: 'Your other interests', items: extra });
  box.innerHTML = groups.map((g) => {
    const count = g.items.filter((n) => on.has(n.toLowerCase())).length;
    return `<details class="interest-group" data-has="${count ? 1 : 0}" >
      <summary><span class="interest-group-name">${esc(g.label)}</span><span class="interest-count">${count ? count + ' on' : g.items.length}</span></summary>
      <div class="interest-chips">${g.items.map((n) => `<label class="interest-chip" data-name="${esc(n.toLowerCase())}">
        <input type="checkbox" class="interest-check" value="${esc(n)}" ${on.has(n.toLowerCase()) ? 'checked' : ''} /><span>${esc(n)}</span></label>`).join('')}</div>
    </details>`;
  }).join('') + '<div class="empty" id="interest-none" hidden>No activity matches that search.</div>';
  const search = document.getElementById('interest-search');
  if (search) search.value = '';
  updateInterestSummary();
}

function updateInterestSummary() {
  const box = document.getElementById('interest-groups');
  const sel = document.getElementById('interest-selected');
  if (!box) return;
  box.querySelectorAll('.interest-group').forEach((g) => {
    const n = g.querySelectorAll('.interest-check:checked').length;
    const total = g.querySelectorAll('.interest-check').length;
    g.querySelector('.interest-count').textContent = n ? `${n} on` : String(total);
    g.dataset.has = n ? 1 : 0;
  });
  if (!sel) return;
  const names = selectedInterests();
  sel.innerHTML = names.length
    ? `<span class="hint">${names.length} selected</span>` + names.map((n) => `<button type="button" class="chip chip-on" data-unpick="${esc(n)}">${esc(n)} <span aria-hidden="true">×</span><span class="sr-only">Remove</span></button>`).join('')
    : '<span class="hint">Nothing selected yet.</span>';
}

function filterInterests(q) {
  const box = document.getElementById('interest-groups');
  if (!box) return;
  const needle = q.trim().toLowerCase();
  let any = false;
  box.querySelectorAll('.interest-group').forEach((g) => {
    const groupHit = needle && g.querySelector('.interest-group-name').textContent.toLowerCase().includes(needle);
    let shown = 0;
    g.querySelectorAll('.interest-chip').forEach((c) => {
      const hit = !needle || groupHit || c.dataset.name.includes(needle);
      c.hidden = !hit;
      if (hit) shown++;
    });
    g.hidden = !shown;
    if (shown) any = true;
    g.open = needle ? shown > 0 : false;
  });
  const none = document.getElementById('interest-none');
  if (none) none.hidden = any;
}

document.getElementById('interest-search')?.addEventListener('input', (e) => filterInterests(e.target.value));
document.getElementById('interest-groups')?.addEventListener('change', (e) => {
  if (e.target.classList.contains('interest-check')) updateInterestSummary();
});
document.getElementById('interest-selected')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-unpick]');
  if (!b) return;
  document.querySelectorAll('.interest-check').forEach((c) => { if (c.value === b.dataset.unpick) c.checked = false; });
  updateInterestSummary();
});

/** Selected activities on the Workouts page (multi-select). Starts empty → no suggestions. */
function selectedProgramActivities() {
  return [...document.querySelectorAll('#wo-program-activities .wo-act-check:checked')].map((c) => c.value);
}

function updateActivitiesSummary() {
  const el = document.getElementById('wo-activities-summary');
  if (!el) return;
  const acts = selectedProgramActivities();
  const days = selectedDaysPerWeek();
  const dayBit = days ? `, ${days} days/week` : '';
  if (!acts.length) {
    el.textContent = 'No activities selected yet' + (days ? ` · filtering ${days} days/week` : '') + '.';
    return;
  }
  const labels = acts.map((a) => ACT.ARCHETYPES[a]?.label || a);
  el.textContent = labels.length === 1
    ? `Selected: ${labels[0]}${dayBit}`
    : `Selected: ${labels.length} activities (${labels.slice(0, 3).join(', ')}${labels.length > 3 ? '…' : ''})${dayBit}`;
}

/** Days/week filter from the Select activities sheet (null = any). */
function selectedDaysPerWeek() {
  const el = document.querySelector('#wo-days-filter input[name="wo-days"]:checked');
  if (!el || !el.value) return null;
  const n = Number(el.value);
  return n === 2 || n === 3 || n === 4 ? n : null;
}

function setDaysPerWeekUI(days) {
  const v = days == null ? '' : String(days);
  const input = document.querySelector(`#wo-days-filter input[name="wo-days"][value="${v}"]`)
    || document.querySelector('#wo-days-filter input[name="wo-days"][value=""]');
  if (input) input.checked = true;
}

async function persistDaysPerWeek(days) {
  try {
    await api('/workouts/suggested-days', { method: 'PUT', body: JSON.stringify({ daysPerWeek: days }) });
    if (settings) settings.suggestedDaysPerWeek = days;
  } catch (err) { toast(err.message); }
}

const woActivitiesSheet = document.getElementById('wo-activities-sheet');
let woActivitiesOpener = null;

function openActivitiesSheet() {
  if (!woActivitiesSheet) return;
  woActivitiesOpener = document.activeElement;
  renderActivityOptions();
  renderRecommendedLifts();
  woActivitiesSheet.hidden = false;
  document.body.classList.add('sheet-open');
  const closeBtn = document.getElementById('wo-activities-sheet-close');
  if (closeBtn) closeBtn.focus();
}

function closeActivitiesSheet() {
  if (!woActivitiesSheet || woActivitiesSheet.hidden) return;
  woActivitiesSheet.hidden = true;
  document.body.classList.remove('sheet-open');
  updateActivitiesSummary();
  const back = woActivitiesOpener && document.body.contains(woActivitiesOpener)
    ? woActivitiesOpener
    : document.getElementById('btn-select-activities');
  if (back && back.focus) back.focus();
  woActivitiesOpener = null;
}

/** Activity multi-select inside the Select activities sheet. */
function renderActivityOptions() {
  const box = document.getElementById('wo-program-activities');
  if (!box) return;
  const prev = new Set(selectedProgramActivities());
  const mine = [...new Set((settings.interests || []).filter((n) => ACT.archetypesFor(n).length).map((n) => (ACT.lookup(n) || { name: n }).name))];
  const types = Object.entries(ACT.ARCHETYPES);
  const tile = (value, label) => {
    const on = prev.has(value) || (ACT.LEGACY_FOCUS[value] && prev.has(ACT.LEGACY_FOCUS[value]));
    return `<label class="check-tile"><input type="checkbox" class="wo-act-check" value="${esc(value)}" ${on ? 'checked' : ''} /><span>${esc(label)}</span></label>`;
  };
  const parts = [];
  if (mine.length) {
    parts.push('<div class="wo-act-group"><div class="section-label">Your activities</div><div class="check-grid">' + mine.map((n) => tile(n, n)).join('') + '</div></div>');
  }
  parts.push('<div class="wo-act-group"><div class="section-label">Activity types</div><div class="check-grid">' + types.map(([k, a]) => tile(k, a.label)).join('') + '</div></div>');
  if (!mine.length) {
    parts.unshift('<p class="hint">Tip: turn on sports in Settings to pin your own activities here.</p>');
  }
  box.innerHTML = parts.join('');
  updateActivitiesSummary();
}

const TRAINING_FOCUS = ['Strength', 'Power', 'Hypertrophy', 'Conditioning', 'Endurance'];

function renderTrainingFocus() {
  const box = document.getElementById('training-focus');
  if (!box) return;
  const selected = new Set(settings.trainingFocus || []);
  box.innerHTML = TRAINING_FOCUS.map((item) => `
    <label class="check-tile">
      <input type="checkbox" class="focus-check" value="${item.toLowerCase()}" ${selected.has(item.toLowerCase()) ? 'checked' : ''} /><span>${item}</span>
    </label>`).join('');
}

function selectedFocus() {
  return Array.from(document.querySelectorAll('.focus-check:checked')).map((el) => el.value);
}

// Themes: each has a main and an accent colour (defined in styles.css).
const THEMES = [
  ['sage', 'Sage'], ['ocean', 'Ocean'], ['slate', 'Slate'], ['forest', 'Forest'],
  ['sunset', 'Sunset'], ['berry', 'Berry'], ['desert', 'Desert'], ['lavender', 'Lavender'],
  ['dark', 'Dark'], ['midnight', 'Midnight']
];
// Old or unknown saved names fall back to a current theme.
const THEME_ALIASES = { default: 'sage', light: 'sage', blue: 'ocean', green: 'sage', gray: 'slate', grey: 'slate', night: 'midnight' };
function normalizeTheme(name) {
  const key = String(name || '').toLowerCase();
  if (THEMES.some(([id]) => id === key)) return key;
  return THEME_ALIASES[key] || 'sage';
}

function applyTheme(name) {
  const theme = normalizeTheme(name);
  document.documentElement.dataset.theme = theme;
  const select = document.getElementById('theme-pref');
  if (select) select.value = theme;
  document.querySelectorAll('#theme-picker .theme-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === theme);
    btn.setAttribute('aria-checked', btn.dataset.value === theme ? 'true' : 'false');
  });
}

function renderThemePicker() {
  const box = document.getElementById('theme-picker');
  if (!box || box.childElementCount) return;
  box.innerHTML = THEMES.map(([id, label]) => `
    <button type="button" class="theme-option" role="radio" data-value="${id}" aria-label="${label} theme">
      <span class="theme-swatch" data-theme="${id}"><i class="sw-main"></i><i class="sw-accent"></i></span>
      <span class="theme-name">${label}</span>
    </button>`).join('');
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-option');
    if (btn) applyTheme(btn.dataset.value);
  });
}

function selectedInterests() {
  return Array.from(document.querySelectorAll('.interest-check:checked')).map((el) => el.value);
}

async function loadSettings() {
  try {
    settings = await api('/settings');
    setDaysPerWeekUI(settings.suggestedDaysPerWeek);
    if (settings.activeRoutine === undefined) settings.activeRoutine = null;
    const unit = document.getElementById('unit-pref');
    const foodUnit = document.getElementById('food-weight-unit');
    const days = document.getElementById('cal-avg-days');
    if (unit) unit.value = settings.unit || 'lbs';
    if (foodUnit) foodUnit.value = settings.foodWeightUnit || 'g';
    if (days) days.value = settings.calAvgDays || 14;
    const length = document.getElementById('length-unit');
    if (length) length.value = settings.lengthUnit || 'in';
    renderThemePicker();
    applyTheme(settings.theme);
    renderInterestChecks();
    renderActivityOptions();
    renderTrainingFocus();
    renderRecommendedLifts();
  } catch (e) {
    console.error(e);
  }
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  try {
    settings = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        unit: document.getElementById('unit-pref').value,
        foodWeightUnit: document.getElementById('food-weight-unit')?.value || 'g',
        calAvgDays: parseInt(document.getElementById('cal-avg-days').value, 10),
        lengthUnit: document.getElementById('length-unit')?.value || 'in',
        theme: document.getElementById('theme-pref')?.value || 'sage',
        interests: selectedInterests(),
        trainingFocus: selectedFocus()
      })
    });
    toast('Settings saved');
    renderAll();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-save-interests').addEventListener('click', async () => {
  try {
    settings = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        unit: document.getElementById('unit-pref').value,
        foodWeightUnit: document.getElementById('food-weight-unit')?.value || settings.foodWeightUnit || 'g',
        calAvgDays: parseInt(document.getElementById('cal-avg-days').value, 10),
        lengthUnit: document.getElementById('length-unit')?.value || settings.lengthUnit || 'in',
        interests: selectedInterests(),
        trainingFocus: selectedFocus()
      })
    });
    toast('Interests saved');
    renderInterestChecks();
    renderActivityOptions();
    renderRecommendedLifts();
  } catch (err) {
    toast(err.message);
  }
});

/** Format serving size for display (converts g ↔ oz based on preference) */
function formatServingLabel(servingSize, servingUnit) {
  const unit = (servingUnit || 'serving').toLowerCase();
  if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    if ((settings.foodWeightUnit || 'g') === 'oz') {
      const oz = servingSize / 28.3495;
      return `${oz % 1 === 0 ? oz : oz.toFixed(1)} oz`;
    }
    return `${servingSize} g`;
  }
  if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') {
    if ((settings.foodWeightUnit || 'g') === 'g') {
      return `${Math.round(servingSize * 28.3495)} g`;
    }
    return `${servingSize} oz`;
  }
  return `${servingSize} ${servingUnit}`;
}

// ========== Dashboard ==========
async function loadActivity() {
  const card = document.getElementById('activity-card');
  try {
    const d = await api('/health/summary?days=7');
    if (!d.hasData) { card.hidden = true; return; }
    card.hidden = false;
    const t = d.today || {};
    const fmtN = (v) => (v == null ? '—' : Math.round(v).toLocaleString());
    document.getElementById('act-steps').textContent = fmtN(t.steps);
    document.getElementById('act-kcal').textContent = fmtN(t.activeKcal);
    document.getElementById('act-dist').textContent = t.distanceM == null ? '—' : (t.distanceM / 1609.344).toFixed(1) + ' mi';
    const max = Math.max(1000, ...d.days.map((x) => x.steps || 0));
    const wk = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    document.getElementById('steps-chart').innerHTML = d.days.map((x, i) => {
      const h = x.steps ? Math.max(4, Math.round((x.steps / max) * 70)) : 3;
      const lbl = x.steps == null ? '' : x.steps >= 1000 ? (x.steps / 1000).toFixed(1) + 'k' : String(x.steps);
      return `<div class="steps-bar${i === d.days.length - 1 ? ' today' : ''}" title="${esc(x.date)}: ${fmtN(x.steps)} steps"><b>${lbl}</b><i style="height:${h}px"></i>${wk[new Date(x.date + 'T12:00:00').getDay()]}</div>`;
    }).join('');
    document.getElementById('activity-source').textContent = d.lastSync ? 'Synced ' + new Date(d.lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  } catch (e) { card.hidden = true; }
}
window.loadActivity = loadActivity;


async function loadActiveRoutineCard() {
  const card = document.getElementById('active-routine-card');
  if (!card) return;
  try {
    const data = await api('/workouts/active-routine');
    const active = data && data.active;
    if (settings) settings.activeRoutine = active || null;
    if (!active) { card.hidden = true; return; }
    card.hidden = false;
    document.getElementById('active-routine-line').textContent = active.name || 'Active routine';
    const kindLabel = active.kind === 'program'
      ? `${active.daysPerWeek || '—'}-day suggested program`
      : 'Saved routine (1 session)';
    document.getElementById('active-routine-meta').textContent = kindLabel + ' · pinned to Home. Switching active never deletes your other routines.';
    const clearBtn = document.getElementById('active-routine-clear');
    if (clearBtn) clearBtn.hidden = false;
  } catch (e) { card.hidden = true; }
}

async function loadDashboard() {
  loadActivity();
  loadActiveRoutineCard();
  try {
    const data = await api(`/dashboard?days=${currentPeriodDays}`);
    const statsEl = document.getElementById('overview-stats');
    const change = data.periodChange;
    statsEl.innerHTML = `
      <div class="stat">
        <div class="value">${data.latestWeight ? toDisplayWeight(data.latestWeight.weight) : '—'}</div>
        <div class="label">Latest</div>
      </div>
      <div class="stat">
        <div class="value">${data.periodAvg != null ? toDisplayWeight(data.periodAvg) : '—'}</div>
        <div class="label">${currentPeriodDays}-day avg</div>
      </div>
      <div class="stat ${change == null ? '' : change < 0 ? 'positive' : change > 0 ? 'negative' : 'neutral'}">
        <div class="value">${change == null ? '—' : (change > 0 ? '+' : '') + change.toFixed(1)}</div>
        <div class="label">${currentPeriodDays}-day change</div>
      </div>
      <div class="stat">
        <div class="value">${data.weighInCount}</div>
        <div class="label">Weigh-ins</div>
      </div>
    `;

    document.getElementById('avg-details').textContent =
      data.weighInCount >= 2
        ? `${data.weighInCount} weigh-ins in the selected window`
        : data.weighInCount === 1
        ? 'Only one entry in this window – need more for a trend.'
        : 'No weight entries in this period yet.';

    renderTodayIntake(data.todayTotals, data.recommendation);
    renderRecommendation(data.recommendation);
  } catch (err) {
    console.error(err);
  }
}

function renderTodayIntake(totals, rec) {
  const el = document.getElementById('today-intake');
  if (!el) return;
  const t = totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const targets = rec?.ready
    ? { calories: rec.targetDaily, protein: rec.macros.proteinG, carbs: rec.macros.carbsG, fat: rec.macros.fatG }
    : null;

  const rows = [
    { key: 'calories', label: 'Calories', unit: '', current: t.calories, target: targets?.calories },
    { key: 'protein', label: 'Protein', unit: 'g', current: t.protein, target: targets?.protein },
    { key: 'carbs', label: 'Carbs', unit: 'g', current: t.carbs, target: targets?.carbs },
    { key: 'fat', label: 'Fat', unit: 'g', current: t.fat, target: targets?.fat }
  ];

  el.innerHTML = targetBasisNote(targets) + rows
    .map((r) => {
      const pct = r.target ? Math.min(100, Math.round((r.current / r.target) * 100)) : 0;
      const over = r.target && r.current > r.target;
      const remaining = r.target ? Math.round(r.target - r.current) : null;
      return `
        <div class="macro-bar-card">
          <div class="macro-label">
            <span>${r.label}</span>
            <span>${Math.round(r.current)}${r.unit}${r.target ? ' / ' + r.target + r.unit : ''}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-${r.key} ${over ? 'over' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="hint" style="margin-top:4px">
            ${remaining == null ? '' : remaining >= 0 ? remaining + r.unit + ' remaining' : Math.abs(remaining) + r.unit + ' over'}
          </div>
        </div>`;
    })
    .join('');
}

// Prominent "this is only an estimate" notice whenever the last 7 days don't have enough logs;
// a quiet "based on your last 7 days" line once they do. Used by the dashboard and the food panel.
function targetBasisNote(t, opts = {}) {
  if (!t) return '';
  const s = t.sufficiency;
  if (!t.estimate) {
    return `<p class="basis-note">Based on your last 7 days of food and weight logs.</p>`;
  }
  const progress = s
    ? `<div class="estimate-progress">Last 7 days: <strong>${s.loggedFoodDays}/${s.foodDays}</strong> days with food logged · <strong>${Math.min(s.loggedWeighIns, s.weighIns)}/${s.weighIns}</strong> weigh-ins</div>`
    : '';
  return `
    <div class="estimate-notice" role="note">
      <div class="estimate-title"><span class="estimate-icon" aria-hidden="true">!</span> This is an estimate, not a prescription</div>
      <p>${t.basis === 'formula' ? "It's based on general formulas, not your body's actual data." : "It's based on only a few days of logs, so it can be far off."} Log food and weight for a week to get a number based on you.</p>
      ${opts.compact ? '' : progress}
    </div>`;
}

function renderRecommendation(rec) {
  const box = document.getElementById('recommendation');
  if (!rec || !rec.ready) {
    box.innerHTML = `<div class="empty">${esc(rec?.reason || 'Not enough data yet.')}</div>`;
    return;
  }

  const badge =
    rec.goalType === 'lose'
      ? '<span class="badge badge-loss">Cut</span>'
      : rec.goalType === 'gain'
      ? '<span class="badge badge-gain">Bulk</span>'
      : '<span class="badge badge-maintain">Maintain</span>';

  let basis;
  if (rec.basis === 'formula') {
    const f = rec.formula || {};
    basis = `Starting estimate from your height, weight, age${f.sex === 'unspecified' ? ' (sex not given, so an average of the two formulas)' : ' and sex'}
      × ${f.assumedActivity ? 'a light-activity guess (add your daily activity in About you)' : 'your daily activity'}.`;
  } else {
    basis = `Based on ${rec.sampleSize.calorieDays} calorie days (avg ${rec.avgCalories} kcal)
      and ${rec.sampleSize.weights} weigh-ins over ${rec.spanDays} days
      (net ${rec.weightDelta > 0 ? '+' : ''}${rec.weightDelta.toFixed(1)} lbs).`;
  }

  box.innerHTML = `
    <div class="rec-box">
      <div class="headline">${rec.estimate ? '<span class="est-tag">Estimate</span> ' : ''}${rec.targetDaily} kcal / day</div>
      ${targetBasisNote(rec)}
      <div class="macros">
        <span class="macro-pill">P ${rec.macros.proteinG}g</span>
        <span class="macro-pill">C ${rec.macros.carbsG}g</span>
        <span class="macro-pill">F ${rec.macros.fatG}g</span>
      </div>
      <div class="detail">
        ${badge} ${esc(rec.goalNote)}<br>
        ${rec.limitNote ? `<div class="limit-note">${esc(rec.limitNote)}</div>` : '<br>'}
        Estimated maintenance: <strong>${rec.estimatedMaintenance} kcal</strong><br>
        ${basis}
      </div>
    </div>
  `;
}

// ========== Weight ==========
document.getElementById('btn-save-weight').addEventListener('click', async () => {
  const date = document.getElementById('weight-date').value;
  const raw = document.getElementById('weight-value').value;
  const note = document.getElementById('weight-note').value.trim();
  if (!date || !raw) return toast('Date and weight required');

  const weight = fromInputWeight(raw);
  if (isNaN(weight) || weight < 50 || weight > 500) return toast('Enter a realistic weight');

  try {
    await api('/weights', {
      method: 'POST',
      body: JSON.stringify({ date, weight, note })
    });
    document.getElementById('weight-value').value = '';
    document.getElementById('weight-note').value = '';
    toast('Weight saved');
    loadWeightHistory();
    loadDashboard();
  } catch (err) {
    toast(err.message);
  }
});

async function loadWeightHistory() {
  try {
    const weights = await api('/weights?days=365');
    const el = document.getElementById('weight-history');
    if (!weights.length) {
      el.innerHTML = '<div class="empty">No weight entries yet.</div>';
      return;
    }

    // Group by year then month
    const byYear = {};
    weights.forEach((w) => {
      const [y, m] = w.date.split('-');
      if (!byYear[y]) byYear[y] = {};
      if (!byYear[y][m]) byYear[y][m] = [];
      byYear[y][m].push(w);
    });

    const years = Object.keys(byYear).sort((a, b) => b - a);
    el.innerHTML = years
      .map((year) => {
        const months = Object.keys(byYear[year]).sort((a, b) => b - a);
        const monthHtml = months
          .map((month) => {
            const entries = byYear[year][month];
            const monthName = new Date(year, parseInt(month, 10) - 1).toLocaleString(undefined, { month: 'long' });
            const rows = entries
              .map(
                (w) => `
              <tr>
                <td>${formatDate(w.date)}</td>
                <td>${toDisplayWeight(w.weight)}</td>
                <td>${w.note || '—'}</td>
                <td><button class="btn btn-danger" data-id="${w._id}">×</button></td>
              </tr>`
              )
              .join('');
            return `
              <div class="weight-month">
                <button type="button" class="weight-month-toggle" aria-expanded="false">
                  <span>${monthName}</span>
                  <span class="hint">${entries.length} entry${entries.length === 1 ? '' : 'ies'}</span>
                  <span class="meal-chevron">▸</span>
                </button>
                <div class="weight-month-body" style="display:none">
                  <table>
                    <thead><tr><th>Date</th><th>Weight</th><th>Note</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                </div>
              </div>`;
          })
          .join('');
        return `
          <div class="weight-year">
            <button type="button" class="weight-year-toggle" aria-expanded="true">
              <span>${year}</span>
              <span class="meal-chevron">▾</span>
            </button>
            <div class="weight-year-body">${monthHtml}</div>
          </div>`;
      })
      .join('');

    // Year toggles
    el.querySelectorAll('.weight-year-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const year = btn.closest('.weight-year');
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        year.querySelector('.weight-year-body').style.display = open ? 'none' : '';
        btn.querySelector('.meal-chevron').textContent = open ? '▸' : '▾';
      });
    });

    // Month toggles
    el.querySelectorAll('.weight-month-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const month = btn.closest('.weight-month');
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        month.querySelector('.weight-month-body').style.display = open ? 'none' : '';
        btn.querySelector('.meal-chevron').textContent = open ? '▸' : '▾';
      });
    });

    el.querySelectorAll('.btn-danger').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this entry?')) return;
        await api(`/weights/${btn.dataset.id}`, { method: 'DELETE' });
        toast('Deleted');
        loadWeightHistory();
        loadDashboard();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

// ========== Food ==========
let searchTimeout = null;
let favoriteIds = new Set();

const SV = window.Servings;
const G_PER_OZ = SV.G_PER_OZ;
function isWeightUnit(unit) { return SV.isWeightUnit(unit); }
function toGrams(size, unit) { return SV.toGrams(size, unit); }

/** Convert amount in the chosen unit into "number of the food's servings" */
function amountToServings(amount, chosenUnit, food) {
  return SV.amountToServings(amount, chosenUnit, food);
}

function buildUnitOptions(food) {
  const select = document.getElementById('food-amount-unit');
  const opts = SV.unitOptions(food);
  const groups = [
    ['serving', null], ['weight', 'Weight'], ['count', 'Count / size'], ['volume', 'Volume']
  ];
  select.innerHTML = groups.map(([kind, label]) => {
    const list = opts.filter((o) => o.kind === kind);
    if (!list.length) return '';
    const html = list.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    return label ? `<optgroup label="${label}">${html}</optgroup>` : html;
  }).join('');
  const hint = document.getElementById('food-unit-hint');
  if (hint) {
    const m = SV.measure(food);
    hint.textContent = !m.grams
      ? 'The weight of this serving is not known, so it can only be logged by serving.'
      : opts.some((o) => o.approx) ? '≈ grams are estimated from volume.' : '';
  }
}

function unitOption(value) {
  return selectedFood ? SV.unitOptions(selectedFood).find((o) => o.value === value) : null;
}

function renderQuickAmounts() {
  const unit = document.getElementById('food-amount-unit').value;
  const opt = unitOption(unit) || { kind: 'serving' };
  const box = document.getElementById('quick-serving-btns');
  let presets;
  if (unit === 'g') {
    const base = Math.round(SV.measure(selectedFood).grams || 100);
    presets = Array.from(new Set([15, 30, 50, 100, base, 150, 200])).sort((a, b) => a - b);
  } else if (unit === 'oz') {
    presets = [0.5, 1, 2, 3, 4, 6];
  } else if (unit === 'ml') {
    presets = [15, 30, 60, 120, 240];
  } else if (opt.kind === 'count') {
    presets = (opt.grams || 100) < 10 ? [5, 10, 15, 20, 30] : [1, 2, 3, 4];
  } else {
    presets = [0.5, 1, 1.5, 2, 3, 4];
  }
  box.innerHTML = presets
    .map((n) => `<button type="button" class="btn btn-secondary btn-sm" data-amt="${n}">${n}</button>`)
    .join('');
}

function selectFoodForLog(food) {
  selectedFood = {
    id: food._id || food.id,
    name: food.name,
    brand: food.brand || '',
    user: food.user || null,
    barcode: food.barcode || '',
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    carbs: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0,
    fiber: Number(food.fiber) || 0,
    servingSize: Number(food.servingSize) || 1,
    servingUnit: food.servingUnit || 'serving',
    gramsPerServing: food.gramsPerServing || null,
    mlPerServing: food.mlPerServing || null,
    portions: food.portions || undefined
  };
  document.getElementById('food-selected-name').textContent = selectedFood.name;
  const m = SV.measure(selectedFood);
  const bits = [SV.servingLabel(selectedFood)];
  if (m.grams && !SV.isWeightUnit(selectedFood.servingUnit)) bits.push((m.approxGrams ? '≈' : '') + SV.fmt(m.grams) + ' g');
  if (m.ml && !SV.isVolumeUnit(selectedFood.servingUnit)) bits.push(SV.fmt(m.ml) + ' mL');
  const per100 = m.grams && !m.approxGrams ? ` · ${Math.round((selectedFood.calories / m.grams) * 100)} kcal per 100 g` : '';
  const labelNote = selectedFood.barcode
    ? `<div class="hint food-label-check">From the Open Food Facts database. Compare with your label. <button type="button" class="link-btn" id="btn-fix-label">Wrong? Save a corrected copy</button></div>`
    : selectedFood.user
      ? `<div class="hint food-label-check"><button type="button" class="link-btn" id="btn-edit-food">Edit serving size / label</button></div>`
      : '';
  document.getElementById('food-selected-meta').innerHTML =
    esc(`${selectedFood.calories} kcal · P${selectedFood.protein}g C${selectedFood.carbs}g F${selectedFood.fat}g per ${bits.join(' = ')}${per100}`) +
    labelNote +
    (window.AboutYouUI ? window.AboutYouUI.dietHtml(selectedFood.name + ' ' + (selectedFood.brand || ''), { caveat: true }) : '');

  buildUnitOptions(selectedFood);
  const def = SV.defaultAmount(selectedFood);
  const sel = document.getElementById('food-amount-unit');
  sel.value = def.unit;
  if (sel.value !== def.unit) sel.value = 'serving';
  document.getElementById('food-servings').value = String(sel.value === def.unit ? def.amount : 1);
  renderQuickAmounts();
  document.getElementById('food-selected-row').style.display = 'block';
  document.getElementById('btn-log-food').disabled = false;
  document.getElementById('food-search').value = '';
  document.getElementById('food-search-results').classList.remove('open');
  updateServingPreview();
}

function updateServingPreview() {
  if (!selectedFood) return;
  const amount = parseFloat(document.getElementById('food-servings').value) || 0;
  const unit = document.getElementById('food-amount-unit').value;
  const servings = amountToServings(amount, unit, selectedFood);
  const box = document.getElementById('food-serving-preview');
  if (servings == null) {
    box.textContent = 'This food is not measured in ' + unit;
    document.getElementById('btn-log-food').disabled = true;
    return;
  }
  document.getElementById('btn-log-food').disabled = !(amount > 0);
  const cal = Math.round(selectedFood.calories * servings);
  const p = +(selectedFood.protein * servings).toFixed(1);
  const c = +(selectedFood.carbs * servings).toFixed(1);
  const f = +(selectedFood.fat * servings).toFixed(1);
  const grams = SV.amountToGrams(amount, unit, selectedFood);
  const m = SV.measure(selectedFood);
  const weightNote = grams && unit !== 'g' ? ` (${m.approxGrams ? '≈' : ''}${SV.fmt(grams)} g)` : '';
  box.innerHTML = `<strong>${esc(SV.amountLabel(amount, unit, selectedFood))}${esc(weightNote)} = ${cal} kcal</strong> · P${p} C${c} F${f}`;
}

document.getElementById('food-servings').addEventListener('input', updateServingPreview);
document.getElementById('food-amount-unit').addEventListener('change', () => {
  // Keep the same quantity of food when switching units (e.g. 1 serving -> 15 g -> 0.5 oz).
  if (!selectedFood) return;
  const unit = document.getElementById('food-amount-unit').value;
  const prevUnit = document.getElementById('food-amount-unit').dataset.prev || 'serving';
  const prevAmount = parseFloat(document.getElementById('food-servings').value) || 0;
  const servings = amountToServings(prevAmount, prevUnit, selectedFood) || 1;
  const opt = unitOption(unit);
  let next = opt ? servings / opt.factor : 1;
  if (opt && opt.kind === 'count') next = Math.max(1, Math.round(next));
  else next = unit === 'g' || unit === 'ml' ? Math.round(next) : Math.round(next * 100) / 100;
  document.getElementById('food-servings').value = String(next || 1);
  document.getElementById('food-amount-unit').dataset.prev = unit;
  updateServingPreview();
  renderQuickAmounts();
});
document.getElementById('food-amount-unit').addEventListener('focus', (e) => { e.target.dataset.prev = e.target.value; });
document.getElementById('food-amount-unit').addEventListener('mousedown', (e) => { e.target.dataset.prev = e.target.value; });
document.getElementById('food-selected-meta').addEventListener('click', (e) => {
  if (e.target.closest('#btn-fix-label') && selectedFood) openCustomFoodForm(selectedFood, { copy: true });
  if (e.target.closest('#btn-edit-food') && selectedFood) openCustomFoodForm(selectedFood);
});

document.getElementById('quick-serving-btns').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-amt]');
  if (!btn) return;
  document.getElementById('food-servings').value = btn.dataset.amt;
  updateServingPreview();
});

document.getElementById('food-search').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('food-search-results').classList.remove('open');
    return;
  }
  searchTimeout = setTimeout(() => searchFoods(q), 250);
});

// ---------- Add-food sheet (opened from a meal card) ----------
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', other: 'Other' };
const foodSheet = document.getElementById('food-sheet');

function setFoodMeal(meal) {
  const m = MEAL_LABELS[meal] ? meal : 'breakfast';
  document.getElementById('food-meal').value = m;
  document.querySelectorAll('[data-meal-pill]').forEach((b) => {
    const on = b.dataset.mealPill === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  document.getElementById('food-sheet-title').textContent = 'Add to ' + MEAL_LABELS[m];
}
function setFoodTab(tab) {
  document.querySelectorAll('.food-tab').forEach((b) => {
    const on = b.dataset.ftab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-fpanel]').forEach((el) => { el.hidden = el.dataset.fpanel !== tab; });
}
function clearFoodSelection() {
  selectedFood = null;
  document.getElementById('food-selected-row').style.display = 'none';
  document.getElementById('btn-log-food').disabled = true;
  document.getElementById('food-servings').value = '1';
  document.getElementById('food-search').value = '';
  document.getElementById('food-search-results').classList.remove('open');
  const recent = document.getElementById('recent-select');
  if (recent) recent.value = '';
}
function openFoodSheet(meal, tab = 'search') {
  clearFoodSelection();
  setFoodMeal(meal);
  setFoodTab(tab);
  const date = document.getElementById('food-date').value || todayStr();
  document.getElementById('food-sheet-date').textContent = date === todayStr() ? 'Today' : formatDate(date);
  foodSheet.hidden = false;
  document.body.classList.add('sheet-open');
  loadQuickAdd();
  // Desktop: jump straight into search. Phones: don't pop the keyboard over the sheet.
  if (!window.matchMedia('(pointer: coarse)').matches) document.getElementById('food-search').focus();
}
function closeFoodSheet() {
  foodSheet.hidden = true;
  document.body.classList.remove('sheet-open');
  document.getElementById('food-search-results').classList.remove('open');
}
foodSheet.addEventListener('click', (e) => {
  if (e.target === foodSheet || e.target.closest('#food-sheet-close')) return closeFoodSheet();
  const pill = e.target.closest('[data-meal-pill]');
  if (pill) return setFoodMeal(pill.dataset.mealPill);
  const tab = e.target.closest('.food-tab');
  if (tab) setFoodTab(tab.dataset.ftab);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('photo-lightbox').hidden) return closeLightbox();
  if (scanModal.style.display === 'flex') return;
  if (!foodSheet.hidden) closeFoodSheet();
  else if (!document.getElementById('wo-sheet').hidden) closeWoSheet();
});

let barcodeScanner = null;
let barcodeBusy = false;
const scanModal = document.getElementById('scan-modal');

async function lookupBarcode(raw) {
  const code = String(raw || '').replace(/\D/g, '');
  if (code.length < 8) return toast('Enter a valid barcode');
  if (barcodeBusy) return;
  barcodeBusy = true;
  const status = document.getElementById('scan-status');
  if (status) status.textContent = 'Looking up ' + code + '…';
  try {
    const data = await api(`/foods/barcode/${code}`);
    if (!data.found) {
      if (status) status.textContent = 'Not found. Search by name or add it manually.';
      toast('Barcode not in the free database');
      return;
    }
    await stopScanner();
    selectFoodForLog(data.food);
    toast(data.food.name + ' ready to log');
  } catch (err) {
    toast(err.message);
  } finally {
    barcodeBusy = false;
  }
}

async function stopScanner() {
  scanModal.style.display = 'none';
  if (barcodeScanner) {
    try { await barcodeScanner.stop(); } catch (e) {}
    try { barcodeScanner.clear(); } catch (e) {}
    barcodeScanner = null;
  }
}

document.getElementById('btn-scan').addEventListener('click', async () => {
  scanModal.style.display = 'flex';
  document.getElementById('scan-status').textContent = 'Starting camera…';
  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('scan-status').textContent = 'Camera scanner unavailable. Type the barcode.';
    return;
  }
  try {
    barcodeScanner = new Html5Qrcode('barcode-reader');
    await barcodeScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 140 } },
      (text) => lookupBarcode(text),
      () => {}
    );
    document.getElementById('scan-status').textContent = 'Point the camera at a barcode.';
  } catch (err) {
    document.getElementById('scan-status').textContent = 'Camera blocked. Allow camera, or type the barcode.';
  }
});

document.getElementById('btn-scan-close').addEventListener('click', stopScanner);
document.getElementById('btn-barcode-lookup').addEventListener('click', () => {
  lookupBarcode(document.getElementById('barcode-manual').value);
});
document.getElementById('barcode-manual').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') lookupBarcode(e.target.value);
});

async function searchFoods(q) {
  try {
    const foods = await api(`/foods?q=${encodeURIComponent(q)}&limit=15`);
    const el = document.getElementById('food-search-results');
    if (!foods.length) {
      el.innerHTML = '<div class="search-item">No foods found. Try <strong>New food</strong> or <strong>Quick add</strong>.</div>';
      el.classList.add('open');
      return;
    }
    el.innerHTML = foods
      .map(
        (f) => `
      <div class="search-item" data-id="${f._id}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div>${esc(f.name)}${f.brand ? ' · ' + esc(f.brand) : ''}</div>
            ${window.AboutYouUI ? window.AboutYouUI.dietHtml(f.name + ' ' + (f.brand || '')) : ''}
            <div class="meta">${esc(f.calories)} kcal · P${esc(f.protein)}g C${esc(f.carbs)}g F${esc(f.fat)}g · per ${esc(formatServingLabel(f.servingSize, f.servingUnit))}</div>
          </div>
          <button class="star-btn ${favoriteIds.has(f._id) ? 'favorited' : ''}" data-star="${f._id}" title="Favorite">★</button>
        </div>
      </div>`
      )
      .join('');
    el.classList.add('open');

    el.querySelectorAll('.search-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.star-btn')) return;
        const food = foods.find((f) => f._id === item.dataset.id);
        if (food) selectFoodForLog(food);
      });
    });

    el.querySelectorAll('.star-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFavorite(btn.dataset.star);
        btn.classList.toggle('favorited');
      });
    });
  } catch (err) {
    console.error(err);
  }
}

async function toggleFavorite(foodId) {
  try {
    const data = await api(`/foods/${foodId}/favorite`, { method: 'POST' });
    if (data.favorited) favoriteIds.add(foodId);
    else favoriteIds.delete(foodId);
    loadQuickAdd();
    toast(data.favorited ? 'Added to favorites' : 'Removed from favorites');
  } catch (err) {
    toast(err.message);
  }
}

document.getElementById('btn-log-food').addEventListener('click', async () => {
  if (!selectedFood) return;
  const date = document.getElementById('food-date').value || todayStr();
  const meal = document.getElementById('food-meal').value;
  const amount = parseFloat(document.getElementById('food-servings').value) || 1;
  const unit = document.getElementById('food-amount-unit').value;
  const servings = amountToServings(amount, unit, selectedFood);
  if (servings == null) return toast('Pick a unit this food is measured in');
  const grams = SV.amountToGrams(amount, unit, selectedFood);
  if (grams > 0 && (selectedFood.calories * servings) / grams > 10) return toast('That calorie total is not possible for this amount');

  try {
    await api('/food-logs', {
      method: 'POST',
      body: JSON.stringify({ date, meal, foodId: selectedFood.id, servings, amount, amountUnit: unit })
    });
    const loggedName = selectedFood.name;
    clearFoodSelection();
    closeFoodSheet();
    toast(`${loggedName} added to ${MEAL_LABELS[meal] || meal}`);
    loadFoodLog();
    loadQuickAdd();
    loadDashboard();
  } catch (err) {
    toast(err.message);
  }
});

// ---------- New food (label serving + per-serving nutrition) ----------
const CF_FIELDS = ['cf-name', 'cf-brand', 'cf-calories', 'cf-protein', 'cf-carbs', 'cf-fat', 'cf-fiber', 'cf-serving-measure'];
function cfVal(id) { return document.getElementById(id).value; }

function updateCustomServingUi() {
  const unit = cfVal('cf-serving-unit');
  const size = parseFloat(cfVal('cf-serving-size')) || 0;
  const row = document.getElementById('cf-weighs-row');
  const mUnit = document.getElementById('cf-serving-measure-unit');
  const isW = SV.isWeightUnit(unit);
  const isV = SV.isVolumeUnit(unit);
  row.hidden = isW;
  if (isV) {
    mUnit.value = 'g';
    mUnit.disabled = true;
    document.getElementById('cf-serving-measure').placeholder = 'grams (optional)';
  } else {
    mUnit.disabled = false;
    document.getElementById('cf-serving-measure').placeholder = mUnit.value === 'mL' ? 'mL' : 'grams';
  }
  const label = size ? `${SV.fmt(size)} ${unit}` : 'serving';
  document.getElementById('cf-calories-label').textContent = `Calories per ${label}`;
  const f = customFoodFromForm();
  const sum = document.getElementById('cf-summary');
  if (!size || cfVal('cf-calories') === '') { sum.textContent = ''; return; }
  const m = SV.measure(f);
  const parts = [`${SV.servingLabel(f)}`];
  if (m.grams && !isW) parts.push((m.approxGrams ? '≈' : '') + SV.fmt(m.grams) + ' g');
  if (m.ml && !isV) parts.push(SV.fmt(m.ml) + ' mL');
  let text = `${parts.join(' = ')} → ${f.calories} kcal`;
  if (m.grams && !m.approxGrams) text += ` · 100 g = ${Math.round((f.calories / m.grams) * 100)} kcal`;
  sum.textContent = text;
}

function customFoodFromForm() {
  const unit = cfVal('cf-serving-unit');
  const measure = parseFloat(cfVal('cf-serving-measure')) || null;
  const mUnit = cfVal('cf-serving-measure-unit');
  const out = {
    name: cfVal('cf-name').trim(),
    brand: cfVal('cf-brand').trim(),
    servingSize: parseFloat(cfVal('cf-serving-size')) || 1,
    servingUnit: unit,
    calories: Number(cfVal('cf-calories')) || 0,
    protein: Number(cfVal('cf-protein')) || 0,
    carbs: Number(cfVal('cf-carbs')) || 0,
    fat: Number(cfVal('cf-fat')) || 0,
    fiber: Number(cfVal('cf-fiber')) || 0,
    gramsPerServing: null,
    mlPerServing: null
  };
  if (measure && !SV.isWeightUnit(unit)) {
    if (SV.isVolumeUnit(unit) || mUnit === 'g') out.gramsPerServing = measure;
    else out.mlPerServing = measure;
  }
  return out;
}

function resetCustomFoodForm() {
  CF_FIELDS.forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('cf-serving-size').value = '1';
  document.getElementById('cf-serving-unit').value = 'tbsp';
  document.getElementById('cf-serving-measure-unit').value = 'g';
  document.getElementById('cf-edit-id').value = '';
  document.getElementById('btn-create-food').textContent = 'Save food';
  document.getElementById('cf-intro').textContent = 'Copy it from the Nutrition Facts label. It is selected right away so you can log it.';
  updateCustomServingUi();
}

/** Prefill the form from a food: edit your own food, or save a corrected copy of a scanned one. */
function openCustomFoodForm(food, { copy = false } = {}) {
  resetCustomFoodForm();
  const set = (id, v) => { document.getElementById(id).value = v == null ? '' : String(v); };
  set('cf-name', food.name);
  set('cf-brand', food.brand || '');
  const unitSel = document.getElementById('cf-serving-unit');
  let unit = SV.baseUnit(food.servingUnit);
  if (unit === 'ml') unit = 'mL';
  if (![...unitSel.options].some((o) => o.value === unit)) {
    unitSel.insertAdjacentHTML('beforeend', `<option value="${esc(food.servingUnit)}">${esc(food.servingUnit)}</option>`);
    unit = food.servingUnit;
  }
  unitSel.value = unit;
  set('cf-serving-size', food.servingSize || 1);
  if (food.gramsPerServing && !SV.isWeightUnit(unit)) { set('cf-serving-measure', food.gramsPerServing); document.getElementById('cf-serving-measure-unit').value = 'g'; }
  else if (food.mlPerServing && !SV.isVolumeUnit(unit)) { set('cf-serving-measure', food.mlPerServing); document.getElementById('cf-serving-measure-unit').value = 'mL'; }
  ['calories', 'protein', 'carbs', 'fat', 'fiber'].forEach((k) => set('cf-' + k, food[k] || (k === 'calories' ? 0 : '')));
  if (!copy && food.user) {
    set('cf-edit-id', food.id || food._id);
    document.getElementById('btn-create-food').textContent = 'Save changes';
    document.getElementById('cf-intro').textContent = 'Fix the serving size or label values. Past entries keep the calories they were saved with.';
  } else if (copy) {
    document.getElementById('cf-intro').textContent = 'Check each number against your label, then save your own copy.';
  }
  setFoodTab('custom');
  updateCustomServingUi();
}

['cf-serving-size', 'cf-serving-unit', 'cf-serving-measure', 'cf-serving-measure-unit', 'cf-calories'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateCustomServingUi);
  document.getElementById(id).addEventListener('change', updateCustomServingUi);
});
updateCustomServingUi();

document.getElementById('btn-create-food').addEventListener('click', async () => {
  const body = customFoodFromForm();
  if (!body.name || cfVal('cf-calories') === '') return toast('Name and calories required');
  if (!(parseFloat(cfVal('cf-serving-size')) > 0)) return toast('Enter the serving size from the label');
  const editId = cfVal('cf-edit-id');
  try {
    const created = await api(editId ? `/foods/${editId}` : '/foods', {
      method: editId ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    resetCustomFoodForm();
    if (created && (created._id || created.id)) {
      setFoodTab('search');
      selectFoodForLog(created);
      toast(editId ? 'Food updated. Set the amount and add it.' : 'Saved. Set the amount and add it.');
    } else {
      toast('Food saved. Search for it to log');
    }
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-manual-entry').addEventListener('click', async () => {
  const date = document.getElementById('food-date').value || todayStr();
  const meal = document.getElementById('food-meal').value;
  const calories = document.getElementById('manual-calories').value;
  if (calories === '' || calories == null) return toast('Calories required');

  try {
    await api('/food-logs', {
      method: 'POST',
      body: JSON.stringify({
        date,
        meal,
        manual: true,
        foodName: document.getElementById('manual-name').value.trim() || 'Manual entry',
        calories: Number(calories),
        protein: Number(document.getElementById('manual-protein').value) || 0,
        carbs: Number(document.getElementById('manual-carbs').value) || 0,
        fat: Number(document.getElementById('manual-fat').value) || 0
      })
    });
    document.getElementById('manual-name').value = '';
    document.getElementById('manual-calories').value = '';
    document.getElementById('manual-protein').value = '0';
    document.getElementById('manual-carbs').value = '0';
    document.getElementById('manual-fat').value = '0';
    closeFoodSheet();
    toast(`Added to ${MEAL_LABELS[meal] || meal}`);
    loadFoodLog();
    loadDashboard();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-copy-yesterday').addEventListener('click', async () => {
  const date = document.getElementById('food-date').value || todayStr();
  if (!confirm(`Copy all foods from the previous day onto ${date}?`)) return;
  try {
    const data = await api('/food-logs/copy-yesterday', {
      method: 'POST',
      body: JSON.stringify({ date })
    });
    toast(`Copied ${data.copied} items from ${data.sourceDate}`);
    loadFoodLog();
    loadQuickAdd();
    loadDashboard();
  } catch (err) {
    toast(err.message);
  }
});

function amountLabel(log) {
  if (log.amountLabel) return log.amountLabel;
  if (log.amount && log.amountUnit === 'serving') return `${log.amount} serving${log.amount === 1 ? '' : 's'}`;
  if (log.amount && log.amountUnit) return `${log.amount} ${String(log.amountUnit).replace(/^p:/, '')}`;
  return `${log.servings} serving${log.servings === 1 ? '' : 's'}`;
}

function renderMacroProgress(totals, targets) {
  const el = document.getElementById('macro-progress');
  const remEl = document.getElementById('energy-remaining');
  const remaining = targets ? Math.round(targets.calories - totals.calories) : null;
  if (remEl) {
    remEl.textContent = remaining == null ? '—' : remaining.toLocaleString();
    remEl.className = 'energy-number' + (remaining != null && remaining < 0 ? ' over' : '');
  }
  if (!targets) {
    el.innerHTML = '<p class="hint">Set a goal and log a few days to see remaining targets.</p>';
    return;
  }

  const rows = [
    { key: 'protein', label: 'Protein', color: 'var(--main)', current: totals.protein, target: targets.protein },
    { key: 'carbs', label: 'Net Carbs', color: 'var(--accent-strong)', current: totals.carbs, target: targets.carbs },
    { key: 'fat', label: 'Fat', color: 'var(--chart-3)', current: totals.fat, target: targets.fat }
  ];

  el.innerHTML = rows
    .map((r) => {
      const pct = r.target ? Math.min(100, Math.round((r.current / r.target) * 100)) : 0;
      const over = r.target && r.current > r.target;
      return `
        <div class="macro-bar-card">
          <div class="macro-label">
            <span><i class="macro-dot" style="background:${r.color}"></i>${r.label}</span>
            <span>${Math.round(r.current)} / ${r.target}g</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${over ? 'over' : ''}" style="width:${pct}%;background:${over ? '' : r.color}"></div>
          </div>
        </div>`;
    })
    .join('');
}

async function loadFoodLog() {
  const date = document.getElementById('food-date').value || todayStr();
  try {
    const data = await api(`/food-logs?date=${date}`);
    const totalsEl = document.getElementById('food-day-totals');
    const listEl = document.getElementById('food-log-list');

    renderMacroProgress(data.totals, data.targets);

    const targetCal = data.targets?.calories;
    totalsEl.innerHTML = `
      <span>${Math.round(data.totals.calories)}${targetCal ? ' / ' + targetCal : ''} kcal eaten</span>
      <span>P ${data.totals.protein.toFixed(0)}g</span>
      <span>C ${data.totals.carbs.toFixed(0)}g</span>
      <span>F ${data.totals.fat.toFixed(0)}g</span>
    `;

    const order = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
    const groups = {};
    data.logs.forEach((l) => {
      if (!groups[l.meal]) groups[l.meal] = [];
      groups[l.meal].push(l);
    });
    const flexGroups = {};
    (data.flexMeals || []).forEach((m) => {
      const k = order.includes(m.meal) ? m.meal : 'other';
      (flexGroups[k] = flexGroups[k] || []).push(m);
    });
    const escH = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    listEl.innerHTML = order
      .map((meal) => {
        const mealLogs = groups[meal] || [];
        const flexItems = flexGroups[meal] || [];
        const mealCals = mealLogs.reduce((s, l) => s + l.calories, 0) + flexItems.reduce((s, m) => s + (m.estimateKcal || 0), 0);
        const flexHtml = flexItems
          .map(
            (m) => `
          <div class="diary-item flex-entry">
            <div class="info">
              <div class="name">${escH(m.label || 'Flex/holiday meal')} <span class="badge-flex">estimate</span></div>
              <div class="meta">${m.estimateLow}–${m.estimateHigh} kcal likely${m.foods && m.foods.length ? ' · ' + m.foods.map((f) => escH(f.label)).join(', ') : ''}</div>
            </div>
            <div class="cals">≈${m.estimateKcal}</div>
            <button class="btn btn-danger btn-sm" data-flex-meal="${escH(m.id)}" aria-label="Remove flex entry">×</button>
          </div>`
          )
          .join('');
        const items = mealLogs.length || flexItems.length
          ? flexHtml + mealLogs
              .map(
                (l) => `
          <div class="diary-item">
            <div class="info">
              <div class="name">${l.foodName}${l.isManual ? ' <span class="badge-manual">manual</span>' : ''}</div>
              <div class="meta">${l.isManual ? '' : amountLabel(l) + ' · '}P${l.protein} C${l.carbs} F${l.fat}</div>
            </div>
            <div class="cals">${l.calories}</div>
            <button class="btn btn-danger btn-sm" data-id="${l._id}" aria-label="Remove">×</button>
          </div>`
              )
              .join('')
          : '<div class="diary-empty">Nothing logged</div>';
        return `
          <div class="meal-group" data-meal="${meal}">
            <button type="button" class="meal-toggle" aria-expanded="true">
              <span class="meal-toggle-label">${meal}</span>
              <span class="meal-toggle-cals">${mealCals} kcal</span>
              <span class="meal-chevron">▾</span>
            </button>
            <div class="meal-items">
              ${items}
              <div class="meal-actions">
                <button type="button" class="add-meal-btn" data-add-meal="${meal}">+ Add food</button>
                <button type="button" class="add-meal-btn flex-meal-btn" data-flex-add="${meal}">Log flex/holiday</button>
              </div>
            </div>
          </div>`;
      })
      .join('');

    listEl.querySelectorAll('.meal-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.meal-group');
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        group.classList.toggle('collapsed', open);
      });
    });

    listEl.querySelectorAll('[data-add-meal]').forEach((btn) => {
      btn.addEventListener('click', () => openFoodSheet(btn.dataset.addMeal));
    });

    listEl.querySelectorAll('[data-flex-add]').forEach((btn) => {
      btn.addEventListener('click', () => window.FlexSport && window.FlexSport.openFlexSheet(btn.dataset.flexAdd));
    });
    listEl.querySelectorAll('[data-flex-meal]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try { await window.FlexSport.removeFlexMeal(date, btn.dataset.flexMeal); } catch (err) { toast(err.message); }
      });
    });

    listEl.querySelectorAll('.btn-danger[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/food-logs/${btn.dataset.id}`, { method: 'DELETE' });
        toast('Removed');
        loadFoodLog();
        loadQuickAdd();
        loadDashboard();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadQuickAdd() {
  try {
    const [favorites, recent] = await Promise.all([
      api('/foods/favorites'),
      api('/foods/recent')
    ]);

    favoriteIds = new Set(favorites.map((f) => f._id));

    const favEl = document.getElementById('favorites-chips');
    if (!favorites.length) {
      favEl.innerHTML = '<div class="chip-empty">Star foods in search to add favorites</div>';
    } else {
      favEl.innerHTML = favorites
        .map(
          (f) => `
        <button class="chip" data-id="${f._id}">
          ${f.name}
          <span class="chip-cal">${f.calories} kcal</span>
        </button>`
        )
        .join('');
      favEl.querySelectorAll('.chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const food = favorites.find((f) => f._id === btn.dataset.id);
          if (food) selectFoodForLog(food);
        });
      });
    }

    const recentEl = document.getElementById('recent-select');
    if (!recent.length) {
      recentEl.innerHTML = '<option value="">No recent foods yet</option>';
    } else {
      recentEl.innerHTML = '<option value="">Choose a recent food</option>' + recent
        .map((f) => `<option value="${f._id}">${f.name}${f.calories != null ? ' · ' + f.calories + ' kcal' : ''}</option>`)
        .join('');
      recentEl.onchange = () => {
        const food = recent.find((f) => f._id === recentEl.value);
        if (food) selectFoodForLog(food);
      };
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('food-date').addEventListener('change', loadFoodLog);

function shiftFoodDate(days) {
  const input = document.getElementById('food-date');
  const d = new Date((input.value || todayStr()) + 'T12:00:00');
  d.setDate(d.getDate() + days);
  input.value = dateKey(d);
  loadFoodLog();
}
document.getElementById('food-prev').addEventListener('click', () => shiftFoodDate(-1));
document.getElementById('food-next').addEventListener('click', () => shiftFoodDate(1));

// ========== Goals ==========
async function loadGoal() {
  try {
    const goal = await api('/goals');
    const el = document.getElementById('current-goal-display');
    if (!goal || goal.type === 'maintain' && !goal.amountLbs) {
      el.innerHTML = '<div class="empty" style="padding:12px 0">No active goal set.</div>';
    } else {
      const typeLabel = goal.type === 'lose' ? 'Lose' : goal.type === 'gain' ? 'Gain' : 'Maintain';
      const by = goal.targetDate ? ' by ' + goal.targetDate : ` in ${goal.weeks} weeks`;
      el.innerHTML = `
        <div class="goal-summary">
          <div class="target">${typeLabel} ${goal.type === 'maintain' ? '' : goal.amountLbs + ' lbs'}${by}</div>
          <div style="margin-top:4px;font-size:0.9rem;color:var(--text-muted)">Calories update from remaining weight and days left.</div>
        </div>
      `;
    }
    document.getElementById('goal-type').value = goal.type || 'maintain';
    document.getElementById('goal-amount').value = goal.amountLbs || '';
    document.getElementById('goal-date').value = goal.targetDate || '';
    if (goal.startWeight) {
      document.getElementById('goal-start-weight').value =
        settings.unit === 'kg' ? (goal.startWeight / 2.20462).toFixed(1) : goal.startWeight.toFixed(1);
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('btn-save-goal').addEventListener('click', async () => {
  const type = document.getElementById('goal-type').value;
  const amount = parseFloat(document.getElementById('goal-amount').value) || 0;
  const targetDate = document.getElementById('goal-date').value;
  let startWeight = parseFloat(document.getElementById('goal-start-weight').value);
  if (!isNaN(startWeight)) startWeight = fromInputWeight(startWeight);
  else startWeight = undefined;

  try {
    await api('/goals', {
      method: 'PUT',
      body: JSON.stringify({ type, amountLbs: amount, targetDate, startWeight })
    });
    toast('Goal saved');
    loadGoal();
    loadDashboard();
  } catch (err) {
    toast(err.message);
  }
});

// Starter lifts per activity type come from lib/activities.js. A few names keep their own picks.
const LIFT_MAP = {
  powerlifting: ['Back Squat', 'Bench Press', 'Conventional Deadlift'],
  bodybuilding: ['Incline Dumbbell Press', 'Lat Pulldown', 'Lateral Raise', 'Leg Curl'],
  wrestling: ['Power Clean', 'Back Squat', 'Farmer Carry', 'Pull-Up']
};

function renderRecommendedLifts() {
  const el = document.getElementById('wo-recommended');
  if (!el) return;
  const interests = settings.interests || [];
  const lifts = [];
  interests.forEach((name) => {
    const own = LIFT_MAP[name.toLowerCase()];
    if (own) return lifts.push(...own);
    const arch = ACT.archetypesFor(name)[0];
    if (arch) lifts.push(...ACT.ARCHETYPES[arch].lifts);
  });
  const unique = [...new Set(lifts)];
  if (!unique.length) {
    el.innerHTML = '<div class="empty">Turn on sports or training interests in Settings.</div>';
    return;
  }
  el.innerHTML = unique.map((name) => `<button type="button" class="chip" data-lift="${name}">${name}</button>`).join(' ');
  el.querySelectorAll('[data-lift]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const found = await api(`/workouts/exercises?q=${encodeURIComponent(btn.dataset.lift)}`);
      const match = found.find((ex) => ex.name.toLowerCase() === btn.dataset.lift.toLowerCase()) || found[0];
      if (!match) return toast('Exercise not in the library yet');
      addExerciseToWorkout({ ...match, exerciseId: match._id, exerciseName: match.name });
    });
  });
}
let swapTargetIdx = null;

document.getElementById('wo-ex-search').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('wo-ex-results').classList.remove('open');
    return;
  }
  searchTimeout = setTimeout(() => searchExercises(q), 250);
});

async function searchExercises(q) {
  try {
    const exercises = await api(`/workouts/exercises?q=${encodeURIComponent(q)}`);
    const el = document.getElementById('wo-ex-results');
    if (!exercises.length) {
      el.innerHTML = '<div class="search-item">No exercises found</div>';
      el.classList.add('open');
      return;
    }
    el.innerHTML = exercises
      .map(
        (ex) => `
      <div class="search-item" data-idx="${exercises.indexOf(ex)}" data-id="${ex._id}" data-name="${esc(ex.name)}" data-pattern="${ex.pattern || ''}">
        <div>${ex.name}</div>
        <div class="meta">${ex.pattern || ''} · ${(ex.equipment || []).join(', ')}</div>
      </div>`
      )
      .join('');
    el.classList.add('open');
    el.querySelectorAll('.search-item').forEach((item) => {
      item.addEventListener('click', () => {
        const picked = exercises[Number(item.dataset.idx)];
        addExerciseToWorkout(picked ? { ...picked, exerciseId: picked._id, exerciseName: picked.name } : { exerciseId: item.dataset.id, exerciseName: item.dataset.name });
        el.classList.remove('open');
        document.getElementById('wo-ex-search').value = '';
      });
    });
  } catch (err) {
    console.error(err);
  }
}

// ========== Workouts v2: set grid, set types, rest timer, progression, plan cards ==========
const P = window.Progression;
let currentWorkoutExercises = [];
let woPlanDay = '';
let woHistoryCache = [];
let woEditing = null; // { ex, set }
let woUid = 0;
// autosave state (see 'Autosave of the in-progress workout')
let draftReady = false;        // false until we've checked for a draft to restore (prevents wiping it on boot)
let draftCheckedFor = null;
let draftSyncTimer = null;
let draftHasSaved = false;
let draftPending = null;

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function woUnit() { return settings.unit === 'kg' ? 'kg' : 'lbs'; }
function woUnitLabel() { return settings.unit === 'kg' ? 'kg' : 'lb'; }
function woDisp(lbs) { return P.displayLoad(Number(lbs) || 0, woUnit()); }
function woToLbs(v) { return woUnit() === 'kg' ? Number(v) * P.LB_PER_KG : Number(v); }
function woStep() { return woUnit() === 'kg' ? 2.5 : 5; }
function woFocus() { return (settings.trainingFocus || [])[0] || 'hypertrophy'; }
function restKey(ex) { return String(ex.exerciseId || ex.exerciseName || '').toLowerCase().replace(/[.$]/g, '_'); }
function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function daysAgoText(date) {
  if (!date) return 'Not done yet';
  const d = Math.round((new Date(todayStr() + 'T12:00:00') - new Date(date + 'T12:00:00')) / 86400000);
  if (d <= 0) return 'Last done today';
  if (d === 1) return 'Last done yesterday';
  return `Last done ${d} days ago`;
}

// ---------- Body map ----------
const MUSCLE_REGIONS = {
  chest: ['chest'], pecs: ['chest'],
  shoulders: ['delts-f', 'delts-b'], delts: ['delts-f', 'delts-b'], 'rear delts': ['delts-b'],
  triceps: ['triceps'], biceps: ['biceps'], forearms: ['forearms'], grip: ['forearms'],
  core: ['abs'], abs: ['abs'], obliques: ['abs'],
  quads: ['quads'], adductors: ['quads'], hamstrings: ['hams'], glutes: ['glutes'], calves: ['calves'],
  back: ['lats', 'lowback'], lats: ['lats'], 'upper back': ['traps'], traps: ['traps'], 'lower back': ['lowback'],
  legs: ['quads', 'hams', 'glutes', 'calves'],
  'full body': ['quads', 'hams', 'glutes', 'lats', 'delts-f', 'delts-b', 'abs', 'traps']
};
const PATTERN_REGIONS = {
  horizontal_push: ['chest', 'triceps', 'delts-f'], vertical_push: ['delts-f', 'triceps'],
  horizontal_pull: ['lats', 'traps', 'biceps'], vertical_pull: ['lats', 'biceps'],
  squat: ['quads', 'glutes'], hinge: ['hams', 'glutes', 'lowback'], lunge: ['quads', 'glutes'],
  carry: ['forearms', 'traps', 'abs'], core: ['abs'], olympic: ['quads', 'glutes', 'traps', 'hams']
};
function regionsFor(details) {
  const set = new Set();
  (details || []).forEach((d) => {
    const muscles = (d.primaryMuscles || []).map((m) => String(m).toLowerCase());
    let hit = false;
    muscles.forEach((m) => (MUSCLE_REGIONS[m] || []).forEach((r) => { set.add(r); hit = true; }));
    if (!hit) (PATTERN_REGIONS[d.pattern] || []).forEach((r) => set.add(r));
  });
  return set;
}
function bodyMapSvg(details, cls = '') {
  const on = regionsFor(details);
  const r = (key, shape) => `<g class="${on.has(key) ? 'bm-on' : 'bm-off'}">${shape}</g>`;
  const fig = (dx) => `
    <circle cx="${30 + dx}" cy="9" r="6"/>
    <rect x="${27 + dx}" y="14" width="6" height="4"/>
    <rect x="${18 + dx}" y="17" width="24" height="30" rx="6"/>
    <rect x="${19 + dx}" y="44" width="22" height="10" rx="4"/>
    <rect x="${11 + dx}" y="19" width="6" height="17" rx="3"/><rect x="${43 + dx}" y="19" width="6" height="17" rx="3"/>
    <rect x="${9 + dx}" y="35" width="6" height="17" rx="3"/><rect x="${45 + dx}" y="35" width="6" height="17" rx="3"/>
    <rect x="${19.5 + dx}" y="52" width="10" height="27" rx="4.5"/><rect x="${30.5 + dx}" y="52" width="10" height="27" rx="4.5"/>
    <rect x="${20.5 + dx}" y="78" width="8" height="25" rx="3.5"/><rect x="${31.5 + dx}" y="78" width="8" height="25" rx="3.5"/>`;
  const front = [
    r('delts-f', '<ellipse cx="16" cy="21" rx="4.6" ry="4"/><ellipse cx="44" cy="21" rx="4.6" ry="4"/>'),
    r('chest', '<path d="M20.5,21.5 Q25,19 29.5,20.5 L29.5,30 Q24,32 20.5,28.5 Z"/><path d="M39.5,21.5 Q35,19 30.5,20.5 L30.5,30 Q36,32 39.5,28.5 Z"/>'),
    r('biceps', '<ellipse cx="14" cy="28" rx="2.8" ry="6"/><ellipse cx="46" cy="28" rx="2.8" ry="6"/>'),
    r('forearms', '<ellipse cx="12" cy="43" rx="2.6" ry="6.5"/><ellipse cx="48" cy="43" rx="2.6" ry="6.5"/>'),
    r('abs', '<rect x="25" y="32" width="10" height="14" rx="2.5"/><ellipse cx="21.6" cy="38" rx="2.3" ry="6"/><ellipse cx="38.4" cy="38" rx="2.3" ry="6"/>'),
    r('quads', '<ellipse cx="24.5" cy="64" rx="4.4" ry="10.5"/><ellipse cx="35.5" cy="64" rx="4.4" ry="10.5"/>'),
    r('calves', '<ellipse cx="24.5" cy="88" rx="2.6" ry="8"/><ellipse cx="35.5" cy="88" rx="2.6" ry="8"/>')
  ].join('');
  const back = [
    r('traps', '<path d="M84,17.5 Q90,14.5 96,17.5 L94,24 Q90,26 86,24 Z"/>'),
    r('delts-b', '<ellipse cx="76" cy="21" rx="4.6" ry="4"/><ellipse cx="104" cy="21" rx="4.6" ry="4"/>'),
    r('lats', '<path d="M79.5,24 Q84.5,23 89.3,27 L89.3,38 Q84,40 80.5,34 Z"/><path d="M100.5,24 Q95.5,23 90.7,27 L90.7,38 Q96,40 99.5,34 Z"/>'),
    r('lowback', '<rect x="86" y="37.5" width="8" height="8.5" rx="2"/>'),
    r('triceps', '<ellipse cx="74" cy="28" rx="2.8" ry="6"/><ellipse cx="106" cy="28" rx="2.8" ry="6"/>'),
    r('forearms', '<ellipse cx="72" cy="43" rx="2.6" ry="6.5"/><ellipse cx="108" cy="43" rx="2.6" ry="6.5"/>'),
    r('glutes', '<ellipse cx="85.2" cy="50.5" rx="4.9" ry="5"/><ellipse cx="94.8" cy="50.5" rx="4.9" ry="5"/>'),
    r('hams', '<ellipse cx="84.5" cy="66" rx="4.2" ry="9.5"/><ellipse cx="95.5" cy="66" rx="4.2" ry="9.5"/>'),
    r('calves', '<ellipse cx="84.5" cy="87" rx="3.1" ry="8"/><ellipse cx="95.5" cy="87" rx="3.1" ry="8"/>')
  ].join('');
  const names = [...on].map((k) => k.replace(/-[fb]$/, '')).filter((v, i, a) => a.indexOf(v) === i);
  return `<svg class="body-map ${cls}" viewBox="0 0 120 105" role="img" aria-label="Muscles worked: ${esc(names.join(', ') || 'none')}">
    <g class="bm-base">${fig(0)}${fig(60)}</g>${front}${back}</svg>`;
}

function exThumb(ex, size = '') {
  if (ex.imageUrl) return `<img class="ex-thumb ${size}" src="${esc(ex.imageUrl)}" alt="" loading="lazy" />`;
  const eq = (ex.equipment || [])[0] || '';
  const icons = {
    barbell: '<rect x="4" y="15" width="32" height="2.4" rx="1"/><rect x="7" y="9" width="3.4" height="14" rx="1"/><rect x="29.6" y="9" width="3.4" height="14" rx="1"/><rect x="3" y="11.5" width="3" height="9" rx="1"/><rect x="34" y="11.5" width="3" height="9" rx="1"/>',
    dumbbell: '<rect x="11" y="15" width="18" height="2.6" rx="1"/><rect x="7" y="10" width="5" height="12.6" rx="1.5"/><rect x="28" y="10" width="5" height="12.6" rx="1.5"/>',
    kettlebell: '<path d="M14 12 Q20 3 26 12" fill="none" stroke-width="2.6"/><circle cx="20" cy="20" r="8"/>',
    cable: '<rect x="18.8" y="3" width="2.4" height="16"/><circle cx="20" cy="22" r="4"/><rect x="12" y="25" width="16" height="3" rx="1.5"/>',
    machine: '<rect x="8" y="5" width="4" height="24" rx="1"/><rect x="12" y="12" width="16" height="4" rx="1"/><rect x="24" y="16" width="4" height="13" rx="1"/>'
  };
  const pick = icons[eq] || icons[{ trap_bar: 'barbell', safety_bar: 'barbell', machine: 'machine', cable: 'cable' }[eq]] || null;
  if (pick) return `<span class="ex-thumb ${size}" aria-hidden="true"><svg viewBox="0 0 40 32">${pick}</svg></span>`;
  const initials = String(ex.exerciseName || ex.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="ex-thumb ${size} ex-thumb-text" aria-hidden="true">${esc(initials)}</span>`;
}

// ---------- Session state ----------
function makeEntry(info) {
  const repMin = Number(info.repMin) || null;
  const repMax = Number(info.repMax) || null;
  const range = P.rangeFor({ focus: woFocus(), repMin, repMax });
  const targetReps = Number(info.targetReps) || range.low;
  const targetSets = Number(info.targetSets) || 3;
  const cachedRest = Number(localStorage.getItem('fc-rest:' + restKey(info)));
  return {
    uid: ++woUid,
    exerciseId: info.exerciseId || info._id || null,
    exerciseName: info.exerciseName || info.name,
    pattern: info.pattern || '',
    primaryMuscles: info.primaryMuscles || [],
    equipment: info.equipment || [],
    imageUrl: info.imageUrl || '',
    isLower: info.isLower,
    repMin, repMax,
    restSec: Number.isFinite(Number(info.restSec)) && info.restSec != null ? Number(info.restSec)
      : (Number.isFinite(cachedRest) && localStorage.getItem('fc-rest:' + restKey(info)) != null ? cachedRest : 90),
    lastSets: [], lastDate: null, lastE1rm: 0, bestE1rm: 0, suggestion: null,
    touched: false,
    sets: Array.from({ length: targetSets }, () => ({ type: 'working', weight: Number(info.targetWeight) || 0, reps: targetReps, logged: false }))
  };
}

function addExerciseToWorkout(idOrInfo, maybeName) {
  const info = typeof idOrInfo === 'object' && idOrInfo ? idOrInfo : { exerciseId: idOrInfo, exerciseName: maybeName };
  const entry = makeEntry(info);
  currentWorkoutExercises.push(entry);
  renderWorkoutExercises();
  document.getElementById('btn-save-workout').disabled = false;
  startWorkoutTimer();
  loadSuggestion(entry.uid);
  return entry;
}

async function loadSuggestion(uid) {
  const ex = currentWorkoutExercises.find((e) => e.uid === uid);
  if (!ex) return;
  const q = new URLSearchParams();
  if (ex.exerciseId) q.set('exerciseId', ex.exerciseId);
  q.set('name', ex.exerciseName);
  if (ex.repMin) q.set('repMin', ex.repMin);
  if (ex.repMax) q.set('repMax', ex.repMax);
  try {
    const data = await api(`/workouts/suggest-load?${q}`);
    if (!currentWorkoutExercises.includes(ex)) return;
    ex.lastSets = data.lastSets || [];
    ex.lastDate = data.lastDate || null;
    ex.lastE1rm = data.lastE1rm || 0;
    ex.bestE1rm = data.bestE1rm || 0;
    ex.suggestion = data.suggestion || null;
    if (ex.isLower == null) ex.isLower = data.isLower;
    if (data.restSec != null && localStorage.getItem('fc-rest:' + restKey(ex)) == null) ex.restSec = data.restSec;
    if (data.ready && ex.lastSets.length && !ex.touched) {
      ex.sets = P.prefillFromLast(ex.lastSets, data.suggestion, woUnit());
    }
    renderWorkoutExercises();
  } catch (err) {
    ex.suggestion = null;
    renderWorkoutExercises();
  }
}

function markPRs(ex) {
  let running = ex.bestE1rm || 0;
  ex.sets.forEach((s) => {
    s.pr = false;
    if (!s.logged || !P.isWorking(s)) return;
    const v = P.e1rm(s.weight, s.reps);
    if (ex.bestE1rm > 0 && Math.round(v) > Math.round(running)) { s.pr = true; running = v; }
  });
}

// ---------- Workout clock ----------
let workoutTimerId = null;
let workoutStartedAt = null;
function startWorkoutTimer(startedAt) {
  if (workoutTimerId) return;
  workoutStartedAt = startedAt || Date.now();
  const el = document.getElementById('wo-timer');
  workoutTimerId = setInterval(() => {
    const s = Math.floor((Date.now() - workoutStartedAt) / 1000);
    if (el) el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}
function stopWorkoutTimer() {
  clearInterval(workoutTimerId);
  workoutTimerId = null;
  workoutStartedAt = null;
  const el = document.getElementById('wo-timer');
  if (el) el.textContent = '00:00';
}

// ---------- Rest timer (timestamp based so it survives backgrounding) ----------
let rest = JSON.parse(localStorage.getItem('fc-rest-active') || 'null');
let restTick = null;
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch { audioCtx = null; }
}
function restChime() {
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch {}
  try {
    if (!audioCtx) return;
    [0, 0.28].forEach((t) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      const at = audioCtx.currentTime + t;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.12, at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      o.connect(g).connect(audioCtx.destination);
      o.start(at); o.stop(at + 0.25);
    });
  } catch {}
}
function startRest(seconds, label = '') {
  if (!(seconds > 0)) return;
  rest = { endsAt: Date.now() + seconds * 1000, total: seconds, label };
  localStorage.setItem('fc-rest-active', JSON.stringify(rest));
  renderRest();
  scheduleDraftSave();
}
function stopRest(done) {
  rest = null;
  localStorage.removeItem('fc-rest-active');
  scheduleDraftSave();
  clearInterval(restTick); restTick = null;
  const bar = document.getElementById('wo-rest');
  if (!bar) return;
  if (done) {
    bar.hidden = false;
    bar.className = 'rest-bar rest-done';
    bar.innerHTML = '<span class="rest-time">Rest over</span><span class="rest-label">Next set when ready</span><button type="button" class="rest-btn" data-rest="close">OK</button>';
    setTimeout(() => { if (!rest) bar.hidden = true; }, 4000);
  } else {
    bar.hidden = true;
  }
}
function renderRest() {
  const bar = document.getElementById('wo-rest');
  if (!bar) return;
  if (!rest) { bar.hidden = true; return; }
  const left = (rest.endsAt - Date.now()) / 1000;
  if (left <= 0) { restChime(); stopRest(true); return; }
  bar.hidden = false;
  bar.className = 'rest-bar';
  const pct = Math.max(0, Math.min(100, (left / rest.total) * 100));
  bar.innerHTML = `
    <div class="rest-progress" style="width:${pct}%"></div>
    <div class="rest-info"><span class="rest-time">${fmtClock(left)}</span><span class="rest-label">Rest${rest.label ? ' · ' + esc(rest.label) : ''}</span></div>
    <button type="button" class="rest-btn" data-rest="-15" aria-label="Subtract 15 seconds">−15s</button>
    <button type="button" class="rest-btn" data-rest="15" aria-label="Add 15 seconds">+15s</button>
    <button type="button" class="rest-btn rest-skip" data-rest="skip">Skip</button>`;
  if (!restTick) restTick = setInterval(renderRest, 250);
}
document.getElementById('wo-rest').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rest]');
  if (!b) return;
  const v = b.dataset.rest;
  if (v === 'skip' || v === 'close') return stopRest(false);
  if (!rest) return;
  rest.endsAt += Number(v) * 1000;
  rest.total = Math.max(rest.total + Number(v), 1);
  localStorage.setItem('fc-rest-active', JSON.stringify(rest));
  renderRest();
  scheduleDraftSave();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && rest) renderRest(); });
if (rest) renderRest();

// ---------- Session rendering ----------
const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

function renderWorkoutExercises() {
  scheduleDraftSave();
  const el = document.getElementById('wo-exercise-list');
  if (!currentWorkoutExercises.length) {
    el.innerHTML = '<div class="empty">Start a day from your plan below, or add an exercise to begin.</div>';
    return;
  }
  const u = woUnitLabel();
  el.innerHTML = currentWorkoutExercises.map((ex, idx) => {
    markPRs(ex);
    const labels = P.setLabels(ex.sets);
    const sessionBest = P.bestE1rm(ex.sets.filter((s) => s.logged)).value;
    const shownE1rm = Math.round(sessionBest || ex.lastE1rm || 0);
    const isPR = ex.sets.some((s) => s.pr);
    const sugg = ex.suggestion;
    const suggText = sugg && sugg.reason ? sugg.reason
      : sugg && sugg.action === 'start' ? `First time logging this. ${sugg.note || ''}` : '';
    const restOpts = REST_OPTIONS.concat(REST_OPTIONS.includes(ex.restSec) ? [] : [ex.restSec]).sort((a, b) => a - b)
      .map((s) => `<option value="${s}" ${s === ex.restSec ? 'selected' : ''}>${s ? fmtClock(s) : 'Off'}</option>`).join('');
    const rows = ex.sets.map((s, si) => {
      const lab = labels[si];
      const editing = woEditing && woEditing.ex === idx && woEditing.set === si;
      const row = `
        <div class="wx-row ${s.logged ? 'logged' : ''} ${editing ? 'editing' : ''} t-${lab.type}">
          <button type="button" class="set-type" data-type="${idx}:${si}" aria-label="Set type: ${lab.type}. Tap to change">${lab.label}</button>
          <button type="button" class="set-val" data-edit="${idx}:${si}">${woDisp(s.weight)}</button>
          <button type="button" class="set-val" data-edit="${idx}:${si}">${s.reps}</button>
          <button type="button" class="set-done ${s.logged ? 'on' : ''}" data-done="${idx}:${si}" aria-label="${s.logged ? 'Undo set' : 'Log set'}">✓</button>
          ${s.pr ? '<span class="pr-badge" title="New estimated 1RM">PR</span>' : ''}
        </div>`;
      if (!editing) return row;
      return row + `
        <div class="wx-editor">
          <div class="stepper">
            <span class="stepper-label">${u === 'kg' ? 'Kg' : 'Lbs'}</span>
            <button type="button" class="step-btn" data-step="${idx}:${si}:w:-1" aria-label="Less weight">−</button>
            <input type="number" inputmode="decimal" class="step-input" data-input="${idx}:${si}:w" value="${woDisp(s.weight)}" step="${woStep()}" min="0" />
            <button type="button" class="step-btn" data-step="${idx}:${si}:w:1" aria-label="More weight">+</button>
          </div>
          <div class="stepper">
            <span class="stepper-label">Reps</span>
            <button type="button" class="step-btn" data-step="${idx}:${si}:r:-1" aria-label="Fewer reps">−</button>
            <input type="number" inputmode="numeric" class="step-input" data-input="${idx}:${si}:r" value="${s.reps}" step="1" min="0" />
            <button type="button" class="step-btn" data-step="${idx}:${si}:r:1" aria-label="More reps">+</button>
          </div>
          <div class="wx-editor-actions">
            <button type="button" class="btn btn-secondary" data-same="${idx}:${si}" ${si === 0 ? 'disabled' : ''}>Same as last set</button>
            <button type="button" class="btn btn-primary" data-close-edit="1">Done</button>
          </div>
        </div>`;
    }).join('');
    return `
    <div class="wx-card" data-idx="${idx}">
      <div class="wx-head">
        ${exThumb(ex)}
        <div class="wx-title">
          <div class="wx-name">${esc(ex.exerciseName)}</div>
          ${(window.AboutYouUI ? window.AboutYouUI.badgeHtml(ex) : '')}
          <div class="wx-meta">
            ${shownE1rm ? `<span class="wx-1rm">Est. 1RM <strong>${woDisp(shownE1rm)} ${u}</strong></span>` : '<span class="wx-1rm">Est. 1RM —</span>'}
            ${isPR ? '<span class="pr-badge">PR</span>' : ''}
          </div>
        </div>
        <button type="button" class="icon-btn" data-swap="${idx}" aria-label="Swap exercise">⇄</button>
        <button type="button" class="icon-btn icon-danger" data-remove="${idx}" aria-label="Remove exercise">×</button>
      </div>
      ${ex.lastSets.length ? `<div class="wx-last"><span>Last${ex.lastDate ? ' (' + esc(formatDate(ex.lastDate).replace(/, \d{4}$/, '')) + ')' : ''}:</span> ${esc(P.formatSets(ex.lastSets, woUnit(), 5))}</div>` : ''}
      ${suggText ? `<div class="wx-suggest">${esc(suggText)}</div>` : ''}
      <div class="wx-grid">
        <div class="wx-row wx-hdr"><span>Set</span><span>${u === 'kg' ? 'Kg' : 'Lbs'}</span><span>Reps</span><span>✓</span></div>
        ${rows}
      </div>
      <div class="wx-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-add-set="${idx}">+ Add set</button>
        <button type="button" class="btn btn-ghost btn-sm" data-del-set="${idx}" ${ex.sets.length ? '' : 'disabled'}>− Remove set</button>
        <label class="rest-pick">⏱ <select data-rest-sel="${idx}" aria-label="Rest timer for ${esc(ex.exerciseName)}">${restOpts}</select></label>
      </div>
    </div>`;
  }).join('');
}

function woSetFrom(attr) { const [i, s] = attr.split(':').map(Number); return { i, s, ex: currentWorkoutExercises[i], set: currentWorkoutExercises[i]?.sets[s] }; }

document.getElementById('wo-exercise-list').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.type) {
    const { ex, set } = woSetFrom(d.type);
    set.type = P.nextSetType(P.setType(set));
    ex.touched = true;
  } else if (d.edit) {
    const { i, s } = woSetFrom(d.edit);
    woEditing = woEditing && woEditing.ex === i && woEditing.set === s ? null : { ex: i, set: s };
  } else if (d.done) {
    const { ex, set } = woSetFrom(d.done);
    unlockAudio();
    set.logged = !set.logged;
    ex.touched = true;
    woEditing = null;
    if (set.logged) startRest(ex.restSec, ex.exerciseName);
  } else if (d.step) {
    const [i, s, f, dir] = d.step.split(':');
    const set = currentWorkoutExercises[i].sets[s];
    if (f === 'w') set.weight = Math.max(0, woToLbs(woDisp(set.weight) + Number(dir) * woStep()));
    else set.reps = Math.max(0, (Number(set.reps) || 0) + Number(dir));
    currentWorkoutExercises[i].touched = true;
  } else if (d.same) {
    const { ex, s, set } = woSetFrom(d.same);
    const prev = ex.sets[s - 1];
    if (prev) { set.weight = prev.weight; set.reps = prev.reps; set.type = P.setType(prev) === 'warmup' ? 'warmup' : 'working'; }
    ex.touched = true;
  } else if (d.closeEdit) {
    woEditing = null;
  } else if (d.addSet) {
    const ex = currentWorkoutExercises[d.addSet];
    const last = ex.sets[ex.sets.length - 1] || { weight: 0, reps: ex.repMin || 8, type: 'working' };
    ex.sets.push({ type: P.setType(last) === 'warmup' ? 'working' : P.setType(last), weight: last.weight, reps: last.reps, logged: false });
    ex.touched = true;
  } else if (d.delSet) {
    const ex = currentWorkoutExercises[d.delSet];
    let idx = -1;
    for (let k = ex.sets.length - 1; k >= 0; k -= 1) if (!ex.sets[k].logged) { idx = k; break; }
    if (idx < 0) idx = ex.sets.length - 1;
    if (idx >= 0) ex.sets.splice(idx, 1);
    woEditing = null; ex.touched = true;
  } else if (d.remove) {
    currentWorkoutExercises.splice(Number(d.remove), 1);
    woEditing = null;
    document.getElementById('btn-save-workout').disabled = !currentWorkoutExercises.length;
  } else if (d.swap) {
    const idx = Number(d.swap);
    const ex = currentWorkoutExercises[idx];
    return openSwapSheet(ex, (chosen) => {
      const fresh = makeEntry({ ...chosen, exerciseId: chosen._id, exerciseName: chosen.name, repMin: ex.repMin, repMax: ex.repMax, targetSets: ex.sets.length, targetReps: ex.sets[0]?.reps });
      currentWorkoutExercises[idx] = fresh;
      renderWorkoutExercises();
      loadSuggestion(fresh.uid);
      toast('Swapped to ' + chosen.name);
    });
  } else return;
  renderWorkoutExercises();
});

document.getElementById('wo-exercise-list').addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.input) {
    const [i, s, f] = t.dataset.input.split(':');
    const set = currentWorkoutExercises[i].sets[s];
    const v = parseFloat(t.value);
    if (f === 'w') set.weight = v >= 0 ? woToLbs(v) : 0;
    else set.reps = v >= 0 ? Math.round(v) : 0;
    currentWorkoutExercises[i].touched = true;
    renderWorkoutExercises();
  } else if (t.dataset.restSel) {
    const ex = currentWorkoutExercises[t.dataset.restSel];
    ex.restSec = Number(t.value);
    localStorage.setItem('fc-rest:' + restKey(ex), String(ex.restSec));
    try { await api('/settings/rest-timer', { method: 'PUT', body: JSON.stringify({ key: restKey(ex), seconds: ex.restSec }) }); } catch {}
    toast(`Rest for ${ex.exerciseName}: ${ex.restSec ? fmtClock(ex.restSec) : 'off'}`);
  }
});

// ---------- Swap sheet (reuses /exercises/:id/swaps) ----------
async function openSwapSheet(ex, onPick) {
  let id = ex.exerciseId;
  try {
    if (!id) {
      const found = await api(`/workouts/exercises?q=${encodeURIComponent(ex.exerciseName || ex.name)}`);
      id = (found.find((f) => f.name.toLowerCase() === String(ex.exerciseName || ex.name).toLowerCase()) || found[0] || {})._id;
    }
    if (!id) return toast('No swap data for this exercise');
    const data = await api(`/workouts/exercises/${id}/swaps`);
    if (!data.swaps?.length) return toast('No swaps found for this pattern');
    const sheet = document.getElementById('wo-sheet');
    sheet.innerHTML = `<div class="sheet" role="dialog" aria-label="Swap exercise">
      <div class="sheet-head"><strong>Swap ${esc(ex.exerciseName || ex.name)}</strong><button type="button" class="icon-btn" data-sheet-close aria-label="Close">×</button></div>
      <p class="hint">Same movement pattern (${esc((data.exercise.pattern || '').replace(/_/g, ' '))})</p>
      ${window.AboutYouUI && (window.AboutYouUI.state.answers?.easyOn?.length || window.AboutYouUI.state.answers?.equipment?.length) ? '<p class="hint">Sorted by your About you answers: doable with your equipment and easier on the areas you flagged come first.</p>' : ''}
      <div class="swap-list">${(window.AboutYouUI ? window.AboutYouUI.rankSwaps(data.swaps) : data.swaps.map((s, i) => ({ s, i, flags: [], ok: true }))).map(({ s, i, ok }) => `<button type="button" class="swap-item" data-pick="${i}">${exThumb(s, 'sm')}<span><strong>${esc(s.name)}</strong><small>${esc((s.equipment || []).join(', ').replace(/_/g, ' '))}${ok ? '' : ' · needs equipment you didn\'t list'}</small>${window.AboutYouUI ? window.AboutYouUI.badgeHtml(s) : ''}</span></button>`).join('')}</div>
    </div>`;
    sheet.hidden = false;
    sheet.onclick = (ev) => {
      if (ev.target === sheet || ev.target.closest('[data-sheet-close]')) { sheet.hidden = true; return; }
      const pick = ev.target.closest('[data-pick]');
      if (pick) { sheet.hidden = true; onPick(data.swaps[Number(pick.dataset.pick)]); }
    };
  } catch (err) {
    toast(err.message);
  }
}

// ---------- Start / finish ----------
document.getElementById('btn-quick-workout').addEventListener('click', () => {
  currentWorkoutExercises = [];
  woPlanDay = '';
  woEditing = null;
  document.getElementById('wo-name').value = 'Quick Workout';
  document.getElementById('wo-date').value = todayStr();
  renderWorkoutExercises();
  document.getElementById('btn-save-workout').disabled = true;
  document.getElementById('wo-ex-search').focus();
  toast('Quick workout started — add an exercise');
});

document.getElementById('btn-save-workout').addEventListener('click', async () => {
  const date = document.getElementById('wo-date').value || todayStr();
  const name = document.getElementById('wo-name').value.trim() || 'Workout';
  const done = currentWorkoutExercises
    .map((e) => ({ ...e, logged: e.sets.filter((s) => s.logged) }))
    .filter((e) => e.logged.length);
  if (!done.length) return toast('Check off at least one set first');
  const durationMin = workoutStartedAt ? Math.max(1, Math.round((Date.now() - workoutStartedAt) / 60000)) : null;
  try {
    await api('/workouts', {
      method: 'POST',
      body: JSON.stringify({
        date, name, durationMin, planDay: woPlanDay,
        exercises: done.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          restSec: e.restSec,
          sets: e.logged.map((s) => ({ type: P.setType(s), weight: Math.round(s.weight * 100) / 100, reps: s.reps }))
        }))
      })
    });
    clearWorkoutDraft();
    showWorkoutSummary({ name, durationMin, exercises: done });
    currentWorkoutExercises = [];
    woPlanDay = '';
    woEditing = null;
    document.getElementById('wo-name').value = '';
    renderWorkoutExercises();
    document.getElementById('btn-save-workout').disabled = true;
    stopWorkoutTimer();
    stopRest(false);
    loadWorkoutHistory();
    loadPlans();
  } catch (err) {
    toast(err.message);
  }
});

function showWorkoutSummary({ name, durationMin, exercises }) {
  const u = woUnitLabel();
  let vol = 0; let setCount = 0; const prs = []; const next = [];
  exercises.forEach((e) => {
    const logged = e.logged;
    vol += P.volume(logged);
    setCount += P.workingSets(logged).length;
    let running = e.bestE1rm || 0; let prSet = null;
    if (running > 0) logged.forEach((s) => { const v = P.isWorking(s) ? P.e1rm(s.weight, s.reps) : 0; if (Math.round(v) > Math.round(running)) { running = v; prSet = s; } });
    if (prSet) prs.push({ name: e.exerciseName, set: prSet, e1rm: running, prev: e.bestE1rm });
    const sug = P.suggestNext(logged, { unit: woUnit(), focus: woFocus(), repMin: e.repMin, repMax: e.repMax, isLower: e.isLower, exercise: e });
    next.push({ name: e.exerciseName, sug });
  });
  const sheet = document.getElementById('wo-sheet');
  sheet.innerHTML = `<div class="sheet summary-sheet" role="dialog" aria-label="Workout summary">
    <div class="sheet-head"><div><div class="summary-kicker">Workout complete</div><strong class="summary-title">${esc(name)}</strong></div><button type="button" class="icon-btn" data-sheet-close aria-label="Close">×</button></div>
    <div class="summary-stats">
      <div><span>${durationMin ? durationMin + ' min' : '—'}</span><small>Duration</small></div>
      <div><span>${setCount}</span><small>Working sets</small></div>
      <div><span>${Math.round(woDisp(vol)).toLocaleString()}</span><small>Volume (${u})</small></div>
      <div><span>${prs.length}</span><small>PRs</small></div>
    </div>
    ${prs.length ? `<h3 class="summary-h">New records</h3>${prs.map((p) => `<div class="summary-pr"><span class="pr-badge">PR</span><div><strong>${esc(p.name)}</strong><small>${woDisp(p.set.weight)}×${p.set.reps} → est. 1RM ${woDisp(Math.round(p.e1rm))} ${u} (was ${woDisp(Math.round(p.prev))})</small></div></div>`).join('')}` : ''}
    <h3 class="summary-h">Next time</h3>
    ${next.map((n) => `<div class="summary-next"><div class="summary-next-top"><strong>${esc(n.name)}</strong><span class="next-chip next-${n.sug.action}">${n.sug.weight ? woDisp(n.sug.weight) + ' ' + u + ' × ' + n.sug.reps : n.sug.reps + ' reps'}</span></div><small>${esc(String(n.sug.reason || '').replace(/ last time\b/g, ' today'))}</small></div>`).join('')}
    <button type="button" class="btn btn-primary btn-block btn-lg" data-sheet-close>Done</button>
  </div>`;
  sheet.hidden = false;
  sheet.onclick = (ev) => { if (ev.target === sheet || ev.target.closest('[data-sheet-close]')) sheet.hidden = true; };
}

document.getElementById('btn-save-as-routine').addEventListener('click', async () => {
  const name = document.getElementById('routine-name').value.trim();
  if (!name) return toast('Enter a routine name');
  if (!currentWorkoutExercises.length) return toast('Add exercises first');
  try {
    await api('/workouts/routines', {
      method: 'POST',
      body: JSON.stringify({
        name,
        exercises: currentWorkoutExercises.map((e) => {
          const work = P.workingSets(e.sets);
          return {
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            targetSets: work.length || e.sets.length,
            targetReps: work[0]?.reps || e.sets[0]?.reps || 8,
            repMin: e.repMin || undefined,
            repMax: e.repMax || undefined,
            restSec: e.restSec
          };
        })
      })
    });
    toast('Routine saved');
    document.getElementById('routine-name').value = '';
    loadPlans();
  } catch (err) {
    toast(err.message);
  }
});

// ---------- Plan overview + day details ----------
let woPlanDays = new Map();
let woDayView = null;

function lastDoneFor(day) {
  const hit = woHistoryCache.find((l) => (l.planDay && l.planDay === day.planDay) ||
    l.name === day.name || l.name === day.sessionName);
  return hit ? hit.date : null;
}
function dayMinutes(day) {
  return P.estimateMinutes(day.details.map((d) => ({
    targetSets: d.targetSets,
    targetReps: d.targetReps || Math.round(((d.repMin || 8) + (d.repMax || d.repMin || 8)) / 2),
    restSec: d.restSec != null ? d.restSec : Number(localStorage.getItem('fc-rest:' + restKey({ exerciseId: d.exerciseId, exerciseName: d.name })) || 90)
  })));
}
function dayCard(day) {
  woPlanDays.set(day.planDay, day);
  const n = day.details.length;
  return `<button type="button" class="day-card" data-day="${esc(day.planDay)}">
    <div class="day-card-main">
      <span class="day-num">Day ${day.number}</span>
      <span class="day-name">${esc(day.name)}</span>
      <span class="day-meta"><span>⏱ ~${dayMinutes(day)} min</span><span>${n} exercise${n === 1 ? '' : 's'}</span></span>
      <span class="day-last">${daysAgoText(lastDoneFor(day))}</span>
    </div>
    ${bodyMapSvg(day.details, 'body-map-sm')}
  </button>`;
}

async function loadPlans() {
  woPlanDays = new Map();
  try {
    const activities = selectedProgramActivities();
    const days = selectedDaysPerWeek();
    const params = [];
    if (activities.length) params.push('activities=' + activities.map(encodeURIComponent).join(','));
    if (days) params.push('daysPerWeek=' + days);
    const q = params.length ? '?' + params.join('&') : '';
    const [programs, routines, history] = await Promise.all([
      api('/workouts/programs' + q),
      api('/workouts/routines').catch(() => []),
      api('/workouts?limit=50').catch(() => [])
    ]);
    woHistoryCache = history;
    const rEl = document.getElementById('wo-routines');
    rEl.innerHTML = routines.length
      ? `<div class="day-grid">${routines.map((r, i) => dayCard({
        planDay: r.planDay || `routine:${r._id}`, number: i + 1, name: r.name, sessionName: r.name,
        details: r.details || r.exercises.map((e) => ({ name: e.exerciseName, exerciseId: e.exercise, targetSets: e.targetSets, targetReps: e.targetReps })),
        routineId: r._id
      })).join('')}</div>`
      : '<div class="empty">No saved routines yet. Finish a session and save it as a routine.</div>';
    const pEl = document.getElementById('wo-programs');
    const hint = document.getElementById('wo-program-hint');
    if (hint) {
      if (!activities.length) {
        hint.textContent = 'Select one or more activities to see suggested programs.';
      } else {
        const labels = activities.map((a) => ACT.ARCHETYPES[a]?.label || a);
        const dayHint = days ? ` · ${days} days/week only` : '';
        hint.textContent = (labels.length === 1
          ? `Plans for ${labels[0]}, best match first.`
          : `Plans for ${labels.length} activities (combined), best match first.`) + dayHint;
      }
    }
    updateActivitiesSummary();
    woPrograms = new Map();
    if (!activities.length) {
      pEl.innerHTML = '<div class="empty">No activities selected yet. Use Select activities to populate suggestions.</div>';
      return;
    }
    if (!programs.length) {
      pEl.innerHTML = days
        ? `<div class="empty">No ${days}-day programs match these activities. Try Any days, or pick different activities.</div>`
        : '<div class="empty">No programs for these activities.</div>';
      return;
    }
    pEl.innerHTML = `<div class="plan-grid">${programs.map((p) => planCard(p, true)).join('')}</div>`;
    if (woReopenPlan && woPrograms.has(woReopenPlan)) openPlanSheet(woReopenPlan);
    woReopenPlan = null;
  } catch (err) {
    console.error(err);
  }
}

let woPrograms = new Map();
let woReopenPlan = null;
let woDayFromPlan = null;

function programDays(p) {
  return p.days.map((d, i) => ({
    planDay: d.planDay || `${p.id}:${d.name}`, number: d.number || i + 1, name: d.name, programName: p.name, programId: p.id,
    sessionName: `${p.name} · ${d.name}`,
    details: d.details || d.exercises.map((x) => ({ name: x }))
  }));
}
function planCard(p, filtered) {
  const days = programDays(p);
  woPrograms.set(p.id, { ...p, planDays: days });
  const all = days.flatMap((d) => d.details);
  const mins = days.length ? Math.round(days.reduce((s, d) => s + dayMinutes(d), 0) / days.length) : 0;
  const last = days.map(lastDoneFor).filter(Boolean).sort().pop() || null;
  const tag = p.matchFor ? `<span class="plan-tag">For ${esc(p.matchFor)}</span>`
    : filtered ? '<span class="plan-tag plan-tag-muted">General backup</span>' : '';
  return `<button type="button" class="plan-card" data-plan="${esc(p.id)}" aria-haspopup="dialog">
    <div class="plan-card-main">
      ${tag}
      <span class="plan-name">${esc(p.name)}</span>
      <span class="day-meta"><span>${days.length} day${days.length === 1 ? '' : 's'}</span><span>⏱ ~${mins} min each</span></span>
      <span class="plan-days">${days.map((d) => esc(d.name)).join(' · ')}</span>
      <span class="day-last">${last ? daysAgoText(last) : 'Not started'}</span>
    </div>
    <div class="plan-card-side">${bodyMapSvg(all, 'body-map-sm')}<span class="plan-open">View days ›</span></div>
  </button>`;
}
/** Fetch one catalog program by id (ignores activity / days filters) and cache it for the plan sheet. */
async function ensureProgramCached(id) {
  if (woPrograms.has(id)) return woPrograms.get(id);
  const p = await api('/workouts/programs/' + encodeURIComponent(id));
  const days = programDays(p);
  woPrograms.set(p.id, { ...p, planDays: days });
  return woPrograms.get(p.id);
}

/** Fetch one owned saved routine and register its day for openDayView. */
async function ensureRoutineDayCached(id) {
  const r = await api('/workouts/routines/' + encodeURIComponent(id));
  const planDay = r.planDay || `routine:${r._id || r.id}`;
  const day = {
    planDay,
    number: 1,
    name: r.name,
    sessionName: r.name,
    details: r.details || (r.exercises || []).map((e) => ({
      name: e.exerciseName || e.name,
      exerciseId: e.exerciseId || e.exercise,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      repMin: e.repMin,
      repMax: e.repMax,
      restSec: e.restSec
    })),
    routineId: String(r._id || r.id)
  };
  woPlanDays.set(planDay, day);
  return day;
}

/** Home → Workouts: always open the pinned program/routine detail, independent of suggestion filters. */
async function openActiveRoutineDetail() {
  const active = settings && settings.activeRoutine;
  if (!active || !active.id) return toast('No active routine set');
  const nav = document.querySelector('#main-nav button[data-panel="workouts"]');
  if (nav) nav.click();
  try {
    if (active.kind === 'program') {
      await ensureProgramCached(active.id);
      openPlanSheet(active.id);
      return;
    }
    if (active.kind === 'routine') {
      const day = await ensureRoutineDayCached(active.id);
      openDayView(day.planDay);
      return;
    }
    toast('Unknown active routine type');
  } catch (err) {
    toast(err.message || 'Could not open active routine');
  }
}

function openPlanSheet(id) {
  const p = woPrograms.get(id);
  if (!p) return;
  const sheet = document.getElementById('wo-sheet');
  const isActive = settings.activeRoutine && settings.activeRoutine.kind === 'program' && settings.activeRoutine.id === p.id;
  sheet.innerHTML = `<div class="sheet plan-sheet" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head"><div><div class="summary-kicker">${p.planDays.length}-day plan${p.matchFor ? ' · for ' + esc(p.matchFor) : ''}</div><strong class="summary-title">${esc(p.name)}</strong></div><button type="button" class="icon-btn" data-sheet-close aria-label="Close">×</button></div>
    ${p.notes ? `<p class="hint">${esc(p.notes)}</p>` : ''}
    <div class="day-grid plan-sheet-days">${p.planDays.map((d) => dayCard(d)).join('')}</div>
    <p class="hint plan-sheet-foot">Tap a day to see the exercises, reorder or swap them, and start.</p>
    <button type="button" class="btn ${isActive ? 'btn-secondary' : 'btn-primary'} btn-block" data-set-active-program="${esc(p.id)}" ${isActive ? 'disabled' : ''}>${isActive ? 'Active on Home' : 'Set as active routine'}</button>
  </div>`;
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
  sheet.onclick = async (ev) => {
    if (ev.target === sheet || ev.target.closest('[data-sheet-close]')) return closeWoSheet();
    const setBtn = ev.target.closest('[data-set-active-program]');
    if (setBtn) {
      try {
        const r = await api('/workouts/active-routine', { method: 'PUT', body: JSON.stringify({ kind: 'program', id: setBtn.dataset.setActiveProgram }) });
        settings.activeRoutine = r.active;
        toast('Active routine saved to Home');
        closeWoSheet();
        loadActiveRoutineCard();
      } catch (err) { toast(err.message); }
      return;
    }
    const c = ev.target.closest('[data-day]');
    if (c) { closeWoSheet(); woDayFromPlan = id; openDayView(c.dataset.day); }
  };
}
function closeWoSheet() {
  const sheet = document.getElementById('wo-sheet');
  sheet.hidden = true;
  document.body.classList.remove('sheet-open');
}

function lastSetsFromHistory(d) {
  const name = String(d.name).toLowerCase();
  for (const log of woHistoryCache) {
    const e = (log.exercises || []).find((x) => (d.exerciseId && x.exercise && String(x.exercise) === String(d.exerciseId)) || String(x.exerciseName).toLowerCase() === name);
    if (e && e.sets?.length) return e.sets;
  }
  return null;
}
function setSummary(d) {
  const sets = lastSetsFromHistory(d);
  if (sets) {
    const work = P.workingSets(sets);
    const warm = sets.length - work.length;
    const reps = work.map((s) => s.reps || 0);
    const main = !reps.length ? '' : reps.every((r) => r === reps[0]) ? `${reps.length} × ${reps[0]} reps` : `${reps.length} × ${reps.join(',')} reps`;
    const extra = warm ? `${warm} warm-up` : '';
    if (main || extra) return [main, extra].filter(Boolean).join(' · ');
  }
  const lo = d.targetReps || d.repMin || 8; const hi = d.targetReps ? null : d.repMax;
  return `${d.targetSets || 3} × ${hi && hi !== lo ? `${lo}–${hi}` : lo} reps`;
}

function openDayView(key) {
  const day = woPlanDays.get(key);
  if (!day) return;
  woDayView = { ...day, details: day.details.map((d) => ({ ...d })) };
  renderDayView();
  document.getElementById('workouts').classList.add('day-open');
  window.scrollTo({ top: 0 });
}
function closeDayView() {
  woDayView = null;
  woDayFromPlan = null;
  document.getElementById('workouts').classList.remove('day-open');
  document.getElementById('wo-day-view').hidden = true;
}
function renderDayView() {
  const v = woDayView;
  const el = document.getElementById('wo-day-view');
  const muscles = [...new Set(v.details.flatMap((d) => d.primaryMuscles || []))];
  el.hidden = false;
  el.innerHTML = `
    <button type="button" class="btn btn-ghost btn-sm dd-back" data-dd="back">‹ Back to plan</button>
    <div class="dd-head">
      <div>
        <div class="day-num">Day ${v.number}${v.programName ? ' · ' + esc(v.programName) : ''}</div>
        <h2 class="dd-title">${esc(v.name)}</h2>
        <div class="day-meta"><span>⏱ ~${dayMinutes(v)} min</span><span>${v.details.length} exercises</span></div>
        <div class="day-last">${daysAgoText(lastDoneFor(v))}</div>
      </div>
      ${bodyMapSvg(v.details, 'body-map-lg')}
    </div>
    ${muscles.length ? `<div class="dd-muscles">${muscles.map((m) => `<span class="chip chip-static">${esc(m)}</span>`).join('')}</div>` : ''}
    <div class="dd-list" id="dd-list">
      ${v.details.map((d, i) => `
        <div class="dd-row" data-i="${i}">
          <span class="dd-handle" data-handle="${i}" aria-label="Drag to reorder ${esc(d.name)}" role="button" tabindex="0">⠿</span>
          ${exThumb({ ...d, exerciseName: d.name })}
          <div class="dd-text"><strong>${esc(d.name)}</strong><small>${esc(setSummary(d))}</small>${(window.AboutYouUI ? window.AboutYouUI.badgeHtml(d) : '')}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-dd-swap="${i}">Swap</button>
        </div>`).join('')}
    </div>
    <p class="hint dd-hint">Drag ⠿ to reorder (saved${v.routineId ? ' to this routine' : ' for you'}).</p>
    ${v.routineId ? `<button type="button" class="btn btn-secondary btn-block" data-dd="set-active-routine">Set as active routine</button>` : ''}
    <button type="button" class="btn btn-primary btn-block btn-lg dd-start" data-dd="start">Start Workout</button>`;
}

document.getElementById('wo-programs').addEventListener('click', (e) => { const c = e.target.closest('[data-plan]'); if (c) openPlanSheet(c.dataset.plan); });
document.getElementById('wo-routines').addEventListener('click', (e) => { const c = e.target.closest('[data-day]'); if (c) openDayView(c.dataset.day); });

async function persistDayOrder() {
  const v = woDayView;
  if (!v) return;
  if (!v.routineId) {
    try {
      await api('/workouts/program-order', { method: 'PUT', body: JSON.stringify({ planDay: v.planDay, exercises: v.details.map((d) => d.name) }) });
      const day = woPlanDays.get(v.planDay);
      if (day) day.details = v.details.map((d) => ({ ...d }));
    } catch (err) { toast(err.message); }
    return;
  }
  try {
    await api(`/workouts/routines/${v.routineId}`, {
      method: 'PUT',
      body: JSON.stringify({ exercises: v.details.map((d) => ({ exerciseId: d.exerciseId, exerciseName: d.name, targetSets: d.targetSets, targetReps: d.targetReps, repMin: d.repMin, repMax: d.repMax, restSec: d.restSec })) })
    });
    const day = woPlanDays.get(v.planDay);
    if (day) day.details = v.details.map((d) => ({ ...d }));
  } catch (err) { toast(err.message); }
}

document.getElementById('wo-day-view').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !woDayView) return;
  if (b.dataset.dd === 'back') { const from = woDayFromPlan; closeDayView(); if (from) openPlanSheet(from); return; }
  if (b.dataset.dd === 'start') return startDay(woDayView);
  if (b.dataset.dd === 'set-active-routine') {
    (async () => {
      try {
        const r = await api('/workouts/active-routine', { method: 'PUT', body: JSON.stringify({ kind: 'routine', id: woDayView.routineId }) });
        settings.activeRoutine = r.active;
        toast('Active routine saved to Home');
        loadActiveRoutineCard();
      } catch (err) { toast(err.message); }
    })();
    return;
  }
  if (b.dataset.ddSwap != null) {
    const i = Number(b.dataset.ddSwap);
    const d = woDayView.details[i];
    openSwapSheet({ exerciseId: d.exerciseId, exerciseName: d.name }, (chosen) => {
      woDayView.details[i] = { ...d, name: chosen.name, exerciseId: chosen._id, pattern: chosen.pattern, primaryMuscles: chosen.primaryMuscles || [], equipment: chosen.equipment || [], imageUrl: chosen.imageUrl || '' };
      renderDayView();
      persistDayOrder();
      toast('Swapped to ' + chosen.name);
    });
  }
});

// Touch-friendly drag to reorder (pointer events on the handle)
(function setupDrag() {
  const host = document.getElementById('wo-day-view');
  let drag = null;
  host.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-handle]');
    if (!h || !woDayView) return;
    const row = h.closest('.dd-row');
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    drag = { row, startY: e.clientY, from: Number(row.dataset.i), handle: h };
    row.classList.add('dragging');
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    drag.row.style.transform = `translateY(${dy}px)`;
    const list = document.getElementById('dd-list');
    const rows = [...list.querySelectorAll('.dd-row')].filter((r) => r !== drag.row);
    const y = drag.row.getBoundingClientRect().top + drag.row.offsetHeight / 2;
    let to = rows.findIndex((r) => y < r.getBoundingClientRect().top + r.offsetHeight / 2);
    if (to < 0) to = rows.length;
    drag.to = to;
    rows.forEach((r, i) => r.classList.toggle('drop-before', i === to));
    list.classList.toggle('drop-end', to === rows.length);
  });
  const end = () => {
    if (!drag) return;
    const { from, to } = drag;
    drag = null;
    if (to != null && to !== from) {
      const [m] = woDayView.details.splice(from, 1);
      woDayView.details.splice(to, 0, m);
      persistDayOrder();
    }
    renderDayView();
  };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  host.addEventListener('keydown', (e) => {
    const h = e.target.closest('[data-handle]');
    if (!h || !woDayView || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const i = Number(h.dataset.handle); const j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= woDayView.details.length) return;
    const [m] = woDayView.details.splice(i, 1); woDayView.details.splice(j, 0, m);
    renderDayView(); persistDayOrder();
    document.querySelector(`[data-handle="${j}"]`)?.focus();
  });
})();

function startDay(day) {
  if (currentWorkoutExercises.some((e) => e.sets.some((s) => s.logged)) && !confirm('Replace the current session?')) return;
  currentWorkoutExercises = [];
  woEditing = null;
  woPlanDay = day.planDay;
  document.getElementById('wo-name').value = day.sessionName || day.name;
  document.getElementById('wo-date').value = todayStr();
  stopWorkoutTimer();
  day.details.forEach((d) => addExerciseToWorkout({ ...d, exerciseName: d.name }));
  closeDayView();
  window.scrollTo({ top: 0 });
  toast(`Started ${day.name}`);
}

// ---------- Autosave of the in-progress workout ----------
// Every change writes the full session to localStorage (per user) right away, and a debounced
// copy goes to the server (PUT /workouts/draft) so it survives reloads and device switches.
const DRAFT_SYNC_MS = 3000;
const DRAFT_STALE_MS = 24 * 60 * 60 * 1000;

function draftKey() { return currentUser ? `fc-wo-draft:${currentUser.id || currentUser._id || currentUser.username}` : null; }

function snapshotWorkout() {
  if (!currentWorkoutExercises.length) return null;
  return {
    v: 1,
    name: document.getElementById('wo-name').value,
    date: document.getElementById('wo-date').value,
    planDay: woPlanDay || '',
    startedAt: workoutStartedAt || Date.now(),
    rest: rest && rest.endsAt > Date.now() ? { ...rest } : null,
    exercises: currentWorkoutExercises.map((e) => ({
      exerciseId: e.exerciseId, exerciseName: e.exerciseName, pattern: e.pattern,
      primaryMuscles: e.primaryMuscles, equipment: e.equipment, imageUrl: e.imageUrl, isLower: e.isLower,
      repMin: e.repMin, repMax: e.repMax, restSec: e.restSec,
      lastSets: e.lastSets, lastDate: e.lastDate, lastE1rm: e.lastE1rm, bestE1rm: e.bestE1rm, suggestion: e.suggestion,
      touched: !!e.touched,
      sets: e.sets.map((s) => ({ type: P.setType(s), weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, logged: !!s.logged }))
    }))
  };
}

function readLocalDraft() {
  const k = draftKey();
  if (!k) return null;
  try { const d = JSON.parse(localStorage.getItem(k) || 'null'); return d && d.data && Array.isArray(d.data.exercises) ? d : null; } catch { return null; }
}

function scheduleDraftSave() {
  if (!draftReady || !currentUser) return;
  const data = snapshotWorkout();
  const k = draftKey();
  if (!data) {
    if (draftHasSaved) clearWorkoutDraft();
    return;
  }
  const savedAt = new Date().toISOString();
  try { localStorage.setItem(k, JSON.stringify({ data, savedAt })); } catch {}
  draftHasSaved = true;
  draftPending = { data, savedAt };
  clearTimeout(draftSyncTimer);
  draftSyncTimer = setTimeout(flushDraft, DRAFT_SYNC_MS);
}

function flushDraft(keepalive = false) {
  clearTimeout(draftSyncTimer); draftSyncTimer = null;
  if (!draftPending) return;
  const body = JSON.stringify(draftPending);
  draftPending = null;
  fetch('/api/workouts/draft', { method: 'PUT', credentials: 'include', keepalive: keepalive && body.length < 60000, headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
}

function clearWorkoutDraft() {
  const k = draftKey();
  if (k) localStorage.removeItem(k);
  clearTimeout(draftSyncTimer); draftSyncTimer = null; draftPending = null;
  draftHasSaved = false;
  fetch(`/api/workouts/draft?at=${encodeURIComponent(new Date().toISOString())}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
}

function resetWorkoutSession() {
  currentWorkoutExercises = [];
  woPlanDay = '';
  woEditing = null;
  document.getElementById('wo-name').value = '';
  document.getElementById('btn-save-workout').disabled = true;
  stopWorkoutTimer();
  stopRest(false);
  renderWorkoutExercises();
}

function applyDraft(d) {
  currentWorkoutExercises = d.exercises.map((e) => ({
    ...e, uid: ++woUid,
    primaryMuscles: e.primaryMuscles || [], equipment: e.equipment || [], lastSets: e.lastSets || [],
    sets: (e.sets || []).map((s) => ({ type: P.setType(s), weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, logged: !!s.logged }))
  }));
  woPlanDay = d.planDay || '';
  woEditing = null;
  document.getElementById('wo-name').value = d.name || 'Workout';
  document.getElementById('wo-date').value = d.date || todayStr();
  document.getElementById('btn-save-workout').disabled = !currentWorkoutExercises.length;
  stopWorkoutTimer();
  startWorkoutTimer(Number(d.startedAt) || Date.now());
  if (d.rest && d.rest.endsAt > Date.now()) {
    rest = { endsAt: d.rest.endsAt, total: d.rest.total || 90, label: d.rest.label || '' };
    localStorage.setItem('fc-rest-active', JSON.stringify(rest));
    renderRest();
  }
  renderWorkoutExercises();
}

function draftTimeText(ms) {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? t : `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${t}`;
}

function showDraftBanner(html, buttons, autoHideMs) {
  let el = document.getElementById('draft-toast');
  if (!el) { el = document.createElement('div'); el.id = 'draft-toast'; el.className = 'draft-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span class="draft-msg">${html}</span>${buttons.map((b, i) => `<button type="button" class="btn btn-sm ${b.primary ? 'btn-primary' : 'btn-ghost'}" data-draft-btn="${i}">${b.label}</button>`).join('')}`;
  el.hidden = false;
  clearTimeout(el._t);
  el.onclick = (e) => { const b = e.target.closest('[data-draft-btn]'); if (!b) return; el.hidden = true; buttons[Number(b.dataset.draftBtn)].run(); };
  if (autoHideMs) el._t = setTimeout(() => { el.hidden = true; }, autoHideMs);
}

async function restoreWorkoutDraft() {
  if (!currentUser) return;
  const uid = currentUser.id || currentUser._id || currentUser.username;
  if (draftCheckedFor === uid) return;
  draftCheckedFor = uid;
  draftReady = false;
  const local = readLocalDraft();
  let server = null; let clearedAt = null;
  try { const r = await api('/workouts/draft'); server = r.draft; clearedAt = r.clearedAt; } catch {}
  const t = (x) => (x ? new Date(x.savedAt).getTime() || 0 : 0);
  let pick = t(server) >= t(local) ? server : local;
  // finished or discarded on another device after this local copy was saved
  if (pick === local && local && clearedAt && new Date(clearedAt).getTime() >= t(local)) { localStorage.removeItem(draftKey()); pick = null; }
  if (pick && currentWorkoutExercises.some((e) => e.sets.some((s) => s.logged))) pick = null; // never clobber a live session
  draftReady = true;
  if (!pick || !pick.data.exercises.length) return;
  draftHasSaved = true;
  const when = draftTimeText(Number(pick.data.startedAt) || t(pick));
  const discard = () => { clearWorkoutDraft(); resetWorkoutSession(); toast('Workout discarded'); };
  if (Date.now() - t(pick) > DRAFT_STALE_MS) {
    showDraftBanner(`Unfinished workout from ${esc(when)}. Resume or discard?`, [
      { label: 'Resume', primary: true, run: () => { applyDraft(pick.data); toast('Workout resumed'); } },
      { label: 'Discard', run: discard }
    ]);
    return;
  }
  applyDraft(pick.data);
  if (pick === server && pick !== local) { try { localStorage.setItem(draftKey(), JSON.stringify(pick)); } catch {} }
  showDraftBanner(`Resumed your workout from ${esc(when)}`, [{ label: 'Discard', run: discard }, { label: 'OK', primary: true, run: () => {} }], 10000);
}

['input', 'change'].forEach((ev) => {
  document.getElementById('wo-name').addEventListener(ev, scheduleDraftSave);
  document.getElementById('wo-date').addEventListener(ev, scheduleDraftSave);
});
window.addEventListener('pagehide', () => flushDraft(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) flushDraft(true); });


document.getElementById('active-routine-clear')?.addEventListener('click', async () => {
  try {
    await api('/workouts/active-routine', { method: 'PUT', body: JSON.stringify({ clear: true }) });
    settings.activeRoutine = null;
    toast('Active routine cleared');
    loadActiveRoutineCard();
  } catch (err) { toast(err.message); }
});
document.getElementById('active-routine-open')?.addEventListener('click', () => {
  openActiveRoutineDetail();
});

document.getElementById('btn-select-activities')?.addEventListener('click', openActivitiesSheet);
document.getElementById('wo-activities-sheet-close')?.addEventListener('click', closeActivitiesSheet);
document.getElementById('wo-activities-sheet-done')?.addEventListener('click', closeActivitiesSheet);
if (woActivitiesSheet) {
  woActivitiesSheet.addEventListener('click', (e) => {
    if (e.target === woActivitiesSheet) closeActivitiesSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && woActivitiesSheet && !woActivitiesSheet.hidden) {
      e.preventDefault();
      closeActivitiesSheet();
    }
  });
  woActivitiesSheet.addEventListener('change', async (e) => {
    if (e.target && e.target.classList.contains('wo-act-check')) {
      updateActivitiesSummary();
      loadPlans();
      return;
    }
    if (e.target && e.target.name === 'wo-days') {
      const days = selectedDaysPerWeek();
      await persistDaysPerWeek(days);
      updateActivitiesSummary();
      loadPlans();
    }
  });
}

document.getElementById('btn-load-routine').addEventListener('click', () => {
  loadPlans();
  document.getElementById('wo-routines').scrollIntoView({ behavior: 'smooth' });
});

async function loadWorkoutHistory() {
  try {
    const [own, imported] = await Promise.all([api('/workouts?limit=15'), api('/health/workouts?limit=15').catch(() => [])]);
    const logs = [...own, ...imported].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)).slice(0, 20);
    const el = document.getElementById('wo-history');
    if (!logs.length) {
      el.innerHTML = '<div class="empty">No workouts logged yet.</div>';
      return;
    }
    el.innerHTML = logs
      .map(
        (w) => w.imported ? `
      <div class="wo-history-item imported">
        <div class="flex-between">
          <strong>${esc(w.name)}<span class="imported-badge">Imported${w.app ? ' · ' + esc(w.app) : ''}</span></strong>
          <span class="hint">${formatDate(w.date)}</span>
        </div>
        <div class="hint">${[w.durationMin ? Math.round(w.durationMin) + ' min' : '', w.activeKcal ? Math.round(w.activeKcal) + ' active kcal' : '', w.distanceM ? (w.distanceM / 1609.344).toFixed(2) + ' mi' : ''].filter(Boolean).join(' · ') || 'Imported workout'}</div>
      </div>` : `
      <div class="wo-history-item">
        <div class="flex-between">
          <strong>${esc(w.name)}</strong>
          <span class="hint">${formatDate(w.date)}</span>
        </div>
        <div class="hint">${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'} · ${w.exercises.reduce((n, e) => n + P.workingSets(e.sets).length, 0)} working sets · ${Math.round(woDisp(w.exercises.reduce((v, e) => v + P.volume(e.sets), 0))).toLocaleString()} ${woUnitLabel()} volume${w.durationMin ? ` · ${w.durationMin} min` : ''}</div>
        <div class="wo-history-actions">
          <button class="btn btn-danger btn-sm" data-id="${esc(w._id)}">Delete</button>
          <button type="button" class="btn btn-ghost-outline btn-sm wo-comments" data-thread-own="${esc(w._id)}" data-title="${esc(w.name)}" hidden>💬 0</button>
        </div>
      </div>`
      )
      .join('');
    el.querySelectorAll('.btn-danger').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this workout?')) return;
        await api(`/workouts/${btn.dataset.id}`, { method: 'DELETE' });
        toast('Deleted');
        loadWorkoutHistory();
      });
    });
    if (window.Social) window.Social.decorateOwnWorkouts();
  } catch (err) {
    console.error(err);
  }
}

// ========== Body Metrics ==========
document.getElementById('length-unit').addEventListener('change', async () => {
  settings.lengthUnit = document.getElementById('length-unit').value;
  await api('/settings', {
    method: 'PUT',
    body: JSON.stringify({
      unit: settings.unit || 'lbs',
      foodWeightUnit: settings.foodWeightUnit || 'g',
      calAvgDays: settings.calAvgDays || 14,
      lengthUnit: settings.lengthUnit,
      theme: settings.theme || 'sage',
      interests: settings.interests || [],
      trainingFocus: settings.trainingFocus || []
    })
  });
  loadBodyMetrics();
});
const CM_PER_IN = 2.54;
function lengthUnit() { return settings.lengthUnit || 'in'; }
function toCm(value) {
  const n = Number(value);
  if (!n) return null;
  return lengthUnit() === 'in' ? +(n * CM_PER_IN).toFixed(1) : n;
}
function fromCm(cm) {
  if (cm == null) return '';
  return lengthUnit() === 'in' ? (cm / CM_PER_IN).toFixed(1) : String(cm);
}
function lengthLabel(cm) {
  if (cm == null) return '';
  return lengthUnit() === 'in' ? `${(cm / CM_PER_IN).toFixed(1)} in` : `${cm} cm`;
}

document.getElementById('btn-save-body').addEventListener('click', async () => {
  const date = document.getElementById('bm-date').value || todayStr();
  const body = {
    date,
    bodyFatPct: document.getElementById('bm-bf').value || null,
    heightCm: toCm(document.getElementById('bm-height').value),
    chestCm: toCm(document.getElementById('bm-chest').value),
    shouldersCm: toCm(document.getElementById('bm-shoulders').value),
    waistCm: toCm(document.getElementById('bm-waist').value),
    hipsCm: toCm(document.getElementById('bm-hips').value),
    leftArmCm: toCm(document.getElementById('bm-larm').value),
    rightArmCm: toCm(document.getElementById('bm-rarm').value),
    leftThighCm: toCm(document.getElementById('bm-lthigh').value),
    rightThighCm: toCm(document.getElementById('bm-rthigh').value),
    neckCm: toCm(document.getElementById('bm-neck').value),
    note: document.getElementById('bm-note').value.trim()
  };
  // Remove nulls
  Object.keys(body).forEach((k) => {
    if (body[k] === '' || body[k] == null) delete body[k];
  });

  try {
    await api('/body-metrics', { method: 'POST', body: JSON.stringify(body) });
    toast('Metrics saved');
    loadBodyMetrics();
  } catch (err) {
    toast(err.message);
  }
});

function compressImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const SAFE_AVATAR_RE = /^(#[0-9a-f]{6}|data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)$/i;
function paintAvatar(target, user) {
  if (!target) return;
  target.style.background = '';
  if (user?.avatar && !SAFE_AVATAR_RE.test(user.avatar)) user = { ...user, avatar: '' };
  if (user?.avatar && user.avatar.startsWith('data:')) {
    target.innerHTML = `<img src="${esc(user.avatar)}" alt="" />`;
    target.style.background = 'transparent';
  } else if (user?.avatar && user.avatar.startsWith('#')) {
    target.textContent = (user.displayName || user.username || 'FC').slice(0, 2).toUpperCase();
    target.style.background = user.avatar;
  } else {
    target.textContent = (user?.displayName || user?.username || 'FC').slice(0, 2).toUpperCase();
  }
}

const AVATAR_COLORS = ['#0f766e', '#1d4ed8', '#b45309', '#be123c', '#374151'];
function renderAvatarPresets() {
  const box = document.getElementById('avatar-presets');
  if (!box) return;
  box.innerHTML = AVATAR_COLORS.map((c) => `<button type="button" data-color="${c}" style="background:${c}"></button>`).join('');
  box.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const data = await api('/profile/avatar', { method: 'PUT', body: JSON.stringify({ avatar: btn.dataset.color }) });
      currentUser.avatar = data.avatar;
      paintAvatar(document.getElementById('header-avatar'), currentUser);
      paintAvatar(document.getElementById('profile-avatar'), currentUser);
    });
  });
}

async function loadProgressPhotos() {
  const list = document.getElementById('photo-list');
  if (!list) return;
  const photos = await api('/profile/photos');
  if (!photos.length) {
    list.innerHTML = '<div class="empty">No progress photos yet.</div>';
    return;
  }
  list.innerHTML = photos.map((p, i) => `
    <div class="photo-card">
      <img src="${p.image}" alt="" data-zoom="${i}" style="cursor:zoom-in" />
      <div class="meta">${p.date}${p.note ? ' · ' + p.note : ''} <button class="btn btn-danger btn-sm" data-id="${p._id}">×</button></div>
    </div>`).join('');
  list.querySelectorAll('[data-zoom]').forEach((img) => {
    img.addEventListener('click', () => {
      const p = photos[Number(img.dataset.zoom)];
      openLightbox(p.image, [formatDate(p.date), p.note].filter(Boolean).join(' · '));
    });
  });
  list.querySelectorAll('[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/profile/photos/${btn.dataset.id}`, { method: 'DELETE' });
      loadProgressPhotos();
    });
  });
}

document.getElementById('avatar-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const avatar = await compressImage(file, 400);
  const data = await api('/profile/avatar', { method: 'PUT', body: JSON.stringify({ avatar }) });
  currentUser.avatar = data.avatar;
  paintAvatar(document.getElementById('header-avatar'), currentUser);
  paintAvatar(document.getElementById('profile-avatar'), currentUser);
  toast('Profile photo saved');
});

document.getElementById('btn-save-photo').addEventListener('click', async () => {
  const file = document.getElementById('photo-file').files[0];
  if (!file) return toast('Choose a photo first');
  const image = await compressImage(file);
  await api('/profile/photos', {
    method: 'POST',
    body: JSON.stringify({
      image,
      date: document.getElementById('photo-date').value || todayStr(),
      note: document.getElementById('photo-note').value
    })
  });
  document.getElementById('photo-file').value = '';
  document.getElementById('photo-note').value = '';
  toast('Photo saved');
  loadProgressPhotos();
});

async function loadBodyMetrics() {
  try {
    const latest = await api('/body-metrics/latest');
    const el = document.getElementById('bm-latest');
    const bmiEl = document.getElementById('bm-bmi');

    const bmiWrap = bmiEl.closest('.bm-bmi-wrap');
    if (bmiWrap) bmiWrap.hidden = latest.showBmi === false;
    if (latest.bmi != null) {
      bmiEl.textContent = latest.bmi.toFixed(1);
    } else {
      bmiEl.textContent = '—';
    }

    if (!latest.metric) {
      el.innerHTML = '<div class="empty">No body metrics logged yet.</div>';
    } else {
      const m = latest.metric;
      const parts = [];
      if (m.bodyFatPct) parts.push(`Body fat: ${m.bodyFatPct}%`);
      if (m.heightCm) parts.push(`Height: ${lengthLabel(m.heightCm)}`);
      if (m.chestCm) parts.push(`Chest: ${lengthLabel(m.chestCm)}`);
      if (m.waistCm) parts.push(`Waist: ${lengthLabel(m.waistCm)}`);
      if (m.shouldersCm) parts.push(`Shoulders: ${lengthLabel(m.shouldersCm)}`);
      el.innerHTML = `<div class="hint">${formatDate(m.date)}</div><div>${parts.join(' · ') || 'No measurements'}</div>`;
    }

    const history = await api('/body-metrics?limit=20');
    const histEl = document.getElementById('bm-history');
    if (!history.length) {
      histEl.innerHTML = '<div class="empty">No history.</div>';
      return;
    }
    histEl.innerHTML = history
      .map(
        (m) => `
      <div class="bm-item">
        <div class="flex-between">
          <strong>${formatDate(m.date)}</strong>
          <button class="btn btn-danger btn-sm" data-id="${m._id}">×</button>
        </div>
        <div class="hint">
          ${m.bodyFatPct ? 'BF ' + m.bodyFatPct + '% · ' : ''}
          ${m.waistCm ? 'Waist ' + lengthLabel(m.waistCm) + ' · ' : ''}
          ${m.chestCm ? 'Chest ' + lengthLabel(m.chestCm) : ''}
        </div>
      </div>`
      )
      .join('');
    histEl.querySelectorAll('.btn-danger').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this entry?')) return;
        await api(`/body-metrics/${btn.dataset.id}`, { method: 'DELETE' });
        toast('Deleted');
        loadBodyMetrics();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

// ========== Calendar ==========
let calYear, calMonth;
function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
}
initCalendar();

document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  loadCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  loadCalendar();
});

async function loadCalendar() {
  const label = document.getElementById('cal-month-label');
  label.textContent = new Date(calYear, calMonth).toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const first = new Date(calYear, calMonth, 1);
  const last = new Date(calYear, calMonth + 1, 0);
  const startPad = first.getDay();
  const days = last.getDate();

  const grid = document.getElementById('calendar-grid');
  const headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-header">${d}</div>`).join('');

  let html = headers;
  for (let i = 0; i < startPad; i++) html += '<div></div>';
  const today = todayStr();
  for (let d = 1; d <= days; d++) {
    const date = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = date === today;
    html += `<div class="cal-day ${isToday ? 'today' : ''}" data-date="${date}"><span>${d}</span></div>`;
  }
  grid.innerHTML = html;

  // Mark days that have progress photos (metadata only, no image data)
  const monthStart = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
  const monthEnd = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
  api(`/profile/photos?from=${monthStart}&to=${monthEnd}&meta=1`).then((photos) => {
    new Set(photos.map((p) => p.date)).forEach((d) => {
      const el = grid.querySelector(`[data-date="${d}"]`);
      if (el && !el.querySelector('.cal-photo')) el.insertAdjacentHTML('beforeend', '<span class="cal-photo" aria-label="Has progress photo" title="Progress photo"></span>');
    });
  }).catch(() => {});

  // Mark days with data
  try {
    const [weights, foodRes, workouts] = await Promise.all([
      api('/weights?days=60'),
      api(`/food-logs?date=${today}`).catch(() => ({ logs: [] })),
      api('/workouts?limit=60')
    ]);
    // Fetch food logs for each day that has a weight or workout, plus a few recent days
    const datesToCheck = new Set();
    weights.forEach(w => datesToCheck.add(w.date));
    workouts.forEach(w => datesToCheck.add(w.date));
    // Also check last 14 days for food
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      datesToCheck.add(dateKey(d));
    }
    const foodDates = new Set();
    await Promise.all(
      [...datesToCheck].slice(0, 20).map(async (date) => {
        try {
          const res = await api(`/food-logs?date=${date}`);
          if (res.logs && res.logs.length) foodDates.add(date);
        } catch (_) {}
      })
    );
    const dates = new Set();
    weights.forEach(w => dates.add(w.date));
    foodDates.forEach(d => dates.add(d));
    workouts.forEach(w => dates.add(w.date));
    dates.forEach(d => {
      const el = grid.querySelector(`[data-date="${d}"]`);
      if (el) {
        el.classList.add('has-data');
        if (!el.querySelector('.dot')) el.innerHTML += '<div class="dot"></div>';
      }
    });
  } catch (err) { console.error(err); }

  grid.querySelectorAll('.cal-day').forEach(el => {
    el.addEventListener('click', () => showDayDetail(el.dataset.date));
  });
}

let dayPhotos = [];
const lightbox = document.getElementById('photo-lightbox');
function openLightbox(src, caption) {
  document.getElementById('photo-lightbox-img').src = src;
  document.getElementById('photo-lightbox-cap').textContent = caption || '';
  lightbox.hidden = false;
  document.body.classList.add('sheet-open');
  lightbox.querySelector('.photo-lightbox-close').focus();
}
function closeLightbox() {
  lightbox.hidden = true;
  document.getElementById('photo-lightbox-img').removeAttribute('src');
  if (document.getElementById('food-sheet').hidden && document.getElementById('wo-sheet').hidden) document.body.classList.remove('sheet-open');
}
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.closest('.photo-lightbox-close')) closeLightbox();
});

async function showDayDetail(date) {
  const detail = document.getElementById('calendar-day-detail');
  const title = document.getElementById('calendar-day-title');
  const content = document.getElementById('calendar-day-content');
  title.textContent = formatDate(date);
  detail.style.display = 'block';
  content.innerHTML = '<div class="empty">Loading…</div>';

  try {
    const [weights, foodRes, workouts, metrics, photos] = await Promise.all([
      api(`/weights?days=365`).then(all => all.filter(w => w.date === date)),
      api(`/food-logs?date=${date}`),
      api('/workouts?limit=100').then(all => all.filter(w => w.date === date)),
      api('/body-metrics?limit=100').then(all => all.filter(m => m.date === date)),
      api(`/profile/photos?date=${date}`).catch(() => [])
    ]);
    dayPhotos = photos;
    const foods = foodRes.logs || [];

    let html = '';

    // Progress photos taken that day: thumbnails, tap to enlarge
    html += `<div class="day-section">
      <button class="day-section-toggle" data-sec="ph">Progress photos${photos.length ? ` <em class="day-count">${photos.length}</em>` : ''} <span>${photos.length ? '▾' : '▸'}</span></button>
      <div class="day-section-body ${photos.length ? 'open' : ''}" id="day-ph">
        ${photos.length
          ? `<div class="day-photos">${photos.map((p, i) => `<button type="button" class="day-photo" data-photo="${i}" aria-label="Open photo${p.note ? ': ' + esc(p.note) : ''}"><img src="${p.image}" alt="" loading="lazy" />${p.note ? `<span>${esc(p.note)}</span>` : ''}</button>`).join('')}</div>`
          : '<div class="empty">No photos this day. Add one on the Body page.</div>'}
      </div>
    </div>`;

    // Food
    html += `<div class="day-section">
      <button class="day-section-toggle" data-sec="food">Food <span>▸</span></button>
      <div class="day-section-body" id="day-food">
        ${foods.length ? foods.map(f => `<div>${f.foodName || 'Manual'} — ${f.calories} kcal</div>`).join('') : '<div class="empty">No food logged</div>'}
      </div>
    </div>`;

    // Workout
    html += `<div class="day-section">
      <button class="day-section-toggle" data-sec="wo">Workouts <span>▸</span></button>
      <div class="day-section-body" id="day-wo">
        ${workouts.length ? workouts.map(w => `<div><strong>${w.name}</strong> — ${w.exercises.length} exercises</div>`).join('') : '<div class="empty">No workouts</div>'}
      </div>
    </div>`;

    // Weight
    html += `<div class="day-section">
      <button class="day-section-toggle" data-sec="wt">Weight <span>▸</span></button>
      <div class="day-section-body" id="day-wt">
        ${weights.length ? weights.map(w => `<div>${toDisplayWeight(w.weight)} ${w.note ? '— ' + w.note : ''}</div>`).join('') : '<div class="empty">No weight</div>'}
      </div>
    </div>`;

    // Body
    html += `<div class="day-section">
      <button class="day-section-toggle" data-sec="bm">Body Metrics <span>▸</span></button>
      <div class="day-section-body" id="day-bm">
        ${metrics.length ? metrics.map(m => `<div>BF ${m.bodyFatPct || '—'}% · Waist ${m.waistCm || '—'}cm</div>`).join('') : '<div class="empty">No metrics</div>'}
      </div>
    </div>`;

    content.innerHTML = html;

    content.querySelectorAll('[data-photo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = dayPhotos[Number(btn.dataset.photo)];
        if (p) openLightbox(p.image, [formatDate(p.date), p.note].filter(Boolean).join(' · '));
      });
    });

    content.querySelectorAll('.day-section-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.nextElementSibling;
        const open = body.classList.contains('open');
        body.classList.toggle('open', !open);
        btn.querySelector('span').textContent = open ? '▸' : '▾';
      });
    });
  } catch (err) {
    content.innerHTML = '<div class="empty">Failed to load day.</div>';
    console.error(err);
  }
}

// ========== Recipes ==========
let recipeDraft = [];
let recipeEditingId = null;
let recipePick = null;
let recipeSearchTimer = null;

function recipeLineMacros(food, amount, unit) {
  const servings = amountToServings(amount, unit, food);
  return {
    calories: Math.round((Number(food.calories) || 0) * servings),
    protein: +((Number(food.protein) || 0) * servings).toFixed(1),
    carbs: +((Number(food.carbs) || 0) * servings).toFixed(1),
    fat: +((Number(food.fat) || 0) * servings).toFixed(1)
  };
}

function renderRecipeDraft() {
  const list = document.getElementById('recipe-draft-list');
  const totalsEl = document.getElementById('recipe-draft-totals');
  if (!recipeDraft.length) {
    list.innerHTML = '<div class="empty">No ingredients yet.</div>';
    totalsEl.textContent = '';
    return;
  }
  const totals = recipeDraft.reduce((acc, line) => {
    acc.calories += line.calories;
    acc.protein += line.protein;
    acc.carbs += line.carbs;
    acc.fat += line.fat;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const yieldN = Math.max(0.25, parseFloat(document.getElementById('recipe-servings').value) || 1);
  list.innerHTML = recipeDraft.map((line, i) => `
    <div class="food-log-item">
      <div>
        <strong>${line.foodName}</strong>
        <div class="hint">${line.amount} ${line.unit} · ${line.calories} kcal · P${line.protein} C${line.carbs} F${line.fat}</div>
      </div>
      <button type="button" class="btn btn-danger btn-sm" data-remove-ingredient="${i}">Remove</button>
    </div>`).join('');
  totalsEl.textContent =
    `Whole recipe: ${Math.round(totals.calories)} kcal · P${totals.protein.toFixed(1)} C${totals.carbs.toFixed(1)} F${totals.fat.toFixed(1)}. Per serving: ${Math.round(totals.calories / yieldN)} kcal.`;
}

function resetRecipeForm() {
  recipeEditingId = null;
  recipeDraft = [];
  recipePick = null;
  document.getElementById('recipe-form-title').textContent = 'New Recipe';
  document.getElementById('recipe-name').value = '';
  document.getElementById('recipe-servings').value = '1';
  document.getElementById('recipe-public').checked = false;
  document.getElementById('btn-save-recipe').textContent = 'Save Recipe';
  document.getElementById('btn-cancel-recipe').style.display = 'none';
  document.getElementById('recipe-ingredient-editor').style.display = 'none';
  renderRecipeDraft();
}

function fillRecipeUnit(food) {
  const select = document.getElementById('recipe-ingredient-unit');
  const base = (food.servingUnit || 'serving').toLowerCase();
  if (isWeightUnit(base)) {
    select.innerHTML = `<option value="g">g</option><option value="oz">oz</option><option value="serving">serving (${food.servingSize} ${food.servingUnit})</option>`;
    select.value = 'g';
    document.getElementById('recipe-ingredient-amount').value = String(Math.round(toGrams(food.servingSize, food.servingUnit)));
  } else {
    select.innerHTML = `<option value="serving">${food.servingUnit || 'serving'}</option>`;
    select.value = 'serving';
    document.getElementById('recipe-ingredient-amount').value = '1';
  }
}

document.getElementById('recipe-draft-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-ingredient]');
  if (!btn) return;
  recipeDraft.splice(Number(btn.dataset.removeIngredient), 1);
  renderRecipeDraft();
});
document.getElementById('recipe-servings').addEventListener('input', renderRecipeDraft);

document.getElementById('recipe-food-search').addEventListener('input', (e) => {
  clearTimeout(recipeSearchTimer);
  const q = e.target.value.trim();
  const el = document.getElementById('recipe-food-results');
  if (q.length < 2) {
    el.classList.remove('open');
    return;
  }
  recipeSearchTimer = setTimeout(async () => {
    try {
      const foods = await api(`/foods?q=${encodeURIComponent(q)}&limit=12`);
      if (!foods.length) {
        el.innerHTML = '<div class="search-item">No foods found</div>';
        el.classList.add('open');
        return;
      }
      el.innerHTML = foods.map((f) => `
        <div class="search-item" data-id="${f._id}">
          <div>${f.name}${f.brand ? ' · ' + f.brand : ''}</div>
          <div class="meta">${f.calories} kcal per ${f.servingSize} ${f.servingUnit}</div>
        </div>`).join('');
      el.classList.add('open');
      el.querySelectorAll('[data-id]').forEach((item) => {
        item.addEventListener('click', () => {
          recipePick = foods.find((x) => x._id === item.dataset.id);
          document.getElementById('recipe-ingredient-name').textContent =
            recipePick.brand ? `${recipePick.name} (${recipePick.brand})` : recipePick.name;
          document.getElementById('recipe-ingredient-editor').style.display = 'block';
          fillRecipeUnit(recipePick);
          el.classList.remove('open');
          document.getElementById('recipe-food-search').value = '';
        });
      });
    } catch (err) {
      toast(err.message);
    }
  }, 250);
});

document.getElementById('btn-add-ingredient').addEventListener('click', () => {
  if (!recipePick) return toast('Pick a food first');
  const amount = parseFloat(document.getElementById('recipe-ingredient-amount').value);
  const unit = document.getElementById('recipe-ingredient-unit').value;
  if (!(amount > 0)) return toast('Enter an amount');
  recipeDraft.push({
    foodId: recipePick._id,
    foodName: recipePick.brand ? `${recipePick.name} (${recipePick.brand})` : recipePick.name,
    amount,
    unit,
    ...recipeLineMacros(recipePick, amount, unit)
  });
  recipePick = null;
  document.getElementById('recipe-ingredient-editor').style.display = 'none';
  renderRecipeDraft();
});

document.getElementById('btn-cancel-recipe').addEventListener('click', resetRecipeForm);

document.getElementById('btn-save-recipe').addEventListener('click', async () => {
  const name = document.getElementById('recipe-name').value.trim();
  if (!name) return toast('Name required');
  if (!recipeDraft.length) return toast('Add at least one ingredient');
  const body = {
    name,
    servings: parseFloat(document.getElementById('recipe-servings').value) || 1,
    isPublic: document.getElementById('recipe-public').checked,
    ingredients: recipeDraft.map((line) => ({
      foodId: line.foodId,
      amount: line.amount,
      unit: line.unit
    }))
  };
  try {
    if (recipeEditingId) {
      await api(`/recipes/${recipeEditingId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Recipe updated');
    } else {
      await api('/recipes', { method: 'POST', body: JSON.stringify(body) });
      toast('Recipe saved');
    }
    resetRecipeForm();
    loadRecipes();
  } catch (err) {
    toast(err.message);
  }
});

function recipeCard(recipe, mine) {
  const yieldN = Math.max(0.25, recipe.servings || 1);
  const cal = Math.round((recipe.totals?.calories || 0) / yieldN);
  const who = recipe.user?.displayName || recipe.user?.username || '';
  return `
    <div class="food-log-item">
      <div>
        <strong>${recipe.name}</strong>
        ${recipe.isPublic ? '<span class="badge badge-maintain">Public</span>' : ''}
        <div class="hint">${cal} kcal per serving · ${recipe.ingredients.length} ingredients${who && !mine ? ' · ' + who : ''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        ${mine ? `<button class="btn btn-secondary btn-sm" data-edit-recipe="${recipe._id}">Edit</button>` : ''}
        ${mine ? `<button class="btn btn-secondary btn-sm" data-public-recipe="${recipe._id}" data-public="${recipe.isPublic ? '1' : '0'}">${recipe.isPublic ? 'Make private' : 'Make public'}</button>` : ''}
        <button class="btn btn-primary btn-sm" data-log-recipe="${recipe.food || ''}">Log 1 serving</button>
        ${mine ? `<button class="btn btn-danger btn-sm" data-delete-recipe="${recipe._id}">Delete</button>` : ''}
      </div>
    </div>`;
}

async function loadRecipes() {
  try {
    const [mine, pub] = await Promise.all([
      api('/recipes?scope=mine'),
      api('/recipes?scope=public')
    ]);
    const mineEl = document.getElementById('my-recipes');
    const pubEl = document.getElementById('public-recipes');
    mineEl._recipes = mine;
    mineEl.innerHTML = mine.length ? mine.map((r) => recipeCard(r, true)).join('') : '<div class="empty">No recipes yet.</div>';
    const others = pub.filter((r) => !mine.some((m) => m._id === r._id));
    pubEl.innerHTML = others.length ? others.map((r) => recipeCard(r, false)).join('') : '<div class="empty">No public recipes from other people yet.</div>';
  } catch (err) {
    console.error(err);
  }
}

async function logRecipeServing(foodId) {
  if (!foodId) return toast('This recipe cannot be logged yet');
  await api('/food-logs', {
    method: 'POST',
    body: JSON.stringify({ date: todayStr(), meal: 'other', foodId, servings: 1 })
  });
  toast('Logged 1 serving for today');
}

document.getElementById('my-recipes').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit-recipe]');
  const pub = e.target.closest('[data-public-recipe]');
  const del = e.target.closest('[data-delete-recipe]');
  const log = e.target.closest('[data-log-recipe]');
  try {
    if (edit) {
      const recipe = (document.getElementById('my-recipes')._recipes || []).find((r) => r._id === edit.dataset.editRecipe);
      if (!recipe) return;
      recipeEditingId = recipe._id;
      recipeDraft = recipe.ingredients.map((item) => ({
        foodId: item.food && item.food._id ? item.food._id : item.food,
        foodName: item.foodName,
        amount: item.amount,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat
      }));
      document.getElementById('recipe-name').value = recipe.name;
      document.getElementById('recipe-servings').value = recipe.servings;
      document.getElementById('recipe-public').checked = !!recipe.isPublic;
      document.getElementById('recipe-form-title').textContent = 'Edit Recipe';
      document.getElementById('btn-save-recipe').textContent = 'Update Recipe';
      document.getElementById('btn-cancel-recipe').style.display = 'block';
      renderRecipeDraft();
    }
    if (pub) {
      await api(`/recipes/${pub.dataset.publicRecipe}`, {
        method: 'PUT',
        body: JSON.stringify({ isPublic: pub.dataset.public !== '1' })
      });
      loadRecipes();
    }
    if (del) {
      if (!confirm('Delete this recipe?')) return;
      await api(`/recipes/${del.dataset.deleteRecipe}`, { method: 'DELETE' });
      if (recipeEditingId === del.dataset.deleteRecipe) resetRecipeForm();
      toast('Deleted');
      loadRecipes();
    }
    if (log) await logRecipeServing(log.dataset.logRecipe);
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('public-recipes').addEventListener('click', async (e) => {
  const log = e.target.closest('[data-log-recipe]');
  if (!log) return;
  try {
    await logRecipeServing(log.dataset.logRecipe);
  } catch (err) {
    toast(err.message);
  }
});

// ========== Shares ==========
document.getElementById('btn-grant-share').addEventListener('click', async () => {
  const username = document.getElementById('share-email').value.trim().replace(/^@/, '');
  if (!username) return toast('Enter their username');
  const permissions = {
    weight: document.getElementById('share-weight').checked,
    workouts: document.getElementById('share-workouts').checked,
    food: document.getElementById('share-food').checked,
    body: document.getElementById('share-body').checked,
    goals: document.getElementById('share-goals').checked
  };
  const note = document.getElementById('share-note').value.trim();
  try {
    await api('/shares', { method: 'POST', body: JSON.stringify({ username, permissions, note }) });
    toast('Access granted');
    SHARE_PERMS.forEach(([k]) => { document.getElementById('share-' + k).checked = k === 'weight' || k === 'workouts'; });
    document.getElementById('share-email').value = '';
    document.getElementById('share-note').value = '';
    loadShares();
  } catch (err) {
    toast(err.message);
  }
});

const SHARE_PERMS = [['weight', 'Weight'], ['workouts', 'Workouts'], ['food', 'Food'], ['body', 'Body'], ['goals', 'Goals']];
function sharePersonName(u) {
  return (u && (u.displayName || u.username)) || 'Former user';
}
function sharePersonSub(u) {
  if (!u) return '';
  const parts = [];
  if (u.username && u.username !== u.displayName) parts.push('@' + u.username);
  return parts.join(' · ');
}
function shareInitials(u) {
  const n = sharePersonName(u).replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  const w = n.split(/\s+/).filter(Boolean);
  return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : (w[0] || '')[1] || '')).toUpperCase();
}
function sharePermPills(perms) {
  const on = SHARE_PERMS.filter(([k]) => perms && perms[k]);
  if (!on.length) return '<span class="perm-pill perm-none">Nothing selected</span>';
  return on.map(([, l]) => `<span class="perm-pill">${esc(l)}</span>`).join('');
}
function shareRow(s, person, canRemove) {
  const uname = person && person.username;
  const nm = sharePersonName(person);
  const actions = canRemove
    ? `<button type="button" class="btn btn-danger-ghost share-remove" data-revoke="${esc(s._id)}" aria-label="Remove access for ${esc(nm)}">Remove</button>`
    : uname
      ? `<div class="share-actions">
          <button type="button" class="btn btn-ghost-outline btn-sm" data-open-shared="${esc(uname)}">Open</button>
          <button type="button" class="btn btn-ghost-outline btn-sm" data-leave="${esc(s._id)}" aria-label="Stop seeing ${esc(nm)}'s data">Leave</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-block="${esc(uname)}" data-name="${esc(nm)}" aria-label="Block ${esc(nm)}">Block</button>
        </div>`
      : '';
  return `<li class="share-row${canRemove ? '' : ' share-row-received'}">
    <span class="share-avatar" aria-hidden="true">${esc(shareInitials(person))}</span>
    <div class="share-main">
      <div class="share-name">${esc(nm)}${s.note ? `<span class="share-note">${esc(s.note)}</span>` : ''}</div>
      ${sharePersonSub(person) ? `<div class="share-sub">${esc(sharePersonSub(person))}</div>` : ''}
      <div class="share-perms">${sharePermPills(s.permissions)}</div>
      ${s.paused ? '<div class="share-paused">Paused: allowed again once age rules permit it (e.g. a parent link).</div>' : ''}
    </div>
    ${actions}
  </li>`;
}

async function loadShares() {
  const el = document.getElementById('share-list');
  try {
    const data = await api('/shares');
    const granted = data.granted || [];
    const received = data.received || [];
    let html = `<h3 class="section-label share-list-title">People with access${granted.length ? ` <span class="count-pill">${granted.length}</span>` : ''}</h3>`;
    html += granted.length
      ? `<ul class="share-rows">${granted.map((s) => shareRow(s, s.viewer, true)).join('')}</ul>`
      : `<div class="empty-state">
          <span class="empty-icon" aria-hidden="true">👥</span>
          <strong>No shares yet</strong>
          <p class="hint">Add a coach or family member above. They'll see only what you tick, read-only.</p>
        </div>`;
    if (received.length) {
      html += `<h3 class="section-label share-list-title">Shared with you <span class="count-pill">${received.length}</span></h3>
        <ul class="share-rows">${received.map((s) => shareRow(s, s.owner, false)).join('')}</ul>`;
    }
    el.innerHTML = html;
  } catch (err) {
    console.error(err);
    el.innerHTML = '<p class="hint">Could not load shares. Try again in a moment.</p>';
  }
}
document.getElementById('share-list').addEventListener('click', async (e) => {
  const leave = e.target.closest('[data-leave]');
  if (leave) {
    const who = leave.closest('.share-row')?.querySelector('.share-name')?.firstChild?.textContent || 'this person';
    if (!confirm(`Stop seeing ${who}'s data? Your comments on their things will be hidden. They can share again later.`)) return;
    leave.disabled = true;
    try { await api(`/shares/${encodeURIComponent(leave.dataset.leave)}`, { method: 'DELETE' }); toast('Removed'); } catch (err) { toast(err.message); }
    return loadShares();
  }
  const btn = e.target.closest('[data-revoke]');
  if (!btn) return;
  const name = btn.closest('.share-row')?.querySelector('.share-name')?.firstChild?.textContent || 'this person';
  if (!confirm(`Remove ${name}'s access to your data?`)) return;
  btn.disabled = true;
  try {
    await api(`/shares/${encodeURIComponent(btn.dataset.revoke)}`, { method: 'DELETE' });
    toast('Access removed');
  } catch (err) {
    toast(err.message);
  }
  loadShares();
});

// ========== Boot ==========
function renderAll() {
  if (!document.getElementById('weight-date').value) {
    document.getElementById('weight-date').value = todayStr();
  }
  if (!document.getElementById('food-date').value) {
    document.getElementById('food-date').value = todayStr();
  }
  if (!document.getElementById('wo-date').value) {
    document.getElementById('wo-date').value = todayStr();
  }
  if (!document.getElementById('bm-date').value) {
    document.getElementById('bm-date').value = todayStr();
  }
  loadDashboard();
  loadWeightHistory();
  loadGoal();
}

if (location.pathname === '/reset') showAuth(); else checkAuth();

// Keep the sticky workout bar tucked right under the (mobile-sticky) top bar.
function syncTopbarHeight() {
  const tb = document.querySelector('.topbar');
  if (tb) document.documentElement.style.setProperty('--topbar-h', `${tb.offsetHeight}px`);
}
window.addEventListener('resize', syncTopbarHeight);
window.addEventListener('load', syncTopbarHeight);
syncTopbarHeight();
