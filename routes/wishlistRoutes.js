import express from 'express';
import { isAuthenticated as auth } from '../middleware/authMiddleware.js';
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    moveToCart
} from '../controllers/user/wishlistController.js';

const router = express.Router();

// Get wishlist page
router.get('/', auth, getWishlist);

// Add item to wishlist
router.post('/add/:productId', auth, addToWishlist);

// Remove item from wishlist
router.post('/remove/:productId', auth, removeFromWishlist);

// Clear entire wishlist
router.post('/clear', auth, clearWishlist);

// Move item from wishlist to cart
router.post('/move-to-cart/:productId', auth, moveToCart);

export default router; 