const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.get('/reports', requireLogin, reportsController.getReports);

module.exports = router;
