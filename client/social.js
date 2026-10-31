// ========== Social: profiles, opt-in search, shared views, comments ==========
// Loaded after app.js; uses its globals (api, esc, toast, settings, currentUser, formatDate, woDisp, woUnitLabel, P).
(function () {
  const $ = (id) => document.getElementById(id);
  const SAFE_AV = /^(#[0-9a-f]{6}|data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)$/i;
  const PERM_LABEL = { workouts: 'Workouts', weight: 'Weight', food: 'Food', body: 'Body', goals: 'Goals' };
  const TAB_ORDER = ['workouts', 'weight', 'food', 'body', 'goals'];
  let unread = { count: 0, items: [] };
  let search = { q: '', page: 0, seq: 0 };
  let shared = null; // { owner, tab, foodDate }
  let privacy = null;

  function initials(p) {
    const n = String((p && (p.displayName || p.username)) || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
    const w = n.split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : (w[0] || '')[1] || '')).toUpperCase();
  }
  function avatar(p, cls = 'share-avatar') {
    const a = p && SAFE_AV.test(p.avatar || '') ? p.avatar : '';
    if (a.startsWith('data:')) return `<span class="${cls} has-img" aria-hidden="true"><img src="${esc(a)}" alt="" /></span>`;
    return `<span class="${cls}" aria-hidden="true"${a ? ` style="background:${a};color:#fff"` : ''}>${esc(initials(p))}</span>`;
  }
  const name = (p) => (p && (p.displayName || p.username)) || 'Someone';
  const handle = (p) => (p && p.username ? '@' + p.username : '');
  const timeAgo = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const monthYear = (ym) => new Date(ym + '-15T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  // ---------- sheet ----------
  function openSheet(html, label) {
    const sh = $('social-sheet');
    sh.innerHTML = `<div class="sheet social-sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="sheet-grip" aria-hidden="true"></div>${html}</div>`;
    sh.hidden = false;
    document.body.classList.add('sheet-open');
    return sh.firstElementChild;
  }
  function closeSheet() {
    $('social-sheet').hidden = true;
    $('social-sheet').innerHTML = '';
    document.body.classList.remove('sheet-open');
  }
  $('social-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'social-sheet' || e.target.closest('[data-sheet-close]')) closeSheet();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('social-sheet').hidden) closeSheet(); });
  const sheetHead = (kicker, title) => `<div class="sheet-head"><div>${kicker ? `<div class="summary-kicker">${esc(kicker)}</div>` : ''}<strong class="summary-title">${esc(title)}</strong></div><button type="button" class="icon-btn" data-sheet-close aria-label="Close">×</button></div>`;

  function goPanel(panel) {
    const b = document.querySelector(`#main-nav button[data-panel="${panel}"]`);
    if (b) b.click();
  }

  // ---------- unread badge ----------
  async function loadUnread() {
    try { unread = await api('/comments/unread'); } catch { return; }
    const n = unread.count || 0;
    const label = n > 9 ? '9+' : String(n);
    [['notif-count'], ['people-badge']].forEach(([id]) => { const el = $(id); el.hidden = !n; el.textContent = label; });
    $('btn-notif').setAttribute('aria-label', n ? `${n} new comment${n === 1 ? '' : 's'}` : 'Comments');
    renderNotifs();
  }
  function renderNotifs() {
    const card = $('notif-card');
    if (!unread.items || !unread.items.length) { card.hidden = true; return; }
    card.hidden = false;
    $('notif-card-count').textContent = unread.count;
    $('notif-list').innerHTML = unread.items.map((c, i) => {
      const whose = c.onMine ? 'your' : c.owner.username === c.author.username ? 'their' : esc(name(c.owner)) + "'s";
      const where = c.workout ? `${whose} workout “${esc(c.workout.name)}”` : `${whose} day, ${esc(formatDate(c.date))}`;
      return `<li><button type="button" class="notif-item" data-notif="${i}">
        ${avatar(c.author)}
        <span class="notif-main"><span class="notif-line"><strong>${esc(name(c.author))}</strong> on ${where}</span>
        <span class="notif-text">${esc(c.text)}</span><span class="notif-time">${esc(timeAgo(c.createdAt))}</span></span></button></li>`;
    }).join('');
  }
  $('notif-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-notif]');
    if (!b) return;
    const c = unread.items[Number(b.dataset.notif)];
    openThread({ owner: c.onMine ? 'me' : c.owner.username, ownerName: c.onMine ? 'You' : name(c.owner), workout: c.workout && c.workout.id, date: c.date, title: c.workout ? c.workout.name : formatDate(c.date) });
  });
  $('btn-notif-seen').addEventListener('click', async () => {
    await api('/comments/seen', { method: 'POST' }).catch(() => {});
    loadUnread();
  });
  $('btn-notif').addEventListener('click', () => { goPanel('people'); setTimeout(() => $('notif-card').scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); });
  setInterval(() => { if (currentUser && document.visibilityState === 'visible') loadUnread(); }, 60_000);

  // ---------- People panel ----------
  async function loadPeople() {
    showHome();
    loadUnread();
    loadSharedWithMe();
    try {
      privacy = await api('/social/me');
      $('people-hidden-note').hidden = !!privacy.discoverable;
    } catch { /* ignore */ }
  }
  function showHome() { $('people-home').hidden = false; $('people-shared').hidden = true; shared = null; }

  async function loadSharedWithMe() {
    const el = $('shared-with-me');
    try {
      const rows = await api('/shared');
      el.innerHTML = rows.length ? rows.map((r) => `<li class="share-row">
          ${avatar(r)}
          <div class="share-main">
            <div class="share-name">${esc(name(r))}${r.note ? `<span class="share-note">${esc(r.note)}</span>` : ''}</div>
            <div class="share-sub">${esc(handle(r))}</div>
            <div class="share-perms">${r.permissions.map((k) => `<span class="perm-pill">${esc(PERM_LABEL[k] || k)}</span>`).join('')}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-open-shared="${esc(r.username)}">Open</button>
        </li>`).join('')
        : `<li class="empty-state"><span class="empty-icon" aria-hidden="true">🤝</span><strong>Nothing shared with you yet</strong><p class="hint">When someone gives you access in their Share access settings, it shows up here.</p></li>`;
      el.classList.toggle('is-empty', !rows.length);
    } catch { el.innerHTML = '<li class="hint" style="padding:12px">Could not load. Try again in a moment.</li>'; }
  }
  $('shared-with-me').addEventListener('click', (e) => { const b = e.target.closest('[data-open-shared]'); if (b) openShared(b.dataset.openShared); });

  // search
  let tmr = null;
  $('people-q').addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => runSearch(true), 300); });
  $('people-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(tmr); runSearch(true); } });
  $('people-more').addEventListener('click', () => runSearch(false));
  async function runSearch(fresh) {
    const q = $('people-q').value.trim();
    const list = $('people-results');
    if (fresh) { search = { q, page: 0, seq: search.seq + 1 }; }
    const seq = search.seq;
    if (q.length < 2) { list.innerHTML = q ? '<li class="hint people-msg">Type at least 2 characters.</li>' : ''; list.classList.toggle('has-rows', false); $('people-more-wrap').hidden = true; return; }
    try {
      const r = await api(`/social/search?q=${encodeURIComponent(q)}&page=${search.page}`);
      if (seq !== search.seq) return;
      const html = r.results.map((p) => `<li class="share-row person-row">
          ${avatar(p)}
          <div class="share-main"><div class="share-name">${esc(name(p))}</div><div class="share-sub">${esc(handle(p))}</div>${p.bio ? `<div class="person-bio">${esc(p.bio)}</div>` : ''}</div>
          <button type="button" class="btn btn-ghost-outline btn-sm" data-profile="${esc(p.username)}">View</button>
        </li>`).join('');
      if (fresh) list.innerHTML = html || `<li class="hint people-msg">No one found for “${esc(q)}”. People only appear if they've turned on search.</li>`;
      else list.insertAdjacentHTML('beforeend', html);
      list.classList.toggle('has-rows', !!list.querySelector('.person-row'));
      search.page += 1;
      $('people-more-wrap').hidden = !r.hasMore;
    } catch (err) { toast(err.message); }
  }
  $('people-results').addEventListener('click', (e) => { const b = e.target.closest('[data-profile]'); if (b) openProfile(b.dataset.profile); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-goto-privacy]')) { closeSheet(); goPanel('settings'); setTimeout(() => $('privacy-card').scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); }
  });

  // ---------- profile sheet ----------
  async function openProfile(username) {
    let p;
    try { p = await api('/social/profile/' + encodeURIComponent(username)); } catch (err) { return toast(err.message); }
    const stats = [];
    if (p.stats.workoutsThisMonth != null) stats.push([p.stats.workoutsThisMonth, 'workouts this month']);
    if (p.stats.streak != null) stats.push([p.stats.streak, p.stats.streak === 1 ? 'day streak' : 'day streak']);
    if (p.stats.memberSince) stats.push([monthYear(p.stats.memberSince), 'member since']);
    const rel = p.relationship || {};
    const theyShare = rel.sharesWithMe && rel.sharesWithMe.length;
    const html = `${sheetHead(p.isSelf ? 'Preview: how others see you' : 'Profile', '')}
      <div class="profile-hero">
        ${avatar(p, 'profile-big')}
        <div><div class="profile-name">${esc(name(p))}</div><div class="share-sub">${esc(handle(p))}</div></div>
      </div>
      ${p.bio ? `<p class="profile-bio">${esc(p.bio)}</p>` : ''}
      ${stats.length ? `<div class="profile-stats">${stats.map(([v, l]) => `<div><span>${esc(v)}</span><small>${esc(l)}</small></div>`).join('')}</div>` : ''}
      ${p.interests && p.interests.length ? `<div class="summary-h">Interests</div><div class="chip-row">${p.interests.map((i) => `<span class="chip chip-static">${esc(i)}</span>`).join('')}</div>` : ''}
      ${!p.bio && !stats.length && !(p.interests && p.interests.length) ? `<p class="hint profile-empty">${p.isSelf ? 'Only your name and @username are visible. Turn on fields in Profile &amp; privacy.' : 'This person keeps their profile minimal.'}</p>` : ''}
      ${p.isSelf ? `<div class="card-actions"><button type="button" class="btn btn-ghost-outline" data-goto-privacy>Edit privacy</button></div>` : `
      ${theyShare ? `<p class="hint rel-note">Shares ${esc(rel.sharesWithMe.map((k) => PERM_LABEL[k]).join(', '))} with you.</p>` : ''}
      ${rel.iShareWithThem ? `<p class="hint rel-note">You share ${esc(rel.iShareWithThem.map((k) => PERM_LABEL[k]).join(', ') || 'nothing yet')} with them.</p>` : ''}
      <div class="profile-actions">
        ${theyShare ? `<button type="button" class="btn btn-primary" data-act="view">View shared data</button>` : ''}
        <button type="button" class="btn ${theyShare ? 'btn-ghost-outline' : 'btn-primary'}" data-act="share">${rel.iShareWithThem ? 'Change what I share' : 'Share with them'}</button>
        <button type="button" class="btn btn-danger-ghost" data-act="block">Block</button>
      </div>`}`;
    const el = openSheet(html, name(p) + ' profile');
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'view') { closeSheet(); goPanel('people'); openShared(p.username); }
      if (a.dataset.act === 'share') shareWith(p.username);
      if (a.dataset.act === 'block') blockUser(p.username, name(p));
    });
  }
  function shareWith(username) {
    closeSheet();
    goPanel('settings');
    const inp = $('share-email');
    inp.value = username;
    setTimeout(() => {
      $('share-card').scrollIntoView({ block: 'start', behavior: 'smooth' });
      $('share-card').classList.add('flash');
      setTimeout(() => $('share-card').classList.remove('flash'), 1600);
      $('share-note').focus({ preventScroll: true });
    }, 60);
    toast('Pick what they can see, then tap Grant access');
  }
  async function blockUser(username, display) {
    if (!confirm(`Block ${display}? This removes sharing both ways, hides their comments, and you won't see each other in search.`)) return;
    try {
      await api('/social/blocks', { method: 'POST', body: JSON.stringify({ username }) });
      toast(`${display} blocked`);
      closeSheet();
      if (shared && shared.owner && shared.owner.username === username) showHome();
      loadSharedWithMe(); loadUnread();
      if (typeof loadShares === 'function') loadShares();
      loadBlocked();
      if (search.q.length >= 2) runSearch(true);
    } catch (err) { toast(err.message); }
  }

  // ---------- shared data view ----------
  async function openShared(username) {
    let o;
    try { o = await api('/shared/' + encodeURIComponent(username)); } catch (err) { toast(err.message); return loadSharedWithMe(); }
    shared = { owner: o, tab: TAB_ORDER.find((t) => o.permissions.includes(t)), foodDate: todayStr() };
    $('people-home').hidden = true; $('people-shared').hidden = false;
    $('shared-head').innerHTML = `<div class="shared-who">${avatar(o)}<div class="share-main"><div class="share-name">${esc(name(o))}</div><div class="share-sub">${esc(handle(o))} · read-only</div></div>
      <button type="button" class="btn btn-ghost-outline btn-sm" data-profile="${esc(o.username)}">Profile</button></div>`;
    $('shared-tabs').innerHTML = TAB_ORDER.filter((t) => o.permissions.includes(t)).map((t) => `<button type="button" role="tab" data-tab="${t}">${PERM_LABEL[t]}</button>`).join('');
    renderTab();
    window.scrollTo({ top: 0 });
  }
  $('shared-back').addEventListener('click', () => { showHome(); loadSharedWithMe(); });
  $('shared-head').addEventListener('click', (e) => { const b = e.target.closest('[data-profile]'); if (b) openProfile(b.dataset.profile); });
  $('shared-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b && shared) { shared.tab = b.dataset.tab; renderTab(); } });

  async function renderTab() {
    const body = $('shared-body');
    const u = encodeURIComponent(shared.owner.username);
    $('shared-tabs').querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === shared.tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    body.innerHTML = '<div class="card"><p class="hint">Loading…</p></div>';
    try {
      if (shared.tab === 'workouts') body.innerHTML = workoutsHtml(await api(`/shared/${u}/workouts?limit=20`));
      if (shared.tab === 'weight') body.innerHTML = weightHtml(await api(`/shared/${u}/weights?days=90`));
      if (shared.tab === 'food') body.innerHTML = foodHtml(await api(`/shared/${u}/food?date=${shared.foodDate}`));
      if (shared.tab === 'body') body.innerHTML = bodyHtml(await api(`/shared/${u}/body`));
      if (shared.tab === 'goals') body.innerHTML = goalsHtml(await api(`/shared/${u}/goals`));
    } catch (err) {
      body.innerHTML = `<div class="card"><p class="hint">${esc(err.message)}</p></div>`;
      if (/Nothing shared/.test(err.message)) { toast('Access was removed'); showHome(); loadSharedWithMe(); }
    }
  }
  function setLine(e) {
    const work = P.workingSets(e.sets || []);
    if (!work.length) return `${(e.sets || []).length} sets`;
    const top = work.reduce((m, s) => ((s.weight || 0) > (m.weight || 0) ? s : m), work[0]);
    const reps = work.map((s) => s.reps || 0);
    const same = reps.every((r) => r === reps[0]);
    return `${work.length} × ${same ? reps[0] : reps.join(',')}${top.weight ? ` @ ${Math.round(woDisp(top.weight) * 10) / 10} ${woUnitLabel()}` : ''}`;
  }
  function workoutsHtml(list) {
    if (!list.length) return emptyCard('🏋️', 'No workouts logged yet');
    return list.map((w) => {
      const vol = Math.round(woDisp((w.exercises || []).reduce((v, e) => v + P.volume(e.sets || []), 0)));
      return `<div class="card shared-wo">
        <div class="flex-between"><strong>${esc(w.name)}</strong><span class="hint">${esc(formatDate(w.date))}</span></div>
        <div class="hint">${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}${vol ? ` · ${vol.toLocaleString()} ${woUnitLabel()} volume` : ''}${w.durationMin ? ` · ${w.durationMin} min` : ''}</div>
        ${w.exercises.length ? `<ul class="shared-ex">${w.exercises.slice(0, 6).map((e) => `<li><span>${esc(e.exerciseName)}</span><span>${esc(setLine(e))}</span></li>`).join('')}${w.exercises.length > 6 ? `<li class="hint">+${w.exercises.length - 6} more</li>` : ''}</ul>` : ''}
        ${w.notes ? `<p class="hint shared-notes">${esc(w.notes)}</p>` : ''}
        <button type="button" class="btn btn-ghost-outline btn-sm comment-btn" data-thread-w="${esc(w.id)}" data-title="${esc(w.name)}">💬 ${w.comments ? `${w.comments} comment${w.comments === 1 ? '' : 's'}` : 'Comment'}</button>
      </div>`;
    }).join('');
  }
  function weightHtml(rows) {
    if (!rows.length) return emptyCard('⚖️', 'No weigh-ins in the last 90 days');
    const last = rows[rows.length - 1], first = rows[0];
    const diff = last.weight - first.weight;
    const ws = rows.map((r) => r.weight), lo = Math.min(...ws), hi = Math.max(...ws), span = hi - lo || 1;
    const pts = rows.map((r, i) => `${rows.length === 1 ? 150 : (i / (rows.length - 1)) * 300},${70 - ((r.weight - lo) / span) * 60}`).join(' ');
    const kg = settings.unit === 'kg';
    const d = kg ? diff / 2.20462 : diff;
    return `<div class="card">
      <div class="profile-stats"><div><span>${esc(toDisplayWeight(last.weight))}</span><small>latest · ${esc(formatDate(last.date))}</small></div>
      <div><span>${d > 0 ? '+' : ''}${d.toFixed(1)} ${kg ? 'kg' : 'lbs'}</span><small>since ${esc(formatDate(first.date))}</small></div></div>
      <svg class="spark" viewBox="0 0 300 80" preserveAspectRatio="none" role="img" aria-label="Weight trend"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
      <ul class="shared-ex">${rows.slice(-8).reverse().map((r) => `<li><span>${esc(formatDate(r.date))}</span><span>${esc(toDisplayWeight(r.weight))}</span></li>`).join('')}</ul>
    </div>`;
  }
  function foodHtml(d) {
    const meals = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
    const t = d.totals;
    const isToday = d.date === todayStr();
    return `<div class="card">
      <div class="day-nav"><button type="button" class="icon-btn" data-food-day="-1" aria-label="Previous day">‹</button><strong>${isToday ? 'Today' : esc(formatDate(d.date))}</strong><button type="button" class="icon-btn" data-food-day="1" aria-label="Next day" ${isToday ? 'disabled' : ''}>›</button></div>
      <div class="profile-stats four"><div><span>${Math.round(t.calories)}</span><small>kcal</small></div><div><span>${Math.round(t.protein)}g</span><small>protein</small></div><div><span>${Math.round(t.carbs)}g</span><small>carbs</small></div><div><span>${Math.round(t.fat)}g</span><small>fat</small></div></div>
      ${d.logs.length ? meals.filter((m) => d.logs.some((l) => l.meal === m)).map((m) => `<div class="summary-h">${m}</div><ul class="shared-ex">${d.logs.filter((l) => l.meal === m).map((l) => `<li><span>${esc(l.foodName)}${l.amount ? ` <small class="hint">${esc(l.amount)} ${esc(l.amountUnit)}</small>` : ''}</span><span>${Math.round(l.calories)} kcal</span></li>`).join('')}</ul>`).join('') : '<p class="hint">Nothing logged this day.</p>'}
      <button type="button" class="btn btn-ghost-outline btn-sm comment-btn" data-thread-d="${esc(d.date)}">💬 Comment on this day</button>
    </div>`;
  }
  const BODY_LABELS = { bodyFatPct: 'Body fat', chestCm: 'Chest', shouldersCm: 'Shoulders', waistCm: 'Waist', hipsCm: 'Hips', leftArmCm: 'Left arm', rightArmCm: 'Right arm', leftThighCm: 'Left thigh', rightThighCm: 'Right thigh', leftCalfCm: 'Left calf', rightCalfCm: 'Right calf', neckCm: 'Neck' };
  function bodyHtml(rows) {
    if (!rows.length) return emptyCard('📏', 'No measurements yet');
    const inch = (settings.lengthUnit || 'in') === 'in';
    const v = (k, x) => (k === 'bodyFatPct' ? `${x}%` : inch ? `${(x / 2.54).toFixed(1)} in` : `${x} cm`);
    const r = rows[0];
    return `<div class="card"><div class="summary-h">Latest · ${esc(formatDate(r.date))}</div>
      <ul class="shared-ex">${Object.keys(BODY_LABELS).filter((k) => r[k] != null).map((k) => `<li><span>${BODY_LABELS[k]}</span><span>${esc(v(k, r[k]))}</span></li>`).join('')}</ul>
      ${rows.length > 1 ? `<p class="hint">${rows.length - 1} earlier entr${rows.length === 2 ? 'y' : 'ies'}.</p>` : ''}</div>`;
  }
  function goalsHtml(g) {
    if (!g) return emptyCard('🎯', 'No goal set');
    const kind = { lose: 'Lose weight', gain: 'Gain weight', maintain: 'Maintain' }[g.type] || g.type;
    const amt = g.amountLbs ? (settings.unit === 'kg' ? `${(g.amountLbs / 2.20462).toFixed(1)} kg` : `${g.amountLbs} lbs`) : '';
    return `<div class="card"><div class="profile-stats"><div><span>${esc(kind)}</span><small>goal</small></div>${amt ? `<div><span>${esc(amt)}</span><small>${g.weeks ? `over ${esc(g.weeks)} weeks` : 'target'}</small></div>` : ''}</div>
      ${g.targetDate ? `<p class="hint">Target date: ${esc(formatDate(g.targetDate))}</p>` : ''}
      ${g.proteinG || g.carbsG || g.fatG ? `<ul class="shared-ex">${[['Protein', g.proteinG], ['Carbs', g.carbsG], ['Fat', g.fatG]].filter(([, x]) => x).map(([l, x]) => `<li><span>${l}</span><span>${esc(x)} g/day</span></li>`).join('')}</ul>` : ''}</div>`;
  }
  const emptyCard = (ico, msg) => `<div class="card"><div class="empty-state"><span class="empty-icon" aria-hidden="true">${ico}</span><strong>${esc(msg)}</strong></div></div>`;

  $('shared-body').addEventListener('click', (e) => {
    const day = e.target.closest('[data-food-day]');
    if (day) {
      const d = new Date(shared.foodDate + 'T12:00:00'); d.setDate(d.getDate() + Number(day.dataset.foodDay));
      const k = dateKey(d); if (k > todayStr()) return;
      shared.foodDate = k; return renderTab();
    }
    const w = e.target.closest('[data-thread-w]');
    if (w) return openThread({ owner: shared.owner.username, ownerName: name(shared.owner), workout: w.dataset.threadW, title: w.dataset.title, onClose: renderTab });
    const dd = e.target.closest('[data-thread-d]');
    if (dd) return openThread({ owner: shared.owner.username, ownerName: name(shared.owner), date: dd.dataset.threadD, title: formatDate(dd.dataset.threadD) });
  });

  // ---------- comment thread ----------
  async function openThread(t) {
    const qs = `owner=${encodeURIComponent(t.owner)}&${t.workout ? 'workout=' + encodeURIComponent(t.workout) : 'date=' + encodeURIComponent(t.date)}`;
    let data;
    try { data = await api('/comments?' + qs); } catch (err) { return toast(err.message === 'Not found' ? 'This is no longer shared with you' : err.message); }
    const kicker = t.owner === 'me' ? (t.workout ? 'Comments on your workout' : 'Comments on your day') : `${t.ownerName || ''}${t.workout ? "'s workout" : "'s day"}`;
    const el = openSheet(`${sheetHead(kicker, t.title || '')}
      <ul class="thread" id="thread-list"></ul>
      <form class="composer" id="thread-form">
        <label class="sr-only" for="thread-text">Write a comment</label>
        <textarea id="thread-text" rows="2" maxlength="500" placeholder="Write something encouraging…"></textarea>
        <div class="composer-row"><span class="char-count"><span id="thread-count">0</span>/500</span><button type="submit" class="btn btn-primary btn-sm" id="thread-send" disabled>Post</button></div>
      </form>`, 'Comments');
    const list = el.querySelector('#thread-list');
    const paint = () => {
      list.innerHTML = data.comments.length ? data.comments.map((c) => `<li class="comment${c.mine ? ' mine' : ''}">
          ${avatar(c.author, 'share-avatar sm')}
          <div class="comment-body"><div class="comment-meta"><strong>${esc(c.mine ? 'You' : name(c.author))}</strong><span>${esc(timeAgo(c.createdAt))}</span>
          ${c.canDelete ? `<button type="button" class="link-btn danger" data-del="${esc(c.id)}">Delete</button>` : ''}</div>
          <p>${esc(c.text)}</p></div></li>`).join('')
        : '<li class="hint thread-empty">No comments yet. Say something nice!</li>';
      list.scrollTop = list.scrollHeight;
    };
    paint();
    const ta = el.querySelector('#thread-text'), send = el.querySelector('#thread-send');
    ta.addEventListener('input', () => { el.querySelector('#thread-count').textContent = ta.value.length; send.disabled = !ta.value.trim(); });
    el.querySelector('#thread-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      send.disabled = true;
      try {
        const c = await api('/comments', { method: 'POST', body: JSON.stringify({ owner: t.owner, workout: t.workout || undefined, date: t.workout ? undefined : t.date, text }) });
        data.comments.push(c); ta.value = ''; el.querySelector('#thread-count').textContent = '0'; paint();
        t.changed = true;
      } catch (err) { toast(err.message); send.disabled = false; }
    });
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]');
      if (!b || !confirm('Delete this comment?')) return;
      try {
        await api('/comments/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
        data.comments = data.comments.filter((c) => c.id !== b.dataset.del); paint(); t.changed = true;
      } catch (err) { toast(err.message); }
    });
    const obs = new MutationObserver(() => {
      if ($('social-sheet').hidden) {
        obs.disconnect();
        if (t.changed && t.onClose) t.onClose();
        if (t.changed && t.owner === 'me') decorateOwnWorkouts();
      }
    });
    obs.observe($('social-sheet'), { attributes: true, attributeFilter: ['hidden'] });
  }

  // ---------- own workout history: comment counts ----------
  async function decorateOwnWorkouts() {
    const btns = [...document.querySelectorAll('#wo-history [data-thread-own]')];
    if (!btns.length) return;
    try {
      const counts = await api('/comments/counts?owner=me&workouts=' + btns.map((b) => b.dataset.threadOwn).join(','));
      btns.forEach((b) => {
        const n = counts[b.dataset.threadOwn] || 0;
        b.hidden = !n;
        b.textContent = `💬 ${n}`;
        b.setAttribute('aria-label', `${n} comment${n === 1 ? '' : 's'}`);
      });
    } catch { /* ignore */ }
  }
  document.getElementById('wo-history').addEventListener('click', (e) => {
    const b = e.target.closest('[data-thread-own]');
    if (b) openThread({ owner: 'me', workout: b.dataset.threadOwn, title: b.dataset.title });
  });

  // ---------- Settings: Profile & privacy ----------
  const VIS = ['avatar', 'bio', 'interests', 'workoutsThisMonth', 'streak', 'memberSince'];
  async function loadPrivacy() {
    try {
      privacy = await api('/social/me');
      $('pp-discoverable').checked = privacy.discoverable;
      $('pp-bio').value = privacy.bio;
      $('pp-bio-count').textContent = privacy.bio.length;
      VIS.forEach((k) => { $('pp-v-' + k).checked = !!privacy.visibility[k]; });
    } catch { /* ignore */ }
    loadBlocked();
  }
  $('pp-bio').addEventListener('input', () => { $('pp-bio-count').textContent = $('pp-bio').value.length; });
  async function savePrivacy() {
    const body = { discoverable: $('pp-discoverable').checked, bio: $('pp-bio').value, visibility: Object.fromEntries(VIS.map((k) => [k, $('pp-v-' + k).checked])) };
    privacy = await api('/social/me', { method: 'PUT', body: JSON.stringify(body) });
    return privacy;
  }
  $('btn-pp-save').addEventListener('click', async () => {
    try { await savePrivacy(); toast(privacy.discoverable ? 'Saved. People can find you in search' : 'Saved. You are hidden from search'); } catch (err) { toast(err.message); }
  });
  $('btn-pp-preview').addEventListener('click', async () => {
    try { await savePrivacy(); openProfile(currentUser.username); } catch (err) { toast(err.message); }
  });
  async function loadBlocked() {
    const el = $('blocked-list');
    try {
      const rows = await api('/social/blocks');
      el.innerHTML = rows.length ? `<h3 class="section-label share-list-title">Blocked <span class="count-pill">${rows.length}</span></h3>
        <ul class="share-rows">${rows.map((b) => `<li class="share-row">${avatar(b)}<div class="share-main"><div class="share-name">${esc(name(b))}</div><div class="share-sub">${esc(handle(b))}</div></div>
        <button type="button" class="btn btn-ghost-outline btn-sm" data-unblock="${esc(b.username)}">Unblock</button></li>`).join('')}</ul>` : '';
    } catch { el.innerHTML = ''; }
  }
  $('blocked-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-unblock]');
    if (!b) return;
    try { await api('/social/blocks/' + encodeURIComponent(b.dataset.unblock), { method: 'DELETE' }); toast('Unblocked'); loadBlocked(); } catch (err) { toast(err.message); }
  });

  // Received share rows: open / leave / block (rendered by app.js shareRow)
  $('share-list').addEventListener('click', async (e) => {
    const open = e.target.closest('[data-open-shared]');
    if (open) { goPanel('people'); return openShared(open.dataset.openShared); }
    const prof = e.target.closest('[data-profile]');
    if (prof) return openProfile(prof.dataset.profile);
    const blk = e.target.closest('[data-block]');
    if (blk) return blockUser(blk.dataset.block, blk.dataset.name || blk.dataset.block);
  });

  window.Social = { loadPeople, loadPrivacy, loadUnread, decorateOwnWorkouts, openProfile, openShared, openThread, closeSheet };
})();
