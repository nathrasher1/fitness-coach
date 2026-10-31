// Relationship and privacy helpers shared by social, shared-data and comment routes.
const mongoose = require('mongoose');
const User = require('../models/User');
const Share = require('../models/Share');
const Block = require('../models/Block');
const Profile = require('../models/Profile');

const PERM_KEYS = ['weight', 'food', 'workouts', 'body', 'goals'];
const AVATAR_RE = /^(#[0-9a-f]{6}|data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)$/i;

function safeAvatar(a) {
  const s = String(a || '');
  return AVATAR_RE.test(s) ? s : '';
}
const oid = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));
const same = (a, b) => String(a) === String(b);

async function isBlockedEither(a, b) {
  if (!a || !b) return false;
  return !!(await Block.exists({ $or: [{ blocker: a, blocked: b }, { blocker: b, blocked: a }] }));
}
// Ids of everyone in a block relation with userId (either direction).
async function blockedIds(userId) {
  const rows = await Block.find({ $or: [{ blocker: userId }, { blocked: userId }] }).select('blocker blocked').lean();
  return rows.map((r) => (same(r.blocker, userId) ? String(r.blocked) : String(r.blocker)));
}
async function shareFrom(owner, viewer) {
  return Share.findOne({ owner, viewer }).lean();
}
async function hasShareEither(a, b) {
  return !!(await Share.exists({ $or: [{ owner: a, viewer: b }, { owner: b, viewer: a }] }));
}
async function getProfile(userId) {
  return (await Profile.findOne({ user: userId }).lean()) || { bio: '', discoverable: false, visibility: {}, commentsSeenAt: new Date(0) };
}
// Can `viewer` open `owner`'s profile? Self always; otherwise not blocked AND
// (owner is discoverable OR they already share in either direction).
async function canViewProfile(viewer, owner, prof) {
  if (same(viewer, owner)) return true;
  if (await isBlockedEither(viewer, owner)) return false;
  const p = prof || (await getProfile(owner));
  if (p.discoverable) return true;
  return hasShareEither(viewer, owner);
}
async function findUserByUsername(name) {
  const n = String(name || '').trim();
  if (!n || n.length > 40) return null;
  const m = await User.findUsernameCandidates(n);
  return m[0] || null;
}
// Minimal identity: never email, never body/weight data.
function personCard(user, prof) {
  const vis = (prof && prof.visibility) || {};
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: vis.avatar ? safeAvatar(user.avatar) : ''
  };
}

// Small in-memory sliding-window rate limiter (single instance app).
function rateLimit({ windowMs, max, name }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${name}:${req.session?.userId || req.ip}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - arr[0])) / 1000)));
      return res.status(429).json({ error: 'Too many requests, slow down a little.' });
    }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
    next();
  };
}

module.exports = { PERM_KEYS, safeAvatar, oid, same, isBlockedEither, blockedIds, shareFrom, hasShareEither, getProfile, canViewProfile, findUserByUsername, personCard, rateLimit };
