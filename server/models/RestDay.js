const mongoose = require('mongoose');

// A day the user chose to rest ("Take a rest day"). Date is the local 'YYYY-MM-DD'.
const restDaySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
restDaySchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('RestDay', restDaySchema);
