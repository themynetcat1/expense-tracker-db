const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/admin', requireAuth, requireAdmin, adminController.getAdminDashboard);
router.get('/admin/users/:id', requireAuth, requireAdmin, adminController.getUserDetails);

router.post('/admin/users/:id/toggle-admin', requireAuth, requireAdmin, adminController.toggleAdmin);
router.post('/admin/users/:id/delete', requireAuth, requireAdmin, adminController.deleteUser);
router.post('/admin/users/:id/toggle-active', requireAuth, requireAdmin, adminController.toggleActive);


module.exports = router;
