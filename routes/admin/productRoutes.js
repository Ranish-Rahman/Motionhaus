import express from 'express';
import * as productController from '../../controllers/admin/productController.js';
import { upload } from '../../middleware/upload.js';

const router = express.Router();

// Get all products
router.get('/', productController.getProducts);

// Get add product page
router.get('/add', productController.getAddProduct);

// Add new product
router.post('/add', upload.array('images', 5), productController.addProduct);

// Get edit product page
router.get('/edit/:id', productController.getEditProduct);

// Update product
router.post('/edit/:id', upload.array('images', 5), productController.updateProduct);

// Delete product
router.delete('/:id', productController.deleteProduct);

// Block/Unblock routes
router.post('/:id/block', productController.blockProduct);
router.post('/:id/unblock', productController.unblockProduct);

export default router; 