const G_PER_OZ = 28.3495;
const WEIGHT_UNITS = new Set(['g', 'gram', 'grams', 'oz', 'ounce', 'ounces']);

function isWeightUnit(unit) {
  return WEIGHT_UNITS.has((unit || '').toLowerCase());
}

function toGrams(size, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return size * G_PER_OZ;
  return size;
}

/** How many of the food's defined servings `amount` in `chosenUnit` represents. */
function amountToServings(amount, chosenUnit, food) {
  const baseUnit = (food.servingUnit || 'serving').toLowerCase();
  const chosen = (chosenUnit || 'serving').toLowerCase();
  if (chosen === 'serving' || chosen === baseUnit) return amount;
  if (isWeightUnit(baseUnit) && (chosen === 'g' || chosen === 'oz' || chosen === 'grams' || chosen === 'ounces')) {
    const baseGrams = toGrams(food.servingSize || 1, baseUnit) || 1;
    const amountGrams = chosen === 'oz' || chosen === 'ounces' ? amount * G_PER_OZ : amount;
    return amountGrams / baseGrams;
  }
  return null;
}

module.exports = { amountToServings, isWeightUnit, toGrams, G_PER_OZ };
