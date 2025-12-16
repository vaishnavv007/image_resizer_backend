const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth.middleware');
const { processImages } = require('../controllers/image.controller');

const router = express.Router();

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

router.post('/process', authMiddleware, upload.array('images', 20), processImages);

module.exports = router;
