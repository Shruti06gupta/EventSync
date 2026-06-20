const express = require('express');
const { register, login, logout } = require('../controllers/authController');
const { forgotPassword, resetPassword } = require('../controllers/passwordController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;