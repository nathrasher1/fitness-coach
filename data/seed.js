/**
 * Seed common foods into the database.
 * Run: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Food = require('../server/models/Food');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fitness-coach';

const { allFoods: commonFoods } = require('./foods');

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  let added = 0;
  for (const f of commonFoods) {
    const exists = await Food.findOne({ name: f.name, user: null });
    if (!exists) {
      await Food.create({ ...f, user: null });
      added++;
    }
  }

  console.log(`Seeded ${added} new common foods (${commonFoods.length} total in list).`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
