// Who may connect with whom (search, profiles, Share Access, comments).
//   adult + adult          -> yes (the existing rules then apply)
//   teen  + linked parent  -> yes
//   anything else          -> no (teen + other adult, teen + teen, under-13 / locked,
//                             or anyone whose date of birth is not on file yet)
const User = require('../models/User');
const ParentLink = require('../models/ParentLink');
const { userGroup } = require('./age');

const same = (a, b) => String(a) === String(b);

async function groupsOf(ids, today) {
  const users = await User.find({ _id: { $in: ids } }).select('+dob accountLocked').lean();
  const m = new Map(users.map((u) => [String(u._id), userGroup(u, today)]));
  return ids.map((id) => m.get(String(id)) || null);
}
async function groupOf(id, today) {
  return (await groupsOf([id], today))[0];
}
async function isLinked(parentId, teenId) {
  return !!(await ParentLink.exists({ parent: parentId, teen: teenId, status: 'active', valid: true }));
}
// Linked either way round (the caller does not know which side is the teen).
async function linkedPair(a, b) {
  return !!(await ParentLink.exists({ status: 'active', valid: true, $or: [{ parent: a, teen: b }, { parent: b, teen: a }] }));
}

async function canConnect(a, b, today) {
  if (!a || !b) return false;
  if (same(a, b)) return true;
  const [ga, gb] = await groupsOf([a, b], today);
  if (ga === 'adult' && gb === 'adult') return true;
  if (ga === 'teen' && gb === 'adult') return isLinked(b, a);
  if (ga === 'adult' && gb === 'teen') return isLinked(a, b);
  return false;
}

// Active links for a user, dropping any whose teen has turned 18 (adults can't be parent-linked).
async function activeLinks(userId, today) {
  const rows = await ParentLink.find({ status: 'active', valid: true, $or: [{ parent: userId }, { teen: userId }] }).lean();
  if (!rows.length) return rows;
  const teens = await groupsOf(rows.map((r) => r.teen), today);
  const stale = rows.filter((r, i) => teens[i] !== 'teen');
  if (stale.length) await ParentLink.deleteMany({ _id: { $in: stale.map((r) => r._id) } });
  return rows.filter((r, i) => teens[i] === 'teen');
}

module.exports = { groupsOf, groupOf, isLinked, linkedPair, canConnect, activeLinks, MAX_PARENTS: 2 };
