const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./db'); // db.js src içindeyse bu doğru
require('dotenv').config();

const app = express();

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

// --- ROUTES ---
const routes = require('./routes');
app.use(routes);


module.exports = app;
