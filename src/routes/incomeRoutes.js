const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const incomeController = require('../controllers/incomeController');

const router = express.Router();

router.post('/add-income', requireAuth, incomeController.addIncome);
router.post('/delete-income/:id', requireAuth, incomeController.deleteIncome);
router.get('/edit-income/:id', requireAuth, incomeController.getEditIncome);
router.post('/update-income/:id', requireAuth, incomeController.updateIncome);

module.exports = router;
