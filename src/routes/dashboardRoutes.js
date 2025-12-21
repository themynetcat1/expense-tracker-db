const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/dashboard', requireLogin, dashboardController.getDashboard);

module.exports = router;
