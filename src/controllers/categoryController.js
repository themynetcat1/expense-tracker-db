const db = require('../db');

exports.addCategory = async (req, res) => {
  const { category_name, category_type } = req.body;

  try {
    await db.query(
      'INSERT INTO categories (category_name, category_type) VALUES ($1, $2)',
      [category_name, category_type]
    );
    return res.redirect('/dashboard');
  } catch (err) {
    console.error("Add Category Error:", err);
    return res.send("Error adding category.");
  }
};
