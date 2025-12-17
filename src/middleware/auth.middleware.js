const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  try {
    const cookieName = process.env.COOKIE_NAME || 'token';
    const token = req.cookies?.[cookieName];

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Server misconfigured' });
    }

    // Security: explicitly restrict algorithms to prevent accepting tokens signed with unexpected/unsafe algorithms.
    // This app signs tokens using the jsonwebtoken default (HS256), so we lock verification to HS256.
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const userId = payload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId).select('_id email');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = authMiddleware;
