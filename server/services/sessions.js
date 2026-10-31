// Sign a user out everywhere by removing their sessions from the session store
// (connect-mongo's "sessions" collection). Works whether sessions are stored as
// JSON strings (the default) or as objects.
const mongoose = require('mongoose');

async function revokeUserSessions(userId, collection = 'sessions') {
  const id = String(userId);
  if (!/^[a-f0-9]{24}$/i.test(id)) return 0;
  if (mongoose.connection.readyState !== 1) return 0;
  const col = mongoose.connection.collection(collection);
  const r = await col.deleteMany({ $or: [{ session: { $regex: `"userId":"${id}"` } }, { 'session.userId': id }] });
  return r.deletedCount || 0;
}

module.exports = { revokeUserSessions };
