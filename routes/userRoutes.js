const express = require('express');
const router = express.Router();
const { 
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
} = require('../controllers/userController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticate, authorizeRoles('Admin'));

// Create new user (admin only)
router.post('/', createUser);

// Get all users (admin only)
router.get('/', getAllUsers);

// Get single user by ID (admin only)
router.get('/:userId', getSingleUser);

// Update user by ID (admin only)
router.put('/:userId', updateUser);

// Delete user by ID (admin only - hard delete)
router.delete('/:userId', deleteUser);

// Deactivate user (admin only)
router.patch('/:userId/deactivate', deactivateUser);

// Reactivate user (admin only)
router.patch('/:userId/reactivate', reactivateUser);

// Reset user password (admin only)
router.post('/:userId/reset-password', resetUserPassword);

// Get users pending approval (admin only)
router.get('/pending', getPendingUsers);

// Approve a pending Google user and assign their role (admin only)
router.patch('/:userId/approve', approveUser);

module.exports = router;