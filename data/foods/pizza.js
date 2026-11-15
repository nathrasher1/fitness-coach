// Official US chain pizza nutrition.
// Retrieved: 2026-11-15.
// Sources are official brand nutrition PDFs only. Values are copied from those PDFs;
// nothing here is estimated, divided into unofficial slices, or taken from third-party sites.
//
// Included:
// - Domino's: specialty pizzas, Hand Tossed crust, official per-slice values for Small (10", 1/4 pizza),
//   Medium (12", 1/5 pizza), Large (14", 1/8 pizza), and Extra Large (16", 1/8 pizza).
//   Source: https://www.dominos.com/cms/assets/8187ef50-6b63-484e-b0ac-47cafe610fde
//   Publication: Domino's Nutrition Guide, June 2026.
// - Little Caesars: official whole-pizza values (the guide does not publish a slice count).
//   Source: https://littlecaesars.com/static/usnutritionguide.pdf
// - Sbarro: official Full Pizza values from the USA Nutritional Guide dated 10.12.22
//   (still published on sbarro.com; retrieved 2026-11-15). The guide does not publish a slice count.
//   Source: https://sbarro.com/wp-content/uploads/2022/10/Sbarro-Nutrition-and-Allergen-Info-10.12.22.pdf
//
// Skipped (could not verify official per-item numbers on 2026-11-15, or official source lists no per-slice values):
// - Domino's build-your-own cheese/pepperoni assembled slices: the June 2026 guide lists components, not finished
//   cheese/pepperoni totals. Existing catalog rows in chains.js were left unchanged (insert-only sync never edits them).
// - Little Caesars per-slice values: official guide is whole-pizza only; slice math was not invented.
// - Little Caesars "Pretzel Crust Pizza with Pizza Sauce and Cheese" and "Old World Fanceroni Pepperoni":
//   names appear in the official PDF without a complete nutrition row in the extracted table.
// - Pizza Hut (US): no official static US nutrition PDF with per-slice tables was retrievable; pizzahut.com points
//   to an interactive Nutrition Portal / Nutritionix calculator. The Canadian Pizza Hut PDF was not used (different menu).
//   Existing Pizza Hut rows in chains.js (sourced from fastfoodnutrition.org) were left unchanged.
// - Papa John's: official nutrition pages and the nutritional-information.pdf URL returned a
//   "Technical Difficulties" error page on 2026-11-15; no official numbers could be verified.
// - Marco's Pizza: official site points to a Nutritionix portal only; no first-party tables/PDF retrieved.
// - Blaze Pizza: official site offers a nutrition calculator only; no static official tables/PDF retrieved.
// - MOD Pizza: official nutrition page (modpizza.com/nutrition/) returned HTTP 403 on 2026-11-15.
// - Jet's Pizza: official nutrition page is a Nutritionix portal/calculator shell with no static per-slice tables;
//   the linked printable menu PDF is a menu, not a nutrition facts table.
// - Sbarro per-slice values: official guide is Full Pizza only; slice math was not invented.
//
// Food documents below match the Food model. Source URL and retrieval date are documented in this header
// (the schema has no source fields; extra keys are not stored).

module.exports = [
  // --- Domino's (retrieved 2026-11-15; see file header for source URL) ---
  {name: "The People's Pizza – Deluxe, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 142, calories: 360, protein: 14, carbs: 38, fat: 16, fiber: 1, sugar: 3, sodium: 700},
  {name: "The People's Pizza – Deluxe, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 153, calories: 390, protein: 15, carbs: 39, fat: 19, fiber: 2, sugar: 4, sodium: 780},
  {name: "The People's Pizza – Deluxe, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 135, calories: 340, protein: 13, carbs: 35, fat: 16, fiber: 1, sugar: 3, sodium: 680},
  {name: "The People's Pizza – Deluxe, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 177, calories: 450, protein: 18, carbs: 46, fat: 21, fiber: 2, sugar: 4, sodium: 900},
  {name: "ExtravaganZZa, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 154, calories: 400, protein: 16, carbs: 38, fat: 19, fiber: 2, sugar: 3, sodium: 900},
  {name: "ExtravaganZZa, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 174, calories: 440, protein: 18, carbs: 40, fat: 22, fiber: 2, sugar: 4, sodium: 1040},
  {name: "ExtravaganZZa, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 153, calories: 380, protein: 16, carbs: 36, fat: 19, fiber: 2, sugar: 3, sodium: 900},
  {name: "ExtravaganZZa, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 202, calories: 500, protein: 21, carbs: 47, fat: 25, fiber: 2, sugar: 4, sodium: 1220},
  {name: "Honolulu Hawaiian, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 137, calories: 350, protein: 15, carbs: 39, fat: 15, fiber: 1, sugar: 4, sodium: 780},
  {name: "Honolulu Hawaiian, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 150, calories: 380, protein: 17, carbs: 40, fat: 17, fiber: 1, sugar: 5, sodium: 910},
  {name: "Honolulu Hawaiian, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 132, calories: 330, protein: 14, carbs: 36, fat: 14, fiber: 1, sugar: 4, sodium: 760},
  {name: "Honolulu Hawaiian, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 173, calories: 430, protein: 19, carbs: 47, fat: 18, fiber: 2, sugar: 6, sodium: 1010},
  {name: "MeatZZa, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 139, calories: 390, protein: 16, carbs: 38, fat: 19, fiber: 1, sugar: 3, sodium: 870},
  {name: "MeatZZa, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 151, calories: 420, protein: 18, carbs: 38, fat: 21, fiber: 1, sugar: 3, sodium: 1000},
  {name: "MeatZZa, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 133, calories: 370, protein: 15, carbs: 34, fat: 18, fiber: 1, sugar: 3, sodium: 850},
  {name: "MeatZZa, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 176, calories: 480, protein: 20, carbs: 45, fat: 24, fiber: 2, sugar: 4, sodium: 1160},
  {name: "Memphis BBQ Chicken, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 131, calories: 360, protein: 15, carbs: 41, fat: 14, fiber: 1, sugar: 7, sodium: 680},
  {name: "Memphis BBQ Chicken, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 147, calories: 410, protein: 18, carbs: 44, fat: 17, fiber: 1, sugar: 8, sodium: 800},
  {name: "Memphis BBQ Chicken, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 128, calories: 350, protein: 15, carbs: 39, fat: 14, fiber: 1, sugar: 7, sodium: 680},
  {name: "Memphis BBQ Chicken, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 166, calories: 460, protein: 20, carbs: 51, fat: 18, fiber: 2, sugar: 9, sodium: 880},
  {name: "Pacific Veggie, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 131, calories: 330, protein: 13, carbs: 38, fat: 13, fiber: 1, sugar: 3, sodium: 620},
  {name: "Pacific Veggie, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 149, calories: 360, protein: 14, carbs: 39, fat: 15, fiber: 2, sugar: 4, sodium: 730},
  {name: "Pacific Veggie, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 131, calories: 310, protein: 12, carbs: 35, fat: 13, fiber: 1, sugar: 3, sodium: 630},
  {name: "Pacific Veggie, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 168, calories: 400, protein: 16, carbs: 46, fat: 16, fiber: 2, sugar: 4, sodium: 790},
  {name: "Philly Cheese Steak, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 124, calories: 340, protein: 14, carbs: 36, fat: 15, fiber: 1, sugar: 3, sodium: 790},
  {name: "Philly Cheese Steak, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 136, calories: 370, protein: 15, carbs: 37, fat: 16, fiber: 1, sugar: 3, sodium: 890},
  {name: "Philly Cheese Steak, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 118, calories: 310, protein: 13, carbs: 33, fat: 13, fiber: 1, sugar: 3, sodium: 720},
  {name: "Philly Cheese Steak, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 152, calories: 400, protein: 17, carbs: 43, fat: 17, fiber: 2, sugar: 3, sodium: 920},
  {name: "Spicy Chicken Bacon Ranch, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 131, calories: 390, protein: 16, carbs: 34, fat: 21, fiber: 1, sugar: 2, sodium: 1110},
  {name: "Spicy Chicken Bacon Ranch, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 155, calories: 480, protein: 19, carbs: 38, fat: 27, fiber: 1, sugar: 3, sodium: 1280},
  {name: "Spicy Chicken Bacon Ranch, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 135, calories: 410, protein: 16, carbs: 34, fat: 22, fiber: 1, sugar: 3, sodium: 1090},
  {name: "Spicy Chicken Bacon Ranch, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 174, calories: 530, protein: 21, carbs: 44, fat: 29, fiber: 1, sugar: 3, sodium: 1410},
  {name: "Spinach & Feta, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 119, calories: 340, protein: 14, carbs: 36, fat: 15, fiber: 1, sugar: 2, sodium: 620},
  {name: "Spinach & Feta, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 130, calories: 370, protein: 15, carbs: 37, fat: 17, fiber: 1, sugar: 2, sodium: 710},
  {name: "Spinach & Feta, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 115, calories: 320, protein: 13, carbs: 33, fat: 15, fiber: 1, sugar: 2, sodium: 610},
  {name: "Spinach & Feta, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 149, calories: 420, protein: 17, carbs: 43, fat: 19, fiber: 2, sugar: 3, sodium: 770},
  {name: "Ultimate Pepperoni, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 131, calories: 380, protein: 16, carbs: 38, fat: 18, fiber: 1, sugar: 3, sodium: 850},
  {name: "Ultimate Pepperoni, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 142, calories: 420, protein: 17, carbs: 38, fat: 21, fiber: 1, sugar: 3, sodium: 960},
  {name: "Ultimate Pepperoni, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 125, calories: 360, protein: 15, carbs: 34, fat: 18, fiber: 1, sugar: 3, sodium: 830},
  {name: "Ultimate Pepperoni, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 165, calories: 480, protein: 20, carbs: 45, fat: 23, fiber: 2, sugar: 4, sodium: 1110},
  {name: "Wisconsin 6 Cheese, Small 10\" Hand Tossed Pizza (1 slice, 1/4 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/4 of Small 10\" Hand Tossed)", gramsPerServing: 124, calories: 340, protein: 14, carbs: 38, fat: 14, fiber: 1, sugar: 3, sodium: 660},
  {name: "Wisconsin 6 Cheese, Medium 12\" Hand Tossed Pizza (1 slice, 1/5 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/5 of Medium 12\" Hand Tossed)", gramsPerServing: 141, calories: 390, protein: 17, carbs: 39, fat: 18, fiber: 1, sugar: 3, sodium: 790},
  {name: "Wisconsin 6 Cheese, Large 14\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Large 14\" Hand Tossed)", gramsPerServing: 122, calories: 330, protein: 14, carbs: 35, fat: 15, fiber: 1, sugar: 3, sodium: 670},
  {name: "Wisconsin 6 Cheese, Extra Large 16\" Hand Tossed Pizza (1 slice, 1/8 pizza)", brand: "Domino's", servingSize: 1, servingUnit: "slice (1/8 of Extra Large 16\" Hand Tossed)", gramsPerServing: 161, calories: 440, protein: 19, carbs: 46, fat: 19, fiber: 2, sugar: 4, sodium: 880},
  // --- Little Caesars (retrieved 2026-11-15; see file header for source URL) ---
  {name: "Large ExtraMostBestest Pepperoni Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2500, protein: 122, carbs: 252, fat: 113, fiber: 13, sugar: 19, sodium: 5640},
  {name: "Large ExtraMostBestest Cheese Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2220, protein: 117, carbs: 252, fat: 84, fiber: 13, sugar: 17, sodium: 4430},
  {name: "Large ExtraMostBestest Italian Sausage Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2660, protein: 129, carbs: 252, fat: 128, fiber: 13, sugar: 19, sodium: 5680},
  {name: "Large 5 Meat Feast Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2830, protein: 139, carbs: 252, fat: 142, fiber: 13, sugar: 20, sodium: 7120},
  {name: "Large Ultimate Supreme Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2500, protein: 118, carbs: 259, fat: 112, fiber: 15, sugar: 23, sodium: 5780},
  {name: "Large 3 Meat Treat Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2860, protein: 135, carbs: 252, fat: 147, fiber: 13, sugar: 20, sodium: 6590},
  {name: "Large Hula Hawaiian Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2180, protein: 121, carbs: 272, fat: 70, fiber: 13, sugar: 35, sodium: 5570},
  {name: "Large Veggie Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2240, protein: 100, carbs: 266, fat: 84, fiber: 20, sugar: 25, sodium: 5430},
  {name: "Large Slices-N-Stix Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2300, protein: 107, carbs: 253, fat: 97, fiber: 13, sugar: 20, sodium: 5220},
  {name: "Large Slices-N-Stix Bacon Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2980, protein: 116, carbs: 252, fat: 115, fiber: 13, sugar: 19, sodium: 5560},
  {name: "Large Slices-N-Stix Jalapeño Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2330, protein: 107, carbs: 255, fat: 99, fiber: 15, sugar: 20, sodium: 6000},
  {name: "Large Stuffed Crust Pepperoni Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2980, protein: 144, carbs: 259, fat: 153, fiber: 13, sugar: 20, sodium: 7040},
  {name: "Large Pretzel Crust Pizza with Pizza Sauce (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2080, protein: 91, carbs: 240, fat: 85, fiber: 11, sugar: 14, sodium: 10500},
  {name: "Large Cheese Pretzel Crust Pizza with Cheese Sauce (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 1940, protein: 85, carbs: 243, fat: 71, fiber: 9, sugar: 12, sodium: 10080},
  {name: "Large Pretzel Crust Pizza with Cheese Sauce (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2190, protein: 94, carbs: 244, fat: 93, fiber: 9, sugar: 13, sodium: 10980},
  {name: "Large Classic Pepperoni Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2300, protein: 109, carbs: 250, fat: 97, fiber: 13, sugar: 19, sodium: 5050},
  {name: "Large Classic Cheese Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 1950, protein: 95, carbs: 248, fat: 65, fiber: 12, sugar: 17, sodium: 3740},
  {name: "Large Classic Italian Sausage Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2270, protein: 111, carbs: 255, fat: 91, fiber: 13, sugar: 17, sodium: 4480},
  {name: "Detroit-Style Deep Dish Pepperoni Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2770, protein: 129, carbs: 319, fat: 111, fiber: 16, sugar: 20, sodium: 5280},
  {name: "Detroit-Style Deep Dish Cheese Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2500, protein: 118, carbs: 317, fat: 85, fiber: 16, sugar: 19, sodium: 4230},
  {name: "Detroit-Style Deep Dish Italian Sausage Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2820, protein: 133, carbs: 319, fat: 114, fiber: 16, sugar: 20, sodium: 5130},
  {name: "Detroit-Style Deep Dish Ultimate Supreme Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 3050, protein: 141, carbs: 332, fat: 130, fiber: 20, sugar: 27, sodium: 6270},
  {name: "Detroit-Style Deep Dish 3 Meat Treat Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 3480, protein: 159, carbs: 321, fat: 175, fiber: 16, sugar: 22, sodium: 7240},
  {name: "Detroit-Style Deep Dish Hula Hawaiian Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2690, protein: 137, carbs: 341, fat: 88, fiber: 17, sugar: 37, sodium: 5610},
  {name: "Detroit-Style Deep Dish Veggie Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2730, protein: 123, carbs: 333, fat: 99, fiber: 22, sugar: 26, sodium: 5760},
  {name: "Detroit-Style Deep Dish 5 Meat Feast Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 3500, protein: 171, carbs: 322, fat: 172, fiber: 16, sugar: 23, sodium: 8140},
  {name: "Thin Crust Pepperoni Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 2130, protein: 94, carbs: 148, fat: 128, fiber: 9, sugar: 5, sodium: 4270},
  {name: "Thin Crust Cheese Pizza (whole)", brand: "Little Caesars", servingSize: 1, servingUnit: "pizza (whole)", calories: 1980, protein: 99, carbs: 150, fat: 109, fiber: 10, sugar: 3, sodium: 3390},
  // --- Sbarro (retrieved 2026-11-15; see file header for source URL) ---
  {name: "SBARRO 17in NY Cheese Pizza (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1237, calories: 2750, protein: 135, carbs: 340, fat: 96, fiber: 20, sugar: 36, sodium: 6300},
  {name: "SBARRO 17in NY Pepperoni (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1293, calories: 3110, protein: 145, carbs: 341, fat: 132, fiber: 21, sugar: 36, sodium: 7690},
  {name: "SBARRO 17in NY Supremo (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1627, calories: 3420, protein: 153, carbs: 357, fat: 156, fiber: 25, sugar: 43, sodium: 8170},
  {name: "SBARRO 17in NY Sausage (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1453, calories: 3540, protein: 167, carbs: 354, fat: 163, fiber: 22, sugar: 40, sodium: 7790},
  {name: "SBARRO 17in NY Mushroom (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1466, calories: 2770, protein: 123, carbs: 341, fat: 104, fiber: 20, sugar: 35, sodium: 6550},
  {name: "SBARRO 17in NY Spinach and Tomato (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1494, calories: 2850, protein: 129, carbs: 355, fat: 105, fiber: 27, sugar: 41, sodium: 6860},
  {name: "SBARRO 17in NY Chicken, Bacon and Ranch (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1435, calories: 4030, protein: 179, carbs: 323, fat: 225, fiber: 13, sugar: 21, sodium: 8100},
  {name: "SBARRO 17in NY Buffalo Chicken (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1370, calories: 3230, protein: 171, carbs: 315, fat: 145, fiber: 11, sugar: 16, sodium: 10410},
  {name: "SBARRO 17in NY Classic Hawaiian (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1513, calories: 2880, protein: 156, carbs: 369, fat: 89, fiber: 21, sugar: 60, sodium: 8500},
  {name: "SBARRO 17in NY 4 Cheese White (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1195, calories: 3300, protein: 144, carbs: 330, fat: 164, fiber: 11, sugar: 17, sodium: 6640},
  {name: "SBARRO 17in NY Veggie (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1642, calories: 2780, protein: 126, carbs: 357, fat: 97, fiber: 26, sugar: 45, sodium: 6540},
  {name: "SBARRO 17in NY Meat Primo (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1602, calories: 3990, protein: 206, carbs: 356, fat: 192, fiber: 22, sugar: 41, sodium: 10360},
  {name: "SBARRO 17in NY Mama’s Meatball (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1572, calories: 3780, protein: 173, carbs: 352, fat: 182, fiber: 18, sugar: 32, sodium: 7580},
  {name: "SBARRO 14in NY Cheese Pizza (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 839, calories: 1850, protein: 91, carbs: 228, fat: 65, fiber: 14, sugar: 25, sodium: 4260},
  {name: "SBARRO 14in NY Pepperoni (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 881, calories: 2110, protein: 99, carbs: 229, fat: 91, fiber: 14, sugar: 25, sodium: 5240},
  {name: "SBARRO 14in NY Supremo (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1094, calories: 2350, protein: 107, carbs: 239, fat: 110, fiber: 17, sugar: 29, sodium: 5680},
  {name: "SBARRO 14in NY Veggie (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1138, calories: 1930, protein: 90, carbs: 240, fat: 70, fiber: 18, sugar: 31, sodium: 4650},
  {name: "SBARRO 14in NY Classic Hawaiian (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1039, calories: 1960, protein: 107, carbs: 248, fat: 61, fiber: 15, sugar: 42, sodium: 5870},
  {name: "SBARRO 14in NY 4 Cheese White (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 821, calories: 2260, protein: 99, carbs: 222, fat: 114, fiber: 7, sugar: 12, sodium: 4540},
  {name: "SBARRO 14in NY Mama’s Meatball (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1084, calories: 2620, protein: 120, carbs: 237, fat: 129, fiber: 12, sugar: 22, sodium: 5220},
  {name: "SBARRO Roman Classic Cheese (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1449, calories: 3670, protein: 137, carbs: 357, fat: 193, fiber: 17, sugar: 36, sodium: 6670},
  {name: "SBARRO Roman Pepperoni and Bacon (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1618, calories: 4580, protein: 185, carbs: 360, fat: 271, fiber: 18, sugar: 37, sodium: 9690},
  {name: "SBARRO Roman Veggie (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1906, calories: 3810, protein: 135, carbs: 375, fat: 202, fiber: 24, sugar: 44, sodium: 7090},
  {name: "SBARRO Roman Double Duo Pepperoni (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1665, calories: 4790, protein: 178, carbs: 358, fat: 298, fiber: 18, sugar: 39, sodium: 10920},
  {name: "SBARRO Roman Meat Primo (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1841, calories: 5000, protein: 215, carbs: 374, fat: 295, fiber: 20, sugar: 41, sodium: 10900},
  {name: "SBARRO Roman Buffalo Chicken Ranch (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1527, calories: 4120, protein: 187, carbs: 332, fat: 232, fiber: 12, sugar: 18, sodium: 11140},
  {name: "SBARRO Roman Supremo (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1865, calories: 4500, protein: 167, carbs: 376, fat: 264, fiber: 22, sugar: 44, sodium: 8840},
  {name: "SBARRO Roman Sausage and Pepperoni (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1749, calories: 4810, protein: 187, carbs: 373, fat: 290, fiber: 20, sugar: 41, sodium: 9200},
  {name: "SBARRO Roman Classic Hawaiian (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1752, calories: 3890, protein: 165, carbs: 386, fat: 192, fiber: 19, sugar: 61, sodium: 9050},
  {name: "SBARRO Pan Classic Hawaiian (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 2010, calories: 4510, protein: 203, carbs: 497, fat: 195, fiber: 22, sugar: 66, sodium: 10800},
  {name: "SBARRO Pan Spinach and Tomato (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1989, calories: 4470, protein: 173, carbs: 481, fat: 213, fiber: 28, sugar: 43, sodium: 8940},
  {name: "SBARRO Pan Spinach and Mushroom (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 2059, calories: 4580, protein: 173, carbs: 474, fat: 228, fiber: 27, sugar: 38, sodium: 8740},
  {name: "SBARRO Pan Meat Primo (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 2045, calories: 5570, protein: 248, carbs: 479, fat: 297, fiber: 23, sugar: 42, sodium: 12300},
  {name: "SBARRO Pan Veggie (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 2023, calories: 4580, protein: 171, carbs: 482, fat: 225, fiber: 28, sugar: 43, sodium: 8640},
  {name: "SBARRO Pan Sausage and Pepperoni (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1966, calories: 5450, protein: 224, carbs: 479, fat: 298, fiber: 23, sugar: 42, sodium: 10810},
  {name: "SBARRO Pan Chicken and Broccoli (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1944, calories: 5070, protein: 242, carbs: 461, fat: 260, fiber: 21, sugar: 24, sodium: 9340},
  {name: "SBARRO Pan Double Duo (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 2005, calories: 5810, protein: 243, carbs: 466, fat: 334, fiber: 21, sugar: 42, sodium: 13200},
  {name: "SBARRO Sicilian Cheese Pizza (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1610, calories: 3870, protein: 159, carbs: 447, fat: 164, fiber: 26, sugar: 57, sodium: 7720},
  {name: "SBARRO Sicilian Sausage and Pepperoni (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 1971, calories: 5580, protein: 216, carbs: 460, fat: 322, fiber: 32, sugar: 64, sodium: 10370},
  {name: "SBARRO Stuffed Sausage and Pepperoni Pizza (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 2499, calories: 7200, protein: 314, carbs: 661, fat: 372, fiber: 34, sugar: 49, sodium: 15720},
  {name: "SBARRO Stuffed Spinach and Broccoli Pizza (whole)", brand: "Sbarro", servingSize: 1, servingUnit: "pizza (whole)", gramsPerServing: 2466, calories: 5890, protein: 233, carbs: 650, fat: 272, fiber: 37, sugar: 33, sodium: 10750},
];
