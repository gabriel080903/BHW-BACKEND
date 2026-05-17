const express = require('express');
const router = express.Router();
const { getHomeData } = require('../controllers/homeController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Protect all home routes: parent users only
router.use(authenticate);
router.use(authorizeRoles('Parent/Guardian'));

router.get('/', getHomeData);

module.exports = router;
