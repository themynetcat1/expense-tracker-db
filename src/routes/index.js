//Tüm route çağrıları daha düzgün görünüm için app.js'den ayırıldı.
const express = require('express');

const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reportRoutes = require('./reportRoutes');
const expenseRoutes = require('./expenseRoutes');
const incomeRoutes = require('./incomeRoutes');
const categoryRoutes = require('./categoryRoutes');

const router = express.Router();

router.use('/', authRoutes);
router.use('/', dashboardRoutes);
router.use('/', reportRoutes);
router.use('/', expenseRoutes);
router.use('/', incomeRoutes);
router.use('/', categoryRoutes);

module.exports = router;
