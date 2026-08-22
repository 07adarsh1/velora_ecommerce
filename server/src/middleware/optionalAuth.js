const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Attaches req.user when a valid Bearer token is present but never rejects —
// for endpoints that are public yet behave differently for admins
// (e.g. previewing unpublished products from the admin editor).
module.exports = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET, { algorithms: ['HS256'] });
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Invalid token on a public route is not an error — proceed anonymously.
    }
  }
  next();
};
