const mongoose = require('mongoose');
const { ROLE_BHW, ROLE_ADMIN, ROLE_PARENT_GUARDIAN, normalizeRole } = require('../utils/roles');

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: function() {
      return !this.googleId; // Only required if not using Google login
    }, 
    unique: true,
    sparse: true, // Allow null values for unique index
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: { 
    type: String, 
    required: function() {
      return !this.googleId; // Only required if not using Google login
    }
    // Note: Password is hashed, never stored or returned in plaintext
  },
  // Google OAuth fields
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allow null values
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  displayName: {
    type: String
  },
  profilePicture: {
    type: String
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  role: { 
    type: String, 
    enum: [ROLE_BHW, ROLE_ADMIN, ROLE_PARENT_GUARDIAN],
    default: ROLE_BHW 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLogin: { 
    type: Date 
  },
  loginAttempts: { 
    type: Number, 
    default: 0 
  },
  lockUntil: { 
    type: Date 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  pendingApproval: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Virtual to check if account is locked
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Normalize legacy lowercase roles before enum validation/save.
UserSchema.pre('validate', function() {
  if (this.role) {
    this.role = normalizeRole(this.role);
  }
});

// Index for faster lookups
UserSchema.index({ username: 1, isActive: 1 });

module.exports = mongoose.model('User', UserSchema);