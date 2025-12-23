
-- 1. TEMİZLİK (CASCADE ekledik: Bağlı tabloları da zorla temizler)
DROP VIEW IF EXISTS user_category_totals CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS incomes CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS installments CASCADE;   -- Bu tabloları da temizliyoruz
DROP TABLE IF EXISTS subscriptions CASCADE;  -- ki hata vermesin
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP PROCEDURE IF EXISTS get_monthly_report;
DROP FUNCTION IF EXISTS update_summary_trigger;

-- 2. KULLANICILAR
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. KATEGORİLER
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL, 
    category_type VARCHAR(20) CHECK (category_type IN ('INCOME', 'EXPENSE', 'BOTH')) DEFAULT 'BOTH'
);

-- Varsayılan Kategoriler
INSERT INTO categories (category_name, category_type) VALUES 
('Maaş', 'INCOME'),
('Freelance', 'INCOME'),
('Kira', 'EXPENSE'),
('Market', 'EXPENSE'),
('Ulaşım', 'EXPENSE'),
('Eğlence', 'EXPENSE'),
('Faturalar', 'EXPENSE');

-- 4. HARCAMALAR (EXPENSES)
CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(category_id),
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. GELİRLER (INCOMES)
CREATE TABLE incomes (
    income_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(category_id),
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    income_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. GÜNLÜK ÖZETLER
CREATE TABLE daily_summaries (
    summary_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    date DATE NOT NULL, 
    total_income DECIMAL(10, 2) DEFAULT 0,
    total_expense DECIMAL(10, 2) DEFAULT 0,
    UNIQUE(user_id, date)
);

-- 7. STORED PROCEDURE: AYLIK RAPOR
CREATE OR REPLACE PROCEDURE get_monthly_report(
    IN p_user_id INT,
    IN p_month INT,
    IN p_year INT,
    OUT p_total_income DECIMAL,
    OUT p_total_expense DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO p_total_income
    FROM incomes
    WHERE user_id = p_user_id 
      AND EXTRACT(MONTH FROM income_date) = p_month
      AND EXTRACT(YEAR FROM income_date) = p_year;

    SELECT COALESCE(SUM(amount), 0) INTO p_total_expense
    FROM expenses
    WHERE user_id = p_user_id 
      AND EXTRACT(MONTH FROM expense_date) = p_month
      AND EXTRACT(YEAR FROM expense_date) = p_year;
END;
$$;

-- 8. TRIGGER FONKSİYONU
CREATE OR REPLACE FUNCTION update_summary_trigger() 
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_TABLE_NAME = 'expenses') THEN
        INSERT INTO daily_summaries (user_id, date, total_expense, total_income)
        VALUES (NEW.user_id, NEW.expense_date, NEW.amount, 0)
        ON CONFLICT (user_id, date) 
        DO UPDATE SET total_expense = daily_summaries.total_expense + NEW.amount;
    ELSIF (TG_TABLE_NAME = 'incomes') THEN
        INSERT INTO daily_summaries (user_id, date, total_expense, total_income)
        VALUES (NEW.user_id, NEW.income_date, 0, NEW.amount)
        ON CONFLICT (user_id, date) 
        DO UPDATE SET total_income = daily_summaries.total_income + NEW.amount;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. TRIGGER'LARI BAĞLA
CREATE TRIGGER trg_update_summary_expense
AFTER INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_summary_trigger();

CREATE TRIGGER trg_update_summary_income
AFTER INSERT ON incomes
FOR EACH ROW
EXECUTE FUNCTION update_summary_trigger();

-- 10. VIEW: User totals by category (income & expense)
CREATE OR REPLACE VIEW user_category_totals AS
SELECT
  t.user_id,
  t.category_id,
  t.category_name,
  COALESCE(SUM(t.total_income), 0)::DECIMAL(10,2)  AS total_income,
  COALESCE(SUM(t.total_expense), 0)::DECIMAL(10,2) AS total_expense
FROM (
  SELECT
    i.user_id,
    c.category_id,
    c.category_name,
    i.amount::DECIMAL(10,2) AS total_income,
    0::DECIMAL(10,2)        AS total_expense
  FROM incomes i
  JOIN categories c ON c.category_id = i.category_id

  UNION ALL

  SELECT
    e.user_id,
    c.category_id,
    c.category_name,
    0::DECIMAL(10,2)        AS total_income,
    e.amount::DECIMAL(10,2) AS total_expense
  FROM expenses e
  JOIN categories c ON c.category_id = e.category_id
) t
GROUP BY t.user_id, t.category_id, t.category_name;


-- 1. ABONELİKLER (SUBSCRIPTIONS)
CREATE TABLE subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    expense_id INT REFERENCES expenses(expense_id) ON DELETE SET NULL, -- Hangi harcamadan oluşturuldu?
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    cycle VARCHAR(20) CHECK (cycle IN ('MONTHLY', 'YEARLY', 'WEEKLY')),
    next_payment_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- 2. TAKSİTLER (INSTALLMENTS)
CREATE TABLE installments (
    installment_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    expense_id INT REFERENCES expenses(expense_id) ON DELETE SET NULL,
    product_name VARCHAR(100) NOT NULL,
    total_amount DECIMAL(10, 2), -- Toplam borç (Örn: 30.000 TL)
    monthly_amount DECIMAL(10, 2), -- Aylık ödeme (Örn: 5.000 TL)
    total_installments INT, -- Kaç taksit? (Örn: 6)
    remaining_installments INT, -- Kaç kaldı?
    next_payment_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- Rename Categories
UPDATE categories SET category_name = 'Salary' WHERE category_name = 'Maaş';
UPDATE categories SET category_name = 'Freelance' WHERE category_name = 'Freelance';
UPDATE categories SET category_name = 'Rent' WHERE category_name = 'Kira';
UPDATE categories SET category_name = 'Groceries' WHERE category_name = 'Market';
UPDATE categories SET category_name = 'Transport' WHERE category_name = 'Ulaşım';
UPDATE categories SET category_name = 'Entertainment' WHERE category_name = 'Eğlence';
UPDATE categories SET category_name = 'Bills' WHERE category_name = 'Faturalar';
UPDATE categories SET category_name = 'Other' WHERE category_name = 'Diğer';

-- Optional: Translate some common descriptions
UPDATE expenses SET description = 'Rent Payment' WHERE description = 'Ev Kirası';
UPDATE expenses SET description = 'Weekly Shopping' WHERE description = 'Haftalık Alışveriş';