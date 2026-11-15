const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const pizza = require('../../data/foods/pizza');
const { allFoods, lists } = require('../../data/foods');
const { queryTokens, tokenFilter, rankFood } = require('../services/foodCatalog');

const src = fs.readFileSync(path.join(__dirname, '../../data/foods/pizza.js'), 'utf8');

test('pizza data file cites official source URLs and the retrieval date', () => {
  assert.match(src, /Retrieved: 2026-11-15/);
  assert.match(src, /https:\/\/www\.dominos\.com\/cms\/assets\/8187ef50-6b63-484e-b0ac-47cafe610fde/);
  assert.match(src, /https:\/\/littlecaesars\.com\/static\/usnutritionguide\.pdf/);
  assert.match(src, /https:\/\/sbarro\.com\/wp-content\/uploads\/2022\/10\/Sbarro-Nutrition-and-Allergen-Info-10\.12\.22\.pdf/);
  assert.match(src, /Skipped/);
  assert.match(src, /Papa John's/);
  assert.match(src, /Pizza Hut/);
  assert.match(src, /Marco's Pizza/);
  assert.match(src, /Blaze Pizza/);
  assert.match(src, /MOD Pizza/);
  assert.match(src, /Jet's Pizza/);
});

test('official pizza items are complete, unique, and registered in the food catalog', () => {
  assert.ok(pizza.length >= 100, pizza.length);
  assert.strictEqual(lists.pizza, pizza);
  const byBrand = {};
  const keys = new Set();
  for (const f of pizza) {
    assert.ok(f.name && f.brand, JSON.stringify(f));
    assert.equal(typeof f.calories, 'number');
    assert.ok(f.calories >= 0);
    for (const k of ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium']) {
      assert.equal(typeof f[k], 'number', `${f.name} ${k}`);
    }
    assert.equal(f.servingSize, 1);
    const key = `${f.name.trim().toLowerCase()}|${(f.brand || '').trim().toLowerCase()}`;
    assert.equal(keys.has(key), false, `duplicate ${key}`);
    keys.add(key);
    byBrand[f.brand] = (byBrand[f.brand] || 0) + 1;
  }
  assert.equal(byBrand["Domino's"], 44);
  assert.equal(byBrand['Little Caesars'], 28);
  assert.equal(byBrand['Sbarro'], 41);
  const existing = allFoods.filter((f) => pizza.includes(f));
  assert.equal(existing.length, pizza.length);

  const others = allFoods.filter((f) => !pizza.includes(f));
  const otherKeys = new Set(others.map((f) => `${f.name.trim().toLowerCase()}|${(f.brand || '').trim().toLowerCase()}`));
  for (const f of pizza) {
    const key = `${f.name.trim().toLowerCase()}|${(f.brand || '').trim().toLowerCase()}`;
    assert.equal(otherKeys.has(key), false, `collides with existing food ${key}`);
  }
});

test('official values match the cited PDFs for representative items (no invented numbers)', () => {
  const ex = pizza.find((f) => f.name.startsWith('ExtravaganZZa, Large 14"'));
  assert.ok(ex);
  assert.equal(ex.calories, 380);
  assert.equal(ex.fat, 19);
  assert.equal(ex.protein, 16);
  assert.equal(ex.carbs, 36);
  assert.equal(ex.sodium, 900);
  assert.equal(ex.gramsPerServing, 153);
  assert.match(ex.servingUnit, /1\/8/);

  const classic = pizza.find((f) => f.name === 'Large Classic Cheese Pizza (whole)');
  assert.ok(classic);
  assert.equal(classic.calories, 1950);
  assert.equal(classic.protein, 95);
  assert.equal(classic.carbs, 248);
  assert.equal(classic.fat, 65);
  assert.equal(classic.sodium, 3740);
  assert.match(classic.servingUnit, /whole/);

  const sbarro = pizza.find((f) => f.name.startsWith('SBARRO 17in NY Cheese Pizza'));
  assert.ok(sbarro);
  assert.equal(sbarro.calories, 2750);
  assert.equal(sbarro.protein, 135);
  assert.equal(sbarro.fat, 96);
  assert.equal(sbarro.gramsPerServing, 1237);
});

test('pizza items are searchable by chain and by the word pizza', () => {
  const q = 'dominos pizza';
  const tokens = queryTokens(q);
  assert.ok(tokens.includes('domino') || tokens.includes('dominos') || tokens.some((t) => t.startsWith('domino')));
  const matches = pizza.filter((f) => {
    const filters = tokenFilter(tokens);
    return filters.every((clause) =>
      clause.$or.some(({ name, brand }) => {
        const rx = new RegExp(name ? name.$regex : brand.$regex, 'i');
        return rx.test(f.name) || rx.test(f.brand);
      })
    );
  });
  assert.ok(matches.length >= 10, `expected Domino's pizza search hits, got ${matches.length}`);
  const ranked = matches.slice().sort((a, b) => rankFood(a, q, tokens) - rankFood(b, q, tokens));
  assert.ok(ranked[0].brand === "Domino's");
});
