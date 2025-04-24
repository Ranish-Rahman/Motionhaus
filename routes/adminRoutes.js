import express from 'express';
import { 
  getAdminLogin, 
  postAdminLogin, 
  customers,
  handleLogout,
  blockUser,
  unblockUser,
  deleteUser,
  dashboard
} from '../controllers/admin/adminController.js';
import { 
  getProducts, 
  getAddProduct, 
  addProduct,
  getEditProduct,
  updateProduct,
  deleteProduct,
  blockProduct,
  unblockProduct
} from '../controllers/admin/productController.js';
import { upload, processImages } from '../middleware/imageUpload.js';

const router = express.Router();

// Admin authentication middleware
const isAdmin = (req, res, next) => {
  if (req.session.admin) {
    return next();
  }
  
  // Check if it's an API request
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Admin session expired' 
    });
  }
  
  res.redirect('/admin/login');
};

// Public routes (no authentication required)
router.get('/login', getAdminLogin);
router.post('/login', postAdminLogin);
router.get('/logout', handleLogout);

// Protected routes (require admin authentication)
router.get('/dashboard', isAdmin, dashboard);
router.get('/customers', isAdmin, customers);

// Product routes
router.get('/products', isAdmin, getProducts);
router.get('/products/add', isAdmin, getAddProduct);
router.post('/products/add', isAdmin, upload.array('images', 10), processImages, addProduct);
router.get('/products/edit/:id', isAdmin, getEditProduct);
router.post('/products/edit/:id', isAdmin, upload.array('images', 10), processImages, updateProduct);
router.delete('/products/:id', isAdmin, deleteProduct);
router.post('/products/:id/block', isAdmin, blockProduct);
router.post('/products/:id/unblock', isAdmin, unblockProduct);

// User management routes
router.post('/users/:userId/block', isAdmin, blockUser);
router.post('/users/:userId/unblock', isAdmin, unblockUser);
router.delete('/users/:userId', isAdmin, deleteUser);

export default router;
