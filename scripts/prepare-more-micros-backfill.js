#!/usr/bin/env node
/**
 * Prepare a micronutrient/electrolyte backfill from official USDA FDC sources.
 * Writes match and update files only. Does not connect to MongoDB or Atlas.
 *
 * Usage:
 *   node scripts/prepare-more-micros-backfill.js \
 *     --backup /workspace/fitness-coach-backups/foods-pre-fat-micros-20261115-1109EST.json \
 *     --sr /tmp/fdc-dl/sr_legacy/FoodData_Central_sr_legacy_food_json_2018-04.json \
 *     --fndds /tmp/fdc-dl/fndds/surveyDownload.json \
 *     --foundation-dir /tmp/fdc-dl/foundation/FoodData_Central_foundation_food_csv_2026-04-30 \
 *     --prior-matches /workspace/fitness-coach-backups/micros-backfill-matches.json \
 *     --out /workspace/fitness-coach-backups
 */
const fs = require('fs');
const path = require('path');
const { toFood, FDC_NUTRIENTS } = require('./import-fdc');

const NEW_KEYS = [
  'chloride', 'phosphorus', 'zinc', 'copper', 'manganese', 'selenium', 'iodine',
  'vitaminE', 'vitaminK', 'thiamin', 'riboflavin', 'niacin', 'pantothenicAcid',
  'vitaminB6', 'biotin', 'folate', 'choline'
];

const GENERIC_LISTS = new Set([
  'base', 'fruits', 'vegetables', 'grains', 'proteins', 'dairy', 'nuts',
  'condiments', 'world', 'breakfast', 'drinks', 'snacks'
]);

function parseArgs(argv) {
  const out = {
    backup: '',
    sr: '',
    fndds: '',
    foundationDir: '',
    priorMatches: '',
    out: '/workspace/fitness-coach-backups'
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], n = argv[i + 1];
    if (a === '--backup' && n) { out.backup = n; i++; }
    else if (a === '--sr' && n) { out.sr = n; i++; }
    else if (a === '--fndds' && n) { out.fndds = n; i++; }
    else if (a === '--foundation-dir' && n) { out.foundationDir = n; i++; }
    else if (a === '--prior-matches' && n) { out.priorMatches = n; i++; }
    else if (a === '--out' && n) { out.out = n; i++; }
    else throw new Error('Unknown argument: ' + a);
  }
  return out;
}

function oid(doc) {
  if (!doc || !doc._id) return '';
  if (typeof doc._id === 'string') return doc._id;
  if (doc._id.$oid) return doc._id.$oid;
  return String(doc._id);
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[()[\],;/+\-]/g, ' ')
    .replace(/\b(?:includes foods for usda's food distribution program|nlea|nrd|ns|nfs)\b/g, ' ')
    .replace(/[^a-z0-9% ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  const stop = new Set(['and', 'or', 'with', 'of', 'in', 'a', 'the', 'for', 'to', 'from']);
  return norm(s).split(' ').filter((t) => t && t.length > 1 && !stop.has(t));
}

function parseGramsFromName(name) {
  const m = String(name || '').match(/\((\d+(?:\.\d+)?)\s*g\)/i);
  return m ? Number(m[1]) : null;
}

function catalogGrams(food) {
  if (Number(food.gramsPerServing) > 0) return { grams: Number(food.gramsPerServing), reason: 'gramsPerServing' };
  const named = parseGramsFromName(food.name);
  if (named) return { grams: named, reason: 'name_parenthetical_g' };
  const unit = String(food.servingUnit || '').toLowerCase();
  const size = Number(food.servingSize);
  if ((unit === 'g' || unit === 'gram' || unit === 'grams') && size > 0) {
    return { grams: size, reason: 'servingUnit_g' };
  }
  return { grams: null, reason: 'no_grams' };
}

function hasValue(v) {
  return v != null && v !== '' && Number.isFinite(Number(v));
}

function macroClose(catalog, imported) {
  if (!imported || imported.calories == null) return false;
  const calTol = Math.max(12, 0.12 * Math.max(1, Number(catalog.calories) || 0));
  if (Math.abs((Number(imported.calories) || 0) - (Number(catalog.calories) || 0)) > calTol) return false;
  const check = (a, b, tol) => Math.abs((Number(a) || 0) - (Number(b) || 0)) <= Math.max(tol, 0.2 * Math.max(1, Number(a) || 0));
  if (!check(catalog.protein, imported.protein, 2.5)) return false;
  if (!check(catalog.carbs, imported.carbs, 3)) return false;
  if (!check(catalog.fat, imported.fat, 2)) return false;
  return true;
}

function pickNewFields(food) {
  const out = {};
  for (const k of NEW_KEYS) {
    if (hasValue(food[k])) out[k] = food[k];
  }
  return out;
}

function foodPortions(record) {
  return record.foodPortions || record.portions || [];
}

function portionGrams(record, catalog) {
  const unit = String(catalog.servingUnit || '').toLowerCase();
  const size = Number(catalog.servingSize) || 1;
  const portions = foodPortions(record);
  if (!portions.length) return null;
  const unitHints = [unit];
  if (unit === 'tbsp' || unit === 'tablespoon') unitHints.push('tablespoon', 'tbsp');
  if (unit === 'tsp' || unit === 'teaspoon') unitHints.push('teaspoon', 'tsp');
  if (unit === 'cup' || unit === 'cups') unitHints.push('cup');
  if (/medium/.test(String(catalog.name).toLowerCase()) || unit === 'medium') unitHints.push('medium');
  if (/large/.test(String(catalog.name).toLowerCase()) || unit === 'large') unitHints.push('large');
  if (/small/.test(String(catalog.name).toLowerCase()) || unit === 'small') unitHints.push('small');
  const hits = portions.filter((p) => {
    const text = `${p.modifier || ''} ${p.portionDescription || ''}`.toLowerCase();
    return unitHints.some((h) => h && text.includes(h));
  });
  if (hits.length === 1 && Number(hits[0].gramWeight) > 0) {
    const amt = Number(hits[0].amount) || 1;
    return { grams: Number(hits[0].gramWeight) * (size / amt), reason: 'fdc_portion_unit' };
  }
  return null;
}

function loadJsonFoods(file, key) {
  if (!file) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (key && Array.isArray(raw[key])) return raw[key];
  if (Array.isArray(raw.SRLegacyFoods)) return raw.SRLegacyFoods;
  if (Array.isArray(raw.SurveyFoods)) return raw.SurveyFoods;
  if (Array.isArray(raw.FoundationFoods)) return raw.FoundationFoods;
  throw new Error('Unrecognized FDC JSON: ' + file);
}

function loadFoundationCsv(dir) {
  if (!dir) return [];
  const foodsPath = path.join(dir, 'food.csv');
  const nutPath = path.join(dir, 'food_nutrient.csv');
  const portPath = path.join(dir, 'food_portion.csv');
  if (!fs.existsSync(foodsPath) || !fs.existsSync(nutPath)) return [];

  function parseCsv(file) {
    const text = fs.readFileSync(file, 'utf8');
    const rows = [];
    let i = 0, field = '', row = [], inQ = false;
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { if (row.length) rows.push(row); row = []; };
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { pushField(); i++; continue; }
      if (c === '\n' || c === '\r') {
        pushField();
        if (c === '\r' && text[i + 1] === '\n') i++;
        pushRow(); i++; continue;
      }
      field += c; i++;
    }
    if (field || row.length) { pushField(); pushRow(); }
    const header = rows.shift().map((h) => h.replace(/^"|"$/g, ''));
    return rows.filter((r) => r.length && r.some(Boolean)).map((r) => {
      const o = {};
      header.forEach((h, idx) => { o[h] = r[idx] || ''; });
      return o;
    });
  }

  const foods = parseCsv(foodsPath);
  const nuts = parseCsv(nutPath);
  const portions = fs.existsSync(portPath) ? parseCsv(portPath) : [];
  const byId = new Map();
  for (const f of foods) {
    const id = Number(f.fdc_id);
    if (!id) continue;
    byId.set(id, {
      fdcId: id,
      description: f.description,
      dataType: f.data_type || 'Foundation',
      foodNutrients: [],
      foodPortions: []
    });
  }
  for (const n of nuts) {
    const id = Number(n.fdc_id);
    const rec = byId.get(id);
    if (!rec) continue;
    const nid = Number(n.nutrient_id);
    const amount = n.amount === '' ? null : Number(n.amount);
    if (!nid || amount == null || !Number.isFinite(amount)) continue;
    rec.foodNutrients.push({ nutrient: { id: nid }, amount });
  }
  for (const p of portions) {
    const id = Number(p.fdc_id);
    const rec = byId.get(id);
    if (!rec) continue;
    rec.foodPortions.push({
      modifier: p.modifier || p.portion_description || '',
      portionDescription: p.portion_description || '',
      gramWeight: p.gram_weight ? Number(p.gram_weight) : null,
      amount: p.amount ? Number(p.amount) : 1
    });
  }
  return [...byId.values()];
}

function indexRecords(records, dataType) {
  const byId = new Map();
  const byNorm = new Map();
  for (const rec of records) {
    if (!rec || !rec.fdcId) continue;
    rec.dataType = rec.dataType || dataType;
    byId.set(Number(rec.fdcId), rec);
    const n = norm(rec.description);
    if (!n) continue;
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(rec);
  }
  return { byId, byNorm, records };
}

function scoreCandidate(catalog, rec) {
  const ct = tokens(catalog.name);
  const rt = tokens(rec.description);
  if (!ct.length || !rt.length) return 0;
  const cset = new Set(ct);
  const rset = new Set(rt);
  const inter = ct.filter((t) => rset.has(t)).length;
  if (inter < Math.min(2, ct.length)) return 0;
  const cover = inter / ct.length;
  const extra = rt.filter((t) => !cset.has(t)).length;
  return cover * 10 - extra * 0.15;
}

function resolveGrams(catalog, rec, priorGrams) {
  if (priorGrams && priorGrams > 0) return { grams: priorGrams, reason: 'prior_match_grams' };
  const own = catalogGrams(catalog);
  const portion = portionGrams(rec, catalog);
  if (own.grams && portion && Math.abs(own.grams - portion.grams) <= Math.max(3, 0.08 * own.grams)) {
    return { grams: own.grams, reason: 'fdc_portion_confirms_' + own.reason };
  }
  if (portion) return portion;
  if (own.grams) return own;
  return { grams: null, reason: 'no_grams' };
}

function tryImport(catalog, rec, grams) {
  try {
    return toFood(rec, { servingGrams: grams });
  } catch {
    return null;
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.backup || !opts.sr) throw new Error('Need --backup and --sr');

  const backup = JSON.parse(fs.readFileSync(opts.backup, 'utf8'));
  const { lists } = require('../data/foods');
  const listOf = new Map();
  for (const [list, arr] of Object.entries(lists)) {
    for (const f of arr) listOf.set(norm(f.name) + '|' + norm(f.brand || ''), list);
  }

  const prior = opts.priorMatches && fs.existsSync(opts.priorMatches)
    ? JSON.parse(fs.readFileSync(opts.priorMatches, 'utf8'))
    : { matches: [] };
  const priorById = new Map((prior.matches || []).map((m) => [String(m.id), m]));

  console.error('Loading SR Legacy...');
  const sr = indexRecords(loadJsonFoods(opts.sr, 'SRLegacyFoods'), 'SR Legacy');
  console.error('SR Legacy foods', sr.records.length);
  console.error('Loading FNDDS...');
  const fndds = opts.fndds ? indexRecords(loadJsonFoods(opts.fndds, 'SurveyFoods'), 'Survey (FNDDS)') : { byId: new Map(), byNorm: new Map(), records: [] };
  console.error('FNDDS foods', fndds.records.length);
  console.error('Loading Foundation...');
  const foundation = opts.foundationDir ? indexRecords(loadFoundationCsv(opts.foundationDir), 'Foundation') : { byId: new Map(), byNorm: new Map(), records: [] };
  console.error('Foundation foods', foundation.records.length);

  const sources = [
    { name: 'SR Legacy', idx: sr, rank: 3 },
    { name: 'Foundation', idx: foundation, rank: 2 },
    { name: 'FNDDS', idx: fndds, rank: 1 }
  ];

  const matches = [];
  const skipped = [];
  const skipReasons = {};
  function skip(food, reason, extra) {
    skipReasons[reason] = (skipReasons[reason] || 0) + 1;
    skipped.push({ id: oid(food), name: food.name, brand: food.brand || '', list: food.list, reason, ...extra });
  }

  const systemFoods = backup.filter((d) => d.user == null);
  for (const food of systemFoods) {
    const id = oid(food);
    const list = listOf.get(norm(food.name) + '|' + norm(food.brand || '')) || food.list || 'not_in_catalog';
    food.list = list;
    const priorMatch = priorById.get(id);

    let rec = null;
    let gramsInfo = { grams: null, reason: 'no_grams' };
    let sourceName = '';

    if (priorMatch && priorMatch.fdcId) {
      rec = sr.byId.get(Number(priorMatch.fdcId))
        || foundation.byId.get(Number(priorMatch.fdcId))
        || fndds.byId.get(Number(priorMatch.fdcId));
      if (rec) {
        gramsInfo = resolveGrams(food, rec, Number(priorMatch.grams));
        sourceName = rec.dataType || priorMatch.fdcDataType || 'SR Legacy';
      }
    }

    if (!rec) {
      if (!GENERIC_LISTS.has(list)) {
        skip(food, 'non_generic_list_skipped');
        continue;
      }
      const n = norm(food.name);
      const candidates = [];
      for (const src of sources) {
        const exact = src.idx.byNorm.get(n) || [];
        for (const r of exact) candidates.push({ rec: r, score: 100 + src.rank, source: src.name });
      }
      if (!candidates.length) {
        for (const src of sources) {
          for (const r of src.idx.records) {
            const sc = scoreCandidate(food, r);
            if (sc >= 6.5) candidates.push({ rec: r, score: sc + src.rank * 0.2, source: src.name });
          }
        }
      }
      const viable = [];
      for (const c of candidates) {
        const g = resolveGrams(food, c.rec);
        if (!g.grams) continue;
        const imported = tryImport(food, c.rec, g.grams);
        if (!imported || !macroClose(food, imported)) continue;
        viable.push({ ...c, gramsInfo: g, imported });
      }
      if (!viable.length) {
        skip(food, candidates.length ? 'candidates_failed_grams_or_macros' : 'no_description_candidate');
        continue;
      }
      viable.sort((a, b) => b.score - a.score);
      const top = viable[0];
      const close = viable.filter((v) => v.rec.fdcId !== top.rec.fdcId && top.score - v.score < 0.8);
      if (close.length) {
        skip(food, 'ambiguous_multiple_matches', { candidates: viable.slice(0, 4).map((v) => v.rec.description) });
        continue;
      }
      rec = top.rec;
      gramsInfo = top.gramsInfo;
      sourceName = rec.dataType || top.source;
    }

    if (!rec || !gramsInfo.grams) {
      skip(food, 'no_record_or_grams');
      continue;
    }
    const imported = tryImport(food, rec, gramsInfo.grams);
    if (!imported) {
      skip(food, 'import_failed');
      continue;
    }
    // For prior matches, still require we can scale; macros were already accepted.
    if (!priorMatch && !macroClose(food, imported)) {
      skip(food, 'macro_gate_failed_after_resolve');
      continue;
    }
    const setFields = pickNewFields(imported);
    matches.push({
      id,
      name: food.name,
      list,
      fdcId: Number(rec.fdcId),
      fdcDescription: rec.description,
      fdcDataType: sourceName,
      sourceUrl: `https://fdc.nal.usda.gov/food-details/${rec.fdcId}/nutrients`,
      grams: gramsInfo.grams,
      gramsReason: gramsInfo.reason,
      calories: imported.calories,
      prior: !!priorMatch,
      setFields
    });
  }

  const coverage = {};
  for (const k of NEW_KEYS) coverage[k] = { present: 0, officialZero: 0, missing: 0 };
  for (const m of matches) {
    for (const k of NEW_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(m.setFields, k)) coverage[k].missing += 1;
      else if (Number(m.setFields[k]) === 0) { coverage[k].present += 1; coverage[k].officialZero += 1; }
      else coverage[k].present += 1;
    }
  }

  const byListMatched = {};
  const byListSkipped = {};
  for (const m of matches) byListMatched[m.list] = (byListMatched[m.list] || 0) + 1;
  for (const s of skipped) byListSkipped[s.list] = (byListSkipped[s.list] || 0) + 1;
  const fdcDataTypes = {};
  for (const m of matches) fdcDataTypes[m.fdcDataType] = (fdcDataTypes[m.fdcDataType] || 0) + 1;

  const wouldUpdate = matches.filter((m) => Object.keys(m.setFields).length > 0);
  const summary = {
    backup: opts.backup,
    backupCount: backup.length,
    systemFoods: systemFoods.length,
    matched: matches.length,
    wouldUpdate: wouldUpdate.length,
    skipped: skipped.length,
    skipReasons,
    byListMatched,
    byListSkipped,
    fdcDataTypes,
    coverage,
    fields: NEW_KEYS,
    dataSources: {
      srLegacy: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip',
      foundation: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip',
      fndds: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip',
      retrieved: '2026-11-25'
    },
    notes: [
      'No production Atlas writes were made. This file is a proposal only.',
      'Only additive $set of new micronutrient/electrolyte fields. Calories, macros, names, servings, and previously filled micros are not changed.',
      'Prior high-confidence matches (86) were reused by fdcId and official gram weight.',
      'Additional matches required a unique description candidate, an official or catalog gram weight, and a macro gate.',
      'Chain, pizza, candy, Costco, packaged, and supplement lists were not auto-matched to branded FDC (labels vary and branded values are per labeled serving). Official manufacturer values can be added later when a first-party label actually lists the nutrient.',
      'Missing nutrients stay absent (not zero). A stored 0 is an official measured zero only.',
      'Take a fresh Atlas foods export before applying, because the latest local backup is from 2026-11-15.'
    ]
  };

  const outDir = opts.out;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'more-micros-backfill-matches.json'), JSON.stringify({ summary, matches }, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'more-micros-backfill-skipped.json'), JSON.stringify({ summary: { skipped: skipped.length, skipReasons }, skipped }, null, 2) + '\n');
  const updates = wouldUpdate.map((m) => ({
    id: m.id,
    $set: {
      ...m.setFields,
      sourceFdcId: m.fdcId
    }
  }));
  fs.writeFileSync(path.join(outDir, 'more-micros-backfill-updates.json'), JSON.stringify({
    count: updates.length,
    fields: NEW_KEYS,
    note: 'Apply only after a fresh backup and approval. $set these fields by _id. Do not overwrite macros.',
    updates
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'more-micros-backfill-updated-ids.json'), JSON.stringify({
    count: wouldUpdate.length,
    ids: wouldUpdate.map((m) => m.id),
    fieldsSet: NEW_KEYS,
    backup: opts.backup,
    note: 'Pending approval. No Atlas writes have been made.'
  }, null, 2) + '\n');

  console.log(JSON.stringify(summary, null, 2));
}

main();
