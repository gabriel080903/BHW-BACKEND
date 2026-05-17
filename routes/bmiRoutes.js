const express = require('express');
const router = express.Router();
const bmiController = require('../controllers/bmiController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// All BMI routes require authentication
router.use(authenticate);

// GET /api/bmi → get all BMI records (BHW, admin, and parent)
router.get('/', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), bmiController.getAllBMI);

// GET /api/bmi/:residentId → get BMI history for one resident
router.get('/:residentId', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), bmiController.getResidentBMIHistory);

// POST /api/bmi → calculate and save BMI record (BHW, admin, and parent)
router.post('/', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), bmiController.createBMI);

module.exports = router;