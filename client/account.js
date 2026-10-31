// Accounts: sign-up age gate, one-time details prompt, locked accounts, forgot/reset password,
// streaks with rest days, training schedule, teen limits and parent links.
(() => {
  const $ = (id) => document.getElementById(id);
  const escA = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const isTeen = () => !!(currentUser && currentUser.ageGroup === 'teen');

  // ---------- auth screen views ----------
  const AUTH_VIEWS = ['login-form', 'register-form', 'forgot-form', 'reset-form', 'under13-panel'];
  function authView(id) {
    AUTH_VIEWS.forEach((v) => { const el = $(v); el.hidden = v !== id; el.style.display = v === id ? 'block' : 'none'; });
    document.querySelector('.auth-tabs').hidden = !(id === 'login-form' || id === 'register-form');
    $('tab-login').classList.toggle('active', id === 'login-form');
    $('tab-register').classList.toggle('active', id === 'register-form');
  }
  $('tab-login').addEventListener('click', () => authView('login-form'));
  $('tab-register').addEventListener('click', () => authView('register-form'));
  $('btn-forgot').addEventListener('click', () => {
    $('forgot-id').value = $('login-username').value.trim();
    $('forgot-msg').textContent = ''; $('forgot-error').textContent = '';
    authView('forgot-form'); $('forgot-id').focus();
  });
  document.querySelectorAll('[data-back-login]').forEach((b) => b.addEventListener('click', () => {
    if (location.pathname === '/reset') history.replaceState(null, '', '/');
    authView('login-form');
  }));
  function showUnder13(message) {
    $('under13-text').textContent = message;
    ['reg-dob', 'reg-email', 'reg-password'].forEach((id) => { $(id).value = ''; });
    authView('under13-panel');
  }
  $('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('forgot-msg').textContent = ''; $('forgot-error').textContent = '';
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await api('/auth/forgot', { method: 'POST', body: JSON.stringify({ identifier: $('forgot-id').value.trim() }) });
      $('forgot-msg').textContent = r.message;
    } catch (err) { $('forgot-error').textContent = err.message; }
    btn.disabled = false;
  });
  let resetToken = '';
  $('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('reset-msg').textContent = ''; $('reset-error').textContent = '';
    if ($('reset-pw').value !== $('reset-pw2').value) { $('reset-error').textContent = "Passwords don't match"; return; }
    try {
      const r = await api('/auth/reset', { method: 'POST', body: JSON.stringify({ token: resetToken, password: $('reset-pw').value }) });
      resetToken = ''; $('reset-pw').value = ''; $('reset-pw2').value = '';
      history.replaceState(null, '', '/');
      authView('login-form');
      $('login-error').textContent = '';
      toast(r.message);
    } catch (err) { $('reset-error').textContent = err.message; }
  });
  // /reset#token=... – read the token from the fragment, then remove it from the address bar.
  function checkResetLink() {
    if (location.pathname !== '/reset') return false;
    const m = location.hash.match(/token=([A-Za-z0-9_-]+)/);
    resetToken = m ? m[1] : '';
    history.replaceState(null, '', '/reset');
    authView('reset-form');
    if (!resetToken) $('reset-error').textContent = 'This reset link is incomplete. Ask for a new one.';
    return true;
  }

  // ---------- one-time details / locked ----------
  function needsGate(user) { return !!(user && (user.locked || (user.needs && user.needs.length))); }
  function showGate(user) {
    if (user) currentUser = user;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    $('gate-screen').style.display = 'flex';
    const locked = currentUser && currentUser.locked;
    $('gate-form').hidden = !!locked; $('gate-locked').hidden = !locked;
    if (locked) { $('gate-locked-text').textContent = "Fitness Coach is for people 13 and older, so this account can't be used right now. We didn't keep the date of birth you entered."; return; }
    const needs = (currentUser && currentUser.needs) || [];
    $('gate-email-row').hidden = !needs.includes('email');
    $('gate-dob-row').hidden = !needs.includes('dob');
    $('gate-email').required = needs.includes('email');
    $('gate-dob').required = needs.includes('dob');
    $('gate-dob').max = todayStr();
  }
  function hideGate() { $('gate-screen').style.display = 'none'; }
  $('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('gate-error').textContent = '';
    const body = {};
    if (!$('gate-email-row').hidden) body.email = $('gate-email').value.trim();
    if (!$('gate-dob-row').hidden) body.dob = $('gate-dob').value;
    try {
      const r = await api('/auth/complete', { method: 'POST', body: JSON.stringify(body) });
      hideGate();
      enterApp(r.user);
    } catch (err) {
      if (err.code === 'account_locked') { currentUser = (err.data && err.data.user) || { ...currentUser, locked: true }; showGate(); return; }
      $('gate-error').textContent = err.message;
    }
  });
  document.querySelectorAll('[data-gate-logout]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    currentUser = null; hideGate(); showAuth(); authView('login-form');
  }));
  $('gate-delete').addEventListener('click', async () => {
    $('gate-locked-error').textContent = '';
    if (!confirm('Delete this account and everything in it? This cannot be undone.')) return;
    try {
      await api('/account', { method: 'DELETE', body: JSON.stringify({ password: $('gate-del-pw').value }) });
      currentUser = null; hideGate(); showAuth(); authView('login-form'); toast('Account deleted');
    } catch (err) { $('gate-locked-error').textContent = err.message; }
  });
  // Called by api() when the server says the account needs details or is locked.
  function gate(data) {
    if (!currentUser) return;
    if (data.code === 'account_locked') currentUser.locked = true;
    if (data.code === 'account_incomplete') currentUser.needs = data.needs || ['dob', 'email'];
    showGate();
  }

  // ---------- streak ----------
  let streak = null;
  function renderStreak() {
    const s = streak; if (!s) return;
    $('streak-card').hidden = false;
    $('streak-value').textContent = s.streak;
    $('streak-unit').textContent = s.streak === 1 ? 'training day in a row' : 'training days in a row';
    let status;
    if (s.todayDone) status = '✓ Trained today. Nice!';
    else if (s.todayRest) status = '😴 Rest day taken. Your streak is safe.';
    else if (s.plannedRestToday) status = s.schedule.mode === 'weekdays' ? '😴 Rest day on your schedule.' : `Today can be a rest day (${s.plannedRestLeft} rest day${s.plannedRestLeft === 1 ? '' : 's'} left this week).`;
    else status = 'Today is a training day. It won\'t break your streak until it\'s over.';
    const extra = s.skipsPerWeek ? `${s.skipsLeft} of ${s.skipsPerWeek} extra rest day${s.skipsPerWeek === 1 ? '' : 's'} left this week` : 'Extra rest days are off in your schedule';
    $('streak-status').innerHTML = `${escA(status)}<small class="hint streak-sub">${escA(extra)}</small>`;
    $('streak-explain').textContent = s.explanation;
    const b = $('btn-rest-day');
    b.hidden = !(s.canTakeRest || s.todayRest);
    b.textContent = s.todayRest ? 'Undo rest day' : 'Take a rest day';
    b.dataset.undo = s.todayRest ? '1' : '';
  }
  async function loadStreak() {
    try { streak = await api('/streak'); renderStreak(); } catch { /* ignore */ }
  }
  $('btn-rest-day').addEventListener('click', async () => {
    const undo = $('btn-rest-day').dataset.undo === '1';
    try { streak = await api('/streak/rest-day', { method: undo ? 'DELETE' : 'POST' }); renderStreak(); toast(undo ? 'Rest day removed' : 'Rest day taken. Your streak is safe'); } catch (err) { toast(err.message); }
  });
  $('streak-edit').addEventListener('click', () => { goSettings('schedule-card'); });
  function goSettings(cardId) {
    const btn = document.querySelector('#main-nav button[data-panel="settings"]');
    if (btn) btn.click();
    setTimeout(() => { const c = $(cardId); if (c) { c.scrollIntoView({ block: 'start', behavior: 'smooth' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1200); } }, 80);
  }

  // ---------- schedule settings ----------
  $('sched-days').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="check-tile"><input type="checkbox" value="${d}" /><span>${DAYS[d]}</span></label>`).join('');
  function syncSchedForm() {
    const anyDay = [...$('sched-days').querySelectorAll('input')].some((i) => i.checked);
    $('sched-rest').disabled = anyDay;
  }
  $('sched-days').addEventListener('change', syncSchedForm);
  async function loadSchedule() {
    if (!streak) await loadStreak();
    const s = streak && streak.schedule; if (!s) return;
    $('sched-days').querySelectorAll('input').forEach((i) => { i.checked = s.mode === 'weekdays' && s.days.includes(Number(i.value)); });
    $('sched-rest').value = s.source === 'setting' ? String(s.rest) : '';
    $('sched-skips').value = String(s.skips);
    $('sched-auto-hint').textContent = s.source === 'program' ? `Automatic: ${s.rest} rest days a week, from ${s.program}.` : s.source === 'default' ? 'Automatic: 3 rest days a week (or your program\'s rest days once you log a plan workout).' : '';
    syncSchedForm();
  }
  $('btn-save-schedule').addEventListener('click', async () => {
    const trainingDays = [...$('sched-days').querySelectorAll('input')].filter((i) => i.checked).map((i) => Number(i.value));
    const rv = $('sched-rest').value;
    try {
      streak = await api('/streak/schedule', { method: 'PUT', body: JSON.stringify({ trainingDays, restDaysPerWeek: rv === '' ? null : Number(rv), restSkipsPerWeek: Number($('sched-skips').value) }) });
      renderStreak(); loadSchedule(); toast('Schedule saved');
    } catch (err) { toast(err.message); }
  });

  // ---------- teen limits ----------
  function applyLimits() {
    const teen = isTeen();
    $('teen-privacy-note').hidden = !teen;
    const disc = $('pp-discoverable');
    disc.disabled = teen; if (teen) disc.checked = false;
    disc.closest('label').classList.toggle('is-disabled', teen);
    $('people-search-card').hidden = teen;
    $('teen-people-note').hidden = !teen;
    if (teen) $('people-hidden-note').hidden = true;
    $('share-intro').textContent = teen
      ? 'On teen accounts you can share only with a linked parent or guardian (see Family below). You choose exactly what they see.'
      : 'Give a coach or family member read-only access to the parts of your log you choose. You can remove it anytime.';
  }

  // ---------- family / parent links ----------
  let family = null;
  const personLine = (p, fallback) => p ? `${escA(p.displayName || p.username)} <span class="share-sub">@${escA(p.username)}</span>` : escA(fallback || 'Former user');
  function renderFamily() {
    const f = family; const el = $('family-body');
    if (!f) { el.innerHTML = '<p class="hint">Could not load.</p>'; return; }
    const teen = f.role === 'teen';
    $('family-intro').textContent = teen
      ? `Link up to ${f.maxParents} parents or guardians. Once linked, you can share what you choose with them and they can comment.`
      : f.role === 'adult' ? 'Parents and guardians can link to a teen\'s account (13–17). The teen accepts, then chooses what to share with you.' : 'Family links are not available yet.';
    const initials = (p, fb) => { const n = String((p && (p.displayName || p.username)) || fb || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean); return ((n[0] || '?')[0] + (n.length > 1 ? n[n.length - 1][0] : (n[0] || '')[1] || '')).toUpperCase(); };
    const rows = (list, kind) => list.map((l) => `<li class="share-row">
        <span class="share-avatar" aria-hidden="true">${escA(initials(l.person, l.username))}</span>
        <div class="share-main"><div class="share-name">${personLine(l.person, l.username)}</div><div class="share-sub">${kind}</div></div>
        <div class="share-actions">${l.incoming ? `<button type="button" class="btn btn-primary btn-sm" data-fam-accept="${escA(l.id)}">Accept</button><button type="button" class="btn btn-ghost-outline btn-sm" data-fam-decline="${escA(l.id)}">Decline</button>` : `<button type="button" class="btn btn-danger-ghost btn-sm" data-fam-remove="${escA(l.id)}" data-kind="${l.pending ? 'cancel' : 'unlink'}">${l.pending ? 'Cancel' : 'Unlink'}</button>`}</div>
      </li>`).join('');
    const linked = teen ? f.parents : f.teens;
    const incoming = f.incoming.map((l) => ({ ...l, incoming: true }));
    const outgoing = f.outgoing.map((l) => ({ ...l, pending: true }));
    let html = '';
    if (incoming.length) html += `<h3 class="section-label">Requests for you <span class="count-pill">${incoming.length}</span></h3><ul class="share-rows">${rows(incoming, teen ? 'Wants to link as your parent/guardian' : 'Says you are their parent/guardian')}</ul>`;
    html += `<h3 class="section-label">${teen ? 'Linked parents' : 'Linked teens'}${linked.length ? ` <span class="count-pill">${linked.length}</span>` : ''}</h3>`;
    html += linked.length ? `<ul class="share-rows">${rows(linked, teen ? 'Parent/guardian' : 'Teen account')}</ul>` : `<p class="hint">${teen ? 'No linked parents yet.' : 'No linked teens.'}</p>`;
    if (outgoing.length) html += `<h3 class="section-label">Sent requests</h3><ul class="share-rows">${rows(outgoing, 'Waiting for them to accept')}</ul>`;
    const canAsk = (f.role === 'adult') || (teen && f.parents.length < f.maxParents);
    if (canAsk) html += `<div class="settings-section"><label class="section-label" for="fam-user">${teen ? 'Parent or guardian\'s username' : 'Your teen\'s username'}</label>
      <div class="search-row"><input type="text" id="fam-user" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="username" /><button type="button" class="btn btn-primary" id="btn-fam-send">Send request</button></div></div>`;
    else if (teen) html += `<p class="hint">You have ${f.maxParents} linked parents (the maximum).</p>`;
    el.innerHTML = html;
  }
  async function loadFamily() {
    try { family = await api('/family'); } catch { family = null; }
    renderFamily();
  }
  $('family-body').addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.id === 'btn-fam-send') {
        const u = $('fam-user').value.trim(); if (!u) return toast('Enter a username');
        const r = await api('/family/requests', { method: 'POST', body: JSON.stringify({ username: u }) });
        toast(r.message);
      } else if (t.dataset.famAccept) { await api(`/family/${t.dataset.famAccept}/accept`, { method: 'POST' }); toast('Linked'); }
      else if (t.dataset.famDecline) { await api(`/family/${t.dataset.famDecline}/decline`, { method: 'POST' }); toast('Declined'); }
      else if (t.dataset.famRemove) {
        if (t.dataset.kind === 'unlink' && !confirm('Unlink? Share Access between you is removed both ways.')) return;
        await api(`/family/${t.dataset.famRemove}`, { method: 'DELETE' }); toast(t.dataset.kind === 'unlink' ? 'Unlinked' : 'Request cancelled');
      } else return;
    } catch (err) { return toast(err.message); }
    loadFamily(); if (typeof loadShares === 'function') loadShares();
  });

  function renderAccountFacts() {
    const u = currentUser || {};
    const dob = u.dob ? new Date(u.dob + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
    const group = u.ageGroup === 'teen' ? 'Teen account (13–17)' : u.ageGroup === 'adult' ? 'Adult account' : '—';
    $('acct-facts').innerHTML = `<dt>Email</dt><dd>${escA(u.email || '—')}</dd><dt>Date of birth</dt><dd>${escA(dob)} <small class="hint">(can't be changed)</small></dd><dt>Account type</dt><dd>${escA(group)}</dd>`;
  }

  function loadSettingsCards() { applyLimits(); loadSchedule(); loadFamily(); renderAccountFacts(); }

  // run when the People panel opens too (search card hidden for teens)
  document.getElementById('main-nav').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.panel === 'settings') loadSettingsCards();
    if (b.dataset.panel === 'people') setTimeout(applyLimits, 0);
    if (b.dataset.panel === 'dashboard') loadStreak();
  });

  window.Account = { needsGate, showGate, hideGate, gate, showUnder13, authView, checkResetLink, loadStreak, applyLimits, loadSettingsCards };
  if (location.pathname === '/reset') checkResetLink();
})();
