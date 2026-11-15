/**
 * Optional micronutrient fields, FDA Daily Values, and day-total helpers.
 *
 * Daily Values are the official FDA labeling DVs (not personalized DRIs/RDAs).
 * Source: https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels
 * FDA page “Content current as of: 03/05/2024”. Retrieved 2026-11-15.
 *
 * Missing values must stay null/undefined (unknown). Never treat “not listed”
 * as zero. A value of 0 is reserved for an official measured zero.
 */

/** Per-serving fields stored on Food (and snapshotted on FoodLog). Units in comments. */
const MICRO_FIELDS = [
  { key: 'fiber', label: 'Dietary fiber', unit: 'g', dv: 28, dvRole: 'get_enough' },
  { key: 'sugar', label: 'Total sugars', unit: 'g', dv: null, dvRole: 'no_dv', note: 'FDA Daily Value is for added sugars (50 g), not total sugars. The catalog stores total sugars only.' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: 2300, dvRole: 'limit' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', dv: 4700, dvRole: 'get_enough' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', dv: 1300, dvRole: 'get_enough' },
  { key: 'iron', label: 'Iron', unit: 'mg', dv: 18, dvRole: 'get_enough' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', dv: 420, dvRole: 'get_enough' },
  { key: 'vitaminA', label: 'Vitamin A', unit: 'mcg RAE', dv: 900, dvRole: 'get_enough' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', dv: 90, dvRole: 'get_enough' },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg', dv: 20, dvRole: 'get_enough' },
  { key: 'vitaminB12', label: 'Vitamin B-12', unit: 'mcg', dv: 2.4, dvRole: 'get_enough' },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', dv: 20, dvRole: 'limit' },
  { key: 'transFat', label: 'Trans fat', unit: 'g', dv: null, dvRole: 'limit', note: 'No FDA Daily Value; keep intake as low as possible.' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dv: 300, dvRole: 'limit' },
  { key: 'monounsaturatedFat', label: 'Monounsaturated fat', unit: 'g', dv: null, dvRole: 'no_dv' },
  { key: 'polyunsaturatedFat', label: 'Polyunsaturated fat', unit: 'g', dv: null, dvRole: 'no_dv' },
  { key: 'omega3', label: 'Omega-3 (ALA+EPA+DHA+DPA)', unit: 'g', dv: null, dvRole: 'no_dv', note: 'Sum of official USDA FDC n-3 components only. Missing components are omitted, not treated as zero.' },
  { key: 'ala', label: 'ALA (omega-3)', unit: 'g', dv: null, dvRole: 'ai', note: 'Adequate Intake is 1.6 g/day for men and 1.1 g/day for women (NIH Office of Dietary Supplements). Not an FDA Daily Value.' },
  { key: 'epa', label: 'EPA', unit: 'g', dv: null, dvRole: 'no_dv', note: 'No FDA Daily Value. Shown in grams from official FDC values only.' },
  { key: 'dha', label: 'DHA', unit: 'g', dv: null, dvRole: 'no_dv', note: 'No FDA Daily Value. Shown in grams from official FDC values only.' },
  { key: 'omega6', label: 'Omega-6', unit: 'g', dv: null, dvRole: 'no_dv', note: 'Sum of official USDA FDC n-6 fatty acids only (e.g. linoleic, arachidonic). Missing components are omitted, not treated as zero.' }
];

/** NIH ODS Adequate Intake for ALA (not an FDA DV). Retrieved 2026-11-15. */
const ALA_AI_G = { men: 1.6, women: 1.1, url: 'https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/' };


const MICRO_KEYS = MICRO_FIELDS.map((f) => f.key);

function hasValue(v) {
  return v != null && v !== '' && Number.isFinite(Number(v));
}

function scaleMicros(src, qty) {
  const out = {};
  const n = Number(qty);
  if (!Number.isFinite(n)) return out;
  for (const key of MICRO_KEYS) {
    if (!hasValue(src && src[key])) continue;
    out[key] = +((Number(src[key]) * n).toFixed(3));
  }
  return out;
}

function pickMicros(src) {
  const out = {};
  for (const key of MICRO_KEYS) {
    if (hasValue(src && src[key])) out[key] = Number(src[key]);
  }
  return out;
}

/**
 * Sum micronutrients across logs. Unknown values are skipped, not treated as 0.
 * coverage[key] = how many log items contributed a number (including official zeros).
 */
function totalMicros(logs) {
  const totals = {};
  const coverage = {};
  for (const key of MICRO_KEYS) {
    totals[key] = null;
    coverage[key] = 0;
  }
  for (const log of logs || []) {
    for (const key of MICRO_KEYS) {
      if (!hasValue(log[key])) continue;
      totals[key] = (totals[key] == null ? 0 : totals[key]) + Number(log[key]);
      coverage[key] += 1;
    }
  }
  for (const key of MICRO_KEYS) {
    if (totals[key] != null) totals[key] = +totals[key].toFixed(3);
  }
  return { totals, coverage, items: (logs || []).length };
}

function percentDv(key, amount) {
  const field = MICRO_FIELDS.find((f) => f.key === key);
  if (!field || field.dv == null || !hasValue(amount)) return null;
  return +((Number(amount) / field.dv) * 100).toFixed(1);
}

function viewModel(logs) {
  const { totals, coverage, items } = totalMicros(logs);
  return {
    source: {
      name: 'FDA Daily Value (Nutrition Facts label)',
      url: 'https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels',
      fdaCurrentAsOf: '2024-03-05',
      retrieved: '2026-11-15',
      note: 'Daily Values are labeling reference amounts for a general 2,000-calorie diet, not personalized Recommended Dietary Allowances.'
    },
    items,
    nutrients: MICRO_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      unit: f.unit,
      dv: f.dv,
      dvRole: f.dvRole,
      note: f.note || '',
      amount: totals[f.key],
      coverage: coverage[f.key],
      percentDv: percentDv(f.key, totals[f.key]),
      unknown: coverage[f.key] === 0
    }))
  };
}

module.exports = {
  MICRO_FIELDS,
  MICRO_KEYS,
  ALA_AI_G,
  hasValue,
  scaleMicros,
  pickMicros,
  totalMicros,
  percentDv,
  viewModel
};
