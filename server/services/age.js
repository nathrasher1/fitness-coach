// Age rules. Ages are always computed on the server from the private date of
// birth and the user's local calendar day (services/dates.localToday).
const { isDateKey } = require('./dates');

const MIN_AGE = 13;
const ADULT_AGE = 18;

// Whole years between dob and today (both 'YYYY-MM-DD'). A Feb 29 birthday
// counts from Mar 1 in non-leap years.
function ageOn(dob, today) {
  if (!isDateKey(dob) || !isDateKey(today)) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

// 'child' (<13), 'teen' (13-17), 'adult' (18+), or null when unknown.
function groupFor(dob, today) {
  const a = ageOn(dob, today);
  if (a == null) return null;
  if (a < MIN_AGE) return 'child';
  if (a < ADULT_AGE) return 'teen';
  return 'adult';
}

// A plausible birth date: a real calendar day, not in the future, not before 1900.
function validDob(dob, today) {
  if (!isDateKey(dob)) return false;
  if (dob < '1900-01-01') return false;
  return dob <= today;
}

// Latest date of birth that is `years` old today (string compare works on keys).
function cutoffFor(today, years) {
  const [y, m, d] = today.split('-');
  return `${String(Number(y) - years).padStart(4, '0')}-${m}-${d}`;
}

// The group for a user document that was loaded with +dob.
function userGroup(user, today) {
  if (!user) return null;
  if (user.accountLocked) return 'child';
  return groupFor(user.dob, today);
}

const UNDER_13_MESSAGE = "Thanks for your interest! Fitness Coach is for people 13 and older, so we can't create an account for you right now. Nothing you entered has been saved.";
const LOCKED_MESSAGE = 'Fitness Coach is for people 13 and older, so this account has been locked. You can sign out or delete the account and its data.';

module.exports = { MIN_AGE, ADULT_AGE, ageOn, groupFor, validDob, cutoffFor, userGroup, UNDER_13_MESSAGE, LOCKED_MESSAGE };
