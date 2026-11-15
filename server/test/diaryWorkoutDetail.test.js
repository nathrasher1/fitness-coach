const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const D = require('../../client/lib/diarySession');

const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');

const prior = {
  _id: 'aaaa1111aaaa1111aaaa1111',
  date: '2026-11-10',
  createdAt: '2026-11-10T22:00:00.000Z',
  name: 'Upper A',
  exercises: [{
    exercise: 'ex-bench',
    exerciseName: 'Bench Press',
    sets: [
      { type: 'warmup', weight: 95, reps: 8 },
      { type: 'working', weight: 165, reps: 8 },
      { type: 'working', weight: 165, reps: 8 }
    ]
  }]
};

const current = {
  _id: 'bbbb2222bbbb2222bbbb2222',
  date: '2026-11-14',
  createdAt: '2026-11-14T23:12:00.000Z',
  name: 'Upper A',
  planDay: 'upper_lower:Day A',
  notes: 'Felt strong on bench.',
  durationMin: 62,
  exercises: [{
    exercise: 'ex-bench',
    exerciseName: 'Bench Press',
    equipment: 'barbell',
    restSec: 120,
    sets: [
      { type: 'warmup', weight: 95, reps: 8 },
      { type: 'working', weight: 185, reps: 8 },
      { type: 'working', weight: 185, reps: 7 },
      { type: 'failure', weight: 185, reps: 5, note: 'spotter helped' }
    ]
  }, {
    exerciseName: 'Cable Row',
    sets: [
      { type: 'working', weight: 120, reps: 10 },
      { type: 'working', weight: 120, reps: 10 }
    ]
  }]
};

test('Diary opens a detail sheet when a logged workout, sport, or imported workout is tapped', () => {
  assert.match(html, /id="diary-wo-sheet"/);
  assert.match(html, /lib\/diarySession\.js/);
  assert.match(app, /data-open-workout=/);
  assert.match(app, /data-open-sport=/);
  assert.match(app, /data-open-health=/);
  assert.match(app, /function renderDiaryLoggedSheet/);
  assert.match(app, /function renderDiarySportSheet/);
  assert.match(app, /function renderDiaryHealthSheet/);
  assert.match(app, /api\(`\/sport-sessions\?from=\$\{date\}&to=\$\{date\}`\)/);
  assert.match(app, /api\('\/health\/workouts\?limit=100'\)/);
  assert.match(app, /data-delete-workout=/);
  assert.match(app, /Delete this workout\?/);
});

test('logged workout summary uses stored sets, volume, best set, notes, and duration', () => {
  const sum = D.summarizeLoggedWorkout(current, [prior, current]);
  assert.equal(sum.name, 'Upper A');
  assert.equal(sum.routine, 'Day A');
  assert.equal(sum.durationMin, 62);
  assert.equal(sum.notes, 'Felt strong on bench.');
  assert.equal(sum.totalSets, 6);
  assert.equal(sum.totalReps, 8 + 8 + 7 + 5 + 10 + 10);
  // Volume excludes warmup: 185*8 + 185*7 + 185*5 + 120*10 + 120*10
  assert.equal(sum.totalVolume, 185 * 8 + 185 * 7 + 185 * 5 + 120 * 10 + 120 * 10);
  const bench = sum.exercises[0];
  assert.equal(bench.sets.length, 4);
  assert.equal(bench.sets[0].type, 'warmup');
  assert.equal(bench.sets[0].label, 'W');
  assert.equal(bench.sets[0].completed, true);
  assert.equal(bench.sets[0].pr, false);
  assert.equal(bench.sets[1].label, '1');
  assert.equal(bench.sets[3].type, 'failure');
  assert.equal(bench.sets[3].note, 'spotter helped');
  assert.equal(bench.bestSet.weight, 185);
  assert.equal(bench.bestSet.reps, 8);
  assert.ok(bench.hasPR);
  assert.equal(sum.prs.length, 1);
  assert.equal(sum.prs[0].name, 'Bench Press');
  const row = sum.exercises[1];
  assert.equal(row.hasPR, false);
});

test('PR markers are not invented when there is no earlier best', () => {
  const first = D.summarizeLoggedWorkout(current, [current]);
  assert.equal(first.prs.length, 0);
  assert.ok(first.exercises.every((ex) => ex.sets.every((s) => s.pr === false)));

  const laterSameButNotHeavier = {
    ...current,
    _id: 'cccc3333cccc3333cccc3333',
    date: '2026-11-15',
    exercises: [{
      exercise: 'ex-bench',
      exerciseName: 'Bench Press',
      sets: [{ type: 'working', weight: 165, reps: 8 }]
    }]
  };
  const noBeat = D.summarizeLoggedWorkout(laterSameButNotHeavier, [prior, laterSameButNotHeavier]);
  assert.equal(noBeat.prs.length, 0);
});

test('plan day labels hide raw routine ids; duration stays blank when not stored', () => {
  assert.equal(D.planDayLabel('upper_lower:Day A'), 'Day A');
  assert.equal(D.planDayLabel('routine:64f0ab12cd34ef567890abcd'), '');
  const noDur = D.summarizeLoggedWorkout({ ...current, durationMin: undefined, notes: '' }, []);
  assert.equal(noDur.durationMin, null);
  assert.equal(noDur.notes, '');
});

test('sport and imported health summaries only surface stored fields', () => {
  const sport = D.summarizeSportSession({
    id: 's1', sport: 'Soccer', date: '2026-11-14', durationMin: 75, effort: 7,
    trainingLoad: 525, activeKcal: 480, notes: 'Scrimmage', drills: 'Passing'
  });
  assert.equal(sport.kind, 'sport');
  assert.equal(sport.name, 'Soccer');
  assert.equal(sport.durationMin, 75);
  assert.equal(sport.effort, 7);
  assert.equal(sport.drills, 'Passing');

  const health = D.summarizeHealthWorkout({
    _id: 'h1', name: 'Outdoor run', date: '2026-11-14', start: '2026-11-14T12:00:00.000Z',
    type: 'running', app: 'Strava', source: 'health_connect', durationMin: 32,
    activeKcal: 310, distanceM: 5210
  });
  assert.equal(health.kind, 'health');
  assert.equal(health.source, 'Health Connect');
  assert.equal(health.type, 'Running');
  assert.equal(health.distanceLabel, '3.2 mi');
  assert.equal(health.durationMin, 32);

  const sparse = D.summarizeHealthWorkout({ date: '2026-11-14', type: 'other' });
  assert.equal(sparse.durationMin, null);
  assert.equal(sparse.distanceLabel, '');
  assert.equal(sparse.app, '');
});
