const db = require('../db');

exports.getReports = async (req, res) => {
  const userId = req.session.userId;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const selectedYear = parseInt(req.query.year) || currentYear;
  const selectedMonth = parseInt(req.query.month) || currentMonth;

  try {
    // NOTE: PostgreSQL CALL genelde rows döndürmez.
    // Senin projende result.rows[0] bekleniyor; çalışıyorsa aynen koruyoruz.
    const result = await db.query(
      `CALL get_monthly_report($1, $2, $3, 0, 0)`,
      [userId, selectedMonth, selectedYear]
    );

    const report = result.rows?.[0] || { p_total_income: 0, p_total_expense: 0 };

    // Pie (selected month)
    const pieQuery = await db.query(`
      SELECT c.category_name, COALESCE(SUM(e.amount), 0) as total
      FROM expenses e JOIN categories c ON e.category_id = c.category_id
      WHERE e.user_id = $1
        AND EXTRACT(MONTH FROM expense_date) = $2
        AND EXTRACT(YEAR  FROM expense_date) = $3
      GROUP BY c.category_name
    `, [userId, selectedMonth, selectedYear]);

    // Line (selected month)
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
      WHERE EXTRACT(MONTH FROM date_column) = $2
        AND EXTRACT(YEAR  FROM date_column) = $3
      GROUP BY date_column
      ORDER BY date_column ASC
    `, [userId, selectedMonth, selectedYear]);

    let currentBalance = 0;
    const balanceData = lineQuery.rows.map(r => {
      currentBalance += parseFloat(r.daily_net_change);
      return currentBalance;
    });

    // Bar (selected month)
    const barQuery = await db.query(`
      SELECT
        (SELECT COALESCE(SUM(amount),0)
         FROM incomes
         WHERE user_id=$1
           AND EXTRACT(MONTH FROM income_date) = $2
           AND EXTRACT(YEAR  FROM income_date) = $3
        ) as income,
        (SELECT COALESCE(SUM(amount),0)
         FROM expenses
         WHERE user_id=$1
           AND EXTRACT(MONTH FROM expense_date) = $2
           AND EXTRACT(YEAR  FROM expense_date) = $3
        ) as expense
    `, [userId, selectedMonth, selectedYear]);

    // Sankey (selected month)
    const incomeFlowQuery = await db.query(`
      SELECT c.category_name, SUM(i.amount) as total
      FROM incomes i JOIN categories c ON i.category_id = c.category_id
      WHERE i.user_id = $1
        AND EXTRACT(MONTH FROM income_date) = $2
        AND EXTRACT(YEAR  FROM income_date) = $3
      GROUP BY c.category_name
    `, [userId, selectedMonth, selectedYear]);

    const expenseFlowQuery = await db.query(`
      SELECT c.category_name, SUM(e.amount) as total
      FROM expenses e JOIN categories c ON e.category_id = c.category_id
      WHERE e.user_id = $1
        AND EXTRACT(MONTH FROM expense_date) = $2
        AND EXTRACT(YEAR  FROM expense_date) = $3
      GROUP BY c.category_name
    `, [userId, selectedMonth, selectedYear]);

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

    return res.render('reports', {
      username: req.session.username,
      year: selectedYear,
      month: selectedMonth,
      income: parseFloat(report.p_total_income),
      expense: parseFloat(report.p_total_expense),
      chartData
    });

  } catch (err) {
    console.error("Report Error:", err);
    return res.render('reports', {
      username: req.session.username,
      year: selectedYear,
      month: selectedMonth,
      income: 0,
      expense: 0,
      chartData: null
    });
  }
};
