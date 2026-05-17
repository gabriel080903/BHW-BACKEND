const express = require('express');
const router = express.Router();
const { getMonthlyReport, importMonthlyReport } = require('../controllers/monthly_reportController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Development-only unauthenticated import test (placed before auth middleware)
if (process.env.NODE_ENV !== 'production') {
	router.post('/import-test', upload.single('file'), importMonthlyReport);
}

// Protect report routes
router.use(authenticate);

router.get('/summary', authorizeRoles('Admin', 'BHW'), getMonthlyReport);
router.post('/import', authorizeRoles('Admin', 'BHW'), upload.single('file'), importMonthlyReport);


module.exports = router;
