const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth.middleware');
const { processImages } = require('../controllers/image.controller');

const router = express.Router();

// Security: image processing is CPU/memory intensive. A dedicated limiter reduces DoS risk even if a user is authenticated.
const imageProcessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    return cb(null, true);
  },
});

router.post('/process', authMiddleware, imageProcessLimiter, upload.array('images', 20), processImages);

module.exports = router;
