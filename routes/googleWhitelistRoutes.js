const express = require('express');
const router = express.Router();

const {
  listWhitelist,
  createWhitelistEntry,
  updateWhitelistEntry,
  deactivateWhitelistEntry,
  reactivateWhitelistEntry,
} = require('../controllers/googleWhitelistController');

const { authenticate, authorizeRoles } = require('../middleware/auth');

router.use(authenticate, authorizeRoles('Admin'));

router.get('/', listWhitelist);
router.post('/', createWhitelistEntry);
router.patch('/:entryId', updateWhitelistEntry);
router.patch('/:entryId/deactivate', deactivateWhitelistEntry);
router.patch('/:entryId/reactivate', reactivateWhitelistEntry);

module.exports = router;
