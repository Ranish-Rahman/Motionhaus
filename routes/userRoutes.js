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
  cancelOrder,
  getHome,
  updateProfile,
  sendProfileOTP,
  verifyProfileOTP,
  generateInvoice
} from '../controllers/user/userController.js';
import { 
  requestReturn, 
  placeOrder, 
  cancelOrderItem, 
  requestItemReturn,
  approveItemReturn 
} from '../controllers/user/orderController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';
import { addToCart, updateCartItem, removeFromCart } from '../controllers/user/cartController.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';
import { getPasswordRules } from '../utils/passwordValidation.js';

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

// Landing page routes
router.get('/', (req, res) => {
  res.render('user/landing');
});

router.get('/user/landing', (req, res) => {
  res.render('user/landing');
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
router.post('/profile/update', updateProfile);

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
router.post('/order/create', placeOrder);
router.post('/order/:orderId/cancel', cancelOrder);

// Add new routes for individual item operations
router.post('/order/:orderId/item/:itemId/cancel', cancelOrderItem);
router.post('/order/:orderId/item/:itemId/return', requestItemReturn);
router.post('/order/:orderId/item/:itemId/return/approve', approveItemReturn);

// Add invoice route
router.get('/profile/orders/:id/invoice', generateInvoice);

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
  requestReturn(req, res, next);
});

// Test route for debugging (can be removed in production)
router.post('/test-return', (req, res) => {
  console.log('Test route hit:', req.body);
  res.json({ success: true, message: 'Test successful' });
});

// Profile routes
router.get('/profile', sessionCheck, getProfile);
router.post('/profile/update', sessionCheck, updateProfile);
router.post('/profile/send-otp', sessionCheck, sendProfileOTP);
router.post('/profile/verify-otp', sessionCheck, verifyProfileOTP);

// Add password rules endpoint
router.get('/api/password-rules', (req, res) => {
  res.json(getPasswordRules());
});

export default router;
