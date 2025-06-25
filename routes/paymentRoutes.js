import express from 'express';
import { verifyPayment, createRazorpayOrder } from '../controllers/user/paymentController.js';
import { handlePaymentFailure, cancelRazorpayOrder } from '../controllers/user/userController.js';
import { getOrderSuccess, getOrderFailure } from '../controllers/user/userController.js';

const router = express.Router();

// Add middleware for larger request bodies specifically for payment routes
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Payment routes
router.post('/create-razorpay-order', createRazorpayOrder);
router.post('/verify-payment', verifyPayment);
router.post('/payment-failed', handlePaymentFailure);
router.post('/cancel-razorpay-order', cancelRazorpayOrder);

// Success and failure page routes
router.get('/success/:id', getOrderSuccess);
router.get('/failed/:id', getOrderFailure);

export default router; 