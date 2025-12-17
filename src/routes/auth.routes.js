const express = require('express');
const rateLimit = require('express-rate-limit');
const { signup, login, me, logout } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Security: Express 4 does not automatically catch rejected promises from async route handlers.
// Forwarding errors to the centralized error handler prevents unhandledRejection crashes (DoS).
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Security: auth endpoints are high-value targets for brute force / credential stuffing.
// Keep a stricter limiter here (in addition to any global limiter) to reduce account takeover risk.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.post('/signup', authLimiter, asyncHandler(signup));
router.post('/login', authLimiter, asyncHandler(login));
router.get('/me', authMiddleware, asyncHandler(me));
router.post('/logout', authLimiter, asyncHandler(logout));

module.exports = router;
