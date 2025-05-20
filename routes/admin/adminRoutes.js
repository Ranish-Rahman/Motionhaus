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
import { upload, processImages } from '../../middleware/imageUpload.js';
import { requireAdminAuth } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Admin authentication middleware
const isAdmin = (req, res, next) => {
  console.log('Admin middleware check:', {
    path: req.path,
    method: req.method,
    session: req.session.admin,
    headers: req.headers
  });

  if (req.session.admin) {
    return next();
  }
  
  // Check if it's an API request
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    console.log('API request detected, sending 401');
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Admin session expired' 
    });
  }
  
  console.log('No admin session, redirecting to login');
  res.redirect('/admin/login');
};

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
router.get('/logout', handleLogout);
router.post('/logout', handleLogout);

// Protected routes (require admin authentication)
router.get('/dashboard', isAdmin, dashboard);
router.get('/customers', isAdmin, customers);
router.get('/products', isAdmin, getProducts);
router.get('/categories', isAdmin, getCategories);
router.get('/orders', isAdmin, getOrders);
router.get('/settings', isAdmin, getSettings);

// Product management routes
router.get('/products/add', isAdmin, getAddProduct);
router.post('/products/add', isAdmin, upload.array('images', 10), processImages, addProduct);
router.get('/products/edit/:id', isAdmin, getEditProduct);
router.post('/products/edit/:id', isAdmin, upload.array('images', 10), processImages, updateProduct);
router.delete('/products/:id', isAdmin, deleteProduct);
router.post('/products/:id/block', isAdmin, blockProduct);
router.post('/products/:id/unblock', isAdmin, unblockProduct);
router.post('/products/restore/:id', isAdmin, restoreProduct);

// Category management routes
router.get('/categories/add', isAdmin, getAddCategory);
router.post('/categories/add', isAdmin, addCategory);
router.get('/categories/edit/:id', isAdmin, getEditCategory);
router.post('/categories/edit/:id', isAdmin, editCategory);
router.post('/categories/delete/:id', isAdmin, softDeleteCategory);
router.post('/categories/restore/:id', isAdmin, restoreCategory);

// User management routes
router.post('/users/:userId/block', isAdmin, blockUser);
router.post('/users/:userId/unblock', isAdmin, unblockUser);
router.delete('/users/:userId', isAdmin, deleteUser);

// Order management routes
router.get('/orders/:id', isAdmin, getOrderDetails);
router.post('/orders/:id/status', isAdmin, updateOrderStatus);
router.post('/orders/:id/return', isAdmin, processReturn);

// Item return request routes
router.post('/orders/:orderId/items/:itemId/return', isAdmin, processItemReturn);
router.post('/orders/:orderId/items/:itemId/return/approve', isAdmin, approveItemReturn);
router.post('/orders/:orderId/items/:itemId/return/deny', isAdmin, denyItemReturn);
router.post('/orders/:orderId/items/:itemId/status', isAdmin, updateOrderItemStatus);

// Return request routes
router.get('/return-requests', isAdmin, getReturnRequests);
router.post('/return-requests/:requestId/:action', isAdmin, updateReturnRequest);

export default router; 