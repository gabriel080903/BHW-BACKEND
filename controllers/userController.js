const User = require('../models/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { validatePassword } = require('../utils/passwordValidator');
const { logActivity } = require('../utils/activityLogger');
const {
  ROLE_VALUES,
  ROLE_DEFAULT,
  ROLE_PARENT_GUARDIAN,
  normalizeRole
} = require('../utils/roles');

const VALID_ROLES = ROLE_VALUES;
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Create User (Admin Only)
 * Creates a new BHW user account
 * Only administrators can create new users
 */
const createUser = async (req, res) => {
  try {
    let { username, password, role, email, displayName } = req.body;

    username = (username || '').trim().toLowerCase();
    role = normalizeRole(role || ROLE_DEFAULT);
    email = email ? email.trim().toLowerCase() : undefined;
    displayName = displayName ? displayName.trim() : undefined;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { username },
        ...(email ? [{ email }] : [])
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        message: existingUser.username === username ? 'Username already exists' : 'Email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      username,
      password: hashedPassword,
      role,
      displayName: displayName || username,
      ...(email ? { email } : {}),
      isActive: true,
      pendingApproval: false,
      createdBy: req.user?.id || req.user?._id
    });

    await newUser.save();

    // do not fail request if logging fails
    logActivity(
      req.user?.id || req.user?._id,
      'CREATE_USER',
      'User',
      String(newUser._id),
      { username: newUser.username, role: newUser.role },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        displayName: newUser.displayName,
        email: newUser.email || null,
        role: newUser.role,
        isActive: newUser.isActive
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get Single User by ID (Admin Only)
 * Returns a single user without password
 */
const getSingleUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const user = await User.findById(userId)
      .select('-password')
      .populate('createdBy', 'username displayName role');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      user
    });
  } catch (error) {
    console.error('Get single user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get All Users (Admin Only)
 * Returns list of all users without passwords
 * Supports: search (name/email), filter by role, and pagination
 */
const getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);

    const filter = {};

    if (role && VALID_ROLES.includes(normalizeRole(role))) {
      filter.role = normalizeRole(role);
    }

    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ displayName: rx }, { email: rx }, { username: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('createdBy', 'username displayName role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Deactivate User (Admin Only)
 * Sets isActive to false, preventing login
 */
const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) return res.status(400).json({ message: 'Invalid userId' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isActive = false;
    await user.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(user._id),
      { action: 'deactivate' },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Reactivate User (Admin Only)
 * Sets isActive to true, allowing login again
 */
const reactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) return res.status(400).json({ message: 'Invalid userId' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isActive = true;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(user._id),
      { action: 'reactivate' },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({ message: 'User reactivated successfully' });
  } catch (error) {
    console.error('Reactivate user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Reset User Password (Admin Only)
 * Resets a user's password and login attempts
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!isValidObjectId(userId)) return res.status(400).json({ message: 'Invalid userId' });
    if (!newPassword) return res.status(400).json({ message: 'newPassword is required' });

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 12);
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(user._id),
      { action: 'reset_password' },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get Pending Users (Admin Only)
 * Returns all users awaiting role assignment and approval
 */
const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ pendingApproval: true })
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Get pending users error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Approve User (Admin Only)
 * Assigns a role, activates the account, and clears pending status
 */
const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    let { role } = req.body;

    if (!isValidObjectId(userId)) return res.status(400).json({ message: 'Invalid userId' });

    role = normalizeRole(role || ROLE_PARENT_GUARDIAN);
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.role = role;
    user.pendingApproval = false;
    user.isActive = true;
    await user.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(user._id),
      { action: 'approve_user', role },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Approve user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update User (Admin Only)
 * Updates user fields: displayName, email, role
 * Password changes require the reset-password endpoint
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { displayName, email, role } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update displayName if provided
    if (displayName !== undefined) {
      const trimmedName = String(displayName).trim();
      if (trimmedName.length > 0) {
        user.displayName = trimmedName;
      } else {
        return res.status(400).json({ message: 'displayName cannot be empty' });
      }
    }

    // Update email if provided
    if (email !== undefined) {
      const trimmedEmail = String(email).trim().toLowerCase();
      if (trimmedEmail.length > 0) {
        // Check if email is already in use by another user
        const existingUser = await User.findOne({
          email: trimmedEmail,
          _id: { $ne: userId }
        });
        if (existingUser) {
          return res.status(400).json({ message: 'Email already in use' });
        }
        user.email = trimmedEmail;
      } else {
        return res.status(400).json({ message: 'email cannot be empty' });
      }
    }

    // Update role if provided
    if (role !== undefined) {
      const normalizedNewRole = normalizeRole(role);
      if (!VALID_ROLES.includes(normalizedNewRole)) {
        return res.status(400).json({
          message: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}`
        });
      }
      user.role = normalizedNewRole;
    }

    await user.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(user._id),
      { displayName: user.displayName, email: user.email, role: user.role },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email || null,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete User (Admin Only - Hard Delete)
 * Permanently removes a user from the database
 * For audit trail preservation, consider using deactivate instead
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admins from deleting themselves
    if (String(user._id) === String(req.user?.id || req.user?._id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const username = user.username;
    const userId_str = String(user._id);

    await User.deleteOne({ _id: userId });

    logActivity(
      req.user?.id || req.user?._id,
      'DELETE_USER',
      'User',
      userId_str,
      { username },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({
      message: 'User deleted successfully',
      deletedUserId: userId_str
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createUser,
  getSingleUser,
  getAllUsers,
  updateUser,
  deleteUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
  getPendingUsers,
  approveUser
};