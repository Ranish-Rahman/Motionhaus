import express from 'express';
import { upload, processImages } from '../../middleware/imageUpload.js';
import * as productController from '../../controllers/admin/productController.js';
import { isAdmin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(isAdmin);

// Get all products
router.get('/', productController.getProducts);

// Get add product page
router.get('/add', productController.getAddProduct);

// Add new product
router.post('/add', upload.array('images', 10), processImages, productController.addProduct);

// Get edit product page
router.get('/edit/:id', productController.getEditProduct);

// Update product
router.post('/edit/:id', upload.array('images', 10), processImages, productController.updateProduct);

// Delete product
router.delete('/:id', productController.deleteProduct);

// Block product
router.post('/:id/block', productController.blockProduct);

// Unblock product
router.post('/:id/unblock', productController.unblockProduct);

// Restore product
router.post('/:id/restore', productController.restoreProduct);

export default router; 