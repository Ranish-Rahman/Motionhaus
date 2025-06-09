import express from 'express';
import { 
  getAdminLogin, 
  postAdminLogin, 
  customers,
  handleLogout,
  blockUser,
  unblockUser,
  deleteUser,
  dashboard,
  getProducts,
  getCategories,
  getOrders,
  getSettings,
  getOrderDetails,
  updateOrderStatus,
  processReturn,
  processReturnRequest,
  getReturnRequests,
  updateReturnRequest,
  processItemReturn,
  approveItemReturn,
  denyItemReturn,
  updateOrderItemStatus
} from '../../controllers/admin/adminController.js';
import { 
  getAddProduct, 
  addProduct,
  getEditProduct,
  updateProduct,
  deleteProduct,
  blockProduct,
  unblockProduct,
  restoreProduct
} from '../../controllers/admin/productController.js';
import { 
  getAddCategory, 
  addCategory,
  getEditCategory,
  editCategory,
  softDeleteCategory,
  restoreCategory
} from '../../controllers/admin/categoryController.js';
import {
  getAllOffers,
  createOffer,
  updateOfferStatus,
  updateOffer
} from '../../controllers/admin/offerController.js';
import { upload, processImages } from '../../middleware/imageUpload.js';
import { isAdmin } from '../../middleware/authMiddleware.js';
import couponRoutes from './couponRoutes.js';
import salesReportRoutes from './sales-report.js';
import Coupon from '../../models/couponModel.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/login', (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { 
    title: 'Admin Login',
    error: req.flash('error')
  });
});

router.post('/login', postAdminLogin);
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.clearCookie('sessionId');
    res.redirect('/admin/login');
  });
});

// Apply admin middleware to all protected routes
router.use(isAdmin);

// Protected routes
router.get('/dashboard', dashboard);
router.get('/customers', customers);
router.get('/products', getProducts);
router.get('/categories', getCategories);
router.get('/settings', getSettings);

// Product management routes
router.get('/products/add', getAddProduct);
router.post('/products/add', upload.array('images', 5), processImages, addProduct);
router.get('/products/edit/:id', getEditProduct);
router.post('/products/edit/:id', upload.array('images', 5), processImages, updateProduct);
router.post('/products/:id/block', blockProduct);
router.post('/products/:id/unblock', unblockProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/restore', restoreProduct);

// Category management routes
router.get('/categories/add', getAddCategory);
router.post('/categories/add', addCategory);
router.get('/categories/edit/:id', getEditCategory);
router.post('/categories/edit/:id', editCategory);
router.delete('/categories/:id', softDeleteCategory);
router.post('/categories/:id/restore', restoreCategory);

// Offer management routes
router.get('/offers', getAllOffers);
router.post('/offers', createOffer);
router.patch('/offers/:id/status', updateOfferStatus);
router.put('/offers/:id', updateOffer);

// User management routes
router.post('/users/:userId/block', blockUser);
router.post('/users/:userId/unblock', unblockUser);
router.delete('/users/:userId', deleteUser);

// Order management routes
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderDetails);
router.patch('/orders/:orderId/status', updateOrderStatus);
router.post('/orders/:orderId/return', processReturn);

// Return management routes
router.get('/return-requests', getReturnRequests);
router.post('/return-requests/:requestId/:action', updateReturnRequest);
router.post('/orders/:orderId/items/:itemId/return', processItemReturn);
router.post('/orders/:orderId/items/:itemId/return/approve', approveItemReturn);
router.post('/orders/:orderId/items/:itemId/return/deny', denyItemReturn);
router.post('/orders/:orderId/items/:itemId/status', updateOrderItemStatus);

// Coupon management routes
router.use('/coupons', couponRoutes);

// Sales Report routes
router.use('/sales-report', salesReportRoutes);

// Add this route to render the coupon management page
router.get('/coupon-management', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.status) {
            if (req.query.status === 'active') {
                query.isActive = true;
            } else if (req.query.status === 'inactive') {
                query.isActive = false;
            }
        }

        const [coupons, total] = await Promise.all([
            Coupon.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Coupon.countDocuments(query)
        ]);

        res.render('admin/coupons', {
            coupons,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total,
            path: '/admin/coupon-management'
        });
    } catch (error) {
        console.error('Error in coupon management page:', error);
        res.status(500).render('error', {
            message: 'Failed to load coupon management page',
            statusCode: 500,
            error: error
        });
    }
});

export default router; 