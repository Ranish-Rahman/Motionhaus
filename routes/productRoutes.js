// routes/adminRoutes.js
import express from 'express';
import {
  getAddProduct,
  addProduct,
  getProducts,
  deleteProduct,
  getEditProduct,
  updateProduct,
  blockProduct,
  unblockProduct,
  restoreProduct
} from '../controllers/admin/productController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';
import { upload, processImages } from '../middleware/imageUpload.js';
import { isAdmin } from '../middleware/authMiddleware.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';

const router = express.Router();

// Apply session check to all routes
router.use(sessionCheck);

// Home page route
router.get('/', (req, res) => {
  res.redirect('/products');
});

// Admin product routes
router.get('/admin/products', isAdmin, getProducts);
router.get('/admin/products/add', isAdmin, getAddProduct);
router.post('/admin/products/add', isAdmin, upload.array('images', 10), processImages, addProduct);
router.get('/admin/products/edit/:id', isAdmin, getEditProduct);
router.post('/admin/products/edit/:id', isAdmin, upload.array('images', 10), processImages, updateProduct);
router.delete('/admin/products/:id', isAdmin, deleteProduct);
router.post('/admin/products/:id/block', isAdmin, blockProduct);
router.post('/admin/products/:id/unblock', isAdmin, unblockProduct);
router.post('/admin/products/restore/:id', isAdmin, restoreProduct);

// User product routes
router.get('/products', listProducts);
router.get('/product/:id', getProductDetails);

export default router;
