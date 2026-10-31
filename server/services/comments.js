// Who may read/write comments on an owner's workout or diary day.
const Share = require('../models/Share');
const Comment = require('../models/Comment');
const WorkoutLog = require('../models/WorkoutLog');
const S = require('./social');

const anyPerm = (p) => !!p && S.PERM_KEYS.some((k) => p[k]);
const permOk = (perms, kind) => (kind === 'workout' ? !!(perms && perms.workouts) : anyPerm(perms));

// Returns true if `userId` may read and write on owner's target ({kind:'workout'|'day'}).
async function canAccess(userId, ownerId, kind) {
  if (S.same(userId, ownerId)) return true;
  if (await S.isBlockedEither(userId, ownerId)) return false;
  const share = await S.shareFrom(ownerId, userId);
  return !!share && permOk(share.permissions, kind);
}
// Authors whose comments are currently visible on owner's `kind` threads to `viewerId`:
// the owner plus people who still have the relevant share, minus anyone blocked with viewer or owner.
async function visibleAuthors(ownerId, kind, viewerId) {
  const shares = await Share.find({ owner: ownerId }).select('viewer permissions').lean();
  const ok = new Set([String(ownerId), ...shares.filter((s) => permOk(s.permissions, kind)).map((s) => String(s.viewer))]);
  const hide = new Set([...(await S.blockedIds(viewerId)), ...(await S.blockedIds(ownerId))]);
  return [...ok].filter((id) => !hide.has(id) || id === String(ownerId) || id === String(viewerId));
}
async function workoutOf(ownerId, workoutId) {
  if (!/^[a-f0-9]{24}$/i.test(String(workoutId || ''))) return null;
  return WorkoutLog.findOne({ _id: workoutId, user: ownerId }).select('_id name date').lean();
}
// Visible comment counts per workout id for the given owner.
async function countsFor(ownerId, workoutIds, viewerId) {
  if (!workoutIds.length) return {};
  const authors = (await visibleAuthors(ownerId, 'workout', viewerId)).map(S.oid);
  const rows = await Comment.aggregate([
    { $match: { owner: S.oid(ownerId), workout: { $in: workoutIds.map(S.oid) }, author: { $in: authors } } },
    { $group: { _id: '$workout', n: { $sum: 1 } } }
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
}

module.exports = { canAccess, visibleAuthors, workoutOf, countsFor, anyPerm };
