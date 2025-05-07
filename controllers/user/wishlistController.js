import User from '../../models/userModel.js';
import Product from '../../models/ProductModel.js';
import Wishlist from '../../models/wishlistModel.js';
import mongoose from 'mongoose';

// Get wishlist page
const getWishlist = async (req, res) => {
    try {
        // First check if user exists and is authenticated
        if (!req.user || !req.user._id) {
            return res.redirect('/login');
        }

        let wishlist = await Wishlist.findOne({ user: req.user._id })
            .populate({
                path: 'items.product',
                select: 'name images price originalPrice stock'
            });

        // Initialize wishlist if it doesn't exist
        if (!wishlist) {
            wishlist = new Wishlist({
                user: req.user._id,
                items: []
            });
            await wishlist.save();
        }

        return res.render('user/wishlist', {
            title: 'My Wishlist',
            user: req.user,
            wishlist: wishlist || { items: [] }
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return res.status(500).render('error', {
            message: 'Error loading wishlist',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

// Add item to wishlist
const addToWishlist = async (req, res) => {
    try {
        const productId = req.params.productId;

        // Validate productId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        let wishlist = await Wishlist.findOne({ user: req.user._id });
        
        // Create wishlist if it doesn't exist
        if (!wishlist) {
            wishlist = new Wishlist({
                user: req.user._id,
                items: []
            });
        }

        // Check if product already exists in wishlist
        if (wishlist.hasProduct(productId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Product already in wishlist' 
            });
        }

        // Add to wishlist
        wishlist.addProduct(productId);
        await wishlist.save();

        res.json({ 
            success: true, 
            message: 'Product added to wishlist successfully' 
        });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding product to wishlist' 
        });
    }
};

// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const productId = req.params.productId;

        // Validate productId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        const wishlist = await Wishlist.findOne({ user: req.user._id });

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found'
            });
        }

        if (!wishlist.hasProduct(productId)) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in wishlist'
            });
        }

        wishlist.removeProduct(productId);
        await wishlist.save();

        res.json({ 
            success: true, 
            message: 'Product removed from wishlist successfully' 
        });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error removing product from wishlist' 
        });
    }
};

// Clear entire wishlist
const clearWishlist = async (req, res) => {
    try {
        const result = await Wishlist.findOneAndUpdate(
            { user: req.user._id },
            { $set: { items: [] } },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found'
            });
        }

        res.json({ 
            success: true, 
            message: 'Wishlist cleared successfully' 
        });
    } catch (error) {
        console.error('Error clearing wishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error clearing wishlist' 
        });
    }
};

// Move item from wishlist to cart
const moveToCart = async (req, res) => {
    try {
        const productId = req.params.productId;

        // Validate productId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        const wishlist = await Wishlist.findOne({ user: req.user._id });
        
        if (!wishlist || !wishlist.hasProduct(productId)) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in wishlist'
            });
        }

        // Add to cart
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if product is in stock
        if (product.stock === 0) {
            return res.status(400).json({
                success: false,
                message: 'Product is out of stock'
            });
        }

        const user = await User.findById(req.user._id);

        // Add to cart logic here (assuming you have a cart model/schema)
        if (!user.cart) {
            user.cart = { items: [] };
        }

        const cartItem = user.cart.items.find(item => 
            item.product.toString() === productId
        );

        if (cartItem) {
            cartItem.quantity += 1;
        } else {
            user.cart.items.push({
                product: productId,
                quantity: 1
            });
        }

        // Remove from wishlist
        wishlist.removeProduct(productId);

        // Save both documents
        await Promise.all([
            user.save(),
            wishlist.save()
        ]);

        res.json({
            success: true,
            message: 'Product moved to cart successfully'
        });
    } catch (error) {
        console.error('Error moving item to cart:', error);
        res.status(500).json({
            success: false,
            message: 'Error moving product to cart'
        });
    }
};

export {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    moveToCart
}; 