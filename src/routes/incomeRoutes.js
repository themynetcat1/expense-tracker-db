const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const incomeController = require('../controllers/incomeController');

const router = express.Router();

router.post('/add-income', requireLogin, incomeController.addIncome);
router.post('/delete-income/:id', requireLogin, incomeController.deleteIncome);
router.get('/edit-income/:id', requireLogin, incomeController.getEditIncome);
router.post('/update-income/:id', requireLogin, incomeController.updateIncome);

module.exports = router;
