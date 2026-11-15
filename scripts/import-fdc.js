#!/usr/bin/env node
/**
 * Import one USDA FoodData Central food into the Fitness Coach Food shape.
 *
 * Nutrient amounts in SR Legacy / Foundation records are per 100 g. This script
 * scales them to a serving weight you choose (default 100 g, or an official
 * FDC portion via --portion). It never invents or fills missing nutrients.
 *
 * Usage:
 *   node scripts/import-fdc.js --file data/fdc/fixtures/173944.json --portion "medium"
 *   node scripts/import-fdc.js --fdc-id 173944 --api-key "$USDA_FDC_API_KEY"
 *
 * This script writes JSON to stdout (or --out). It does not connect to MongoDB
 * or production Atlas.
 *
 * USDA FoodData Central data is public domain in the U.S.
 * API: https://api.nal.usda.gov/fdc/v1/food/{fdcId}
 */

const fs = require('fs');
const path = require('path');

// FDC nutrient ids → Food fields. Amounts from FDC are per 100 g for SR Legacy.
const FDC_NUTRIENTS = {
  1008: { key: 'calories', unit: 'kcal' },
  1003: { key: 'protein', unit: 'g' },
  1004: { key: 'fat', unit: 'g' },
  1005: { key: 'carbs', unit: 'g' },
  1079: { key: 'fiber', unit: 'g' },
  2000: { key: 'sugar', unit: 'g' },
  1093: { key: 'sodium', unit: 'mg' },
  1092: { key: 'potassium', unit: 'mg' },
  1087: { key: 'calcium', unit: 'mg' },
  1089: { key: 'iron', unit: 'mg' },
  1090: { key: 'magnesium', unit: 'mg' },
  1106: { key: 'vitaminA', unit: 'mcg RAE' },
  1162: { key: 'vitaminC', unit: 'mg' },
  1114: { key: 'vitaminD', unit: 'mcg' },
  1178: { key: 'vitaminB12', unit: 'mcg' }
};

function parseArgs(argv) {
  const out = { portion: '', servingGrams: null, out: '', file: '', fdcId: '', apiKey: process.env.USDA_FDC_API_KEY || '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--file' && next) { out.file = next; i++; }
    else if (a === '--fdc-id' && next) { out.fdcId = next; i++; }
    else if (a === '--api-key' && next) { out.apiKey = next; i++; }
    else if (a === '--portion' && next) { out.portion = next; i++; }
    else if (a === '--serving-grams' && next) { out.servingGrams = Number(next); i++; }
    else if (a === '--out' && next) { out.out = next; i++; }
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function nutrientAmount(record, id) {
  const row = (record.foodNutrients || []).find((n) => {
    const nid = (n.nutrient && n.nutrient.id) || n.nutrientId;
    return Number(nid) === Number(id);
  });
  if (!row) return null;
  const amount = row.amount != null ? row.amount : row.value;
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return Number(amount);
}

function pickPortion(record, query) {
  const portions = record.foodPortions || [];
  if (!query) return null;
  const q = String(query).toLowerCase();
  return portions.find((p) => String(p.modifier || '').toLowerCase().includes(q)) || null;
}

function scalePer100g(per100, grams) {
  if (per100 == null) return undefined;
  return +((per100 * (Number(grams) / 100)).toFixed(3));
}

function toFood(record, opts = {}) {
  if (!record || !record.fdcId) throw new Error('Not a FoodData Central food record');
  const portion = opts.portionQuery ? pickPortion(record, opts.portionQuery) : null;
  let grams = opts.servingGrams != null ? Number(opts.servingGrams) : null;
  let servingUnit = 'g';
  if (grams == null && portion && portion.gramWeight) {
    grams = Number(portion.gramWeight);
    const amt = portion.amount || 1;
    servingUnit = amt === 1 ? String(portion.modifier || 'serving') : `${amt} ${portion.modifier || 'serving'}`;
  }
  if (grams == null || !Number.isFinite(grams) || grams <= 0) {
    grams = 100;
    servingUnit = 'g';
  }

  const food = {
    name: record.description,
    brand: 'USDA FoodData Central',
    servingSize: 1,
    servingUnit,
    gramsPerServing: grams,
    sourceFdcId: Number(record.fdcId),
    sourceDataType: record.dataType || '',
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${record.fdcId}/nutrients`,
    sourceRetrieved: '2026-11-15',
    sourceBasis: 'per 100 g, scaled to the serving weight above using official FDC amounts only'
  };

  for (const [id, meta] of Object.entries(FDC_NUTRIENTS)) {
    const per100 = nutrientAmount(record, Number(id));
    if (per100 == null) continue; // omit — unknown, never invent
    food[meta.key] = scalePer100g(per100, grams);
  }
  if (food.calories != null) food.calories = Math.round(food.calories);
  return food;
}

async function loadRecord(opts) {
  if (opts.file) {
    return JSON.parse(fs.readFileSync(path.resolve(opts.file), 'utf8'));
  }
  if (opts.fdcId) {
    const key = opts.apiKey || 'DEMO_KEY';
    const url = `https://api.nal.usda.gov/fdc/v1/food/${opts.fdcId}?api_key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FDC API ${res.status} for fdcId ${opts.fdcId}`);
    return res.json();
  }
  throw new Error('Provide --file or --fdc-id');
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('Usage:')[1].split('USDA FoodData')[0]);
    return;
  }
  const record = await loadRecord(opts);
  const food = toFood(record, { portionQuery: opts.portion, servingGrams: opts.servingGrams });
  const json = JSON.stringify(food, null, 2);
  if (opts.out) fs.writeFileSync(opts.out, json + '\n');
  else console.log(json);
}

module.exports = { FDC_NUTRIENTS, toFood, pickPortion, nutrientAmount, scalePer100g };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
