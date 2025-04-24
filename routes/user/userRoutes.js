import express from 'express';
import { sessionCheck } from '../../middleware/sessionMiddleware.js';
import { getHome, getProducts, getProductDetails, getCart, getWishlist, getProfile, getOrders, getOrderDetails } from '../../controllers/user/userController.js';
import { listProducts } from '../../controllers/user/productController.js';

const router = express.Router();

// Apply session check to all routes
router.use(sessionCheck);

// Protected routes
router.get('/home', getHome);
router.get('/products', listProducts);
router.get('/product/:id', getProductDetails);
router.get('/cart', getCart);
router.get('/wishlist', getWishlist);
router.get('/profile', getProfile);
router.get('/orders', getOrders);
router.get('/order/:id', getOrderDetails);

// Public routes (handled by sessionCheck middleware)
router.get('/login', (req, res) => {
  res.render('user/login');
});

router.get('/signup', (req, res) => {
  res.render('user/signup');
});

export default router; 