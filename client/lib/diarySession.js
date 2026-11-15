/**
 * Diary session summaries for logged workouts, sport/practice, and imported health workouts.
 * Uses only fields already stored on those records. PR markers require a prior
 * best estimated 1RM in the provided history; first-time lifts are not marked.
 *
 * Shared by the server tests (require) and the browser (window.DiarySession).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./progression'));
  } else {
    root.DiarySession = factory(root.Progression);
  }
})(typeof self !== 'undefined' ? self : this, function (P) {
  function exerciseKey(ex) {
    const id = ex && (ex.exercise || ex.exerciseId);
    if (id) return 'id:' + String(id);
    return 'name:' + String((ex && ex.exerciseName) || '').trim().toLowerCase();
  }

  function isEarlierLog(a, b) {
    if (!a || !b) return false;
    if (a.date < b.date) return true;
    if (a.date > b.date) return false;
    const ta = Date.parse(a.createdAt || '');
    const tb = Date.parse(b.createdAt || '');
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta < tb;
    return false;
  }

  function planDayLabel(planDay) {
    if (!planDay) return '';
    const raw = String(planDay);
    const i = raw.lastIndexOf(':');
    const right = i >= 0 ? raw.slice(i + 1) : raw;
    if (!right || /^[a-f0-9]{24}$/i.test(right)) return '';
    return right;
  }

  function prettySource(source) {
    if (source === 'health_connect') return 'Health Connect';
    if (source === 'healthkit') return 'HealthKit';
    return source ? String(source) : '';
  }

  function prettyActivityType(type) {
    const s = String(type || '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatDistanceMi(distanceM) {
    if (distanceM == null || distanceM === '' || !Number.isFinite(Number(distanceM))) return '';
    return (Number(distanceM) / 1609.344).toFixed(1) + ' mi';
  }

  function priorBestE1rmMap(history, workout) {
    const map = new Map();
    (history || []).forEach((h) => {
      if (!h || (workout && h._id && workout._id && String(h._id) === String(workout._id))) return;
      if (workout && !isEarlierLog(h, workout)) return;
      (h.exercises || []).forEach((ex) => {
        const best = P.bestE1rm(ex.sets || []).value;
        if (!(best > 0)) return;
        const key = exerciseKey(ex);
        if (best > (map.get(key) || 0)) map.set(key, best);
      });
    });
    return map;
  }

  function summarizeLoggedWorkout(workout, history) {
    const w = workout || {};
    const prior = priorBestE1rmMap(history, w);
    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;
    const prs = [];
    const exercises = (w.exercises || []).map((ex) => {
      const sets = ex.sets || [];
      const labels = P.setLabels(sets);
      const vol = P.volume(sets);
      const best = P.bestE1rm(sets);
      const prev = prior.get(exerciseKey(ex)) || 0;
      let running = prev;
      const setViews = sets.map((s, i) => {
        const working = P.isWorking(s);
        const e1 = working ? P.e1rm(s.weight, s.reps) : 0;
        const pr = prev > 0 && e1 > 0 && Math.round(e1) > Math.round(running);
        if (pr) running = e1;
        totalSets += 1;
        totalReps += Number(s.reps) || 0;
        return {
          type: P.setType(s),
          label: labels[i].label,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
          distanceM: s.distanceM,
          durationSec: s.durationSec,
          note: s.note || '',
          completed: true,
          pr,
          e1rm: e1
        };
      });
      totalVolume += vol;
      const prSets = setViews.filter((s) => s.pr);
      if (prSets.length) prs.push({ name: ex.exerciseName, sets: prSets, prev, e1rm: running });
      return {
        name: ex.exerciseName,
        equipment: ex.equipment || '',
        restSec: ex.restSec,
        sets: setViews,
        volume: vol,
        bestSet: best.set || null,
        bestE1rm: best.value || 0,
        hasPR: prSets.length > 0
      };
    });
    return {
      kind: 'logged',
      id: w._id ? String(w._id) : '',
      name: w.name || 'Workout',
      date: w.date || '',
      createdAt: w.createdAt || null,
      durationMin: w.durationMin != null && w.durationMin !== '' ? Number(w.durationMin) : null,
      notes: (w.notes || '').trim(),
      planDay: w.planDay || '',
      routine: planDayLabel(w.planDay),
      exercises,
      totalSets,
      totalReps,
      totalVolume,
      prs
    };
  }

  function summarizeSportSession(session) {
    const s = session || {};
    return {
      kind: 'sport',
      id: String(s.id || s._id || ''),
      name: s.sport || 'Practice',
      date: s.date || '',
      durationMin: s.durationMin != null ? Number(s.durationMin) : null,
      effort: s.effort != null ? Number(s.effort) : null,
      trainingLoad: s.trainingLoad != null ? Number(s.trainingLoad) : null,
      activeKcal: s.activeKcal != null ? Number(s.activeKcal) : null,
      notes: (s.notes || '').trim(),
      drills: (s.drills || '').trim()
    };
  }

  function summarizeHealthWorkout(workout) {
    const w = workout || {};
    return {
      kind: 'health',
      id: w._id ? String(w._id) : '',
      name: w.name || prettyActivityType(w.type) || 'Workout',
      date: w.date || '',
      start: w.start || null,
      type: prettyActivityType(w.type),
      app: w.app || '',
      source: prettySource(w.source),
      durationMin: w.durationMin != null && w.durationMin !== '' ? Number(w.durationMin) : null,
      activeKcal: w.activeKcal != null ? Number(w.activeKcal) : null,
      distanceM: w.distanceM != null ? Number(w.distanceM) : null,
      distanceLabel: formatDistanceMi(w.distanceM)
    };
  }

  return {
    exerciseKey,
    isEarlierLog,
    planDayLabel,
    prettySource,
    prettyActivityType,
    formatDistanceMi,
    priorBestE1rmMap,
    summarizeLoggedWorkout,
    summarizeSportSession,
    summarizeHealthWorkout
  };
});
