
A personal expense tracking system built with Node.js, Express, and PostgreSQL. This project serves as a comprehensive web application for managing personal finances and demonstrates advanced database features like stored procedures, triggers, and views.

## Features

-   **User Authentication**: Secure user registration and login with input validation.
-   **Secure Password Handling**: Passwords are securely hashed using `bcrypt`. The system includes an automatic migration feature that hashes legacy plaintext passwords upon the user's first successful login.
-   **Income & Expense Management**: Full CRUD (Create, Read, Update, Delete) functionality for income and expense records.
-   **Category Management**: Users can create custom categories for income, expenses, or both.
-   **Interactive Dashboard**: A central dashboard provides a quick overview of your finances with:
    -   Daily income and expense summaries.
    -   Lists of recent transactions.
    -   Multiple chart visualizations including Pie, Line, Bar, and Sankey charts to analyze financial data.
-   **Monthly Reports**: Generate detailed monthly reports using a dedicated page. This feature is powered by a PostgreSQL stored procedure for efficient data aggregation.
-   **Automated Summaries**: Database triggers automatically update daily summary tables whenever a new income or expense is added, ensuring real-time data accuracy with minimal application overhead.
-   **Optimized Queries**: A database view is used to pre-aggregate category totals, providing efficient data for the expense distribution pie chart.

## Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: PostgreSQL
-   **Templating Engine**: EJS
-   **Authentication**: JSON Web Tokens (JWT) stored in cookies, `bcrypt` for password hashing.
-   **Data Validation**: `express-validator`
-   **Node.js Libraries**: `pg`, `dotenv`, `body-parser`, `cookie-parser`
-   **Charting**: Chart.js, chartjs-chart-sankey

## Setup and Installation

### Prerequisites

-   Node.js (LTS version recommended)
-   PostgreSQL
-   `psql` CLI tool available in your system's PATH

### 1. Clone the Repository

```bash
git clone https://github.com/themynetcat1/expense-tracker-db.git
cd expense-tracker-db
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file by copying the example file.

```bash
# On macOS / Linux
cp .env.example .env

# On Windows (PowerShell)
copy .env.example .env
```

Now, open the `.env` file and update the following variables with your PostgreSQL connection details and a secure secret for JWT.

```
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=expense_tracker_db
JWT_SECRET=your_super_secret_random_string
```

### 4. Create the Database

If you are using the default database name from `.env.example` (`expense_tracker_db`), run the following command. Replace `postgres` with your PostgreSQL superuser if different.

```bash
psql -U postgres -c "CREATE DATABASE expense_tracker_db;"
```

### 5. Initialize the Database Schema

Run the `init.sql` script to create all necessary tables, views, triggers, and stored procedures.

```bash
# Adjust -U <user> and -d <db_name> to match your .env file
psql -U your_postgres_user -d expense_tracker_db -f database/init.sql
```

### 6. Run the Application

You can start the server in development mode (with auto-reloading) or production mode.

```bash
# For development with nodemon
npm run dev

# For production
npm run start
```

The application will be running at `http://localhost:3000`.

## DBMS Features Implemented

This project specifically implements several key database management system features:

-   **Stored Procedure**: The monthly reports page utilizes the `get_monthly_report` stored procedure. This procedure takes a user ID, month, and year as input and efficiently calculates the total income and expenses for that period directly within the database.
-   **Triggers**: The `update_summary_trigger` function is executed automatically after any new record is inserted into the `incomes` or `expenses` tables. It updates the `daily_summaries` table to maintain a running total of daily financial activity, offloading this logic from the application layer.
-   **View**: The `user_category_totals` view pre-calculates the total income and expense for each user and category. This provides a simplified and performant way to query data for the category distribution pie chart on the dashboard without complex joins and aggregations in the application code.
