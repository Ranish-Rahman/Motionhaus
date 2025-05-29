import express from 'express';
import { verifyPayment, createRazorpayOrder } from '../controllers/user/paymentController.js';
import { handlePaymentFailure, cancelRazorpayOrder } from '../controllers/user/userController.js';
import { getOrderSuccess, getOrderFailure } from '../controllers/user/userController.js';

const router = express.Router();

// Payment routes
router.post('/create-razorpay-order', createRazorpayOrder);
router.post('/verify-payment', verifyPayment);
router.post('/payment-failed', handlePaymentFailure);
router.post('/cancel-razorpay-order', cancelRazorpayOrder);

// Success and failure page routes
router.get('/success/:id', getOrderSuccess);
router.get('/failed/:id', getOrderFailure);

export default router; 