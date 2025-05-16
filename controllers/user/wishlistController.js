import User from '../../models/userModel.js';
import Product from '../../models/ProductModel.js';
import Wishlist from '../../models/wishlistModel.js';
import mongoose from 'mongoose';
import Cart from '../../models/cartModel.js';

// Validation helper
const validateProductData = async (productId) => {
    const results = {
        isValid: false,
        errors: [],
        product: null
    };

    try {
        const product = await Product.findById(productId).lean();
        if (!product) {
            results.errors.push('Product not found');
            return results;
        }

        results.product = product;

        if (!product.sizes || !Array.isArray(product.sizes)) {
            results.errors.push('Invalid sizes array');
        } else {
            let hasValidSizes = false;
            product.sizes.forEach((size, index) => {
                if (typeof size === 'object') {
                    if (typeof size.size !== 'number' || size.size < 0) {
                        results.errors.push(`Invalid size at ${index}`);
                    }
                    if (typeof size.quantity !== 'number' || size.quantity < 0) {
                        results.errors.push(`Invalid quantity at ${index}`);
                    }
                    if (size.quantity > 0) hasValidSizes = true;
                } else if (typeof size === 'number') {
                    if (size >= 0) hasValidSizes = true;
                    else results.errors.push(`Invalid size at ${index}`);
                } else {
                    results.errors.push(`Invalid size data at ${index}`);
                }
            });
            if (!hasValidSizes) results.errors.push('No valid sizes found');
        }

        if (!product.name) results.errors.push('Missing product name');
        if (typeof product.price !== 'number' || product.price < 0) results.errors.push('Invalid price');
        if (product.isDeleted) results.errors.push('Product is deleted');
        if (product.isBlocked) results.errors.push('Product is blocked');

        results.isValid = results.errors.length === 0;
        return results;

    } catch (error) {
        results.errors.push('Database error: ' + error.message);
        return results;
    }
};

// Updated getWishlist
const getWishlist = async (req, res) => {
    try {
        console.log('==================== START WISHLIST ====================');
        
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login');
        }

        console.log('User ID:', req.session.user._id);

        // Get wishlist
        let wishlist = await Wishlist.findOne({ user: req.session.user._id });
        
        if (!wishlist) {
            console.log('No wishlist found, creating new one');
            wishlist = new Wishlist({ user: req.session.user._id, items: [] });
            await wishlist.save();
        } else {
            console.log('Found existing wishlist with', wishlist.items.length, 'items');
            console.log('Wishlist items before population:', wishlist.items);
        }

        // Populate product data
        await wishlist.populate({
            path: 'items.product',
            model: 'Product',
            select: 'name price images sizes isDeleted isBlocked brand description category'
        });

        console.log('Wishlist after population:', 
            wishlist.items.map(item => ({
                productName: item.product.name,
                size: item.size,
                productSizes: item.product.sizes
            }))
        );

        // Convert to plain object
        const wishlistObj = wishlist.toObject();

        // Process items
        if (wishlistObj.items && Array.isArray(wishlistObj.items)) {
            wishlistObj.items = wishlistObj.items
                .filter(item => item && item.product && !item.product.isDeleted && !item.product.isBlocked)
                .map(item => {
                    try {
                        const product = item.product;
                        const itemSize = Number(item.size);

                        console.log('\nProcessing product:', product.name);
                        console.log('Looking for size:', itemSize);
                        console.log('Available sizes:', product.sizes);

                        // Find the selected size
                        const selectedSizeObj = product.sizes.find(s => Number(s.size) === itemSize);
                        
                        console.log('Found size object:', selectedSizeObj);

                        // Calculate stock status
                        const selectedSizeStock = selectedSizeObj ? selectedSizeObj.quantity : 0;
                        const hasStock = selectedSizeStock > 0;

                        console.log('Stock calculation:', {
                            size: itemSize,
                            quantity: selectedSizeStock,
                            hasStock: hasStock
                        });

                        return {
                            ...item,
                            product: {
                                ...product,
                                hasStock,
                                selectedSizeStock
                            }
                        };
                    } catch (error) {
                        console.error('Error processing item:', error);
                        return null;
                    }
                })
                .filter(Boolean);
        }

        console.log('==================== END WISHLIST ====================');

        return res.render('user/wishlist', {
            title: 'My Wishlist',
            user: req.session.user,
            wishlist: wishlistObj
        });

    } catch (error) {
        console.error('Error in getWishlist:', error);
        return res.render('error', {
            message: 'Error loading wishlist',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

const addToWishlist = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user._id) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const productId = req.params.productId;
    let { size } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    if (!size) {
      return res.status(400).json({ success: false, message: 'Size is required' });
    }

    // Convert size to number
    size = Number(size);
    if (isNaN(size)) {
      return res.status(400).json({ success: false, message: 'Invalid size format' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    console.log('Adding to wishlist:', {
      productId,
      productName: product.name,
      requestedSize: size,
      availableSizes: product.sizes
    });

    // Find the size entry in the product's sizes array
    const sizeEntry = product.sizes.find(s => Number(s.size) === size);
    console.log('Found size entry:', sizeEntry);

    if (!sizeEntry) {
      return res.status(400).json({ success: false, message: `Size ${size} not available` });
    }

    if (sizeEntry.quantity <= 0) {
      return res.status(400).json({ success: false, message: `Size ${size} is out of stock` });
    }

    let wishlist = await Wishlist.findOne({ user: req.session.user._id });
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.session.user._id, items: [] });
    }

    // Check if product with same size already exists in wishlist
    const exists = wishlist.items.some(item => {
      const itemMatches = item.product.toString() === productId && Number(item.size) === size;
      console.log('Checking existing item:', {
        existingProduct: item.product.toString(),
        existingSize: item.size,
        requestedProduct: productId,
        requestedSize: size,
        matches: itemMatches
      });
      return itemMatches;
    });

    if (exists) {
      return res.status(400).json({ success: false, message: 'Already in wishlist' });
    }

    // Add to wishlist with the size as number
    wishlist.items.push({ 
      product: productId, 
      size: size,  // Already converted to number above
      quantity: 1,
      addedAt: new Date() 
    });
    
    await wishlist.save();
    res.json({ success: true, message: 'Added to wishlist' });

  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ success: false, message: 'Error adding product to wishlist' });
  }
};


const removeFromWishlist = async (req, res) => {
  try {
    const productId = req.params.productId;
    let { size } = req.body;

    // If size is not provided, we'll remove all items with this productId
    const shouldRemoveAll = !size;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Only validate size if it's provided
    if (size) {
      size = Number(size);
      if (isNaN(size)) {
        return res.status(400).json({ success: false, message: 'Invalid size format' });
      }
    }

    const wishlist = await Wishlist.findOne({ user: req.session.user._id });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    console.log('Removing item:', {
      productId,
      size,
      shouldRemoveAll,
      currentItems: wishlist.items.map(item => ({
        product: item.product.toString(),
        size: item.size,
        sizeType: typeof item.size
      }))
    });

    // Remove items based on condition
    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(item => {
      if (shouldRemoveAll) {
        return item.product.toString() !== productId;
      } else {
        return !(item.product.toString() === productId && Number(item.size) === size);
      }
    });

    if (wishlist.items.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Item not found in wishlist' });
    }

    await wishlist.save();
    res.json({ success: true, message: 'Removed from wishlist' });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ success: false, message: 'Error removing product from wishlist' });
  }
};


const clearWishlist = async (req, res) => {
    try {
        const result = await Wishlist.findOneAndUpdate(
            { user: req.session.user._id },
            { $set: { items: [] } },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        res.json({ success: true, message: 'Wishlist cleared' });

    } catch (error) {
        console.error('Error clearing wishlist:', error);
        res.status(500).json({ success: false, message: 'Error clearing wishlist' });
    }
};

const moveToCart = async (req, res) => {
    try {
        const productId = req.params.productId;
        const { size } = req.body;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        if (!size) {
            return res.status(400).json({ success: false, message: 'Please select a size' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const productSize = product.sizes.find(s => s.size === size);
        if (!productSize || productSize.quantity <= 0) {
            return res.status(400).json({ success: false, message: `Size ${size} is out of stock` });
        }

        let cart = await Cart.findOne({ user: req.session.user._id });
        if (!cart) cart = new Cart({ user: req.session.user._id, items: [] });

        const existingItem = cart.items.find(i => i.product.toString() === productId && i.size === size);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.items.push({ product: productId, size, quantity: 1, price: product.price });
        }

        await cart.save();

        const wishlist = await Wishlist.findOne({ user: req.session.user._id });
        if (wishlist) {
            wishlist.items = wishlist.items.filter(item =>
                !(item.product.toString() === productId && item.size === size)
            );
            await wishlist.save();
        }

        res.json({ success: true, message: 'Moved to cart successfully' });

    } catch (error) {
        console.error('Error moving to cart:', error);
        res.status(500).json({ success: false, message: 'Error moving product to cart' });
    }
};

export {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    moveToCart
};
