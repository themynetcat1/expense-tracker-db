const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const expenseController = require('../controllers/expenseController');

const router = express.Router();

router.post('/add-expense', requireAuth, expenseController.addExpense);
router.post('/delete-expense/:id', requireAuth, expenseController.deleteExpense);
router.get('/edit-expense/:id', requireAuth, expenseController.getEditExpense);
router.post('/update-expense/:id', requireAuth, expenseController.updateExpense);

module.exports = router;
