const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Ayarlar
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Oturum Yönetimi
app.use(session({
    secret: process.env.SESSION_SECRET || 'gizli_anahtar',
    resave: false,
    saveUninitialized: true
}));

// --- FONKSİYON: Giriş Kontrolü ---
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    next();
};

// --- ROTALAR ---

// 1. Ana Sayfa (Login)
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('index', { error: null });
});

// 2. Dashboard (Ana Ekran) - GÜNCELLENMİŞ VE CHART DESTEKLİ
app.get('/dashboard', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    try {
        // --- A. LİSTELER VE TABLOLAR ---
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


        // --- B. GRAFİK VERİLERİ (CHART DATA) ---

        // 1. Pasta Grafik (Pie Chart): Kategori Bazlı Harcama
        // Hangi kategoriye ne kadar harcadık?
        const pieQuery = await db.query(`
            SELECT c.category_name, SUM(e.amount) as total
            FROM expenses e
            JOIN categories c ON e.category_id = c.category_id
            WHERE e.user_id = $1
            GROUP BY c.category_name`, [userId]);

        // 2. Çizgi Grafik (Line Chart): Son 7 Günlük Harcama
        const lineQuery = await db.query(`
            SELECT to_char(expense_date, 'YYYY-MM-DD') as day, SUM(amount) as daily_total
            FROM expenses
            WHERE user_id = $1 AND expense_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY expense_date
            ORDER BY expense_date ASC`, [userId]);

        // 3. Sütun Grafik (Bar Chart): Bu Ay Gelir vs Gider
        const barQuery = await db.query(`
            SELECT 
                (SELECT COALESCE(SUM(amount),0) FROM incomes WHERE user_id=$1 AND EXTRACT(MONTH FROM income_date) = EXTRACT(MONTH FROM CURRENT_DATE)) as income,
                (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id=$1 AND EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)) as expense
        `, [userId]);


        // --- C. VERİ PAKETLEME ---
        // Veritabanından gelen ham veriyi, Chart.js'in anlayacağı basit listelere çeviriyoruz.
        const chartData = {
            // Pasta Grafik
            pieLabels: pieQuery.rows.map(r => r.category_name),
            pieValues: pieQuery.rows.map(r => parseFloat(r.total)),

            // Çizgi Grafik
            lineLabels: lineQuery.rows.map(r => r.day),
            lineValues: lineQuery.rows.map(r => parseFloat(r.daily_total)),

            // Sütun Grafik
            barIncome: parseFloat(barQuery.rows[0].income),
            barExpense: parseFloat(barQuery.rows[0].expense)
        };

        // Sayfayı Render Et (Tek Seferde)
        res.render('dashboard', {
            username: req.session.username,
            categories: categories.rows,
            expenses: expenses.rows,
            incomes: incomes.rows,
            stats: dailyStats,
            chartData: chartData // Grafik verisini gönderiyoruz
        });

    } catch (err) {
        console.error("Dashboard Hatası:", err);
        res.send("Bir hata oluştu: " + err.message);
    }
});

// 3. Yeni Gider Ekle (POST)
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
        res.send("Gider eklenirken hata oluştu.");
    }
});

// 4. Yeni Gelir Ekle (POST)
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
        res.send("Gelir eklenirken hata oluştu.");
    }
});

// 5. Kayıt ve Login İşlemleri (Değişmedi)
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
        res.render('index', { error: 'Kayıt başarısız (Email/Kullanıcı adı kullanımda olabilir).' });
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
        res.render('index', { error: 'Hatalı giriş bilgileri.' });
    } catch (err) {
        res.render('index', { error: 'Sunucu hatası.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- YENİ ROTA: AYLIK RAPOR SAYFASI ---
app.get('/reports', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    // Eğer tarih seçilmediyse bugünün ayını ve yılını al
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // JS'de aylar 0'dan başlar

    const selectedYear = req.query.year || currentYear;
    const selectedMonth = req.query.month || currentMonth;

    try {
        // Stored Procedure Çağırılıyor (PostgreSQL'e özel CALL komutu)
        // Sonuç tek satır döner: { p_total_income, p_total_expense }
        const result = await db.query(
            `CALL get_monthly_report($1, $2, $3, 0, 0)`, 
            [userId, selectedMonth, selectedYear]
        );
        
        // Procedure sonuçları bazen farklı formatta dönebilir, pg kütüphanesinde
        // CALL işlemi sonucunda rows genellikle ilk satırda veriyi döndürür.
        const report = result.rows[0] || { p_total_income: 0, p_total_expense: 0 };

        res.render('reports', {
            username: req.session.username,
            year: selectedYear,
            month: selectedMonth,
            income: report.p_total_income,
            expense: report.p_total_expense
        });

    } catch (err) {
        console.error("Rapor Hatası:", err);
        // Hata olsa bile sayfayı boş verilerle açalım ki çökmesin
        res.render('reports', {
            username: req.session.username,
            year: selectedYear,
            month: selectedMonth,
            income: 0, 
            expense: 0 
        });
    }
});
// --- YENİ ROTA: KATEGORİ EKLEME ---
app.post('/add-category', requireLogin, async (req, res) => {
    const { category_name, category_type } = req.body; // Formdan gelen veriler
    try {
        // Yeni kategoriyi veritabanına ekle
        await db.query(
            'INSERT INTO categories (category_name, category_type) VALUES ($1, $2)',
            [category_name, category_type]
        );
        res.redirect('/dashboard'); // İşlem bitince Dashboard'a dön
    } catch (err) {
        console.error("Kategori Ekleme Hatası:", err);
        res.send("Kategori eklenirken hata oluştu.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde hazır!`);
});