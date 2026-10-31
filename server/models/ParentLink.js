const mongoose = require('mongoose');

// A parent <-> teen link. Requests to usernames that are not eligible are kept
// as `valid: false` rows so the sender sees the same "pending" state either way
// (an adult cannot use requests to find out which usernames are teen accounts).
const parentLinkSchema = new mongoose.Schema({
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  teen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetName: { type: String, default: '' }, // what the requester typed (for their own list)
  status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  valid: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date }
});
parentLinkSchema.index({ parent: 1, teen: 1 });

module.exports = mongoose.model('ParentLink', parentLinkSchema);
