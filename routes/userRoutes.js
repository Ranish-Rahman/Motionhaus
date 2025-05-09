import express from 'express';
import { 
  signUpPage, 
  getLogin, 
  getForgotPassword, 
  postSignup, 
  verifyOTP, 
  resendOTP, 
  postLogin, 
  postForgotPassword, 
  resetPassword, 
  liveSearch,
  getCart,
  getWishlist,
  getProfile,
  getOrders,
  getOrderDetails,
  getAddress,
  addAddress,
  getEditAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getChangePassword,
  postChangePassword,
  getCheckout,
  createOrder,
  cancelOrder,
  getHome
} from '../controllers/user/userController.js';
import { requestReturn, placeOrder } from '../controllers/user/orderController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';
import { addToCart, updateCartItem, removeFromCart } from '../controllers/user/cartController.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';

const router = express.Router();

// Public routes (no session required)
router.get('/signup', signUpPage);
router.get('/login', getLogin);
router.get('/forgot-password', getForgotPassword);
router.post('/signup', postSignup);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', postLogin);
router.post('/forgot-password', postForgotPassword);
router.post('/reset-password', resetPassword);

// Root route - redirect to home
router.get('/', (req, res) => {
  res.redirect('/home');
});

// Apply session check to protected routes
router.use(sessionCheck);

// Protected routes (require session)
router.get('/home', getHome);
router.get('/cart', getCart);
router.post('/cart/add', addToCart);
router.post('/cart/update/:itemId', updateCartItem);
router.post('/cart/remove/:itemId', removeFromCart);
router.get('/wishlist', getWishlist);
router.get('/profile', getProfile);

// Address management routes
router.get('/profile/address', getAddress);
router.post('/profile/address/add', addAddress);
router.get('/profile/address/edit/:id', getEditAddress);
router.post('/profile/address/edit/:id', updateAddress);
router.post('/profile/address/delete/:id', deleteAddress);
router.post('/profile/address/set-default/:id', setDefaultAddress);

// Order-related routes
router.get('/orders', getOrders);
router.get('/profile/orders/:id', getOrderDetails);
router.post('/order/create', createOrder);
router.post('/order/:orderId/cancel', cancelOrder);

// Product-related routes
router.get('/products', listProducts);
router.get('/products/:id', getProductDetails);

// Search route
router.get('/search', liveSearch);

// Checkout and password routes
router.get('/checkout', getCheckout);
router.get('/profile/change-password', getChangePassword);
router.post('/profile/change-password', postChangePassword);

// Return request route
router.post('/order/:orderId/return', (req, res, next) => {
  console.log('Return request route hit:', req.body);
  requestReturn(req, res, next);  // Ensure requestReturn handles order status checks internally
});

// Test route for debugging (can be removed in production)
router.post('/test-return', (req, res) => {
  console.log('Test route hit:', req.body);
  res.json({ success: true, message: 'Test successful' });
});

// New routes
router.post('/orders', placeOrder);

export default router;
