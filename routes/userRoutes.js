import express from 'express';
import { 
  signUpPage, 
  getLogin, 
  getHome, 
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
  cancelOrder
} from '../controllers/user/userController.js';
import { requestReturn } from '../controllers/user/orderController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';
import { addToCart, updateCartItem, removeFromCart } from '../controllers/user/cartController.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';
import Address from '../models/addressModel.js';
import Cart from '../models/cartModel.js';
import Order from '../models/orderModel.js';
import Product from '../models/ProductModel.js';

const router = express.Router();

// Public routes (no session required)
router.get('/signup', signUpPage);
router.get('/login', getLogin);
router.get('/forgot-password', getForgotPassword);

// Handle signup and OTP (no session required)
router.post('/signup', postSignup);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', postLogin);
router.post('/forgot-password', postForgotPassword);
router.post('/reset-password', resetPassword);

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
router.get('/profile/address', getAddress);
router.post('/profile/address/add', addAddress);
router.get('/profile/address/edit/:id', getEditAddress);
router.post('/profile/address/edit/:id', updateAddress);
router.post('/profile/address/delete/:id', deleteAddress);
router.post('/profile/address/set-default/:id', setDefaultAddress);
router.get('/orders', getOrders);
router.get('/profile/orders/:id', getOrderDetails);
router.get('/products', listProducts);
router.get('/products/:id', getProductDetails);
router.get('/search', liveSearch);
router.get('/checkout', getCheckout);
// Change Password routes
router.get('/profile/change-password', getChangePassword);
router.post('/profile/change-password', postChangePassword);

// Order routes
router.post('/order/create', createOrder);

router.get('/profile/orders', (req, res) => res.redirect('/orders'));

// Test route
router.post('/test-return', (req, res) => {
  console.log('Test route hit:', req.body);
  res.json({ success: true, message: 'Test successful' });
});

// Return request route
router.post('/order/:orderId/return', (req, res, next) => {
  console.log('Return request route hit:', {
    params: req.params,
    body: req.body,
    headers: req.headers
  });
  requestReturn(req, res, next);
});
router.post('/order/:orderId/cancel', cancelOrder);

export default router;

