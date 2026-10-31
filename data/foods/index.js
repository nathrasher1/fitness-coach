// All built-in (system) foods. Each list follows the Food model: per-serving values,
// sodium in mg. New lists are appended; names must be unique (case-insensitive).
const lists = {
  base: require('./base'),
  costco: require('./costco')
};

const seen = new Set();
const allFoods = [];
for (const list of Object.values(lists)) {
  for (const f of list) {
    const key = f.name.trim().toLowerCase() + '|' + (f.brand || '').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    allFoods.push(f);
  }
}

module.exports = { allFoods, lists };
