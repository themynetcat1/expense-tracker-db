const { verifyToken } = require('../utils/jwt');
const db = require('../db');

module.exports = async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/');

  try {
    const payload = verifyToken(token); // { userId, ... }

    const q = await db.query(
        'SELECT user_id, username, is_admin, is_active FROM users WHERE user_id = $1',
        [payload.userId]
    );

    if (q.rows.length === 0) {
      res.clearCookie('token', { path: '/' });
      return res.redirect('/');
    }

    const user = q.rows[0];
    if (!user.is_active) {
      res.clearCookie('token', { path: '/' });
      return res.redirect('/');
    }

    req.user = {
      userId: user.user_id,
      username: user.username,
      isAdmin: user.is_admin === true
    };

    return next();
  } catch (err) {
    res.clearCookie('token', { path: '/' });
    return res.redirect('/');
  }
};
