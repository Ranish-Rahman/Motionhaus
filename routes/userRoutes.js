import express from 'express';
import userController from '../controllers/user/userController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';

const router = express.Router();

// Render signup and login pages
router.get('/signup', userController.signUpPage);
router.get('/login', userController.getLogin);
router.get('/home', userController.getHome);
router.get('/forgot-password', userController.getForgotPassword);
router.get('/products', listProducts);
router.get('/products/:id', getProductDetails);

// Handle signup and OTP
router.post('/signup', userController.postSignup);
router.post('/verify-otp', userController.verifyOTP);
router.post('/resend-otp', userController.resendOTP);

// Handle login
router.post('/login', userController.postLogin);

// Handle forgot password
router.post('/forgot-password', userController.postForgotPassword);
router.post('/reset-password', userController.resetPassword);

// Add live search route
router.get('/search-live', userController.liveSearch);


export default router;

