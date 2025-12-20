const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Settings
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session Management
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: true
}));

// --- FUNCTION: Login Check ---
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    next();
};

// --- ROUTES ---

// 1. Home Page (Login)
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('index', { error: null });
});

// 2. Dashboard
app.get('/dashboard', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    try {
        // --- A. LISTS AND TABLES ---
        const categories = await db.query('SELECT * FROM categories ORDER BY category_name');
        
        const expenses = await db.query(`
            SELECT e.*, c.category_name 
            FROM expenses e JOIN categories c ON e.category_id = c.category_id 
            WHERE e.user_id = $1 ORDER BY expense_date DESC, created_at DESC LIMIT 5`, [userId]);

        const incomes = await db.query(`
            SELECT i.*, c.category_name 
            FROM incomes i JOIN categories c ON i.category_id = c.category_id 
            WHERE i.user_id = $1 ORDER BY income_date DESC, created_at DESC LIMIT 5`, [userId]);

        const summary = await db.query(`
            SELECT total_income, total_expense FROM daily_summaries 
            WHERE user_id = $1 AND date = CURRENT_DATE`, [userId]);
        const dailyStats = summary.rows[0] || { total_income: 0, total_expense: 0 };

        // --- B. CHART DATA ---

        // 1. Pie Chart
        const pieQuery = await db.query(`
            SELECT c.category_name, SUM(e.amount) as total
            FROM expenses e
            JOIN categories c ON e.category_id = c.category_id
            WHERE e.user_id = $1
            GROUP BY c.category_name`, [userId]);

        // 2. Line Chart (Balance Flow)
        const lineQuery = await db.query(`
            SELECT 
                to_char(date_column, 'YYYY-MM-DD') as day, 
                SUM(inc) - SUM(exp) as daily_net_change
            FROM (
                SELECT income_date as date_column, amount as inc, 0 as exp FROM incomes WHERE user_id = $1
                UNION ALL
                SELECT expense_date as date_column, 0 as inc, amount as exp FROM expenses WHERE user_id = $1
            ) as combined
            WHERE date_column >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY date_column
            ORDER BY date_column ASC`, [userId]);

        let currentBalance = 0;
        const balanceData = lineQuery.rows.map(r => {
            currentBalance += parseFloat(r.daily_net_change);
            return currentBalance;
        });

        // 3. Bar Chart
        const barQuery = await db.query(`
            SELECT 
                (SELECT COALESCE(SUM(amount),0) FROM incomes WHERE user_id=$1 AND EXTRACT(MONTH FROM income_date) = EXTRACT(MONTH FROM CURRENT_DATE)) as income,
                (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id=$1 AND EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)) as expense
        `, [userId]);

        // 4. Sankey Data
        const incomeFlowQuery = await db.query(`
            SELECT c.category_name, SUM(i.amount) as total
            FROM incomes i
            JOIN categories c ON i.category_id = c.category_id
            WHERE i.user_id = $1
            GROUP BY c.category_name`, [userId]);

        const expenseFlowQuery = await db.query(`
            SELECT c.category_name, SUM(e.amount) as total
            FROM expenses e
            JOIN categories c ON e.category_id = c.category_id
            WHERE e.user_id = $1
            GROUP BY c.category_name`, [userId]);

        let sankeyData = [];

        incomeFlowQuery.rows.forEach(r => {
            sankeyData.push({ 
                from: r.category_name, 
                to: 'Wallet 💰', 
                flow: parseFloat(r.total) 
            });
        });

        expenseFlowQuery.rows.forEach(r => {
            sankeyData.push({ 
                from: 'Wallet 💰', 
                to: r.category_name, 
                flow: parseFloat(r.total) 
            });
        });

        const chartData = {
            pieLabels: pieQuery.rows.map(r => r.category_name),
            pieValues: pieQuery.rows.map(r => parseFloat(r.total)),
            
            lineLabels: lineQuery.rows.map(r => r.day),
            lineValues: balanceData,
            
            barIncome: parseFloat(barQuery.rows[0].income),
            barExpense: parseFloat(barQuery.rows[0].expense),
            
            sankey: typeof sankeyData !== 'undefined' ? sankeyData : [] 
        };

        res.render('dashboard', {
            username: req.session.username,
            categories: categories.rows,
            expenses: expenses.rows,
            incomes: incomes.rows,
            stats: dailyStats,
            chartData: chartData
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.send("An error occurred: " + err.message);
    }
});

// 3. Add Expense
app.post('/add-expense', requireLogin, async (req, res) => {
    const { amount, category_id, description, date } = req.body;
    try {
        await db.query(
            'INSERT INTO expenses (user_id, category_id, amount, description, expense_date) VALUES ($1, $2, $3, $4, $5)',
            [req.session.userId, category_id, amount, description, date]
        );
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.send("Error adding expense.");
    }
});

// 4. Add Income
app.post('/add-income', requireLogin, async (req, res) => {
    const { amount, category_id, description, date } = req.body;
    try {
        await db.query(
            'INSERT INTO incomes (user_id, category_id, amount, description, income_date) VALUES ($1, $2, $3, $4, $5)',
            [req.session.userId, category_id, amount, description, date]
        );
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.send("Error adding income.");
    }
});

// 5. Register and Login
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
            [username, email, password]
        );
        req.session.userId = result.rows[0].user_id;
        req.session.username = username;
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.render('index', { error: 'Registration failed (Email/Username might be taken).' });
    }
});

app.post('/login', async (req, res) => {
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
        res.render('index', { error: 'Invalid credentials.' });
    } catch (err) {
        res.render('index', { error: 'Server error.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- REPORTS ROUTE ---
app.get('/reports', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const selectedYear = parseInt(req.query.year) || currentYear;
    const selectedMonth = parseInt(req.query.month) || currentMonth;

    try {
        const result = await db.query(
            `CALL get_monthly_report($1, $2, $3, 0, 0)`, 
            [userId, selectedMonth, selectedYear]
        );
        const report = result.rows[0] || { p_total_income: 0, p_total_expense: 0 };

        // Graphics Data (Filtered by Selected Month)
        const pieQuery = await db.query(`
            SELECT c.category_name, COALESCE(SUM(e.amount), 0) as total
            FROM expenses e JOIN categories c ON e.category_id = c.category_id
            WHERE e.user_id = $1 
              AND EXTRACT(MONTH FROM expense_date) = $2 
              AND EXTRACT(YEAR FROM expense_date) = $3
            GROUP BY c.category_name`, [userId, selectedMonth, selectedYear]);

        const lineQuery = await db.query(`
            SELECT 
                to_char(date_column, 'YYYY-MM-DD') as day, 
                SUM(inc) - SUM(exp) as daily_net_change
            FROM (
                SELECT income_date as date_column, amount as inc, 0 as exp FROM incomes WHERE user_id = $1
                UNION ALL
                SELECT expense_date as date_column, 0 as inc, amount as exp FROM expenses WHERE user_id = $1
            ) as combined
            WHERE EXTRACT(MONTH FROM date_column) = $2 
              AND EXTRACT(YEAR FROM date_column) = $3
            GROUP BY date_column 
            ORDER BY date_column ASC`, [userId, selectedMonth, selectedYear]);

        let currentBalance = 0;
        const balanceData = lineQuery.rows.map(r => {
            currentBalance += parseFloat(r.daily_net_change);
            return currentBalance;
        });

        const barQuery = await db.query(`
            SELECT 
                (SELECT COALESCE(SUM(amount),0) FROM incomes WHERE user_id=$1 AND EXTRACT(MONTH FROM income_date) = $2 AND EXTRACT(YEAR FROM income_date) = $3) as income,
                (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id=$1 AND EXTRACT(MONTH FROM expense_date) = $2 AND EXTRACT(YEAR FROM expense_date) = $3) as expense
        `, [userId, selectedMonth, selectedYear]);

        const incomeFlowQuery = await db.query(`
            SELECT c.category_name, SUM(i.amount) as total
            FROM incomes i JOIN categories c ON i.category_id = c.category_id
            WHERE i.user_id = $1 
              AND EXTRACT(MONTH FROM income_date) = $2 
              AND EXTRACT(YEAR FROM income_date) = $3
            GROUP BY c.category_name`, [userId, selectedMonth, selectedYear]);

        const expenseFlowQuery = await db.query(`
            SELECT c.category_name, SUM(e.amount) as total
            FROM expenses e JOIN categories c ON e.category_id = c.category_id
            WHERE e.user_id = $1 
              AND EXTRACT(MONTH FROM expense_date) = $2 
              AND EXTRACT(YEAR FROM expense_date) = $3
            GROUP BY c.category_name`, [userId, selectedMonth, selectedYear]);

        let sankeyData = [];
        incomeFlowQuery.rows.forEach(r => {
            sankeyData.push({ from: r.category_name, to: 'Wallet 💰', flow: parseFloat(r.total) });
        });
        expenseFlowQuery.rows.forEach(r => {
            sankeyData.push({ from: 'Wallet 💰', to: r.category_name, flow: parseFloat(r.total) });
        });

        const chartData = {
            pieLabels: pieQuery.rows.map(r => r.category_name),
            pieValues: pieQuery.rows.map(r => parseFloat(r.total)),
            lineLabels: lineQuery.rows.map(r => r.day),
            lineValues: balanceData,
            barIncome: parseFloat(barQuery.rows[0].income),
            barExpense: parseFloat(barQuery.rows[0].expense),
            sankey: sankeyData
        };

        res.render('reports', {
            username: req.session.username,
            year: selectedYear,
            month: selectedMonth,
            income: parseFloat(report.p_total_income), 
            expense: parseFloat(report.p_total_expense),
            chartData: chartData
        });

    } catch (err) {
        console.error("Report Error:", err);
        res.render('reports', {
            username: req.session.username,
            year: selectedYear,
            month: selectedMonth,
            income: 0, expense: 0, chartData: null
        });
    }
});

// --- ADD CATEGORY ---
app.post('/add-category', requireLogin, async (req, res) => {
    const { category_name, category_type } = req.body;
    try {
        await db.query(
            'INSERT INTO categories (category_name, category_type) VALUES ($1, $2)',
            [category_name, category_type]
        );
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Add Category Error:", err);
        res.send("Error adding category.");
    }
});

// --- DELETE OPERATIONS ---
app.post('/delete-expense/:id', requireLogin, async (req, res) => {
    const expenseId = req.params.id;
    try {
        await db.query('DELETE FROM expenses WHERE expense_id = $1 AND user_id = $2', [expenseId, req.session.userId]);
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Delete error:", err);
        res.send("Delete failed.");
    }
});

app.post('/delete-income/:id', requireLogin, async (req, res) => {
    const incomeId = req.params.id;
    try {
        await db.query('DELETE FROM incomes WHERE income_id = $1 AND user_id = $2', [incomeId, req.session.userId]);
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Delete error:", err);
        res.send("Delete failed.");
    }
});

// --- UPDATE OPERATIONS ---
app.get('/edit-expense/:id', requireLogin, async (req, res) => {
    try {
        const expenseId = req.params.id;
        const result = await db.query('SELECT * FROM expenses WHERE expense_id = $1 AND user_id = $2', [expenseId, req.session.userId]);
        const categories = await db.query('SELECT * FROM categories ORDER BY category_name');

        if (result.rows.length === 0) return res.redirect('/dashboard');

        res.render('edit_expense', { expense: result.rows[0], categories: categories.rows });
    } catch (err) {
        res.send("Could not fetch data.");
    }
});

app.post('/update-expense/:id', requireLogin, async (req, res) => {
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

        if (is_subscription === 'true') {
            let nextDate = new Date(date);
            if(sub_cycle === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
            if(sub_cycle === 'YEARLY') nextDate.setFullYear(nextDate.getFullYear() + 1);

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

        res.redirect('/dashboard');

    } catch (err) {
        console.error("Update Error:", err);
        res.send("Error during update: " + err.message);
    }
});

app.get('/edit-income/:id', requireLogin, async (req, res) => {
    try {
        const incomeId = req.params.id;
        const userId = req.session.userId;

        const result = await db.query('SELECT * FROM incomes WHERE income_id = $1 AND user_id = $2', [incomeId, userId]);
        const categories = await db.query('SELECT * FROM categories ORDER BY category_name');

        if (result.rows.length === 0) return res.redirect('/dashboard');

        res.render('edit_income', { income: result.rows[0], categories: categories.rows });
    } catch (err) {
        console.error("Income fetch error:", err);
        res.send("Could not fetch data.");
    }
});

app.post('/update-income/:id', requireLogin, async (req, res) => {
    const { amount, category_id, description, date } = req.body;
    const incomeId = req.params.id;
    const userId = req.session.userId;

    try {
        await db.query(
            `UPDATE incomes 
             SET amount = $1, category_id = $2, description = $3, income_date = $4 
             WHERE income_id = $5 AND user_id = $6`,
            [amount, category_id, description, date, incomeId, userId]
        );
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Income update error:", err);
        res.send("Update failed.");
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});