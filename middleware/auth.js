const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeRole } = require('../utils/roles');

/**
 * Authentication Middleware
 * Verifies JWT from HTTP-only cookie or Authorization header
 * Attaches decoded payload to req.user
 */
async function authenticate(req, res, next) {
	try {
		let token = null;

		// Try to get token from HTTP-only cookie first (preferred)
		if (req.cookies && req.cookies.authToken) {
			token = req.cookies.authToken;
		}
		// Fall back to Authorization header (Bearer token) for backward compatibility
		else if (req.headers.authorization || req.headers.Authorization) {
			const authHeader = req.headers.authorization || req.headers.Authorization;
			if (authHeader.startsWith('Bearer ')) {
				token = authHeader.split(' ')[1];
			}
		}

		if (!token) {
			return res.status(401).json({ message: 'Unauthorized: missing authentication token' });
		}

		// Verify JWT
		const secret = process.env.JWT_SECRET || 'change_this_secret';
		const decoded = jwt.verify(token, secret);
		
		// Check if user still exists and is active
		const user = await User.findById(decoded.id);
		if (!user || !user.isActive) {
			return res.status(401).json({ message: 'Unauthorized: user account is inactive' });
		}

		// Attach user info to request. Role comes from DB and is normalized for compatibility.
		req.user = {
			...decoded,
			id: String(user._id),
			role: normalizeRole(user.role)
		};
		return next();
	} catch (err) {
		if (err.name === 'TokenExpiredError') {
			return res.status(401).json({ message: 'Unauthorized: token expired' });
		}
		return res.status(401).json({ message: 'Unauthorized: invalid token' });
	}
}

/**
 * Authorization Middleware Factory
 * Restricts access to users with at least one of the allowed roles
 */
function authorizeRoles(...allowedRoles) {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({ message: 'Unauthorized' });
		}

		const userRole = normalizeRole(req.user.role);
		const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));

		if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
			return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
		}

		return next();
	};
}

module.exports = { authenticate, authorizeRoles };