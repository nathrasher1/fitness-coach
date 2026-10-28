// ========== State ==========
let currentUser = null;
let settings = { unit: 'lbs', calAvgDays: 14, interests: [] };
let selectedFood = null;
let currentPeriodDays = 7;

// ========== Helpers ==========
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
async function checkAuth() {
  try {
    const data = await api('/auth/me');
    currentUser = data.user;
    showApp();
    await loadSettings();
    renderAll();
  } catch {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('header-user').textContent = currentUser.displayName || currentUser.username;
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
    currentUser = data.user;
    showApp();
    await loadSettings();
    renderAll();
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
        password: document.getElementById('reg-password').value
      })
    });
    currentUser = data.user;
    showApp();
    await loadSettings();
    renderAll();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  currentUser = null;
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
    loadPrograms();
    loadWorkoutHistory();
    if (!document.getElementById('wo-date').value) {
      document.getElementById('wo-date').value = todayStr();
    }
  }
  if (btn.dataset.panel === 'body') {
    loadBodyMetrics();
    if (!document.getElementById('bm-date').value) {
      document.getElementById('bm-date').value = todayStr();
    }
  }
  if (btn.dataset.panel === 'settings') loadShares();
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
const INTEREST_GROUPS = [
  {
    label: 'Sports',
    items: [
      'Brazilian jiu-jitsu', 'Wrestling', 'Boxing', 'Muay Thai', 'MMA',
      'Football', 'Basketball', 'Baseball', 'Softball', 'Soccer',
      'Hockey', 'Lacrosse', 'Volleyball', 'Tennis', 'Golf',
      'Track and field', 'Swimming', 'Wakeboarding', 'Skiing', 'Snowboarding'
    ]
  },
  {
    label: 'Training',
    items: [
      'Strength training', 'Powerlifting', 'Olympic lifting', 'Bodybuilding',
      'CrossFit', 'Running', 'Cycling', 'Rock climbing', 'Hiking', 'Yoga'
    ]
  },
  {
    label: 'Other activities',
    items: ['Coaching', 'Music', 'Guitar', 'Spanish', 'Homeschool', 'Gardening']
  }
];

function renderInterestChecks() {
  const box = document.getElementById('interest-groups');
  if (!box) return;
  const selected = new Set(settings.interests || []);
  box.innerHTML = INTEREST_GROUPS.map((group) => `
    <div style="margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:6px">${group.label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px 14px">
        ${group.items.map((item) => `
          <label style="display:flex;align-items:center;gap:4px;font-weight:400">
            <input type="checkbox" class="interest-check" value="${item}" ${selected.has(item) ? 'checked' : ''} style="width:auto" />
            ${item}
          </label>`).join('')}
      </div>
    </div>`).join('');
}

function selectedInterests() {
  return Array.from(document.querySelectorAll('.interest-check:checked')).map((el) => el.value);
}

async function loadSettings() {
  try {
    settings = await api('/settings');
    const unit = document.getElementById('unit-pref');
    const foodUnit = document.getElementById('food-weight-unit');
    const days = document.getElementById('cal-avg-days');
    if (unit) unit.value = settings.unit || 'lbs';
    if (foodUnit) foodUnit.value = settings.foodWeightUnit || 'g';
    if (days) days.value = settings.calAvgDays || 14;
    renderInterestChecks();
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
        interests: selectedInterests()
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
        interests: selectedInterests()
      })
    });
    toast('Interests saved');
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
async function loadDashboard() {
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

  el.innerHTML = rows
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
            <div class="bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="hint" style="margin-top:4px">
            ${remaining == null ? '' : remaining >= 0 ? remaining + r.unit + ' remaining' : Math.abs(remaining) + r.unit + ' over'}
          </div>
        </div>`;
    })
    .join('');
}

function renderRecommendation(rec) {
  const box = document.getElementById('recommendation');
  if (!rec || !rec.ready) {
    box.innerHTML = `<div class="empty">${rec?.reason || 'Not enough data yet.'}</div>`;
    return;
  }

  const badge =
    rec.goalNote.includes('Lose')
      ? '<span class="badge badge-loss">Cut</span>'
      : rec.goalNote.includes('Gain')
      ? '<span class="badge badge-gain">Bulk</span>'
      : '<span class="badge badge-maintain">Maintain</span>';

  box.innerHTML = `
    <div class="rec-box">
      <div class="headline">${rec.targetDaily} kcal / day</div>
      <div class="macros">
        <span class="macro-pill">P ${rec.macros.proteinG}g</span>
        <span class="macro-pill">C ${rec.macros.carbsG}g</span>
        <span class="macro-pill">F ${rec.macros.fatG}g</span>
      </div>
      <div class="detail">
        ${badge} ${rec.goalNote}<br><br>
        Estimated maintenance: <strong>${rec.estimatedMaintenance} kcal</strong><br>
        Based on ${rec.sampleSize.calorieDays} calorie days (avg ${rec.avgCalories} kcal)
        and ${rec.sampleSize.weights} weigh-ins over ${rec.spanDays} days
        (net ${rec.weightDelta > 0 ? '+' : ''}${rec.weightDelta.toFixed(1)} lbs).
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

const WEIGHT_UNITS = new Set(['g', 'gram', 'grams', 'oz', 'ounce', 'ounces']);
const G_PER_OZ = 28.3495;

function isWeightUnit(unit) {
  return WEIGHT_UNITS.has((unit || '').toLowerCase());
}

function toGrams(size, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return size * G_PER_OZ;
  return size; // already grams
}

/** Convert amount in the chosen unit into "number of base servings" */
function amountToServings(amount, chosenUnit, food) {
  const baseUnit = (food.servingUnit || 'serving').toLowerCase();
  if (chosenUnit === 'serving' || chosenUnit === baseUnit) {
    return amount;
  }
  // Weight conversion: food defined per X g (or oz)
  if (isWeightUnit(baseUnit) && (chosenUnit === 'g' || chosenUnit === 'oz')) {
    const baseGrams = toGrams(food.servingSize, baseUnit);
    const amountGrams = chosenUnit === 'oz' ? amount * G_PER_OZ : amount;
    return amountGrams / baseGrams;
  }
  return amount;
}

function buildUnitOptions(food) {
  const baseUnit = (food.servingUnit || 'serving').toLowerCase();
  const select = document.getElementById('food-amount-unit');
  const options = [];

  if (isWeightUnit(baseUnit)) {
    options.push({ value: 'g', label: 'g' });
    options.push({ value: 'oz', label: 'oz' });
    options.push({
      value: 'serving',
      label: `serving (${food.servingSize} ${food.servingUnit})`
    });
  } else {
    options.push({ value: 'serving', label: food.servingUnit || 'serving' });
  }

  const seen = new Set();
  select.innerHTML = options
    .filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    })
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join('');
}

function renderQuickAmounts() {
  const unit = document.getElementById('food-amount-unit').value;
  const box = document.getElementById('quick-serving-btns');
  let presets;
  if (unit === 'g') {
    const base = selectedFood
      ? Math.round(toGrams(selectedFood.servingSize, selectedFood.servingUnit))
      : 100;
    presets = Array.from(new Set([25, 50, 100, base, 150, 200])).sort((a, b) => a - b);
  } else if (unit === 'oz') {
    presets = [1, 2, 3, 4, 6];
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
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    carbs: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0,
    servingSize: Number(food.servingSize) || 1,
    servingUnit: food.servingUnit || 'serving'
  };
  document.getElementById('food-selected-name').textContent = selectedFood.name;
  const serveLabel = `${selectedFood.servingSize} ${selectedFood.servingUnit}`;
  let perGram = '';
  if (isWeightUnit(selectedFood.servingUnit)) {
    const grams = toGrams(selectedFood.servingSize, selectedFood.servingUnit) || 1;
    perGram = ` · ${(selectedFood.calories / grams).toFixed(2)} kcal/g`;
  }
  document.getElementById('food-selected-meta').textContent =
    `${selectedFood.calories} kcal · P${selectedFood.protein}g C${selectedFood.carbs}g F${selectedFood.fat}g per ${serveLabel}${perGram}`;

  buildUnitOptions(selectedFood);
  if (isWeightUnit(selectedFood.servingUnit)) {
    document.getElementById('food-amount-unit').value = 'g';
    document.getElementById('food-servings').value = String(
      Math.round(toGrams(selectedFood.servingSize, selectedFood.servingUnit))
    );
  } else {
    document.getElementById('food-amount-unit').value = 'serving';
    document.getElementById('food-servings').value = '1';
  }
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
  const cal = Math.round(selectedFood.calories * servings);
  const p = +(selectedFood.protein * servings).toFixed(1);
  const c = +(selectedFood.carbs * servings).toFixed(1);
  const f = +(selectedFood.fat * servings).toFixed(1);
  document.getElementById('food-serving-preview').textContent =
    `${cal} kcal · P${p}g C${c}g F${f}g`;
}

document.getElementById('food-servings').addEventListener('input', updateServingPreview);
document.getElementById('food-amount-unit').addEventListener('change', () => {
  // When switching to g/oz, set a sensible default amount (the base serving size)
  if (!selectedFood) return;
  const unit = document.getElementById('food-amount-unit').value;
  const baseUnit = (selectedFood.servingUnit || '').toLowerCase();
  if (unit === 'g') {
    document.getElementById('food-servings').value = String(
      Math.round(toGrams(selectedFood.servingSize, baseUnit))
    );
  } else if (unit === 'oz') {
    const g = toGrams(selectedFood.servingSize, baseUnit);
    document.getElementById('food-servings').value = (g / G_PER_OZ).toFixed(1);
  } else {
    document.getElementById('food-servings').value = '1';
  }
  updateServingPreview();
  renderQuickAmounts();
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
      el.innerHTML = '<div class="search-item">No foods found — create a custom food below</div>';
      el.classList.add('open');
      return;
    }
    el.innerHTML = foods
      .map(
        (f) => `
      <div class="search-item" data-id="${f._id}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div>${f.name}${f.brand ? ' · ' + f.brand : ''}</div>
            <div class="meta">${f.calories} kcal · P${f.protein}g C${f.carbs}g F${f.fat}g · per ${formatServingLabel(f.servingSize, f.servingUnit)}</div>
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

  try {
    await api('/food-logs', {
      method: 'POST',
      body: JSON.stringify({ date, meal, foodId: selectedFood.id, servings })
    });
    selectedFood = null;
    document.getElementById('food-selected-row').style.display = 'none';
    document.getElementById('btn-log-food').disabled = true;
    document.getElementById('food-servings').value = '1';
    toast('Food logged');
    loadFoodLog();
    loadQuickAdd();
    loadDashboard();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-create-food').addEventListener('click', async () => {
  const name = document.getElementById('cf-name').value.trim();
  const calories = document.getElementById('cf-calories').value;
  if (!name || !calories) return toast('Name and calories required');

  try {
    await api('/foods', {
      method: 'POST',
      body: JSON.stringify({
        name,
        calories: Number(calories),
        protein: Number(document.getElementById('cf-protein').value) || 0,
        carbs: Number(document.getElementById('cf-carbs').value) || 0,
        fat: Number(document.getElementById('cf-fat').value) || 0
      })
    });
    document.getElementById('cf-name').value = '';
    document.getElementById('cf-calories').value = '';
    document.getElementById('cf-protein').value = '';
    document.getElementById('cf-carbs').value = '';
    document.getElementById('cf-fat').value = '';
    toast('Custom food created — search for it to log');
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
    toast('Manual entry added');
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
    { key: 'protein', label: 'Protein', color: '#16a34a', current: totals.protein, target: targets.protein },
    { key: 'carbs', label: 'Net Carbs', color: '#2563eb', current: totals.carbs, target: targets.carbs },
    { key: 'fat', label: 'Fat', color: '#d97706', current: totals.fat, target: targets.fat }
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

    listEl.innerHTML = order
      .map((meal) => {
        const mealLogs = groups[meal] || [];
        const mealCals = mealLogs.reduce((s, l) => s + l.calories, 0);
        const items = mealLogs.length
          ? mealLogs
              .map(
                (l) => `
          <div class="diary-item">
            <div class="info">
              <div class="name">${l.foodName}${l.isManual ? ' <span class="badge-manual">manual</span>' : ''}</div>
              <div class="meta">${l.isManual ? '' : l.servings + ' · '}P${l.protein} C${l.carbs} F${l.fat}</div>
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
              <button type="button" class="add-meal-btn" data-add-meal="${meal}">+ Add food</button>
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
      btn.addEventListener('click', () => {
        document.getElementById('food-meal').value = btn.dataset.addMeal;
        document.getElementById('food-search').focus();
        document.getElementById('food-search').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    listEl.querySelectorAll('.btn-danger').forEach((btn) => {
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

    const recentEl = document.getElementById('recent-chips');
    if (!recent.length) {
      recentEl.innerHTML = '<div class="chip-empty">Foods you log will appear here</div>';
    } else {
      recentEl.innerHTML = recent
        .map(
          (f) => `
        <button class="chip" data-id="${f._id}">
          ${f.name}
          <span class="chip-cal">${f.calories != null ? f.calories + ' kcal' : ''}</span>
        </button>`
        )
        .join('');
      recentEl.querySelectorAll('.chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const food = recent.find((f) => f._id === btn.dataset.id);
          if (food) selectFoodForLog(food);
        });
      });
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
  input.value = d.toISOString().slice(0, 10);
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
      const rate = goal.weeks ? (goal.amountLbs / goal.weeks).toFixed(2) : '—';
      el.innerHTML = `
        <div class="goal-summary">
          <div class="target">${typeLabel} ${goal.type === 'maintain' ? '' : goal.amountLbs + ' lbs'} in ${goal.weeks} weeks</div>
          <div style="margin-top:4px;font-size:0.9rem;color:var(--text-muted)">≈ ${rate} lbs / week</div>
        </div>
      `;
    }
    document.getElementById('goal-type').value = goal.type || 'maintain';
    document.getElementById('goal-amount').value = goal.amountLbs || '';
    document.getElementById('goal-weeks').value = goal.weeks || 12;
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
  const weeks = parseInt(document.getElementById('goal-weeks').value, 10) || 12;
  let startWeight = parseFloat(document.getElementById('goal-start-weight').value);
  if (!isNaN(startWeight)) startWeight = fromInputWeight(startWeight);
  else startWeight = undefined;

  try {
    await api('/goals', {
      method: 'PUT',
      body: JSON.stringify({ type, amountLbs: amount, weeks, startWeight })
    });
    toast('Goal saved');
    loadGoal();
    loadDashboard();
  } catch (err) {
    toast(err.message);
  }
});

// ========== Workouts ==========
let currentWorkoutExercises = [];
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
      <div class="search-item" data-id="${ex._id}" data-name="${ex.name}" data-pattern="${ex.pattern || ''}">
        <div>${ex.name}</div>
        <div class="meta">${ex.pattern || ''} · ${(ex.equipment || []).join(', ')}</div>
      </div>`
      )
      .join('');
    el.classList.add('open');
    el.querySelectorAll('.search-item').forEach((item) => {
      item.addEventListener('click', () => {
        addExerciseToWorkout(item.dataset.id, item.dataset.name);
        el.classList.remove('open');
        document.getElementById('wo-ex-search').value = '';
      });
    });
  } catch (err) {
    console.error(err);
  }
}

function addExerciseToWorkout(id, name) {
  const entry = {
    exerciseId: id,
    exerciseName: name,
    suggestion: '',
    previous: [],
    sets: [{ weight: 0, reps: 8, logged: false }]
  };
  currentWorkoutExercises.push(entry);
  renderWorkoutExercises();
  document.getElementById('btn-save-workout').disabled = false;
  startWorkoutTimer();
  loadSuggestion(currentWorkoutExercises.length - 1);
}

async function loadSuggestion(idx) {
  const ex = currentWorkoutExercises[idx];
  if (!ex) return;
  try {
    const data = await api(`/workouts/suggest-load?exerciseId=${encodeURIComponent(ex.exerciseId)}`);
    ex.previous = data.lastSets || [];
    if (data.ready && data.suggestion) {
      ex.sets[0].weight = data.suggestion.weight || 0;
      ex.sets[0].reps = data.suggestion.reps || 8;
      ex.suggestion = `Target ${data.suggestion.weight} × ${data.suggestion.reps}`;
    } else {
      ex.suggestion = 'No history yet';
    }
    renderWorkoutExercises();
  } catch (err) {
    ex.suggestion = '';
    renderWorkoutExercises();
  }
}

let workoutTimerId = null;
let workoutStartedAt = null;
function startWorkoutTimer() {
  if (workoutTimerId) return;
  workoutStartedAt = Date.now();
  const el = document.getElementById('wo-timer');
  workoutTimerId = setInterval(() => {
    const s = Math.floor((Date.now() - workoutStartedAt) / 1000);
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    if (el) el.textContent = `${m}:${sec}`;
  }, 1000);
}
function stopWorkoutTimer() {
  clearInterval(workoutTimerId);
  workoutTimerId = null;
  workoutStartedAt = null;
  const el = document.getElementById('wo-timer');
  if (el) el.textContent = '00:00';
}

let restTimerId = null;
function startRest(seconds) {
  clearInterval(restTimerId);
  const banner = document.getElementById('wo-rest');
  let left = seconds;
  const tick = () => {
    if (!banner) return;
    banner.style.display = 'flex';
    banner.innerHTML = `<span>Rest ${left}s</span><button type="button" class="btn btn-secondary btn-sm" id="rest-skip">Skip</button>`;
    const skip = document.getElementById('rest-skip');
    if (skip) skip.onclick = () => { clearInterval(restTimerId); banner.style.display = 'none'; };
  };
  tick();
  restTimerId = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(restTimerId);
      if (banner) banner.style.display = 'none';
      return;
    }
    tick();
  }, 1000);
}

function previousLabel(ex, si) {
  const prev = ex.previous && ex.previous[si];
  if (!prev || prev.weight == null) return '—';
  return `${prev.weight}×${prev.reps || 0}`;
}

function renderWorkoutExercises() {
  const el = document.getElementById('wo-exercise-list');
  if (!currentWorkoutExercises.length) {
    el.innerHTML = '<div class="empty">Add an exercise to start the session.</div>';
    return;
  }
  el.innerHTML = currentWorkoutExercises
    .map(
      (ex, idx) => `
    <div class="wo-ex-card" data-idx="${idx}">
      <div class="flex-between">
        <div>
          <strong>${ex.exerciseName}</strong>
          ${ex.suggestion ? `<div class="hint">${ex.suggestion}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn btn-secondary btn-sm" data-swap="${idx}">Swap</button>
          <button type="button" class="btn btn-danger btn-sm" data-remove="${idx}">×</button>
        </div>
      </div>
      <table class="set-table">
        <thead><tr><th>Set</th><th>Previous</th><th>Weight</th><th>Reps</th><th></th></tr></thead>
        <tbody>
          ${ex.sets
            .map(
              (s, si) => `
            <tr class="${s.logged ? 'set-logged' : ''}">
              <td>${si + 1}</td>
              <td class="prev-cell">${previousLabel(ex, si)}</td>
              <td><input type="number" class="set-weight" data-ex="${idx}" data-set="${si}" value="${s.weight}" min="0" step="2.5" ${s.logged ? 'disabled' : ''} /></td>
              <td><input type="number" class="set-reps" data-ex="${idx}" data-set="${si}" value="${s.reps}" min="0" ${s.logged ? 'disabled' : ''} /></td>
              <td>
                ${s.logged
                  ? '<span class="set-check done">✓</span>'
                  : `<button type="button" class="set-check" data-log-set="${idx}" data-set="${si}" aria-label="Log set"></button>`}
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <button type="button" class="btn btn-secondary btn-sm" data-add-set="${idx}" style="margin-top:8px">+ Set</button>
    </div>`
    )
    .join('');

  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentWorkoutExercises.splice(parseInt(btn.dataset.remove, 10), 1);
      renderWorkoutExercises();
      document.getElementById('btn-save-workout').disabled = !currentWorkoutExercises.length;
    });
  });

  el.querySelectorAll('[data-add-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.addSet, 10);
      const last = currentWorkoutExercises[idx].sets.slice(-1)[0] || { weight: 0, reps: 8 };
      currentWorkoutExercises[idx].sets.push({ weight: last.weight, reps: last.reps, logged: false });
      renderWorkoutExercises();
    });
  });

  el.querySelectorAll('[data-log-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ex = parseInt(btn.dataset.logSet, 10);
      const set = parseInt(btn.dataset.set, 10);
      const row = btn.closest('tr');
      const w = parseFloat(row.querySelector('.set-weight').value) || 0;
      const r = parseInt(row.querySelector('.set-reps').value, 10) || 0;
      currentWorkoutExercises[ex].sets[set] = { weight: w, reps: r, logged: true };
      renderWorkoutExercises();
      startRest(90);
    });
  });

  el.querySelectorAll('.set-weight, .set-reps').forEach((input) => {
    input.addEventListener('change', () => {
      const ex = parseInt(input.dataset.ex, 10);
      const set = parseInt(input.dataset.set, 10);
      if (input.classList.contains('set-weight')) {
        currentWorkoutExercises[ex].sets[set].weight = parseFloat(input.value) || 0;
      } else {
        currentWorkoutExercises[ex].sets[set].reps = parseInt(input.value, 10) || 0;
      }
    });
  });

  el.querySelectorAll('[data-swap]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.swap, 10);
      const ex = currentWorkoutExercises[idx];
      if (!ex.exerciseId) return toast('No swap data for this exercise');
      try {
        const data = await api(`/workouts/exercises/${ex.exerciseId}/swaps`);
        if (!data.swaps?.length) return toast('No swaps found for this pattern');
        const choice = prompt(
          'Swap to:\n' + data.swaps.map((s, i) => `${i + 1}. ${s.name}`).join('\n') + '\n\nEnter number:'
        );
        const n = parseInt(choice, 10);
        if (n >= 1 && n <= data.swaps.length) {
          const chosen = data.swaps[n - 1];
          currentWorkoutExercises[idx].exerciseId = chosen._id;
          currentWorkoutExercises[idx].exerciseName = chosen.name;
          currentWorkoutExercises[idx].previous = [];
          currentWorkoutExercises[idx].suggestion = '';
          renderWorkoutExercises();
          loadSuggestion(idx);
          toast('Swapped to ' + chosen.name);
        }
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

document.getElementById('btn-quick-workout').addEventListener('click', () => {
  currentWorkoutExercises = [];
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
  if (!currentWorkoutExercises.length) return toast('Add at least one exercise');

  try {
    await api('/workouts', {
      method: 'POST',
      body: JSON.stringify({
        date,
        name,
        exercises: currentWorkoutExercises.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          sets: e.sets.filter((s) => s.logged || s.weight || s.reps)
        }))
      })
    });
    toast('Workout saved');
    currentWorkoutExercises = [];
    document.getElementById('wo-name').value = '';
    renderWorkoutExercises();
    document.getElementById('btn-save-workout').disabled = true;
    stopWorkoutTimer();
    loadWorkoutHistory();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-save-as-routine').addEventListener('click', async () => {
  const name = document.getElementById('routine-name').value.trim();
  if (!name) return toast('Enter a routine name');
  if (!currentWorkoutExercises.length) return toast('Add exercises first');

  try {
    await api('/workouts/routines', {
      method: 'POST',
      body: JSON.stringify({
        name,
        exercises: currentWorkoutExercises.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          targetSets: e.sets.length,
          targetReps: e.sets[0]?.reps || 8
        }))
      })
    });
    toast('Routine saved');
    document.getElementById('routine-name').value = '';
    loadRoutines();
  } catch (err) {
    toast(err.message);
  }
});

async function loadRoutines() {
  try {
    const routines = await api('/workouts/routines');
    const el = document.getElementById('wo-routines');
    if (!routines.length) {
      el.innerHTML = '<div class="empty">No saved routines yet.</div>';
      return;
    }
    el.innerHTML = routines
      .map(
        (r) => `
      <div class="program-card">
        <div class="flex-between">
          <strong>${r.name}</strong>
          <div>
            <button class="btn btn-secondary btn-sm" data-load="${r._id}">Load</button>
            <button class="btn btn-danger btn-sm" data-del="${r._id}">×</button>
          </div>
        </div>
        <div class="hint">${r.exercises.length} exercise${r.exercises.length === 1 ? '' : 's'}</div>
      </div>`
      )
      .join('');
    el.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const r = routines.find((x) => x._id === btn.dataset.load);
        if (!r) return;
        currentWorkoutExercises = r.exercises.map((e) => ({
          exerciseId: e.exercise,
          exerciseName: e.exerciseName,
          suggestion: '',
          previous: [],
          sets: Array.from({ length: e.targetSets || 3 }, () => ({
            weight: 0,
            reps: e.targetReps || 8,
            logged: false
          }))
        }));
        document.getElementById('wo-name').value = r.name;
        renderWorkoutExercises();
        document.getElementById('btn-save-workout').disabled = false;
        startWorkoutTimer();
        currentWorkoutExercises.forEach((_, i) => loadSuggestion(i));
        toast('Loaded ' + r.name);
      });
    });
    el.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this routine?')) return;
        await api(`/workouts/routines/${btn.dataset.del}`, { method: 'DELETE' });
        toast('Deleted');
        loadRoutines();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('btn-load-routine').addEventListener('click', () => {
  loadRoutines();
  document.getElementById('wo-routines').scrollIntoView({ behavior: 'smooth' });
});

async function loadPrograms() {
  try {
    const focus = document.getElementById('wo-program-focus').value;
    const programs = await api(`/workouts/programs${focus ? '?focus=' + focus : ''}`);
    const el = document.getElementById('wo-programs');
    if (!programs.length) {
      el.innerHTML = '<div class="empty">No programs for this focus.</div>';
      return;
    }
    el.innerHTML = programs
      .map(
        (p) => `
      <div class="program-card">
        <strong>${p.name}</strong>
        ${p.notes ? `<p class="hint">${p.notes}</p>` : ''}
        <ul>
          ${p.days.map((d) => `<li><strong>${d.name}:</strong> ${d.exercises.join(', ')}</li>`).join('')}
        </ul>
      </div>`
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('wo-program-focus').addEventListener('change', loadPrograms);

async function loadWorkoutHistory() {
  try {
    const logs = await api('/workouts?limit=15');
    const el = document.getElementById('wo-history');
    if (!logs.length) {
      el.innerHTML = '<div class="empty">No workouts logged yet.</div>';
      return;
    }
    el.innerHTML = logs
      .map(
        (w) => `
      <div class="wo-history-item">
        <div class="flex-between">
          <strong>${w.name}</strong>
          <span class="hint">${formatDate(w.date)}</span>
        </div>
        <div class="hint">${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}</div>
        <button class="btn btn-danger btn-sm" data-id="${w._id}" style="margin-top:6px">Delete</button>
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
  } catch (err) {
    console.error(err);
  }
}

// ========== Body Metrics ==========
document.getElementById('btn-save-body').addEventListener('click', async () => {
  const date = document.getElementById('bm-date').value || todayStr();
  const body = {
    date,
    bodyFatPct: document.getElementById('bm-bf').value || null,
    heightCm: document.getElementById('bm-height').value || null,
    chestCm: document.getElementById('bm-chest').value || null,
    shouldersCm: document.getElementById('bm-shoulders').value || null,
    waistCm: document.getElementById('bm-waist').value || null,
    hipsCm: document.getElementById('bm-hips').value || null,
    leftArmCm: document.getElementById('bm-larm').value || null,
    rightArmCm: document.getElementById('bm-rarm').value || null,
    leftThighCm: document.getElementById('bm-lthigh').value || null,
    rightThighCm: document.getElementById('bm-rthigh').value || null,
    neckCm: document.getElementById('bm-neck').value || null,
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

async function loadBodyMetrics() {
  try {
    const latest = await api('/body-metrics/latest');
    const el = document.getElementById('bm-latest');
    const bmiEl = document.getElementById('bm-bmi');

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
      if (m.heightCm) parts.push(`Height: ${m.heightCm} cm`);
      if (m.chestCm) parts.push(`Chest: ${m.chestCm} cm`);
      if (m.waistCm) parts.push(`Waist: ${m.waistCm} cm`);
      if (m.shouldersCm) parts.push(`Shoulders: ${m.shouldersCm} cm`);
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
          ${m.waistCm ? 'Waist ' + m.waistCm + 'cm · ' : ''}
          ${m.chestCm ? 'Chest ' + m.chestCm + 'cm' : ''}
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
      datesToCheck.add(d.toISOString().slice(0, 10));
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

async function showDayDetail(date) {
  const detail = document.getElementById('calendar-day-detail');
  const title = document.getElementById('calendar-day-title');
  const content = document.getElementById('calendar-day-content');
  title.textContent = formatDate(date);
  detail.style.display = 'block';
  content.innerHTML = '<div class="empty">Loading…</div>';

  try {
    const [weights, foodRes, workouts, metrics] = await Promise.all([
      api(`/weights?days=365`).then(all => all.filter(w => w.date === date)),
      api(`/food-logs?date=${date}`),
      api('/workouts?limit=100').then(all => all.filter(w => w.date === date)),
      api('/body-metrics?limit=100').then(all => all.filter(m => m.date === date))
    ]);
    const foods = foodRes.logs || [];

    let html = '';

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
  const email = document.getElementById('share-email').value.trim();
  if (!email) return toast('Email required');
  const permissions = {
    weight: document.getElementById('share-weight').checked,
    workouts: document.getElementById('share-workouts').checked,
    food: document.getElementById('share-food').checked,
    body: document.getElementById('share-body').checked,
    goals: document.getElementById('share-goals').checked
  };
  const note = document.getElementById('share-note').value.trim();
  try {
    await api('/shares', { method: 'POST', body: JSON.stringify({ email, permissions, note }) });
    toast('Access granted');
    document.getElementById('share-email').value = '';
    document.getElementById('share-note').value = '';
    loadShares();
  } catch (err) {
    toast(err.message);
  }
});

async function loadShares() {
  try {
    const data = await api('/shares');
    const el = document.getElementById('share-list');
    if (!data.granted.length && !data.received.length) {
      el.innerHTML = '<div class="empty">No shares yet.</div>';
      return;
    }
    let html = '';
    if (data.granted.length) {
      html += '<h3 style="font-size:0.9rem;margin:12px 0 6px">People who can see your data</h3>';
      html += data.granted.map(s => {
        const perms = Object.entries(s.permissions || {}).filter(([,v]) => v).map(([k]) => k).join(', ') || 'none';
        return `
          <div class="share-item">
            <div>
              <strong>${s.viewer?.name || s.viewer?.email || 'User'}</strong>
              <div class="hint">${s.viewer?.email || ''} · ${perms}</div>
            </div>
            <button class="btn btn-danger btn-sm" data-id="${s._id}">Revoke</button>
          </div>`;
      }).join('');
    }
    if (data.received.length) {
      html += '<h3 style="font-size:0.9rem;margin:16px 0 6px">People sharing with you</h3>';
      html += data.received.map(s => {
        const perms = Object.entries(s.permissions || {}).filter(([,v]) => v).map(([k]) => k).join(', ') || 'none';
        return `
          <div class="share-item">
            <div>
              <strong>${s.owner?.name || s.owner?.email || 'User'}</strong>
              <div class="hint">${perms}</div>
            </div>
          </div>`;
      }).join('');
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Revoke this access?')) return;
        await api(`/shares/${btn.dataset.id}`, { method: 'DELETE' });
        toast('Revoked');
        loadShares();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

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

checkAuth();
