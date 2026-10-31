// Compact row helper for built-in food lists:
// r(name, servingSize, servingUnit, calories, protein, carbs, fat, fiber, sugar, sodiumMg, extra)
module.exports = function r(name, servingSize, servingUnit, calories, protein, carbs, fat, fiber = 0, sugar = 0, sodium = 0, extra = {}) {
  return { name, servingSize, servingUnit, calories, protein, carbs, fat, fiber, sugar, sodium, ...extra };
};
