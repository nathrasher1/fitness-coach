// Costco food court pizza (US, non-California menu).
// Source: Costco "Food Court Nutrition Facts" sheet, 4/2021 (Non-California, US):
//   Slice Cheese 269 g: 710 kcal, 27 g fat, 78 g carbs, 9 g fiber, 5 g sugar, 41 g protein, 1780 mg sodium
//   Whole Cheese 1616 g: 4260 kcal, 161 g fat, 467 g carbs, 52 g fiber, 31 g sugar, 247 g protein, 10710 mg sodium
//   Slice Pepperoni 243 g: 650 kcal, 24 g fat, 75 g carbs, 7 g fiber, 5 g sugar, 34 g protein, 1740 mg sodium
//   Whole Pepperoni 1456 g: 3880 kcal, 145 g fat, 449 g carbs, 44 g fiber, 33 g sugar, 202 g protein, 10450 mg sodium
//   Whole 1/2 Pepperoni + 1/2 Cheese 1579 g: 4080 kcal, 162 g fat, 453 g carbs, 42 g fiber, 33 g sugar, 224 g protein, 10440 mg sodium
// The food-court slice is 1/6 of an 18" pie. A whole pie bought to take home is cut into 12;
// the "1/12 pie" rows are Costco's whole-pie figures divided by 12 (no other change).
// Combo pizza was discontinued in 2020 and is not on the current menu, so it is not listed.
const B = 'Costco Food Court';
const r1 = (n) => Math.round(n * 10) / 10;
const twelfth = (name, w) => ({
  name, brand: B, servingSize: 1, servingUnit: 'slice (1/12 pie)',
  calories: Math.round(w.calories / 12), protein: r1(w.protein / 12), carbs: r1(w.carbs / 12),
  fat: r1(w.fat / 12), fiber: r1(w.fiber / 12), sugar: r1(w.sugar / 12), sodium: Math.round(w.sodium / 12)
});
const wholeCheese = { calories: 4260, protein: 247, carbs: 467, fat: 161, fiber: 52, sugar: 31, sodium: 10710 };
const wholePep = { calories: 3880, protein: 202, carbs: 449, fat: 145, fiber: 44, sugar: 33, sodium: 10450 };
const wholeHalf = { calories: 4080, protein: 224, carbs: 453, fat: 162, fiber: 42, sugar: 33, sodium: 10440 };

module.exports = [
  { name: 'Costco cheese pizza, food court slice', brand: B, servingSize: 1, servingUnit: 'slice (1/6 pie, 269 g)', calories: 710, protein: 41, carbs: 78, fat: 27, fiber: 9, sugar: 5, sodium: 1780 },
  { name: 'Costco pepperoni pizza, food court slice', brand: B, servingSize: 1, servingUnit: 'slice (1/6 pie, 243 g)', calories: 650, protein: 34, carbs: 75, fat: 24, fiber: 7, sugar: 5, sodium: 1740 },
  { name: 'Costco cheese pizza, whole 18" pie', brand: B, servingSize: 1, servingUnit: 'pizza (1616 g)', ...wholeCheese },
  { name: 'Costco pepperoni pizza, whole 18" pie', brand: B, servingSize: 1, servingUnit: 'pizza (1456 g)', ...wholePep },
  { name: 'Costco half cheese / half pepperoni pizza, whole 18" pie', brand: B, servingSize: 1, servingUnit: 'pizza (1579 g)', ...wholeHalf },
  twelfth('Costco cheese pizza, slice from whole pie (1/12)', wholeCheese),
  twelfth('Costco pepperoni pizza, slice from whole pie (1/12)', wholePep),
  twelfth('Costco half cheese / half pepperoni pizza, slice from whole pie (1/12)', wholeHalf)
];
