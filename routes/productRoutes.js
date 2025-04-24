// routes/adminRoutes.js
import express from 'express';
import {
  getAddProduct,
  addProduct,
  getProducts,
  listProducts,
  deleteProduct,
  getEditProduct,
  updateProduct,
  blockProduct,
  unblockProduct,
  restoreProduct
} from '../controllers/admin/productController.js';
import { upload, processImages } from '../middleware/imageUpload.js';
import { isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Home page route
router.get('/', (req, res) => {
  res.redirect('/products');
});

// Admin product routes
router.get('/products', isAdmin, getProducts);
router.get('/products/add', isAdmin, getAddProduct);
router.post('/products/add', isAdmin, upload.array('images', 10), processImages, addProduct);
router.get('/products/edit/:id', isAdmin, getEditProduct);
router.post('/products/edit/:id', isAdmin, upload.array('images', 10), processImages, updateProduct);
router.delete('/products/:id', isAdmin, deleteProduct);
router.post('/products/:id/block', isAdmin, blockProduct);
router.post('/products/:id/unblock', isAdmin, unblockProduct);
router.post('/products/restore/:id', isAdmin, restoreProduct);

// User product routes
router.get('/user/products', listProducts);

export default router;
