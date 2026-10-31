const Food = require('../models/Food');

const keyOf = (name, brand) => `${String(name || '').trim().toLowerCase()}|${String(brand || '').trim().toLowerCase()}`;

/**
 * Add any built-in foods that are missing (matched by name + brand, case-insensitive).
 * Never edits or removes existing foods, so logged entries and favorites are untouched.
 */
async function ensureBuiltInFoods(list = require('../../data/foods').allFoods) {
  const existing = await Food.find({ user: null }, { name: 1, brand: 1 }).lean();
  const have = new Set(existing.map((f) => keyOf(f.name, f.brand)));
  const missing = list
    .filter((f) => !have.has(keyOf(f.name, f.brand)))
    .map((f) => ({ ...f, user: null, brand: f.brand || '' }));
  if (missing.length) await Food.insertMany(missing, { ordered: false });
  return { added: missing.length, total: list.length };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split a query into up to 6 tokens; a trailing plural "s" is dropped so "pizzas" finds "pizza". */
function queryTokens(q) {
  return String(q || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/^[^a-z0-9%&'"/.-]+|[^a-z0-9%&'"/.-]+$/g, ''))
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

/** Mongo filter: every token must appear (case-insensitive, anywhere) in the name or brand. */
function tokenFilter(tokens) {
  return tokens.map((t) => {
    const rx = { $regex: escapeRegex(t), $options: 'i' };
    return { $or: [{ name: rx }, { brand: rx }] };
  });
}

/** Lower is better: exact > name starts with query > word starts > anywhere. */
function rankFood(food, q, tokens) {
  const name = String(food.name || '').toLowerCase();
  const full = `${name} ${String(food.brand || '').toLowerCase()}`;
  const query = q.toLowerCase().trim();
  let score = 50;
  if (name === query) score = 0;
  else if (name.startsWith(query)) score = 5;
  else if (tokens.length && name.startsWith(tokens[0])) score = 10;
  else if (full.includes(query)) score = 20;
  const words = full.split(/[^a-z0-9%]+/);
  const wordStarts = tokens.filter((t) => words.some((w) => w.startsWith(t))).length;
  score += (tokens.length - wordStarts) * 8;
  return score;
}

module.exports = { ensureBuiltInFoods, queryTokens, tokenFilter, rankFood, escapeRegex };
