const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.post('/add-category', requireLogin, categoryController.addCategory);

module.exports = router;
