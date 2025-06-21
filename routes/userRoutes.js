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
  getHome,
  updateProfile,
  sendProfileOTP,
  verifyProfileOTP,
  generateInvoice,
  getProfileData,
  handlePaymentFailure,
  cancelRazorpayOrder,
  getOrderSuccess,
  getOrderFailure,
  createOrder
} from '../controllers/user/userController.js';
import { 
  requestReturn, 
  placeOrder, 
  cancelOrderItem, 
  requestItemReturn,
  approveItemReturn,
  cancelOrder,
  retryPayment,
  verifyPayment
} from '../controllers/user/orderController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';
import { addToCart, updateCartItem, removeFromCart, applyCoupon, removeCoupon, validateStock } from '../controllers/user/cartController.js';
import { getWishlist, addToWishlist, removeFromWishlist, clearWishlist, moveToCart } from '../controllers/user/wishlistController.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';
import { getPasswordRules } from '../utils/passwordValidation.js';
import { createRazorpayOrder } from '../controllers/user/paymentController.js';
import Order from '../models/orderModel.js';
import razorpay from '../utils/razorpay.js';
import Product from '../models/ProductModel.js';
import Cart from '../models/cartModel.js';
import { getWallet } from '../controllers/user/walletController.js';

const router = express.Router();

// Public routes (no session required)
router.get('/signup', signUpPage);
router.get('/login', getLogin);
router.get('/forgot-password', getForgotPassword);
router.post('/signup', postSignup);
router.post('/verify-otp', verifyOTP);

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

// Apply session check middleware
router.use(sessionCheck);

// Search route (public)
router.get('/search', liveSearch);

// Order Routes
router.post('/order/create', placeOrder);
router.post('/order/:orderId/cancel', cancelOrder);
router.post('/order/:orderId/item/:itemId/cancel', cancelOrderItem);
router.post('/order/:orderId/item/:itemId/return', requestItemReturn);
router.post('/order/:orderId/item/:itemId/return/approve', approveItemReturn);
router.post('/order/:orderId/return', requestReturn);
router.post('/order/:orderId/retry-payment', retryPayment);
router.post('/order/:orderId/verify-payment', verifyPayment);

// Protected routes
router.get('/home', getHome);
router.get('/cart', getCart);
router.post('/cart/add', addToCart);
router.post('/cart/update/:itemId', updateCartItem);
router.post('/cart/remove/:itemId', removeFromCart);
router.post('/cart/apply-coupon', applyCoupon);
router.post('/cart/remove-coupon', removeCoupon);
router.post('/cart/validate-stock', validateStock);

// Wishlist routes
router.get('/wishlist', getWishlist);
router.post('/wishlist/add/:productId', addToWishlist);
router.post('/wishlist/remove/:productId', removeFromWishlist);
router.post('/wishlist/clear', clearWishlist);
router.post('/wishlist/move-to-cart/:productId', moveToCart);

// Profile routes
router.get('/profile', getProfile);
router.post('/profile/update', updateProfile);
router.post('/profile/send-otp', sendProfileOTP);
router.post('/profile/verify-otp', verifyProfileOTP);
router.get('/profile/data', getProfileData);

// Address management routes
router.get('/profile/address', getAddress);
router.post('/profile/address/add', addAddress);
router.get('/profile/address/edit/:id', getEditAddress);
router.post('/profile/address/edit/:id', updateAddress);
router.post('/profile/address/delete/:id', deleteAddress);
router.post('/profile/address/set-default/:id', setDefaultAddress);

// Order-related routes
router.get('/profile/orders', getOrders);
router.get('/profile/orders/:id', getOrderDetails);
router.get('/profile/orders/:id/invoice', generateInvoice);

// Product-related routes
router.get('/products', listProducts);
router.get('/products/:id', getProductDetails);

// Checkout and password routes
router.get('/checkout', getCheckout);
router.post('/checkout', createOrder);
router.get('/profile/change-password', getChangePassword);
router.post('/profile/change-password', postChangePassword);

// Add password rules endpoint
router.get('/api/password-rules', (req, res) => {
  res.json(getPasswordRules());
});

router.get('/order/success/:id', getOrderSuccess);
router.get('/order/failure/:id', getOrderFailure);

router.get('/wallet', getWallet);

export default router;
