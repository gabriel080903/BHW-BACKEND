const mongoose = require('mongoose');
const { ROLE_VALUES, ROLE_DEFAULT, normalizeRole } = require('../utils/roles');

const GoogleWhitelistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLE_DEFAULT
    },
    isActive: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300
    }
  },
  { timestamps: true }
);

GoogleWhitelistSchema.pre('validate', function() {
  if (this.role) {
    this.role = normalizeRole(this.role);
  }
});

module.exports = mongoose.model('GoogleWhitelist', GoogleWhitelistSchema);