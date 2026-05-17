const jwt = require('jsonwebtoken');

function generateToken(payload, expiresIn = '1h') {
  const secret = process.env.JWT_SECRET || 'change_this_secret';
  return jwt.sign(payload, secret, { expiresIn });
}

module.exports = { generateToken };
