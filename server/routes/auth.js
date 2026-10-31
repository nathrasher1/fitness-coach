const crypto = require('crypto');
const express = require('express');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Profile = require('../models/Profile');
const Share = require('../models/Share');
const ParentLink = require('../models/ParentLink');
const PasswordReset = require('../models/PasswordReset');
const { requireAuth } = require('../middleware/auth');
const { accountState } = require('../middleware/account');
const { localToday } = require('../services/dates');
const A = require('../services/age');
const { rateLimit } = require('../services/social');
const { sendMail } = require('../services/mailer');
const { revokeUserSessions } = require('../services/sessions');
const { APP_ORIGIN } = require('../middleware/cors');

const router = express.Router();
const MIN_PASSWORD = 8;
const RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const AGE_COOKIE = 'fc_age_gate';
const FORGOT_MESSAGE = "If that matches an account, we've sent a link to reset the password to its email address. The link works once, for 1 hour.";

const registerLimit = rateLimit({ name: 'register', windowMs: 60 * 60_000, max: 30 });
const forgotLimit = rateLimit({ name: 'forgot', windowMs: 15 * 60_000, max: 5 });
const resetLimit = rateLimit({ name: 'reset', windowMs: 15 * 60_000, max: 10 });
const completeLimit = rateLimit({ name: 'complete', windowMs: 15 * 60_000, max: 20 });

function cleanEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
async function emailTaken(email, exceptId) {
  const q = { email };
  if (exceptId) q._id = { $ne: exceptId };
  return !!(await User.exists(q));
}
function hasAgeCookie(req) {
  return String(req.headers.cookie || '').split(';').some((c) => c.trim().startsWith(AGE_COOKIE + '='));
}
function setAgeCookie(res) {
  res.cookie(AGE_COOKIE, '1', { maxAge: 24 * 3600 * 1000, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth' });
}
const under13 = (res) => res.status(403).json({ error: A.UNDER_13_MESSAGE, code: 'under_13' });

// The signed-in user's own view. Email and date of birth appear only here.
function selfView(user, today) {
  const group = A.userGroup(user, today);
  const st = accountState(user);
  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    role: user.role || 'user',
    email: user.email || '',
    dob: user.dob || '',
    sex: user.sex,
    birthYear: user.birthYear,
    heightCm: user.heightCm,
    avatar: user.avatar || '',
    ageGroup: group,
    needs: st.needs,
    locked: st.locked,
    limits: group === 'teen' ? { search: false, publicProfile: false, shareWith: 'linked parents only', comments: 'linked parents only' } : null
  };
}
async function loadSelf(id) {
  return User.findById(id).select('+email +dob -passwordHash');
}
function signIn(req, user) {
  req.session.userId = user._id.toString();
  req.session.username = user.username;
  req.session.acctOk = false;
}

// Teen accounts: hidden from search, and Share Access only with linked parents.
async function applyTeenLimits(userId) {
  await Profile.updateOne({ user: userId }, { $set: { discoverable: false, updatedAt: new Date() } });
  const links = await ParentLink.find({ teen: userId, status: 'active', valid: true }).select('parent').lean();
  const parents = links.map((l) => l.parent);
  await Share.deleteMany({ $or: [{ owner: userId, viewer: { $nin: parents } }, { viewer: userId, owner: { $nin: parents } }] });
}
// Under-13 discovered after sign-up: lock the account and disconnect it from everyone.
async function lockUnder13(user) {
  user.accountLocked = 'under13';
  user.dob = undefined;
  user.birthYear = undefined;
  await user.save();
  await Profile.updateOne({ user: user._id }, { $set: { discoverable: false, bio: '', updatedAt: new Date() } });
  await Share.deleteMany({ $or: [{ owner: user._id }, { viewer: user._id }] });
  await ParentLink.deleteMany({ $or: [{ parent: user._id }, { teen: user._id }, { requestedBy: user._id }] });
}

// POST /api/auth/register { username, password, displayName?, email, dob }
router.post('/register', registerLimit, async (req, res) => {
  try {
    const b = req.body || {};
    const username = typeof b.username === 'string' ? b.username.trim() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    const today = localToday(req);
    if (hasAgeCookie(req)) return under13(res);
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (username.length < 3 || username.length > 40) return res.status(400).json({ error: 'Username must be 3-40 characters' });
    if (password.length < MIN_PASSWORD || password.length > 200) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
    const dob = String(b.dob || '');
    if (!dob) return res.status(400).json({ error: 'Date of birth is required' });
    if (!A.validDob(dob, today)) return res.status(400).json({ error: 'Enter a valid date of birth' });
    // Under 13: refuse before anything is looked up or stored.
    if (A.ageOn(dob, today) < A.MIN_AGE) { setAgeCookie(res); return under13(res); }
    const email = cleanEmail(b.email);
    if (!b.email) return res.status(400).json({ error: 'Email is required' });
    if (!email) return res.status(400).json({ error: 'Enter a valid email address' });

    if (await User.usernameTaken(username)) return res.status(409).json({ error: 'Username already taken' });
    if (await emailTaken(email)) return res.status(409).json({ error: 'That email is already used by another account' });

    const user = await User.create({
      username,
      passwordHash: await User.hashPassword(password),
      displayName: (typeof b.displayName === 'string' && b.displayName.trim().slice(0, 60)) || username,
      email,
      dob,
      birthYear: Number(dob.slice(0, 4))
    });
    await Settings.create({ user: user._id });
    signIn(req, user);
    req.session.acctOk = true;
    res.status(201).json({ user: selfView(await loadSelf(user._id), today) });
  } catch (err) {
    console.error('Register error:', err && err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    // Case-insensitive: try the exact-case account first, then any others
    // that differ only by case (older data may contain such duplicates).
    let user = null;
    for (const candidate of await User.findUsernameCandidates(username)) {
      if (await candidate.verifyPassword(String(password))) { user = candidate; break; }
    }
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    signIn(req, user);
    res.json({ user: selfView(await loadSelf(user._id), localToday(req)) });
  } catch (err) {
    console.error('Login error:', err && err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await loadSelf(req.session.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ user: selfView(user, localToday(req)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// POST /api/auth/complete { dob?, email? } – one-time details for accounts made before they were required.
// A date of birth that is already on file can't be changed here (or anywhere by the user).
router.post('/complete', requireAuth, completeLimit, async (req, res) => {
  try {
    const today = localToday(req);
    const user = await User.findById(req.session.userId).select('+email +dob');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.accountLocked) return res.status(403).json({ error: A.LOCKED_MESSAGE, code: 'account_locked' });
    const b = req.body || {};
    let email = null;
    if (!user.email) {
      email = cleanEmail(b.email);
      if (!b.email) return res.status(400).json({ error: 'Email is required' });
      if (!email) return res.status(400).json({ error: 'Enter a valid email address' });
      if (await emailTaken(email, user._id)) return res.status(409).json({ error: 'That email is already used by another account' });
    }
    let teen = false;
    if (!user.dob) {
      const dob = String(b.dob || '');
      if (!dob) return res.status(400).json({ error: 'Date of birth is required' });
      if (!A.validDob(dob, today)) return res.status(400).json({ error: 'Enter a valid date of birth' });
      if (A.ageOn(dob, today) < A.MIN_AGE) {
        await lockUnder13(user);
        req.session.acctOk = false;
        return res.status(403).json({ error: A.LOCKED_MESSAGE, code: 'account_locked', user: selfView(await loadSelf(user._id), today) });
      }
      user.dob = dob;
      user.birthYear = Number(dob.slice(0, 4));
      teen = A.groupFor(dob, today) === 'teen';
    }
    if (email) user.email = email;
    await user.save();
    if (teen) await applyTeenLimits(user._id);
    const fresh = await loadSelf(user._id);
    req.session.acctOk = accountState(fresh).needs.length === 0;
    res.json({ user: selfView(fresh, today) });
  } catch (err) {
    console.error('Complete error:', err && err.message);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ---------- Password reset ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const perAccount = new Map(); // userId -> [timestamps] (max 3 emails an hour per account)
function accountAllowed(id) {
  const now = Date.now();
  const arr = (perAccount.get(id) || []).filter((t) => now - t < 3600_000);
  if (arr.length >= 3) { perAccount.set(id, arr); return false; }
  arr.push(now); perAccount.set(id, arr);
  if (perAccount.size > 5000) for (const [k, v] of perAccount) if (!v.some((t) => now - t < 3600_000)) perAccount.delete(k);
  return true;
}
function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') return APP_ORIGIN;
  return `http://localhost:${process.env.PORT || 3000}`;
}

async function processForgot(identifier) {
  const q = String(identifier || '').trim();
  if (!q || q.length > 254) return;
  let user = null;
  if (q.includes('@')) {
    const email = cleanEmail(q);
    if (email) user = await User.findOne({ email }).select('+email accountLocked');
  } else {
    const cands = await User.findUsernameCandidates(q);
    if (cands[0]) user = await User.findById(cands[0]._id).select('+email accountLocked');
  }
  if (!user || !user.email || user.accountLocked) return;
  if (!accountAllowed(String(user._id))) return;
  const token = crypto.randomBytes(32).toString('base64url');
  await PasswordReset.deleteMany({ user: user._id });
  await PasswordReset.create({ user: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
  // The token is in the URL fragment, so it is never sent to the server in a page request or a Referer.
  const link = `${appUrl()}/reset#token=${token}`;
  await sendMail({
    kind: 'password reset',
    to: user.email,
    subject: 'Reset your Fitness Coach password',
    text: `Hi ${user.displayName || user.username},\n\nSomeone (hopefully you) asked to reset the password for your Fitness Coach account "${user.username}".\n\nReset it here (the link works once, for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email. Your password won't change.\n`,
    html: `<p>Hi ${escapeHtml(user.displayName || user.username)},</p><p>Someone (hopefully you) asked to reset the password for your Fitness Coach account <strong>${escapeHtml(user.username)}</strong>.</p><p><a href="${link}">Reset your password</a> (works once, for 1 hour)</p><p>If you didn't ask for this, you can ignore this email. Your password won't change.</p>`
  });
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// POST /api/auth/forgot { identifier } – same answer whether or not an account matches.
// The lookup and email happen after the response, so timing doesn't reveal it either.
router.post('/forgot', forgotLimit, (req, res) => {
  const identifier = req.body && typeof req.body.identifier === 'string' ? req.body.identifier : '';
  res.json({ ok: true, message: FORGOT_MESSAGE });
  setImmediate(() => { processForgot(identifier).catch((err) => console.warn('[forgot] failed:', err && err.name)); });
});
router.forgotDone = processForgot; // for tests

// POST /api/auth/reset { token, password }
router.post('/reset', resetLimit, async (req, res) => {
  try {
    const token = req.body && typeof req.body.token === 'string' ? req.body.token : '';
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < MIN_PASSWORD || password.length > 200) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
    const bad = () => res.status(400).json({ error: 'This reset link is invalid or has expired. Ask for a new one.', code: 'invalid_token' });
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return bad();
    // Atomic delete = single use, even with two requests at once.
    const row = await PasswordReset.findOneAndDelete({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
    if (!row) return bad();
    const user = await User.findById(row.user);
    if (!user || user.accountLocked) return bad();
    user.passwordHash = await User.hashPassword(password);
    user.passwordChangedAt = new Date();
    await user.save();
    await PasswordReset.deleteMany({ user: user._id });
    // Sign out everywhere (all devices), including this browser if it was signed in.
    await revokeUserSessions(user._id);
    if (req.session && String(req.session.userId) === String(user._id)) {
      return req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ ok: true, message: 'Password updated. Log in with your new password.' }); });
    }
    res.json({ ok: true, message: 'Password updated. Log in with your new password.' });
  } catch (err) {
    console.error('Reset error:', err && err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.applyTeenLimits = applyTeenLimits;
module.exports = router;
