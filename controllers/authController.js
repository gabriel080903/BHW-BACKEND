const { generateToken } = require('../utils/jwt');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/passwordValidator');
const { logActivity } = require('../utils/activityLogger');
const { normalizeRole } = require('../utils/roles');

// Maximum login attempts before account lock
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  // 'None' required when frontend and backend are on different domains.
  // 'Strict' blocks the cookie cross-origin even over HTTPS.
  // 'None' MUST be paired with secure:true — only activates in production.
  sameSite: IS_PROD ? 'None' : 'Strict',
  maxAge: 60 * 60 * 1000
};

const buildTokenPayload = (user) => ({
  id: String(user._id),
  username: user.username || user.email || user.displayName || 'user',
  role: normalizeRole(user.role)
});

/**
 * Secure Login
 * - No env-based fallback
 * - Only accepts pre-created users
 * - Implements account locking after failed attempts
 * - Stores JWT in HTTP-only cookie
 */
exports.login = async (req, res) => {
  try {
    let { username, password } = req.body || {};

    username = (username || '').trim().toLowerCase();

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({
        message: 'This account uses Google sign-in. Please continue with Google.'
      });
    }

    if (!user.password || typeof user.password !== 'string') {
      return res.status(400).json({
        message: 'This account has no local password. Please use Google sign-in or ask an admin to reset your password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(buildTokenPayload(user));

    res.cookie('authToken', token, COOKIE_OPTIONS);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: String(user._id),
        username: user.username,
        role: normalizeRole(user.role),
        email: user.email || null,
        displayName: user.displayName || user.username,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Google OAuth Callback Handler
 * Handles successful Google authentication
 */
exports.googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (user.pendingApproval) {
      return res.redirect(`${process.env.FRONTEND_URL}/pending-approval`);
    }

    if (!user.isActive) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_deactivated`);
    }

    const token = generateToken(buildTokenPayload(user));

    res.cookie('authToken', token, COOKIE_OPTIONS);

    // Redirect to app root so SPA session bootstrap can load authenticated user
    res.redirect(`${process.env.FRONTEND_URL}`);
  } catch (error) {
    console.error('Google callback error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Google OAuth Failure Handler
 */
exports.googleFailure = (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}?error=google_auth_failed`);
};

/**
 * Secure Logout
 * Clears the authentication cookie
 */
exports.logout = async (req, res) => {
  try {
    res.clearCookie('authToken', COOKIE_OPTIONS);
    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Authenticated session user
 * Returns minimal user profile for frontend bootstrap
 */
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('_id username role email displayName isActive');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Unauthorized: user account is inactive' });
    }

    return res.status(200).json({
      user: {
        id: String(user._id),
        username: user.username || user.email || user.displayName || 'user',
        role: normalizeRole(user.role),
        email: user.email || ''
      }
    });
  } catch (error) {
    console.error('Get session user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Validate Password Strength
 * Used during initial user creation (setup)
 */
exports.validatePasswordStrength = (req, res) => {
  try {
    const { password } = req.body;
    const validation = validatePassword(password);

    if (validation.isValid) {
      return res.status(200).json({ 
        isValid: true, 
        message: 'Password meets security requirements' 
      });
    } else {
      return res.status(400).json({ 
        isValid: false, 
        errors: validation.errors 
      });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
/**
 * Google Token Verification
 * Called from frontend after Google OAuth popup — verifies token,
 * creates/finds user, handles pending approval flow
 */
exports.googleTokenLogin = async (req, res) => {
  try {
    const { accessToken, profile } = req.body || {}
    if (!accessToken || !profile?.email) {
      return res.status(400).json({ message: 'Missing token or profile' })
    }

    const email = profile.email.trim().toLowerCase()

    // 1. Find existing user by googleId or email
    let user = await User.findOne({ googleId: profile.sub })
    if (!user) user = await User.findOne({ email })

    if (user) {
      // Existing user — check if pending approval
      if (user.pendingApproval) {
        return res.status(403).json({
          message: 'pending_approval',
          email: user.email,
          displayName: user.displayName
        })
      }
      if (!user.isActive) {
        return res.status(403).json({ message: 'account_deactivated' })
      }
      // Update Google info if not set
      if (!user.googleId) {
        user.googleId = profile.sub
        user.profilePicture = profile.picture
        user.authProvider = 'google'
      }
      user.lastLogin = new Date()
      await user.save()
    } else {
      // New Google user — create with pendingApproval = true
      const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_')
      user = new User({
        googleId:       profile.sub,
        email,
        username,
        displayName:    profile.name || username,
        profilePicture: profile.picture,
        authProvider:   'google',
        role:           'Parent/Guardian',
        isActive:       false,
        pendingApproval: true,
        lastLogin:      new Date()
      })
      await user.save()
      return res.status(403).json({
        message: 'pending_approval',
        email:   user.email,
        displayName: user.displayName
      })
    }

    const token = generateToken(buildTokenPayload(user))
    res.cookie('authToken', token, COOKIE_OPTIONS)

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id:          String(user._id),
        username:    user.username,
        displayName: user.displayName,
        role:        normalizeRole(user.role),
        email:       user.email,
        avatar:      user.profilePicture,
        isActive:    user.isActive
      }
    })
  } catch (err) {
    console.error('Google token login error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}
