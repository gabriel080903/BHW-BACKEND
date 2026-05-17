const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// All nutrition routes require authentication
router.use(authenticate);

// GET /api/nutrition → get all visible nutrition records
router.get('/', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), nutritionController.getAllNutritionRecords);

// POST /api/nutrition → add nutrition record (BHW, admin, and parent)
router.post('/', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), nutritionController.addNutritionRecord);

// GET /api/nutrition/:residentId → get nutrition history for one resident
router.get('/:residentId', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), nutritionController.getResidentNutritionHistory);

// PATCH /api/nutrition/record/:recordId → update one nutrition record
router.patch('/record/:recordId', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), nutritionController.updateNutritionRecord);

// DELETE /api/nutrition/record/:recordId → delete one nutrition record
router.delete('/record/:recordId', authorizeRoles('BHW', 'Admin', 'Parent/Guardian'), nutritionController.deleteNutritionRecord);

module.exports = router;
