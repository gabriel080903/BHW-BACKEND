const express = require('express');
const router = express.Router();
const { getAllResidents, addResident, updateResident, deleteResident, getResidentTimeline } = require('../controllers/residentController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Protect all resident routes
router.use(authenticate);

// @route   GET /api/residents
// @desc    Get all residents list
router.get('/', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), getAllResidents);

// @route   POST /api/residents
// @desc    Register a new resident (authenticated users only)
router.post('/', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), addResident);

// @route   GET /api/residents/:residentId/timeline
// @desc    Get resident timeline (nutrition, BMI, vaccines)
router.get('/:residentId/timeline', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), getResidentTimeline);

// @route   PATCH /api/residents/:residentId
// @desc    Update resident
router.patch('/:residentId', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), updateResident);

// @route   DELETE /api/residents/:residentId
// @desc    Delete resident and dependent records
router.delete('/:residentId', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), deleteResident);

module.exports = router;