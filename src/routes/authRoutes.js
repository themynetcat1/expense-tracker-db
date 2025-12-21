const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/', authController.getHome);

router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 5, max: 30 }).withMessage('Username must be 5-30 characters.')
      .matches(/^[a-zA-Z0-9_.]+$/).withMessage('Username can contain letters, numbers, underscore or dot only.'),

    body('email')
      .trim()
      .isEmail().withMessage('Please enter a valid email.')
      .normalizeEmail(),

    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain a number.')
  ],
  authController.register
);

router.post('/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router;
