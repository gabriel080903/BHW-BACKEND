const express = require('express');
const router = express.Router();
const { addMyFamilyMember, getMyFamilyMembers } = require('../controllers/myFamilyController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Parent users only
router.use(authenticate);
router.use(authorizeRoles('Parent/Guardian'));

router.post('/', addMyFamilyMember);
router.get('/', getMyFamilyMembers);

module.exports = router;
