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
} from '../controllers/user/userController.js';
import { 
  requestReturn, 
  placeOrder, 
  cancelOrderItem, 
  requestItemReturn,
  approveItemReturn,
  cancelOrder 
} from '../controllers/user/orderController.js';
import { listProducts, getProductDetails } from '../controllers/user/productController.js';
import { addToCart, updateCartItem, removeFromCart } from '../controllers/user/cartController.js';
import { getWishlist, addToWishlist, removeFromWishlist, clearWishlist, moveToCart } from '../controllers/user/wishlistController.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';
import { getPasswordRules } from '../utils/passwordValidation.js';
import { verifyPayment, createRazorpayOrder } from '../controllers/user/paymentController.js';
import Order from '../models/orderModel.js';
import razorpay from '../utils/razorpay.js';

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

// Search route (public)
router.get('/search', liveSearch);

// Apply session check to protected routes
router.use(sessionCheck);

// Protected routes (require session)
router.get('/home', getHome);
router.get('/cart', getCart);
router.post('/cart/add', addToCart);
router.post('/cart/update/:itemId', updateCartItem);
router.post('/cart/remove/:itemId', removeFromCart);

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
router.get('/profile/orders', async (req, res) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Number of orders per page
        const skip = (page - 1) * limit;

        // Get total count of orders
        const totalOrders = await Order.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        // Get orders for current page
        const orders = await Order.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('items.product');

        res.render('user/orders', {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            limit
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        req.flash('error', 'Failed to load orders');
        res.redirect('/profile');
    }
});

router.get('/profile/orders/:id', getOrderDetails);
router.get('/profile/orders/:id/invoice', generateInvoice);
router.post('/order/create', placeOrder);
router.post('/order/:orderId/cancel', cancelOrder);
router.post('/order/:orderId/item/:itemId/cancel', cancelOrderItem);
router.post('/order/:orderId/item/:itemId/return', requestItemReturn);
router.post('/order/:orderId/item/:itemId/return/approve', approveItemReturn);

// Product-related routes
router.get('/products', listProducts);
router.get('/products/:id', getProductDetails);

// Checkout and password routes
router.get('/checkout', getCheckout);
router.get('/profile/change-password', getChangePassword);
router.post('/profile/change-password', postChangePassword);

// Return request route
router.post('/order/:orderId/return', requestReturn);

// Add password rules endpoint
router.get('/api/password-rules', (req, res) => {
  res.json(getPasswordRules());
});

// Order success route
router.get('/order/success/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/profile/orders');
    }
    res.render('user/order-success', {
      order: {
        orderID: order.orderID,
        createdAt: order.createdAt,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    req.flash('error', 'Failed to load order details');
    res.redirect('/profile/orders');
  }
});

// Order failure route
router.get('/order/failed/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/profile/orders');
    }
    res.render('user/order-failed', {
      order: {
        orderID: order.orderID,
        createdAt: order.createdAt,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod
      },
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    req.flash('error', 'Failed to load order details');
    res.redirect('/profile/orders');
  }
});

// Payment verification route
router.post('/order/verify-payment', sessionCheck, verifyPayment);

// Razorpay order route
router.post('/order/create-razorpay-order', sessionCheck, createRazorpayOrder);

// Cancel Razorpay order route
router.post('/order/cancel-razorpay-order', sessionCheck, async (req, res) => {
  try {
    const { orderID, razorpayOrderId } = req.body;
    const userId = req.session.user._id;

    // Find and delete the order
    const order = await Order.findOneAndDelete({ 
      orderID, 
      user: userId,
      paymentStatus: 'pending'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or already processed'
      });
    }

    // Try to cancel the Razorpay order
    try {
      await razorpay.orders.cancel(razorpayOrderId);
    } catch (error) {
      console.error('Error cancelling Razorpay order:', error);
      // Continue even if Razorpay cancellation fails
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
});

export default router;
