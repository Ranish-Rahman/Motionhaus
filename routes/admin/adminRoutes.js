import express from 'express';
import { requireAdminAuth } from '../../middleware/authMiddleware.js';
import { getDashboard, getProducts, getCategories, getOrders, getCustomers, getSettings } from '../../controllers/admin/adminController.js';

const router = express.Router();

// Protected routes
router.get('/dashboard', requireAdminAuth, getDashboard);
router.get('/products', requireAdminAuth, getProducts);
router.get('/categories', requireAdminAuth, getCategories);
router.get('/orders', requireAdminAuth, getOrders);
router.get('/customers', requireAdminAuth, getCustomers);
router.get('/settings', requireAdminAuth, getSettings);

// Public routes
router.get('/login', (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login');
});

export default router; 