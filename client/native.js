// Native glue for the Fitness Coach iOS/Android app (Capacitor). On the plain
// website window.Capacitor is absent and this file does nothing.
(function () {
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = (isNative && Cap.Plugins) || {};
  const platform = isNative ? Cap.getPlatform() : 'web';
  const $ = (id) => document.getElementById(id);
  const REM_KEY = 'fc-reminders';
  const WORKOUT_ID = 101, STREAK_ID = 102;

  function loadRem() {
    try { return Object.assign({ workout: false, workoutTime: '17:30', streak: false, streakTime: '20:00' }, JSON.parse(localStorage.getItem(REM_KEY) || '{}')); }
    catch (e) { return { workout: false, workoutTime: '17:30', streak: false, streakTime: '20:00' }; }
  }
  const hm = (t) => { const [h, m] = String(t || '').split(':').map(Number); return { hour: h || 0, minute: m || 0 }; };

  async function clearReminders() {
    if (!P.LocalNotifications) return;
    try { await P.LocalNotifications.cancel({ notifications: [{ id: WORKOUT_ID }, { id: STREAK_ID }] }); } catch (e) {}
    localStorage.removeItem(REM_KEY);
  }

  async function applyReminders(r) {
    const LN = P.LocalNotifications;
    if (!LN) return 'Notifications unavailable';
    await LN.cancel({ notifications: [{ id: WORKOUT_ID }, { id: STREAK_ID }] }).catch(() => {});
    if (!r.workout && !r.streak) return 'Reminders off';
    let perm = await LN.checkPermissions();
    if (perm.display !== 'granted') perm = await LN.requestPermissions();
    if (perm.display !== 'granted') return 'Notifications are blocked. Turn them on in your phone Settings.';
    const list = [];
    if (r.workout) list.push({ id: WORKOUT_ID, title: 'Time to train 💪', body: 'Your workout is waiting in Fitness Coach.', schedule: { on: hm(r.workoutTime), repeats: true, allowWhileIdle: true } });
    if (r.streak) list.push({ id: STREAK_ID, title: 'Keep your streak going 🔥', body: 'Log a meal, weight, or workout today.', schedule: { on: hm(r.streakTime), repeats: true, allowWhileIdle: true } });
    await LN.schedule({ notifications: list });
    return 'Saved. ' + list.length + ' daily reminder' + (list.length > 1 ? 's' : '') + ' set.';
  }

  function initReminders() {
    const card = $('reminders-card');
    if (!card || !P.LocalNotifications) return;
    card.hidden = false;
    const r = loadRem();
    $('rem-workout').checked = r.workout; $('rem-workout-time').value = r.workoutTime;
    $('rem-streak').checked = r.streak; $('rem-streak-time').value = r.streakTime;
    $('btn-rem-save').addEventListener('click', async () => {
      const next = { workout: $('rem-workout').checked, workoutTime: $('rem-workout-time').value, streak: $('rem-streak').checked, streakTime: $('rem-streak-time').value };
      localStorage.setItem(REM_KEY, JSON.stringify(next));
      try { $('rem-status').textContent = await applyReminders(next); }
      catch (e) { $('rem-status').textContent = 'Could not set reminders.'; }
    });
    // Tapping a reminder opens the matching screen.
    P.LocalNotifications.addListener('localNotificationActionPerformed', (ev) => {
      const id = ev && ev.notification && ev.notification.id;
      go(id === WORKOUT_ID ? 'workouts' : 'dashboard');
    });
  }

  function go(panel) {
    const b = document.querySelector('#main-nav button[data-panel="' + panel + '"]');
    if (b) b.click();
  }
  const visible = (el) => el && !el.hidden && getComputedStyle(el).display !== 'none';

  // Android back button: close the top-most overlay, then go to Dashboard, then leave the app.
  function initBack() {
    if (!P.App) return;
    P.App.addListener('backButton', () => {
      const scan = $('scan-modal');
      if (scan && scan.style.display === 'flex') return $('btn-scan-close').click();
      const lb = $('photo-lightbox');
      if (visible(lb)) return lb.querySelector('.photo-lightbox-close').click();
      const sheets = ['about-you-sheet', 'social-sheet', 'wo-sheet', 'food-sheet'];
      for (const id of sheets) {
        const el = $(id);
        if (visible(el)) {
          const close = el.querySelector('[data-close], .sheet-close, .btn-close, [aria-label="Close"]');
          if (close) close.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          return;
        }
      }
      const nav = $('main-nav');
      if (nav && nav.classList.contains('open')) return $('nav-toggle').click();
      const active = document.querySelector('#main-nav button.active');
      if (active && active.dataset.panel !== 'dashboard' && visible($('app-screen') || document.body)) return go('dashboard');
      P.App.minimizeApp ? P.App.minimizeApp() : P.App.exitApp();
    });
  }

  async function initChrome() {
    document.documentElement.classList.add('native', 'native-' + platform);
    if (P.StatusBar) {
      try {
        await P.StatusBar.setStyle({ style: 'DARK' }); // light text on the dark green top bar
        if (platform === 'android') await P.StatusBar.setBackgroundColor({ color: '#203227' });
      } catch (e) {}
    }
    if (P.SplashScreen) setTimeout(() => P.SplashScreen.hide().catch(() => {}), 150);
  }

  // Barcode scanner: html5-qrcode runs inside the web view with getUserMedia.
  // Camera permission comes from Info.plist (iOS) / AndroidManifest (Android).
  // A light haptic tick confirms a successful scan.
  function initScanHaptics() {
    if (!P.Haptics) return;
    const status = $('scan-status');
    if (!status) return;
    new MutationObserver(() => {
      if (/^Looking up/.test(status.textContent)) P.Haptics.impact({ style: 'LIGHT' }).catch(() => {});
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }

  window.FCNative = { isNative, platform, clearReminders, applyReminders };
  if (!isNative) return;
  initChrome(); initBack(); initReminders(); initScanHaptics();
  // When the app resumes after a long sleep, refresh so data and the session are current.
  if (P.App) {
    let hiddenAt = 0;
    P.App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30 * 60_000) location.reload();
    });
  }
})();
