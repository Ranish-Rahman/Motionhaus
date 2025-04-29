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
import { addToCart, updateCartItem, removeFromCart } from '../controllers/user/cartController.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';
import Address from '../models/addressModel.js';
import Cart from '../models/cartModel.js';
import Order from '../models/Order.js';

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

// Add checkout route
router.get('/checkout', async (req, res) => {
  try {
    // Fetch user's addresses from the database
    const addresses = await Address.find({ userId: req.session.user.id });
    
    res.render('user/checkout', { 
      cart: req.session.cart || { items: [], subtotal: 0 },
      addresses: addresses
    });
  } catch (error) {
    console.error('Error fetching addresses for checkout:', error);
    res.render('user/checkout', { 
      cart: req.session.cart || { items: [], subtotal: 0 },
      addresses: []
    });
  }
});

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

// Order routes
router.post('/order/create', async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    
    // Validate required fields
    if (!addressId || !paymentMethod) {
      return res.status(400).json({ message: 'Address and payment method are required' });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.session.user._id }).populate('items.product');
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    // Create order
    const order = new Order({
      user: req.session.user._id,
      address: addressId,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        size: item.size
      })),
      total: cart.subtotal,
      paymentMethod,
      status: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'not_paid'
    });

    await order.save();

    // Clear the cart
    cart.items = [];
    cart.subtotal = 0;
    await cart.save();

    res.status(200).json({ 
      message: 'Order placed successfully',
      orderId: order._id 
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

export default router;

