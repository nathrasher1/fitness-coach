const test = require('node:test');
const assert = require('node:assert/strict');
const { seedExercises, exercises, machineExercises } = require('../../data/seed-exercises');
const machines = require('../../data/machine-exercises');
const Exercise = require('../models/Exercise');
const {
  isMachineQuery,
  machineEquipmentList,
  exerciseSearchFilter,
  exerciseSearchLimit,
  allSystemExercises
} = require('../services/exerciseCatalog');

const patternEnum = Exercise.schema.path('pattern').enumValues;
const equipmentEnum = Exercise.schema.path('equipment').caster.enumValues;
const categoryEnum = Exercise.schema.path('category').enumValues;
const difficultyEnum = Exercise.schema.path('difficulty').enumValues;

test('machine catalog has unique names and does not duplicate existing seed exercises', () => {
  assert.strictEqual(machines.length, machineExercises.length);
  assert.ok(machines.length >= 70, `expected a comprehensive catalog, got ${machines.length}`);
  const names = machines.map((m) => m.name.toLowerCase());
  assert.strictEqual(names.length, new Set(names).size);
  const seedNames = new Set(exercises.map((e) => e.name.toLowerCase()));
  const dups = machines.filter((m) => seedNames.has(m.name.toLowerCase()));
  assert.deepEqual(dups.map((d) => d.name), []);
});

test('machine catalog uses the existing Exercise enums and is tagged machine and/or cable', () => {
  for (const m of machines) {
    assert.ok(patternEnum.includes(m.pattern), `${m.name} pattern ${m.pattern}`);
    assert.ok(categoryEnum.includes(m.category), `${m.name} category ${m.category}`);
    assert.ok(Array.isArray(m.equipment) && m.equipment.length, m.name);
    for (const eq of m.equipment) assert.ok(equipmentEnum.includes(eq), `${m.name} equipment ${eq}`);
    assert.ok(m.equipment.includes('machine') || m.equipment.includes('cable'), m.name);
    assert.ok(Array.isArray(m.primaryMuscles) && m.primaryMuscles.length, m.name);
    if (m.difficulty) assert.ok(difficultyEnum.includes(m.difficulty), m.name);
  }
});

test('combined seed list includes the new machines once', () => {
  const all = allSystemExercises();
  const machineNames = new Set(machines.map((m) => m.name.toLowerCase()));
  const inSeed = seedExercises.filter((e) => machineNames.has(e.name.toLowerCase()));
  assert.strictEqual(inSeed.length, machines.length);
  assert.strictEqual(all.length, seedExercises.length);
  assert.strictEqual(new Set(all.map((e) => e.name.toLowerCase())).size, all.length);
});

test('searching or filtering "Machine" matches machine and cable equipment without a name regex', () => {
  assert.equal(isMachineQuery('machine'), true);
  assert.equal(isMachineQuery('Machines'), true);
  assert.equal(isMachineQuery('leg press'), false);
  const filter = exerciseSearchFilter({ q: 'machine', userId: 'u1' });
  assert.deepEqual(filter.equipment, { $in: machineEquipmentList() });
  assert.equal(filter.name, undefined);
  const named = exerciseSearchFilter({ q: 'leg press', equipment: 'machine,cable', userId: 'u1' });
  assert.equal(named.name.$regex.toLowerCase ? named.name.$regex : named.name.$regex, 'leg press');
  assert.deepEqual(named.equipment, { $in: ['machine', 'cable'] });
  assert.equal(exerciseSearchLimit({ q: 'machine' }), 200);
  assert.equal(exerciseSearchLimit({ equipment: 'machine,cable' }), 200);
  assert.equal(exerciseSearchLimit({ q: 'bench' }), 80);
  assert.equal(exerciseSearchLimit({ q: 'machine', limit: 50 }), 50);
});
