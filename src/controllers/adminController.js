const db = require('../db');

exports.getAdminDashboard = async (req, res) => {
    try {
        const users = await db.query(`
            SELECT user_id, username, email, is_admin, is_active, created_at
            FROM users
            ORDER BY created_at DESC
        `);


        return res.render('admin_dashboard', {
            username: req.user.username,
            users: users.rows
        });
    } catch (err) {
        console.error('ADMIN DASHBOARD ERROR:', err);
        return res.status(500).send('Server error');
    }
};

exports.toggleActive = async (req, res) => {
    const targetId = parseInt(req.params.id, 10);

    if (targetId === req.user.userId) {
        return res.status(400).send('You cannot disable your own account.');
    }

    await db.query(
        `UPDATE users SET is_active = NOT is_active WHERE user_id = $1`,
        [targetId]
    );

    return res.redirect('/admin');
};


exports.getUserDetails = async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    try {
        const userQ = await db.query(
            `SELECT user_id, username, email, is_admin, created_at
       FROM users WHERE user_id = $1`,
            [userId]
        );

        if (userQ.rows.length === 0) {
            return res.status(404).send('User not found');
        }

        const expenses = await db.query(
            `SELECT e.expense_id, e.amount, e.description, e.expense_date, c.category_name
       FROM expenses e
       JOIN categories c ON c.category_id = e.category_id
       WHERE e.user_id = $1
       ORDER BY e.expense_date DESC
       LIMIT 20`,
            [userId]
        );

        const incomes = await db.query(
            `SELECT i.income_id, i.amount, i.description, i.income_date, c.category_name
       FROM incomes i
       JOIN categories c ON c.category_id = i.category_id
       WHERE i.user_id = $1
       ORDER BY i.income_date DESC
       LIMIT 20`,
            [userId]
        );

        return res.render('admin_user', {
            username: req.user.username,
            targetUser: userQ.rows[0],
            expenses: expenses.rows,
            incomes: incomes.rows
        });
    } catch (err) {
        console.error('ADMIN USER DETAILS ERROR:', err);
        return res.status(500).send('Server error');
    }
};

exports.toggleAdmin = async (req, res) => {
    const targetId = parseInt(req.params.id, 10);

    try {
        // Optional safety: prevent removing your own admin
        if (targetId === req.user.userId) {
            return res.status(400).send('You cannot change your own admin status.');
        }

        await db.query(
            `UPDATE users SET is_admin = NOT is_admin WHERE user_id = $1`,
            [targetId]
        );

        return res.redirect('/admin');
    } catch (err) {
        console.error('TOGGLE ADMIN ERROR:', err);
        return res.status(500).send('Server error');
    }
};

exports.deleteUser = async (req, res) => {
    const targetId = parseInt(req.params.id, 10);

    try {
        if (targetId === req.user.userId) {
            return res.status(400).send('You cannot delete your own account.');
        }

        // ON DELETE CASCADE olduğu için expenses/incomes/daily_summaries vs. temizlenir
        await db.query(`DELETE FROM users WHERE user_id = $1`, [targetId]);

        return res.redirect('/admin');
    } catch (err) {
        console.error('DELETE USER ERROR:', err);
        return res.status(500).send('Server error');
    }
};
