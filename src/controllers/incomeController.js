const db = require('../db');

exports.addIncome = async (req, res) => {
  const { amount, category_id, description, date } = req.body;

  try {
    await db.query(
      'INSERT INTO incomes (user_id, category_id, amount, description, income_date) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, category_id, amount, description, date]
    );
    return res.redirect('/dashboard');
  } catch (err) {
    console.error("Add Income Error:", err);
    return res.send("Error adding income.");
  }
};

exports.deleteIncome = async (req, res) => {
  const incomeId = req.params.id;

  try {
    await db.query(
      'DELETE FROM incomes WHERE income_id = $1 AND user_id = $2',
      [incomeId, req.user.userId]
    );
    return res.redirect('/dashboard');
  } catch (err) {
    console.error("Delete Income Error:", err);
    return res.send("Delete failed.");
  }
};

exports.getEditIncome = async (req, res) => {
  try {
    const incomeId = req.params.id;
    const userId = req.user.userId;

    const result = await db.query(
      'SELECT * FROM incomes WHERE income_id = $1 AND user_id = $2',
      [incomeId, userId]
    );
    const categories = await db.query('SELECT * FROM categories ORDER BY category_name');

    if (result.rows.length === 0) return res.redirect('/dashboard');

    return res.render('edit_income', { income: result.rows[0], categories: categories.rows });
  } catch (err) {
    console.error("Income fetch error:", err);
    return res.send("Could not fetch data.");
  }
};

exports.updateIncome = async (req, res) => {
  const { amount, category_id, description, date } = req.body;

  const incomeId = req.params.id;
  const userId = req.user.userId;

  try {
    await db.query(
      `UPDATE incomes
       SET amount = $1, category_id = $2, description = $3, income_date = $4
       WHERE income_id = $5 AND user_id = $6`,
      [amount, category_id, description, date, incomeId, userId]
    );
    return res.redirect('/dashboard');
  } catch (err) {
    console.error("Income update error:", err);
    return res.send("Update failed.");
  }
};
