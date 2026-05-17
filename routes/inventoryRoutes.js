const express = require('express');
const router = express.Router();
const { addItem, getInventory, updateItem, deleteItem } = require('../controllers/inventoryController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Protect inventory routes
router.use(authenticate);

router.post('/', authorizeRoles('Admin', 'BHW'), addItem);
router.get('/', authorizeRoles('Admin', 'BHW'), getInventory);
router.patch('/:itemId', authorizeRoles('Admin', 'BHW'), updateItem);
router.delete('/:itemId', authorizeRoles('Admin', 'BHW'), deleteItem);

module.exports = router;