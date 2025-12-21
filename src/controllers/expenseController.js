const db = require('../db');

exports.addExpense = async (req, res) => {
  const { amount, category_id, description, date } = req.body;

  try {
    await db.query(
      'INSERT INTO expenses (user_id, category_id, amount, description, expense_date) VALUES ($1, $2, $3, $4, $5)',
      [req.session.userId, category_id, amount, description, date]
    );
    return res.redirect('/dashboard');
  } catch (err) {
    console.error("Add Expense Error:", err);
    return res.send("Error adding expense.");
  }
};

exports.deleteExpense = async (req, res) => {
  const expenseId = req.params.id;

  try {
    await db.query(
      'DELETE FROM expenses WHERE expense_id = $1 AND user_id = $2',
      [expenseId, req.session.userId]
    );
    return res.redirect('/dashboard');
  } catch (err) {
    console.error("Delete Expense Error:", err);
    return res.send("Delete failed.");
  }
};

exports.getEditExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.session.userId;

    const result = await db.query(
      'SELECT * FROM expenses WHERE expense_id = $1 AND user_id = $2',
      [expenseId, userId]
    );
    const categories = await db.query('SELECT * FROM categories ORDER BY category_name');

    if (result.rows.length === 0) return res.redirect('/dashboard');

    return res.render('edit_expense', { expense: result.rows[0], categories: categories.rows });
  } catch (err) {
    console.error("Edit Expense Fetch Error:", err);
    return res.send("Could not fetch data.");
  }
};

exports.updateExpense = async (req, res) => {
  const {
    amount, category_id, description, date,
    is_subscription, sub_cycle,
    is_installment, total_installments, current_installment
  } = req.body;

  const expenseId = req.params.id;
  const userId = req.session.userId;

  try {
    await db.query(
      `UPDATE expenses
       SET amount = $1, category_id = $2, description = $3, expense_date = $4
       WHERE expense_id = $5 AND user_id = $6`,
      [amount, category_id, description, date, expenseId, userId]
    );

    // Keep existing behavior (creates subscription/installment when true)
    if (is_subscription === 'true') {
      let nextDate = new Date(date);
      if (sub_cycle === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
      if (sub_cycle === 'YEARLY') nextDate.setFullYear(nextDate.getFullYear() + 1);

      await db.query(
        `INSERT INTO subscriptions (user_id, expense_id, name, amount, cycle, next_payment_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, expenseId, description, amount, sub_cycle, nextDate]
      );
      console.log("✅ New subscription created.");
    }

    if (is_installment === 'true') {
      const total = parseInt(total_installments);
      const current = parseInt(current_installment);
      const remaining = total - current;
      const totalDebt = parseFloat(amount) * total;

      await db.query(
        `INSERT INTO installments (user_id, expense_id, product_name, total_amount, monthly_amount, total_installments, remaining_installments)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, expenseId, description, totalDebt, amount, total, remaining]
      );
      console.log("✅ New installment plan created.");
    }

    return res.redirect('/dashboard');
  } catch (err) {
    console.error("Update Expense Error:", err);
    return res.send("Error during update: " + err.message);
  }
};
