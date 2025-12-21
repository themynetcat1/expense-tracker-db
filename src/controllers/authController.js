const db = require('../db');

// GET /
exports.getHome = (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('index', { error: null });
};

// POST /register
exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
      [username, email, password]
    );

    req.session.userId = result.rows[0].user_id;
    req.session.username = username;

    return res.redirect('/dashboard');
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.render('index', { error: 'Registration failed (Email/Username might be taken).' });
  }
};

// POST /login
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      if (user.password_hash === password) {
        req.session.userId = user.user_id;
        req.session.username = user.username;
        return res.redirect('/dashboard');
      }
    }

    return res.render('index', { error: 'Invalid credentials.' });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.render('index', { error: 'Server error.' });
  }
};

// GET /logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};
