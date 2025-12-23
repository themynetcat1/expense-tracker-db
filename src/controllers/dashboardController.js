const db = require('../db');

exports.getDashboard = async (req, res) => {
  const userId = req.user.userId;

  try {
    // --- A. LISTS AND TABLES ---
    const categories = await db.query('SELECT * FROM categories ORDER BY category_name');

    const expenses = await db.query(`
      SELECT e.*, c.category_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.category_id
      WHERE e.user_id = $1
      ORDER BY expense_date DESC, created_at DESC
      LIMIT 5
    `, [userId]);

    const incomes = await db.query(`
      SELECT i.*, c.category_name
      FROM incomes i
      JOIN categories c ON i.category_id = c.category_id
      WHERE i.user_id = $1
      ORDER BY income_date DESC, created_at DESC
      LIMIT 5
    `, [userId]);

    const summary = await db.query(`
      SELECT total_income, total_expense
      FROM daily_summaries
      WHERE user_id = $1 AND date = CURRENT_DATE
    `, [userId]);

    const dailyStats = summary.rows[0] || { total_income: 0, total_expense: 0 };

    // --- B. CHART DATA ---

    // 1) Pie - Using VIEW
    const pieQuery = await db.query(`
      SELECT category_name, total_expense AS total
      FROM user_category_totals
      WHERE user_id = $1 AND total_expense > 0
      ORDER BY total_expense DESC
    `, [userId]);


    // 2) Line (Balance Flow)
    const lineQuery = await db.query(`
      SELECT
        to_char(date_column, 'YYYY-MM-DD') as day,
        SUM(inc) - SUM(exp) as daily_net_change
      FROM (
        SELECT income_date as date_column, amount as inc, 0 as exp
        FROM incomes
        WHERE user_id = $1
        UNION ALL
        SELECT expense_date as date_column, 0 as inc, amount as exp
        FROM expenses
        WHERE user_id = $1
      ) as combined
      WHERE date_column >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date_column
      ORDER BY date_column ASC
    `, [userId]);

    let currentBalance = 0;
    const balanceData = lineQuery.rows.map(r => {
      currentBalance += parseFloat(r.daily_net_change);
      return currentBalance;
    });

    // 3) Bar
    const barQuery = await db.query(`
      SELECT
        (SELECT COALESCE(SUM(amount),0)
         FROM incomes
         WHERE user_id=$1
           AND EXTRACT(MONTH FROM income_date) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(YEAR  FROM income_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
        ) as income,
        (SELECT COALESCE(SUM(amount),0)
         FROM expenses
         WHERE user_id=$1
           AND EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(YEAR  FROM expense_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
        ) as expense
    `, [userId]);

    // 4) Sankey
    const incomeFlowQuery = await db.query(`
      SELECT c.category_name, SUM(i.amount) as total
      FROM incomes i
      JOIN categories c ON i.category_id = c.category_id
      WHERE i.user_id = $1
      GROUP BY c.category_name
    `, [userId]);

    const expenseFlowQuery = await db.query(`
      SELECT c.category_name, SUM(e.amount) as total
      FROM expenses e
      JOIN categories c ON e.category_id = c.category_id
      WHERE e.user_id = $1
      GROUP BY c.category_name
    `, [userId]);

    const sankeyData = [];
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

    return res.render('dashboard', {
      username: req.user.username,
      isAdmin: req.user.isAdmin,
      categories: categories.rows,
      expenses: expenses.rows,
      incomes: incomes.rows,
      stats: dailyStats,
      chartData
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    return res.send("An error occurred: " + err.message);
  }
};
