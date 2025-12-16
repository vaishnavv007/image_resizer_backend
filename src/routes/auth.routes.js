const express = require('express');
const { signup, login, me, logout } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authMiddleware, me);
router.post('/logout', logout);

module.exports = router;
