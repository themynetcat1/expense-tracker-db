const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/dashboard', requireAuth, dashboardController.getDashboard);

module.exports = router;
