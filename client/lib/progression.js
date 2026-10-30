/**
 * Workout math shared by the server (require) and the browser (window.Progression).
 * Weights are always in lbs here; callers convert for display.
 *
 * Set types: 'working' (default, also for legacy sets with no type),
 * 'warmup' (excluded from volume / PRs / e1RM / progression),
 * 'failure' (counts as a working set, flagged).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Progression = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SET_TYPES = ['working', 'warmup', 'failure'];
  const LB_PER_KG = 2.20462;

  // Rep ranges by training focus (from the original suggest-load logic).
  const FOCUS_RANGES = {
    strength: { low: 3, high: 6, bump: true },
    power: { low: 2, high: 5, bump: true },
    hypertrophy: { low: 8, high: 12, bump: true },
    conditioning: { low: 12, high: 20, bump: false },
    endurance: { low: 15, high: 20, bump: false }
  };

  const LOWER_PATTERNS = ['squat', 'hinge', 'lunge', 'plyometric'];
  const LOWER_MUSCLES = ['quads', 'glutes', 'hamstrings', 'legs', 'calves', 'adductors'];

  function setType(s) {
    return s && SET_TYPES.includes(s.type) ? s.type : 'working';
  }
  function nextSetType(t) {
    const order = ['working', 'warmup', 'failure'];
    return order[(order.indexOf(t) + 1) % order.length] || 'working';
  }
  function isWorking(s) {
    return setType(s) !== 'warmup';
  }
  function workingSets(sets) {
    return (sets || []).filter(isWorking);
  }

  /** Display labels: working/failure sets are numbered 1..n, warm-ups show W, failure shows F. */
  function setLabels(sets) {
    let n = 0;
    return (sets || []).map((s) => {
      const t = setType(s);
      if (t === 'warmup') return { type: t, label: 'W', number: null };
      n += 1;
      return { type: t, label: t === 'failure' ? 'F' : String(n), number: n };
    });
  }

  /** Epley: w × (1 + reps/30). One rep = the weight itself. */
  function e1rm(weight, reps) {
    const w = Number(weight);
    const r = Number(reps);
    if (!(w > 0) || !(r >= 1)) return 0;
    if (r === 1) return w;
    return w * (1 + r / 30);
  }

  function bestE1rm(sets) {
    let best = 0;
    let bestSet = null;
    workingSets(sets).forEach((s) => {
      const v = e1rm(s.weight, s.reps);
      if (v > best) { best = v; bestSet = s; }
    });
    return { value: best, set: bestSet };
  }

  function volume(sets) {
    return workingSets(sets).reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
  }

  function isLowerBody(ex) {
    if (!ex) return false;
    if (LOWER_PATTERNS.includes(ex.pattern)) return true;
    const muscles = (ex.primaryMuscles || []).map((m) => String(m).toLowerCase());
    if (muscles.length) return muscles.some((m) => LOWER_MUSCLES.includes(m)) &&
      !muscles.some((m) => ['chest', 'back', 'lats', 'shoulders', 'triceps', 'biceps'].includes(m));
    return /squat|deadlift|lunge|leg|calf|hip thrust|step-up|rdl|glute/i.test(ex.name || ex.exerciseName || '');
  }

  function rangeFor({ focus, repMin, repMax } = {}) {
    const base = FOCUS_RANGES[focus] || FOCUS_RANGES.hypertrophy;
    const low = Number(repMin) > 0 ? Number(repMin) : base.low;
    const high = Number(repMax) >= low ? Number(repMax) : Math.max(low, base.high);
    return { low, high, bump: base.bump, focus: FOCUS_RANGES[focus] ? focus : 'hypertrophy' };
  }

  /** Plate-friendly rounding: 5 lb, or 2.5 kg for metric users (converted back to lbs). */
  function roundLoad(lbs, unit) {
    if (unit === 'kg') return (Math.round(lbs / LB_PER_KG / 2.5) * 2.5) * LB_PER_KG;
    return Math.round(lbs / 5) * 5;
  }
  function displayLoad(lbs, unit) {
    if (unit === 'kg') return Math.round((lbs / LB_PER_KG) * 2) / 2;
    return Math.round(lbs * 10) / 10;
  }

  /**
   * Double progression on the previous session's working sets.
   * Returns { action, deltaLbs, factor, weight, reps, reason } where weight/reps describe the top set.
   *  - all working sets at the top of the range  -> add weight (+5 upper / +10 lower; 2.5 / 5 kg)
   *  - more than 20% under the bottom of range   -> deload 5–10%
   *  - 2+ sets short of the bottom of the range  -> keep weight and reps
   *  - otherwise                                 -> keep weight, add a rep
   */
  function suggestNext(sets, opts = {}) {
    const unit = opts.unit === 'kg' ? 'kg' : 'lbs';
    const range = rangeFor(opts);
    const work = workingSets(sets).filter((s) => Number(s.reps) > 0);
    const u = unit === 'kg' ? 'kg' : 'lb';
    const fmt = (lbs) => `${displayLoad(lbs, unit)}`;
    if (!work.length) {
      return {
        action: 'start', deltaLbs: 0, factor: 1, weight: null, reps: range.low, range,
        reason: `No working sets yet. Start with ${range.low}–${range.high} reps (${range.focus}).`
      };
    }
    const top = work.reduce((a, s) => ((Number(s.weight) || 0) > (Number(a.weight) || 0) ? s : a), work[0]);
    const topW = Number(top.weight) || 0;
    const reps = work.map((s) => Number(s.reps) || 0);
    const target = range.low * work.length;
    const total = reps.reduce((a, b) => a + b, 0);
    const shortfall = target > 0 ? (target - total) / target : 0;
    const missed = reps.filter((r) => r < range.low).length;
    const allTop = reps.every((r) => r >= range.high);
    const lower = opts.isLower != null ? !!opts.isLower : isLowerBody(opts.exercise);

    if (shortfall > 0.2) {
      const factor = shortfall > 0.35 ? 0.9 : 0.95;
      const w = topW ? roundLoad(topW * factor, unit) : 0;
      const pct = Math.round((1 - factor) * 100);
      return {
        action: 'deload', deltaLbs: w - topW, factor, weight: w, reps: range.low, range,
        reason: `Reps came in ${Math.round(shortfall * 100)}% under target last time, so drop about ${pct}% to ${fmt(w)} ${u} and rebuild.`
      };
    }
    if (allTop && range.bump && topW > 0) {
      const step = unit === 'kg' ? (lower ? 5 : 2.5) * LB_PER_KG : (lower ? 10 : 5);
      const w = roundLoad(topW + step, unit);
      return {
        action: 'increase', deltaLbs: w - topW, factor: 1, weight: w, reps: range.low, range,
        reason: `You hit ${range.high} reps on every set last time, so try ${fmt(w)} ${u}.`
      };
    }
    if (allTop) {
      return {
        action: 'reps', deltaLbs: 0, factor: 1, weight: topW, reps: Math.max(...reps) + 1, range,
        reason: `Top of the ${range.low}–${range.high} range on every set; add a rep (${range.focus} stays rep-driven).`
      };
    }
    if (missed >= 2) {
      return {
        action: 'hold', deltaLbs: 0, factor: 1, weight: topW, reps: range.low, range,
        reason: `${missed} sets fell short of ${range.low} reps, so stay at ${fmt(topW)} ${u} and own the range.`
      };
    }
    const nextReps = Math.min(range.high, Math.max(...reps.filter((r, i) => (Number(work[i].weight) || 0) === topW)) + 1);
    return {
      action: 'reps', deltaLbs: 0, factor: 1, weight: topW, reps: nextReps, range,
      reason: `Keep ${fmt(topW)} ${u} and aim for ${nextReps} reps; at ${range.high} on every set the weight goes up.`
    };
  }

  /** Copy last session's sets forward and apply the suggestion to the working sets only. */
  function prefillFromLast(lastSets, suggestion, unit) {
    const s = suggestion || { action: 'hold', deltaLbs: 0, factor: 1 };
    return (lastSets || []).map((src) => {
      const t = setType(src);
      let weight = Number(src.weight) || 0;
      let reps = Number(src.reps) || 0;
      if (t !== 'warmup') {
        if (s.action === 'increase') { weight = roundLoad(weight + s.deltaLbs, unit); reps = s.range ? s.range.low : reps; }
        else if (s.action === 'deload') { weight = roundLoad(weight * s.factor, unit); }
        else if (s.action === 'reps' && s.range && reps < s.range.high) { reps += 1; }
      }
      return { type: t, weight, reps, logged: false };
    });
  }

  function formatSets(sets, unit, max = 4) {
    const list = (sets || []).map((s) => {
      const w = displayLoad(Number(s.weight) || 0, unit);
      const tag = setType(s) === 'warmup' ? 'W ' : setType(s) === 'failure' ? 'F ' : '';
      return `${tag}${w}×${Number(s.reps) || 0}`;
    });
    return list.length > max ? list.slice(0, max).join(', ') + '…' : list.join(', ');
  }

  /** Estimated session length in minutes: work time + rest between sets + changeover per exercise. */
  function estimateMinutes(exercises) {
    let sec = 0;
    (exercises || []).forEach((e) => {
      const sets = Number(e.sets) || Number(e.targetSets) || 3;
      const reps = Number(e.reps) || Number(e.targetReps) || 8;
      const rest = Number(e.restSec) || 90;
      sec += sets * reps * 4 + Math.max(0, sets - 1) * rest + 90;
    });
    return Math.max(5, Math.round(sec / 60 / 5) * 5);
  }

  return {
    SET_TYPES, FOCUS_RANGES, LB_PER_KG,
    setType, nextSetType, isWorking, workingSets, setLabels,
    e1rm, bestE1rm, volume, isLowerBody, rangeFor, roundLoad, displayLoad,
    suggestNext, prefillFromLast, formatSets, estimateMinutes
  };
});
