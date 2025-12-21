const { verifyToken } = require('../utils/jwt');

module.exports = function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/');

  try {
    const payload = verifyToken(token);
    req.user = payload; // { userId, username, iat, exp }
    return next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/');
  }
};
