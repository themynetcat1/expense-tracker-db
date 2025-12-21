const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.post('/add-category', requireAuth, categoryController.addCategory);

module.exports = router;
