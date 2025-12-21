const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const expenseController = require('../controllers/expenseController');

const router = express.Router();

router.post('/add-expense', requireLogin, expenseController.addExpense);
router.post('/delete-expense/:id', requireLogin, expenseController.deleteExpense);
router.get('/edit-expense/:id', requireLogin, expenseController.getEditExpense);
router.post('/update-expense/:id', requireLogin, expenseController.updateExpense);

module.exports = router;
