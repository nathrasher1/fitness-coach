// All built-in (system) foods. Each list follows the Food model: per-serving values,
// sodium in mg. New lists are appended; names must be unique (case-insensitive).
const lists = {
  base: require('./base'),
  costco: require('./costco'),
  fruits: require('./fruits'),
  vegetables: require('./vegetables'),
  grains: require('./grains'),
  proteins: require('./proteins'),
  dairy: require('./dairy'),
  nuts: require('./nuts'),
  snacks: require('./snacks'),
  drinks: require('./drinks'),
  breakfast: require('./breakfast'),
  condiments: require('./condiments'),
  supplements: require('./supplements'),
  packaged: require('./packaged'),
  world: require('./world'),
  chains: require('./chains')
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
