// Server side of the shared serving-unit rules (client/lib/servings.js).
const S = require('../../client/lib/servings');

module.exports = {
  amountToServings: S.amountToServings,
  amountToGrams: S.amountToGrams,
  isWeightUnit: S.isWeightUnit,
  toGrams: S.toGrams,
  measure: S.measure,
  unitOptions: S.unitOptions,
  parseServingText: S.parseServingText,
  G_PER_OZ: S.G_PER_OZ
};
