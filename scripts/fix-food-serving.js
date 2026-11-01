// One-off, reversible fix for a food whose serving was stored wrong (e.g. a barcode import
// that saved label per-serving values as "per 100 g").
// Dry run by default. Backs up the food and every log that points at it before writing.
//   MONGODB_URI=... node scripts/fix-food-serving.js <foodId> '{"servingSize":1,"servingUnit":"tbsp","mlPerServing":15,"gramsPerServing":null}' [--apply]
//   MONGODB_URI=... node scripts/fix-food-serving.js --restore backups/food-<id>-<time>.json
// Log entries are NOT changed: they keep the calories the user saw (servings x the per-serving
// values, which this fix leaves as they are). Only the serving description of the food changes.
const fs = require('fs');
const mongoose = require('mongoose');
const Food = require('../server/models/Food');
const FoodLog = require('../server/models/FoodLog');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const args = process.argv.slice(2);
  if (args[0] === '--restore') {
    const b = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    await Food.collection.replaceOne({ _id: new mongoose.Types.ObjectId(b.food._id) }, { ...b.food, _id: new mongoose.Types.ObjectId(b.food._id) });
    console.log('Restored food', b.food._id);
    return mongoose.disconnect();
  }
  const [id, json, flag] = args;
  const change = JSON.parse(json);
  const allowed = ['servingSize', 'servingUnit', 'gramsPerServing', 'mlPerServing', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];
  Object.keys(change).forEach((k) => { if (!allowed.includes(k)) throw new Error('Field not allowed: ' + k); });
  const food = await Food.findById(id).lean();
  if (!food) throw new Error('Food not found');
  const logs = await FoodLog.find({ food: food._id }, { date: 1, servings: 1, amount: 1, amountUnit: 1, calories: 1 }).lean();
  console.log('Food before:', { name: food.name, servingSize: food.servingSize, servingUnit: food.servingUnit, calories: food.calories });
  console.log('Change:', change, '\nLogs pointing at it (unchanged):', logs.length);
  if (flag !== '--apply') { console.log('Dry run. Add --apply to write.'); return mongoose.disconnect(); }
  fs.mkdirSync('backups', { recursive: true });
  const file = `backups/food-${id}-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify({ food, logs }, null, 2));
  await Food.updateOne({ _id: food._id }, { $set: change });
  console.log('Backed up to', file, 'and updated. Undo with --restore', file);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
