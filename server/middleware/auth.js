function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

function optionalAuth(req, res, next) {
  // just continues; session may or may not exist
  next();
}

module.exports = { requireAuth, optionalAuth };
