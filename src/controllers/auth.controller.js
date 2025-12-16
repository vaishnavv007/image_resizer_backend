const jwt = require('jsonwebtoken');
const User = require('../models/User');

function expiresInToMs(expiresIn) {
  const value = String(expiresIn || '7d').trim();
  const match = value.match(/^([0-9]+)\s*([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) return 7 * 24 * 60 * 60 * 1000;

  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

function setAuthCookie(res, token) {
  const cookieName = process.env.COOKIE_NAME || 'token';
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: expiresInToMs(process.env.JWT_EXPIRES_IN || '7d'),
  });
}

function clearAuthCookie(res) {
  const cookieName = process.env.COOKIE_NAME || 'token';
  const isProd = process.env.NODE_ENV === 'production';

  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
}

async function signup(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() }).select('_id');
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const user = await User.create({ email, password });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Server misconfigured' });
  }

  const token = jwt.sign({ sub: user._id.toString() }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  setAuthCookie(res, token);
  return res.status(201).json({ user: { id: user._id, email: user.email } });
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password email');
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await user.comparePassword(String(password));
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Server misconfigured' });
  }

  const token = jwt.sign({ sub: user._id.toString() }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  setAuthCookie(res, token);
  return res.json({ user: { id: user._id, email: user.email } });
}

async function me(req, res) {
  return res.json({ user: { id: req.user._id, email: req.user.email } });
}

async function logout(req, res) {
  clearAuthCookie(res);
  return res.json({ message: 'Logged out' });
}

module.exports = {
  signup,
  login,
  me,
  logout,
};
