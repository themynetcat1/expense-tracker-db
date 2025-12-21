const db = require('../db');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

const { signToken, verifyToken } = require('../utils/jwt');

// GET - cookie varsa giriş yapmadan dashboard'a atar
exports.getHome = (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      verifyToken(token);
      return res.redirect('/dashboard');
    } catch (e) {
      res.clearCookie('token');
    }
  }
  return res.render('index', { error: null });
};



//Daha önce kayıt olan kullanıcılar için şifreleri bcrypt ile hashlemek üzere kontrol edilir
function looksLikeBcryptHash(value) {
  // bcrypt hashes typically start with $2a$, $2b$, or $2y$
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

// POST /register
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('index', { error: errors.array()[0].msg });
  }

  const { username, email, password } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
      [username, email, passwordHash]
    );

    //JWT işlemleri
    const token = signToken({ userId: result.rows[0].user_id, username: username });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.redirect('/dashboard');
  } catch (err) {
    console.error("REGISTER ERROR:", err);

    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('email')) {
        return res.render('index', { error: 'This email is already in use.' });
      }
      if (err.constraint && err.constraint.includes('username')) {
        return res.render('index', { error: 'This username is already taken.' });
      }
      return res.render('index', { error: 'Email or username is already in use.' });
    }

    return res.render('index', { error: 'Registration failed due to a server error.' });
  }
};

// POST /login (auto-migrate old plaintext passwords + issue JWT cookie)
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.render('index', { error: 'Invalid credentials.' });
    }

    const user = result.rows[0];

    // 1) If it's already a bcrypt hash, do normal compare
    if (looksLikeBcryptHash(user.password_hash)) {
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.render('index', { error: 'Invalid credentials.' });
      }
    } else {
      // 2) Legacy plaintext: check and migrate on first successful login
      const legacyOk = (user.password_hash === password);
      if (!legacyOk) {
        return res.render('index', { error: 'Invalid credentials.' });
      }

      // Migrate: hash and update DB
      const newHash = await bcrypt.hash(password, 12);
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE user_id = $2',
        [newHash, user.user_id]
      );
    }

    // 3) Issue JWT cookie
    const token = signToken({ userId: user.user_id, username: user.username });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.redirect('/dashboard');

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.render('index', { error: 'Server error.' });
  }
};


// GET /logout
exports.logout = (req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.redirect('/');
};
