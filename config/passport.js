const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const GoogleWhitelist = require('../models/GoogleWhitelist');
const { ROLE_DEFAULT, ROLE_VALUES, normalizeRole } = require('../utils/roles');

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleEmail = profile.emails?.[0]?.value?.trim().toLowerCase();

        if (!googleEmail) {
          return done(null, false);
        }

        // Check if user already exists with this Google ID (any role)
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // User exists, update last login
          user.lastLogin = new Date();
          await user.save();
          return done(null, user);
        }

        // Check if user exists with this email (pre-registered by admin, any role)
        user = await User.findOne({ email: googleEmail });

        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.displayName = profile.displayName;
          user.profilePicture = profile.photos?.[0]?.value;
          user.authProvider = 'google';
          user.lastLogin = new Date();
          await user.save();
          return done(null, user);
        }

        // No existing account — check DB-backed whitelist for auto-approval.
        const whitelistEntry = await GoogleWhitelist.findOne({
          email: googleEmail,
          isActive: true
        })
          .select('role')
          .lean();

        const normalizedRole = normalizeRole(whitelistEntry?.role || ROLE_DEFAULT);
        const whitelistedRole = ROLE_VALUES.includes(normalizedRole)
          ? normalizedRole
          : ROLE_DEFAULT;
        const isWhitelisted = !!whitelistEntry;

        const newUser = new User({
          googleId: profile.id,
          email: googleEmail,
          displayName: profile.displayName,
          username: googleEmail.split('@')[0], // Use email prefix as username
          profilePicture: profile.photos?.[0]?.value,
          authProvider: 'google',
          isActive: isWhitelisted,        // Active immediately if whitelisted
          pendingApproval: !isWhitelisted, // Skip approval if whitelisted
          role: isWhitelisted ? whitelistedRole : ROLE_DEFAULT,
          lastLogin: new Date()
        });

        await newUser.save();
        done(null, newUser);
      } catch (err) {
        console.error('Google OAuth error:', err);
        done(err, null);
      }
    }
  )
);

module.exports = passport;
