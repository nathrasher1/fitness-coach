// Connected health data (phone app only). A provider adapter per platform keeps
// HealthKit easy to add later: implement the same 6 methods for 'ios'.
(function () {
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const platform = isNative ? Cap.getPlatform() : 'web';
  const Health = isNative && Cap.Plugins && Cap.Plugins.Health;
  const $ = (id) => document.getElementById(id);
  const KEY = 'fc-health';
  const SYNC_DAYS = 30, MIN_AUTO_GAP = 15 * 60_000;
  const TYPES = [
    { key: 'steps', label: 'Steps' },
    { key: 'calories', label: 'Active calories' },
    { key: 'distance', label: 'Distance' },
    { key: 'workouts', label: 'Workouts (exercise sessions)' }
  ];
  const READ = TYPES.map((t) => t.key);
  const localKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const state = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));

  // ---- provider: Android Health Connect via @capgo/capacitor-health ----
  const providers = {
    android: {
      source: 'health_connect', name: 'Health Connect',
      async available() { const r = await Health.isAvailable(); return { ok: !!r.available, reason: r.reason || '' }; },
      async status() { return Health.checkAuthorization({ read: READ }); },
      async request() { return Health.requestAuthorization({ read: READ }); },
      async manage() { return Health.openHealthConnectSettings(); },
      async read(start, end) {
        const agg = async (dataType) => {
          try { return (await Health.queryAggregated({ dataType, startDate: start.toISOString(), endDate: end.toISOString(), bucket: 'day', aggregation: 'sum' })).samples || []; }
          catch (e) { return []; }
        };
        const [steps, kcal, dist] = await Promise.all([agg('steps'), agg('calories'), agg('distance')]);
        const days = {};
        const put = (arr, k) => arr.forEach((s) => { const d = localKey(s.startDate); (days[d] = days[d] || { date: d })[k] = s.value; });
        put(steps, 'steps'); put(kcal, 'activeKcal'); put(dist, 'distanceM');
        let workouts = [];
        try {
          const r = await Health.queryWorkouts({ startDate: start.toISOString(), endDate: end.toISOString(), limit: 500 });
          workouts = (r.workouts || []).filter((w) => w.platformId).map((w) => ({
            externalId: w.platformId, start: w.startDate, end: w.endDate, date: localKey(w.startDate), type: w.workoutType,
            app: w.sourceName || '', durationMin: w.duration != null ? w.duration / 60 : null, activeKcal: w.totalEnergyBurned, distanceM: w.totalDistance
          }));
        } catch (e) {}
        return { days: Object.values(days), workouts };
      }
    }
  };
  const P = Health && providers[platform];

  function setStatus(msg) { const el = $('health-status'); if (el) el.textContent = msg; }
  function renderTypes(st) {
    const ok = new Set((st && st.readAuthorized) || []);
    $('health-types').innerHTML = TYPES.map((t) => `<li><span>${t.label}</span><span class="${ok.has(t.key) ? 'ok' : 'no'}">${ok.has(t.key) ? 'Allowed' : 'Not allowed'}</span></li>`).join('');
    return ok;
  }
  function buttons(connected) {
    $('btn-health-connect').hidden = connected;
    $('btn-health-sync').hidden = !connected;
    $('btn-health-manage').hidden = false;
    $('btn-health-disconnect').hidden = !connected;
  }

  async function refreshCard() {
    const av = await P.available().catch(() => ({ ok: false, reason: 'error' }));
    if (!av.ok) {
      renderTypes(null); buttons(false); $('btn-health-manage').hidden = true;
      $('btn-health-connect').textContent = 'Get Health Connect';
      setStatus(/update/i.test(av.reason) ? 'Health Connect needs an update. Update it from Google Play, then come back.' : 'Health Connect isn\'t installed on this phone. On Android 13 and older, install "Health Connect" from Google Play. On Android 14 and newer it\'s built into Settings.');
      return { available: false };
    }
    $('btn-health-connect').textContent = 'Connect Health Connect';
    const st = await P.status().catch(() => null);
    const ok = renderTypes(st);
    const s = state();
    const connected = !!s.connected && ok.size > 0;
    buttons(connected);
    if (s.connected && !ok.size) setStatus('Access was turned off in Health Connect. Tap Connect to allow it again.');
    else if (connected) setStatus(s.lastSync ? `Last synced ${new Date(s.lastSync).toLocaleString()}${s.lastResult ? ` · ${s.lastResult}` : ''}` : 'Connected. Tap Sync now.');
    else setStatus('Not connected.');
    return { available: true, connected, ok };
  }

  let syncing = false;
  async function sync(manual) {
    const s = state();
    if (!P || !s.connected || syncing) return;
    if (!manual && s.lastSync && Date.now() - s.lastSync < MIN_AUTO_GAP) return;
    syncing = true; if (manual) setStatus('Syncing…');
    try {
      const st = await P.status();
      if (!(st.readAuthorized || []).length) { if (manual) await refreshCard(); return; }
      const end = new Date(); const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (SYNC_DAYS - 1));
      const data = await P.read(start, end);
      const r = await api('/health/sync', { method: 'POST', body: JSON.stringify({ source: P.source, days: data.days, workouts: data.workouts }) });
      save({ ...state(), lastSync: Date.now(), lastResult: `${r.days} day${r.days === 1 ? '' : 's'}, ${r.workouts} workout${r.workouts === 1 ? '' : 's'}` });
      if (manual) toast('Health data synced');
      if (window.loadActivity) window.loadActivity();
      if (typeof loadWorkoutHistory === 'function') loadWorkoutHistory();
    } catch (e) {
      if (manual) setStatus('Sync failed: ' + (e.message || 'please try again'));
    } finally { syncing = false; if (manual) refreshCard(); }
  }

  function init() {
    const card = $('health-card');
    if (!card || !P) return; // web, iOS (until HealthKit is added) or plugin missing: hide entirely
    card.hidden = false;
    refreshCard();
    $('btn-health-connect').addEventListener('click', async () => {
      const av = await P.available().catch(() => ({ ok: false }));
      if (!av.ok) { window.open('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata', '_system'); return; }
      try {
        const st = await P.request();
        const n = (st.readAuthorized || []).length;
        save({ ...state(), connected: n > 0 });
        await refreshCard();
        if (n) sync(true); else setStatus('No access was allowed. You can change this any time with Manage permissions.');
      } catch (e) { setStatus('Couldn\'t open Health Connect: ' + (e.message || 'unknown error')); }
    });
    $('btn-health-sync').addEventListener('click', () => sync(true));
    $('btn-health-manage').addEventListener('click', () => P.manage().catch(() => {}));
    $('btn-health-disconnect').addEventListener('click', async () => {
      if (!confirm('Stop syncing from Health Connect? Data already imported stays until you remove it below. To fully revoke access, also turn it off in Health Connect (Manage permissions).')) return;
      save({ connected: false }); await refreshCard(); setStatus('Disconnected. Nothing new will be synced.');
    });
    $('btn-health-remove').addEventListener('click', async () => {
      if (!confirm('Remove all imported steps, calories and workouts from Fitness Coach?')) return;
      try { const r = await api('/health/data', { method: 'DELETE' }); toast(`Removed ${r.removed.days} days and ${r.removed.workouts} workouts`); if (window.loadActivity) window.loadActivity(); if (typeof loadWorkoutHistory === 'function') loadWorkoutHistory(); }
      catch (e) { toast(e.message); }
    });
    setTimeout(() => sync(false), 2500);
    if (Cap.Plugins.App) Cap.Plugins.App.addListener('appStateChange', ({ isActive }) => { if (isActive) { refreshCard(); sync(false); } });
  }

  window.FCHealth = { isAvailable: !!P, sync, refreshCard, clearLocal: () => localStorage.removeItem(KEY) };
  init();
})();
