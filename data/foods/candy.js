// Halloween, fun-size and snack-size candy. Values copied from US Nutrition Facts labels:
// manufacturer sites (hersheyland.com, marswrigleyhalloween.com, skittles.com), retailer label scans,
// or USDA FoodData Central branded records (fdc ids in comments). Every row has a real gram weight
// (gramsPerServing), so it can be logged in g/oz, and a count unit (bar, piece, pouch...).
const r = require('./_row');
const c = (name, brand, n, unit, grams, cal, p, carb, fat, fib, sug, na, src, extra = {}) =>
  r(name, n, unit, cal, p, carb, fat, fib, sug, na, { brand, gramsPerServing: grams, ...extra });

module.exports = [
  // ---- from the user's photos ----
  c("Hershey's Cookies 'n' Creme Fangs (Halloween fun size)", "Hershey's", 2, 'fangs', 26, 130, 2, 17, 7, 0, 13, 55, 'FDC 2658293'),
  c('Harvest Mellocremes mellowcreme candy (candy corn & pumpkins, store brand)', '', 28, 'g', 28, 100, 0, 26, 0, 0, 21, 30, 'FDC 2669058 store-brand mellocreme label',
    { portions: [{ label: 'mellowcreme pumpkin', grams: 5.6 }, { label: 'candy corn piece', grams: 2.05 }] }),
  c('Skittles Gummies fun size pouch (Halloween)', 'Skittles', 3, 'pouches', 30, 100, 1, 24, 0, 0, 19, 0, 'retailer label, 6 oz fun size bag'),
  c('Milky Way fun size bar (Halloween)', 'Mars', 2, 'bars', 34, 160, 1, 24, 6, 0, 21, 45, 'FDC 2564536'),
  c('100 Grand fun size bar (Halloween)', 'Ferrero', 1, 'bar', 21, 100, 1, 15, 4, 0, 11, 45, 'retailer label 0009990071181'),
  c('Butterfinger fun size bar (Halloween)', 'Ferrero', 2, 'bars', 37, 170, 3, 25, 7, 1, 15, 110, 'FDC 2571801'),
  c('Heath snack size bar (fun size, 0.5 oz)', "Hershey's", 3, 'bars', 43, 230, 1, 27, 14, 1, 26, 150, 'Heath snack size label, 3 pieces 43 g'),
  // ---- other common fun-size / Halloween candy ----
  c("Reese's Peanut Butter Cups miniatures", "Hershey's", 5, 'pieces', 44, 220, 4, 26, 13, 1, 23, 130, 'FDC 1350593'),
  c("Reese's Peanut Butter Cups snack size (fun size)", "Hershey's", 2, 'pieces', 31, 160, 3, 18, 9, 1, 16, 100, 'FDC 2563624'),
  c("Reese's Peanut Butter Pumpkin (Halloween candy pumpkin)", "Hershey's", 1, 'pumpkin', 34, 170, 4, 18, 10, 1, 16, 130, 'hersheyland.com'),
  c('Snickers fun size bar (Halloween)', 'Mars', 2, 'bars', 34, 160, 3, 21, 8, 1, 18, 80, 'FDC 666518'),
  c('Twix fun size bar (Halloween)', 'Mars', 1, 'bar', 16, 80, 1, 11, 4, 0, 8, 30, 'FDC 539645'),
  c('Kit Kat snack size bar (fun size)', "Hershey's", 2, 'bars', 28, 140, 1, 19, 7, 0, 15, 15, 'hersheyland.com'),
  c("M&M's milk chocolate fun size pack (Halloween)", 'Mars', 2, 'packs', 27, 130, 1, 20, 5, 0, 17, 20, 'marswrigleyhalloween.com'),
  c("Peanut M&M's fun size pack (Halloween)", 'Mars', 1, 'pack', 18, 90, 2, 11, 5, 0, 9, 10, 'marswrigleyhalloween.com'),
  c('3 Musketeers fun size bar (Halloween)', 'Mars', 3, 'bars', 45, 200, 1, 34, 6, 1, 30, 75, 'FDC 2110941'),
  c('3 Musketeers minis', 'Mars', 7, 'pieces', 41, 170, 1, 32, 5, 1, 27, 80, 'FDC 1342183'),
  c("Hershey's milk chocolate snack size bar (fun size)", "Hershey's", 2, 'bars', 26, 130, 2, 16, 7, 0, 15, 20, 'hersheyland.com'),
  c("Hershey's Miniatures assortment", "Hershey's", 3, 'pieces', 26, 130, 2, 16, 7, 1, 14, 70, 'FDC 2611269'),
  c('Almond Joy snack size bar (fun size)', "Hershey's", 2, 'bars', 34, 170, 1, 20, 9, 1, 16, 40, 'FDC 2671682'),
  c('Mounds bar (2-piece package)', "Hershey's", 2, 'pieces', 49, 230, 2, 29, 13, 3, 21, 55, 'FDC 550997'),
  c('York Peppermint Pattie snack size', "Hershey's", 1, 'pattie', 17, 60, 0, 14, 1, 0, 11, 5, 'FDC 1350741'),
  c('Tootsie Roll Midgees', 'Tootsie', 5, 'pieces', 33, 120, 0, 23, 2.5, 0, 17, 10, 'FDC 2568839'),
  c('Tootsie Pop lollipop', 'Tootsie', 1, 'pop', 17, 60, 0, 15, 0, 0, 10, 0, 'FDC 426979'),
  c('Starburst Original fruit chews', 'Mars', 8, 'pieces', 40, 160, 0, 34, 3, 0, 22, 0, 'FDC 664790'),
  c('Skittles Original fun size pouch (Halloween)', 'Skittles', 1, 'pouch', 15, 60, 0, 14, 0.5, 0, 11, 0, 'Mars fun size pouch nutrition sheet'),
  c('Swedish Fish, red', 'Mondelez', 16, 'pieces', 40, 140, 0, 35, 0, 0, 29, 15, 'FDC 1789998'),
  c('Nerds fun size box (Halloween)', 'Ferrara', 1, 'box', 12, 45, 0, 11, 0, 0, 11, 0, 'FDC 792521'),
  c('Laffy Taffy', 'Ferrara', 4, 'pieces', 39, 140, 0, 30, 2, 0, 19, 50, 'FDC 792549'),
  c('Airheads mini bars', 'Perfetti', 3, 'bars', 33, 140, 0, 30, 1.5, 0, 18, 15, 'FDC 933524'),
  c('Jolly Rancher hard candy', "Hershey's", 3, 'pieces', 18, 70, 0, 17, 0, 0, 11, 10, 'FDC 544271'),
  c('Smarties candy roll', 'Smarties', 1, 'roll', 7, 25, 0, 6, 0, 0, 6, 0, 'FDC 2638033'),
  c("Brach's candy corn (Halloween)", "Brach's", 19, 'pieces', 39, 140, 0, 35, 0, 0, 28, 70, "Brach's Classic Candy Corn label, UPC 011300640704"),
  c("Brach's mellowcreme pumpkins (candy pumpkin)", "Brach's", 4, 'pieces', 33, 120, 0, 30, 0, 0, 24, 75, 'FDC 2657694'),
  c('Milk Duds', "Hershey's", 13, 'pieces', 39, 170, 1, 27, 6, 0, 20, 105, 'FDC 1795624'),
  c('Whoppers malted milk balls', "Hershey's", 18, 'pieces', 41, 190, 1, 31, 7, 0, 24, 95, 'FDC 651206'),
  c('Junior Mints', 'Tootsie', 12, 'pieces', 30, 130, 0, 26, 2.5, 0, 25, 0, 'FDC 2590994'),
  c("Hershey's Kisses milk chocolate", "Hershey's", 7, 'pieces', 32, 160, 2, 19, 9, 1, 18, 25, 'FDC 2668372'),
  c('Dove Promises milk chocolate', 'Mars', 5, 'pieces', 40, 220, 2, 24, 13, 1, 23, 30, 'FDC 650978'),
  c('Lindt Lindor milk chocolate truffle', 'Lindt', 2, 'truffles', 24, 150, 1, 11, 11, 0, 10, 15, 'FDC 2559973'),
  c('Baby Ruth fun size bar (Halloween)', 'Ferrero', 2, 'bars', 37, 180, 2, 24, 8, 1, 19, 90, 'FDC 2571820'),
  c('PayDay bar', "Hershey's", 1, 'bar', 52, 240, 7, 27, 13, 2, 21, 120, 'FDC 1350785'),
  c('Whatchamacallit bar', "Hershey's", 1, 'bar', 45, 230, 3, 29, 12, 1, 21, 85, 'FDC 2590240'),
  c("Mr. Goodbar (Hershey's milk chocolate with peanuts)", "Hershey's", 3, 'blocks', 37, 190, 4, 20, 13, 1, 17, 40, 'FDC 2574347'),
  c('Krackel bar', "Hershey's", 3, 'blocks', 35, 170, 2, 23, 9, 1, 18, 35, 'FDC 1354363'),
  c('Rolo chewy caramels in milk chocolate', "Hershey's", 7, 'pieces', 42, 190, 2, 29, 9, 0, 26, 70, 'FDC 1350669'),
  c('Twizzlers Twists, strawberry', "Hershey's", 5, 'pieces', 38, 130, 1, 30, 0.5, 0, 16, 80, 'FDC 1354114')
];
