const express = require('express');
const router = express.Router();
const { addVaccine, getResidentVaccineHistory, replaceResidentVaccines } = require('../controllers/vaccineController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Protect vaccine routes
router.use(authenticate);

router.post('/', authorizeRoles('Admin', 'BHW'), addVaccine);
router.get('/:residentId', authorizeRoles('Admin', 'BHW', 'Parent/Guardian'), getResidentVaccineHistory);
router.put('/:residentId', authorizeRoles('Admin', 'BHW', 'Parent/Guardian'), replaceResidentVaccines);

module.exports = router;
