// After sign-in every account needs a date of birth and an email on file.
// Until then (or while an account is locked) only /api/auth/* and /api/account/*
// work; everything else answers 403 with a code the client turns into a prompt.
const User = require('../models/User');
const { LOCKED_MESSAGE } = require('../services/age');

function accountState(user) {
  const locked = !!(user && user.accountLocked);
  const needs = locked || !user ? [] : [!user.dob && 'dob', !user.email && 'email'].filter(Boolean);
  return { locked, needs };
}

async function accountGate(req, res, next) {
  try {
    const id = req.session && req.session.userId;
    if (!id || req.session.acctOk === true) return next();
    const user = await User.findById(id).select('+dob +email accountLocked');
    if (!user) return next();
    const st = accountState(user);
    if (st.locked) return res.status(403).json({ error: LOCKED_MESSAGE, code: 'account_locked' });
    if (st.needs.length) return res.status(403).json({ error: 'Please finish setting up your account first', code: 'account_incomplete', needs: st.needs });
    req.session.acctOk = true;
    next();
  } catch (err) { next(err); }
}

module.exports = { accountGate, accountState };
