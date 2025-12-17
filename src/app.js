const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const imageRoutes = require('./routes/image.routes');

const app = express();

app.set('trust proxy', 1);

// Security: reduce information leakage / fingerprinting of the backend framework.
app.disable('x-powered-by');

app.use(helmet());

const isProd = process.env.NODE_ENV === 'production';
const configuredFrontendOrigin = String(process.env.FRONTEND_ORIGIN || '').trim();
const allowedOrigins = (configuredFrontendOrigin
  ? configuredFrontendOrigin.split(',')
  : (isProd ? [] : ['http://localhost:5173'])
)
  .map((o) => String(o).trim())
  .filter(Boolean);

// Security: fail closed in production so we never accidentally allow requests from arbitrary origins.
if (isProd && allowedOrigins.length === 0) {
  throw new Error('FRONTEND_ORIGIN must be set in production');
}

app.use(
  cors({
    // Security: strict allowlist to prevent any website from making credentialed cross-origin requests.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type'],
  })
);

// Security: because auth is cookie-based and SameSite=None in production, enforce Origin checks for
// state-changing requests to mitigate CSRF. (CORS does not block sending requests; it only blocks reading responses.)
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    // Security: in production we expect browsers to send an Origin header for state-changing requests.
    // If it's missing, we reject the request to avoid CSRF from opaque origins (e.g., file://, sandboxed iframes).
    if (isProd && !origin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }
  return next();
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: '1mb' }));
// Security: keep urlencoded body size bounded to reduce memory/CPU DoS via large request bodies.
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.use((err, req, res, next) => {
  if (err && err.message === 'CORS_NOT_ALLOWED') {
    // Security: explicit 403 avoids leaking internal error details while clearly rejecting disallowed origins.
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (err && err.message === 'Unsupported file type') {
    return res.status(400).json({ message: 'Unsupported file type' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large' });
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ message: 'Too many files' });
  }

  return res.status(500).json({ message: 'Server error' });
});

module.exports = app;
