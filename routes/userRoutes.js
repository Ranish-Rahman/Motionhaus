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
  postChangePassword
} from '../controllers/user/userController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';

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
router.get('/wishlist', getWishlist);
router.get('/profile', getProfile);
router.get('/profile/address', getAddress);
router.post('/profile/address/add', addAddress);
router.get('/profile/address/edit/:id', getEditAddress);
router.post('/profile/address/edit/:id', updateAddress);
router.post('/profile/address/delete/:id', deleteAddress);
router.post('/profile/address/set-default/:id', setDefaultAddress);
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderDetails);
router.get('/products', listProducts);
router.get('/products/:id', getProductDetails);
router.get('/search', liveSearch);

// Change Password routes
router.get('/profile/change-password', getChangePassword);
router.post('/profile/change-password', postChangePassword);

export default router;

