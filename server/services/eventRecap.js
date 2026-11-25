// Post-event recap: result, lead-in training / food / weight / readiness, last similar event.
const { shiftKey } = require('./dates');
const E = require('./events');

function workoutVolume(workout) {
  let sets = 0;
  let volume = 0;
  (workout && workout.exercises || []).forEach((ex) => {
    (ex.sets || []).forEach((s) => {
      if (s && s.type === 'warmup') return;
      sets++;
      const reps = Number(s && s.reps) || 0;
      const w = Number(s && s.weight) || 0;
      if (reps > 0 && w > 0) volume += reps * w;
    });
  });
  return { sets, volumeLbs: Math.round(volume) };
}

function summarizeLeadIn({ from, to, workouts, sports, weights, foodByDate, readiness }) {
  let workoutCount = 0;
  let durationMin = 0;
  let volumeLbs = 0;
  (workouts || []).forEach((w) => {
    if (!w || w.date < from || w.date > to) return;
    workoutCount++;
    if (w.durationMin > 0) durationMin += w.durationMin;
    const v = workoutVolume(w);
    volumeLbs += v.volumeLbs;
  });
  let practiceCount = 0;
  let trainingLoad = 0;
  (sports || []).forEach((s) => {
    if (!s || s.date < from || s.date > to) return;
    practiceCount++;
    if (s.trainingLoad > 0) trainingLoad += s.trainingLoad;
  });
  const inRange = (weights || []).filter((w) => w && w.date >= from && w.date <= to).sort((a, b) => a.date < b.date ? -1 : 1);
  const start = inRange[0];
  const end = inRange[inRange.length - 1];
  let foodDays = 0;
  let calorieSum = 0;
  Object.keys(foodByDate || {}).forEach((d) => {
    if (d < from || d > to) return;
    const kcal = Number(foodByDate[d]);
    if (kcal > 0) { foodDays++; calorieSum += kcal; }
  });
  const checks = (readiness || []).filter((r) => r && r.date >= from && r.date <= to)
    .sort((a, b) => a.date < b.date ? -1 : 1)
    .map((r) => ({ date: r.date, sleep: r.sleep, soreness: r.soreness, mood: r.mood, energy: r.energy }));
  return {
    from,
    to,
    workouts: workoutCount,
    durationMin: durationMin ? Math.round(durationMin * 10) / 10 : 0,
    volumeLbs,
    practiceSessions: practiceCount,
    trainingLoad: trainingLoad ? Math.round(trainingLoad * 10) / 10 : 0,
    weightStartLbs: start ? start.weight : null,
    weightEndLbs: end ? end.weight : null,
    weightChangeLbs: start && end ? Math.round((end.weight - start.weight) * 10) / 10 : null,
    weighIns: inRange.length,
    foodDays,
    avgCalories: foodDays ? Math.round(calorieSum / foodDays) : null,
    readiness: checks
  };
}

function buildRecap({ event, others, workouts, sports, weights, foodByDate, readiness, today }) {
  if (!event) return { error: 'Event not found' };
  const from = shiftKey(event.date, -7);
  const to = event.date;
  const previous = E.findSimilar(event, others);
  const leadIn = summarizeLeadIn({ from, to, workouts, sports, weights, foodByDate, readiness });
  let comparison = null;
  if (previous) {
    comparison = {
      event: {
        id: previous.id || (previous._id && String(previous._id)) || '',
        name: previous.name,
        sport: previous.sport,
        type: previous.type,
        date: previous.date,
        hasResult: E.hasResult(previous.result),
        result: previous.result || null
      },
      ...E.compareResults(event, previous)
    };
  }
  return {
    eventDate: event.date,
    isPastOrToday: !today || event.date <= today,
    leadIn,
    previous: comparison,
    result: event.result || null,
    hasResult: E.hasResult(event.result)
  };
}

module.exports = { workoutVolume, summarizeLeadIn, buildRecap };
