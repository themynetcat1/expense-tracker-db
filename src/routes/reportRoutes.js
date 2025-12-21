const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.get('/reports', requireAuth, reportsController.getReports);

module.exports = router;
