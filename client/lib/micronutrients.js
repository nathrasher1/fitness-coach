(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Micros = factory();
})(typeof self !== 'undefined' ? self : this, function () {
/**
 * Optional micronutrient fields, FDA Daily Values, and day-total helpers.
 *
 * Daily Values are the official FDA labeling DVs (not personalized DRIs/RDAs).
 * Source: https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels
 * FDA page “Content current as of: 03/05/2024”. Retrieved 2026-11-25 (values unchanged).
 *
 * Missing values must stay null/undefined (unknown). Never treat “not listed”
 * as zero. A value of 0 is reserved for an official measured zero.
 */

/** Per-serving fields stored on Food (and snapshotted on FoodLog). Units in comments. */
const MICRO_FIELDS = [
  { key: 'fiber', label: 'Dietary fiber', unit: 'g', dv: 28, dvRole: 'get_enough', group: 'general' },
  { key: 'sugar', label: 'Total sugars', unit: 'g', dv: null, dvRole: 'no_dv', group: 'general', note: 'FDA Daily Value is for added sugars (50 g), not total sugars. The catalog stores total sugars only.' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: 2300, dvRole: 'limit', group: 'electrolyte' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', dv: 4700, dvRole: 'get_enough', group: 'electrolyte' },
  { key: 'chloride', label: 'Chloride', unit: 'mg', dv: 2300, dvRole: 'get_enough', group: 'electrolyte', note: 'Rarely reported in USDA FDC food records. Missing stays blank, not zero.' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', dv: 420, dvRole: 'get_enough', group: 'electrolyte' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', dv: 1300, dvRole: 'get_enough', group: 'electrolyte' },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', dv: 1250, dvRole: 'get_enough', group: 'electrolyte' },
  { key: 'iron', label: 'Iron', unit: 'mg', dv: 18, dvRole: 'get_enough', group: 'mineral' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', dv: 11, dvRole: 'get_enough', group: 'mineral' },
  { key: 'copper', label: 'Copper', unit: 'mg', dv: 0.9, dvRole: 'get_enough', group: 'mineral' },
  { key: 'manganese', label: 'Manganese', unit: 'mg', dv: 2.3, dvRole: 'get_enough', group: 'mineral' },
  { key: 'selenium', label: 'Selenium', unit: 'mcg', dv: 55, dvRole: 'get_enough', group: 'mineral' },
  { key: 'iodine', label: 'Iodine', unit: 'mcg', dv: 150, dvRole: 'get_enough', group: 'mineral', note: 'Often missing from FDC records. Missing stays blank, not zero.' },
  { key: 'vitaminA', label: 'Vitamin A', unit: 'mcg RAE', dv: 900, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', dv: 90, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg', dv: 20, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'vitaminE', label: 'Vitamin E', unit: 'mg', dv: 15, dvRole: 'get_enough', group: 'vitamin', note: 'FDA Daily Value is 15 mg alpha-tocopherol. Values come from official FDC alpha-tocopherol when present.' },
  { key: 'vitaminK', label: 'Vitamin K', unit: 'mcg', dv: 120, dvRole: 'get_enough', group: 'vitamin', note: 'Shown from official FDC phylloquinone (vitamin K1) only. Other K forms are not added in.' },
  { key: 'thiamin', label: 'Thiamin (B-1)', unit: 'mg', dv: 1.2, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'riboflavin', label: 'Riboflavin (B-2)', unit: 'mg', dv: 1.3, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'niacin', label: 'Niacin (B-3)', unit: 'mg', dv: 16, dvRole: 'get_enough', group: 'vitamin', note: 'FDA Daily Value is 16 mg niacin equivalents (NE). FDC values are niacin (mg) when that is what the record reports.' },
  { key: 'pantothenicAcid', label: 'Pantothenic acid (B-5)', unit: 'mg', dv: 5, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'vitaminB6', label: 'Vitamin B-6', unit: 'mg', dv: 1.7, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'biotin', label: 'Biotin (B-7)', unit: 'mcg', dv: 30, dvRole: 'get_enough', group: 'vitamin', note: 'Rarely reported in USDA FDC food records. Missing stays blank, not zero.' },
  { key: 'folate', label: 'Folate', unit: 'mcg DFE', dv: 400, dvRole: 'get_enough', group: 'vitamin', note: 'FDA Daily Value is 400 mcg DFE. Only official FDC Folate, DFE values are stored.' },
  { key: 'vitaminB12', label: 'Vitamin B-12', unit: 'mcg', dv: 2.4, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'choline', label: 'Choline', unit: 'mg', dv: 550, dvRole: 'get_enough', group: 'vitamin' },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', dv: 20, dvRole: 'limit', group: 'fat' },
  { key: 'transFat', label: 'Trans fat', unit: 'g', dv: null, dvRole: 'limit', group: 'fat', note: 'No FDA Daily Value; keep intake as low as possible.' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dv: 300, dvRole: 'limit', group: 'fat' },
  { key: 'monounsaturatedFat', label: 'Monounsaturated fat', unit: 'g', dv: null, dvRole: 'no_dv', group: 'fat' },
  { key: 'polyunsaturatedFat', label: 'Polyunsaturated fat', unit: 'g', dv: null, dvRole: 'no_dv', group: 'fat' },
  { key: 'omega3', label: 'Omega-3 (ALA+EPA+DHA+DPA)', unit: 'g', dv: null, dvRole: 'no_dv', group: 'fat', note: 'Sum of official USDA FDC n-3 components only. Missing components are omitted, not treated as zero.' },
  { key: 'ala', label: 'ALA (omega-3)', unit: 'g', dv: null, dvRole: 'ai', group: 'fat', note: 'Adequate Intake is 1.6 g/day for men and 1.1 g/day for women (NIH Office of Dietary Supplements). Not an FDA Daily Value.' },
  { key: 'epa', label: 'EPA', unit: 'g', dv: null, dvRole: 'no_dv', group: 'fat', note: 'No FDA Daily Value. Shown in grams from official FDC values only.' },
  { key: 'dha', label: 'DHA', unit: 'g', dv: null, dvRole: 'no_dv', group: 'fat', note: 'No FDA Daily Value. Shown in grams from official FDC values only.' },
  { key: 'omega6', label: 'Omega-6', unit: 'g', dv: null, dvRole: 'no_dv', group: 'fat', note: 'Sum of official USDA FDC n-6 fatty acids only (e.g. linoleic, arachidonic). Missing components are omitted, not treated as zero.' }
];

const MICRO_GROUPS = {
  general: { key: 'general', label: 'General', keys: MICRO_FIELDS.filter((f) => f.group === 'general').map((f) => f.key) },
  electrolyte: { key: 'electrolyte', label: 'Electrolytes', keys: MICRO_FIELDS.filter((f) => f.group === 'electrolyte').map((f) => f.key) },
  vitamin: { key: 'vitamin', label: 'Vitamins', keys: MICRO_FIELDS.filter((f) => f.group === 'vitamin').map((f) => f.key) },
  mineral: { key: 'mineral', label: 'Minerals', keys: MICRO_FIELDS.filter((f) => f.group === 'mineral').map((f) => f.key) },
  fat: { key: 'fat', label: 'Fats & omega-3', keys: MICRO_FIELDS.filter((f) => f.group === 'fat').map((f) => f.key) }
};

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
      retrieved: '2026-11-25',
      note: 'Daily Values are labeling reference amounts for a general 2,000-calorie diet, not personalized Recommended Dietary Allowances.'
    },
    items,
    nutrients: MICRO_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      unit: f.unit,
      dv: f.dv,
      dvRole: f.dvRole,
      group: f.group,
      note: f.note || '',
      amount: totals[f.key],
      coverage: coverage[f.key],
      percentDv: percentDv(f.key, totals[f.key]),
      unknown: coverage[f.key] === 0
    }))
  };
}

  return {
    MICRO_FIELDS,
    MICRO_KEYS,
    MICRO_GROUPS,
    ALA_AI_G,
    hasValue,
    scaleMicros,
    pickMicros,
    totalMicros,
    percentDv,
    viewModel
  };
});
