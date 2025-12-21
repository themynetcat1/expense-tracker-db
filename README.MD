# Expense Tracker (DBMS Project)

A personal expense tracking system built with **Node.js (Express)**, **PostgreSQL**, and **EJS**.  
This project also demonstrates DBMS features such as **stored procedures**, **triggers**, and **views**.

---

## Features

- User registration & login
  - Input validation (email format, password length, etc.)
  - Passwords are stored **hashed (bcrypt)**
  - **Automatic migration**: legacy plaintext passwords are hashed on the first successful login
- Expense & income management (CRUD)
- Category management
- Dashboard with charts (Pie/Line/Bar/Sankey)
  - Pie chart reads data from a **database view**
- Monthly reports using a **stored procedure**
- Daily summaries updated via **triggers**

---

## Tech Stack

- Backend: Node.js, Express
- Templating: EJS
- Database: PostgreSQL
- Auth: express-session
- Validation: express-validator
- Password hashing: bcrypt

---

## Setup & Run
Prerequisites
-Node.js (LTS recommended)
-PostgreSQL
-psql CLI available in your PATH

1) Clone the repository

- git clone <https://github.com/themynetcat1/expense-tracker-db.git>
- cd <expense-tracker-db>

2) Install dependencies
- npm install

3) Configure environment variables
- Copy .env.example to .env and update values if needed:

- Windows (PowerShell):
- copy .env.example .env

- macOS / Linux:
- cp .env.example .env

- Make sure .env includes correct PostgreSQL connection values (DB name, user, password, host, port) and a session secret.

4) Create the database
- If your .env uses DB_NAME=expense_tracker_db, create it like this:

- psql -U postgres -c "CREATE DATABASE expense_tracker_db;"

- If you use a different database name, ensure it matches DB_NAME in .env.

5) Initialize database schema (tables, triggers, procedure, view)
- psql -U postgres -d expense_tracker_db -f database/init.sql

- If you need to specify host/port:
- psql -U postgres -h localhost -p 5432 -d expense_tracker_db -f database/init.sql

6) Start the application
- npm run start

- If you have a dev script:
- npm run dev

- Open in browser:
- http://localhost:3000

---

## Notes
- Password hashing migration
- If there are existing users stored with plaintext passwords, the app will automatically hash and update them after the first successful login.

---

## DBMS requirements
- Stored procedure: used in the monthly report page
- Triggers: used to update daily summaries
- View: used for category totals (pie chart source)

