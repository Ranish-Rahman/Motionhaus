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

// Public routes (no session check required)
router.get('/', listProducts);
router.get('/:id', getProductDetails);

// Admin routes (require session check and admin auth)
router.use('/admin', sessionCheck, isAdmin);
router.get('/admin/products/add', getAddProduct);
router.post('/admin/products/add', upload.array('images', 10), processImages, addProduct);
router.get('/admin/products', getProducts);
router.get('/admin/products/edit/:id', getEditProduct);
router.post('/admin/products/edit/:id', upload.array('images', 10), processImages, updateProduct);
router.post('/admin/products/delete/:id', deleteProduct);
router.post('/admin/products/block/:id', blockProduct);
router.post('/admin/products/unblock/:id', unblockProduct);
router.post('/admin/products/restore/:id', restoreProduct);

export default router;
