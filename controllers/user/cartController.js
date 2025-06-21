import Cart from '../../models/cartModel.js';
import Product from '../../models/ProductModel.js';
import Coupon from '../../models/couponModel.js';
import { getBestOffer } from './productController.js';
import { calculateCartTotals } from '../../utils/cartHelper.js';

// Add to cart 
export const addToCart = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
    }

    const userId = req.session.user._id || req.session.user.id;

    const { productId, size, quantity } = req.body;

    // Validate input
    if (!productId || !size || !quantity) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Find product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if product is blocked
    if (product.isBlocked) {
      return res.status(400).json({ success: false, message: 'This product is currently unavailable and cannot be added to your cart.' });
    }

    // Validate size
    const sizeObj = product.sizes.find(s => s.size === parseInt(size));
    if (!sizeObj) {
      return res.status(400).json({ success: false, message: 'Invalid size selected' });
    }

    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }
    if (qty > sizeObj.quantity) {
      return res.status(400).json({ success: false, message: 'Not enough stock available' });
    }

    // Get best offer for the product
    const bestOffer = await getBestOffer(productId);
    
    // Calculate price with offer if available
    let finalPrice = product.price;
    if (bestOffer) {
      const discountAmount = (product.price * bestOffer.discount) / 100;
      finalPrice = product.price - discountAmount;
    }

    // Find or create cart for the user
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId && item.size === size
    );

    if (existingItemIndex > -1) {
      // Update existing item
      const newQuantity = cart.items[existingItemIndex].quantity + qty;
      if (newQuantity > sizeObj.quantity) {
        return res.status(400).json({ success: false, message: 'Not enough stock available' });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].price = finalPrice; // Update price in case offer changed
    } else {
      // Add new item
      cart.items.push({
        product: product._id,
        size,
        quantity: qty,
        price: finalPrice
      });
    }

    // Save cart (pre-save hook will calculate subtotal)
    await cart.save();

    // Populate product details for response
    await cart.populate('items.product');

    res.json({
      success: true,
      message: 'Item added to cart',
      cart
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Failed to add item to cart' });
  }
};

/**
 * Checks if a coupon applied to the cart is still valid after a cart modification.
 * If the coupon is no longer valid, it is removed from the cart.
 *
 * @param {object} cart - The user's cart object, populated with coupon details.
 * @returns {string|null} A message if the coupon was removed, otherwise null.
 */
const checkAndUpdateCoupon = async (cart) => {
  if (!cart.coupon) {
    return null; // No coupon to check
  }

  // Ensure coupon details are populated
  if (!cart.populated('coupon')) {
    await cart.populate('coupon');
  }

  const coupon = cart.coupon;
  const subtotal = cart.subtotal; // Subtotal is already recalculated by the pre-save hook

  let removalReason = null;

  if (subtotal < coupon.minAmount) {
    removalReason = `The previously applied coupon was removed because your order total is now below the minimum requirement of ₹${coupon.minAmount}.`;
  }

  if (removalReason) {
    // Revert coupon usage stats
    await Coupon.findByIdAndUpdate(coupon._id, {
      $pull: { usedBy: cart.user }, // Remove user from the usedBy list
      $inc: { usageCount: -1 } // Decrement the usage count
    });

    // Remove coupon from cart
    cart.coupon = null;
    cart.couponCode = null;

    return removalReason;
  }

  return null; // Coupon is still valid
};

// Update cart item quantity
export const updateCartItem = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Please login to update cart' });
    }

    const userId = req.session.user._id || req.session.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    // Find cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(item => item.product.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    // Check stock availability
    const product = await Product.findById(itemId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Check if product is blocked
    if (product.isBlocked) {
      // Remove the blocked item from cart
      cart.items = cart.items.filter(item => item.product.toString() !== itemId);
      await cart.save();
      
      // Populate product details for response
      await cart.populate('items.product');
      
      return res.status(400).json({ 
        success: false, 
        message: 'This product is no longer available and has been removed from your cart.',
        cart
      });
    }

    // Find the size object for stock check
    const sizeObj = product.sizes.find(s => s.size === parseInt(cart.items[itemIndex].size));
    if (!sizeObj || qty > sizeObj.quantity) {
      return res.status(400).json({ success: false, message: 'Not enough stock available' });
    }

    // Get best offer and calculate price
    const bestOffer = await getBestOffer(itemId);
    let finalPrice = product.price;
    if (bestOffer) {
      const discountAmount = (product.price * bestOffer.discount) / 100;
      finalPrice = product.price - discountAmount;
    }

    // Update quantity and ensure price is current
    cart.items[itemIndex].quantity = qty;
    cart.items[itemIndex].price = finalPrice;

    // Save cart (pre-save hook will calculate subtotal)
    await cart.save();

    // After saving, check if the applied coupon is still valid
    const couponRemovalMessage = await checkAndUpdateCoupon(cart);
    if (couponRemovalMessage) {
      await cart.save(); // Save again to persist coupon removal
    }

    // Recalculate final totals with the helper
    const updatedCartData = await calculateCartTotals(cart);

    res.json({
      success: true,
      message: 'Cart updated',
      couponMessage: couponRemovalMessage, // Send removal message to frontend
      cart: updatedCartData
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Please login to remove items' });
    }

    const userId = req.session.user._id || req.session.user.id;
    const { itemId } = req.params;
    const { size } = req.body;

    if (!size) {
      return res.status(400).json({ success: false, message: 'Size is required' });
    }

    // Find cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Remove item from cart based on both product ID and size
    cart.items = cart.items.filter(item => 
      !(item.product.toString() === itemId && item.size === size)
    );

    // Save cart (pre-save hook will calculate subtotal)
    await cart.save();
    
    // After saving, check if the applied coupon is still valid
    const couponRemovalMessage = await checkAndUpdateCoupon(cart);
    if (couponRemovalMessage) {
      await cart.save(); // Save again to persist coupon removal
    }

    // Recalculate final totals with the helper
    const updatedCartData = await calculateCartTotals(cart);

    res.json({
      success: true,
      message: 'Item removed from cart',
      couponMessage: couponRemovalMessage, // Send removal message to frontend
      cart: updatedCartData
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Failed to remove item from cart' });
  }
};

// Apply coupon to cart
export const applyCoupon = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Please login to apply a coupon.'
            });
        }

        const userId = req.session.user._id;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a coupon code.'
            });
        }

        // Find cart and check if a coupon is already applied
        const cart = await Cart.findOne({ user: userId });
        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Your cart is empty. Add items to apply a coupon.'
            });
        }
        if (cart.coupon) {
            return res.status(400).json({
                success: false,
                message: 'A coupon has already been applied. Please remove it first to apply a new one.'
            });
        }

        // Find the coupon
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon code not found. Please check the code and try again.'
            });
        }

        // --- Start Advanced Validation ---

        // 1. Check if coupon is active
        if (!coupon.isActive) {
            return res.status(400).json({
                success: false,
                message: 'This coupon is currently inactive.'
            });
        }

        // 2. Check date validity
        const now = new Date();
        if (now < coupon.validFrom) {
            return res.status(400).json({
                success: false,
                message: `This coupon is not valid until ${coupon.validFrom.toLocaleDateString()}.`
            });
        }
        if (now > coupon.validUntil) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has expired.'
            });
        }

        // 3. Check usage limits (total and per user)
        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has reached its maximum usage limit.'
            });
        }

        // 4. Check if coupon has been used by this user before
        if (coupon.usedBy.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You have already redeemed this coupon.'
            });
        }

        // 5. Check minimum purchase amount
        const subtotal = cart.subtotal;
        if (subtotal < coupon.minAmount) {
            return res.status(400).json({
                success: false,
                message: `Your order must be at least ₹${coupon.minAmount} to use this coupon. Your current total is ₹${subtotal.toFixed(2)}.`
            });
        }

        // --- End Advanced Validation ---

        // If all checks pass, apply the coupon
        cart.coupon = coupon._id;
        cart.couponCode = coupon.code; // Store for display purposes
        
        // IMPORTANT: Increment usage count and add user to usedBy list
        coupon.usageCount += 1;
        coupon.usedBy.push(userId);
        
        await Promise.all([cart.save(), coupon.save()]);

        // Repopulate the cart to include the new coupon details
        const populatedCart = await Cart.findById(cart._id).populate(['items.product', 'coupon']);

        // Recalculate cart totals with the new coupon
        const updatedCartData = await calculateCartTotals(populatedCart);

        res.json({
            success: true,
            message: 'Coupon applied successfully!',
            cart: updatedCartData
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while applying the coupon. Please try again.'
        });
    }
};

// Remove coupon from cart
export const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    if (!cart.coupon) {
      return res.status(400).json({ success: false, message: 'No coupon to remove.' });
    }

    // Clear coupon from cart
    cart.coupon = null;
    cart.couponCode = null;
    await cart.save();
    
    // IMPORTANT: Repopulate the cart to get item details
    const populatedCart = await Cart.findById(cart._id).populate(['items.product', 'coupon']);

    // Recalculate totals without the coupon
    const updatedCartData = await calculateCartTotals(populatedCart);

    res.json({ 
      success: true, 
      message: 'Coupon removed successfully!',
      cart: updatedCartData
    });
  } catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({ success: false, message: 'Server error while removing coupon.' });
  }
};

// Validate stock availability for all items in cart
export const validateStock = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Please login to validate stock' });
    }

    const userId = req.session.user._id || req.session.user.id;

    // Find cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({
        isValid: true,
        issues: []
      });
    }

    // Populate product details
    await cart.populate('items.product');

    const issues = [];
    let hasStockIssues = false;

    // Check each item in cart
    for (const item of cart.items) {
      if (!item.product || item.product.isBlocked) {
        hasStockIssues = true;
        issues.push({
          name: item.product ? item.product.name : 'Unknown Product',
          size: item.size,
          requested: item.quantity,
          available: 0,
          reason: 'Product is no longer available'
        });
        continue;
      }

      // Find the size object for stock check
      const sizeObj = item.product.sizes.find(s => s.size === parseInt(item.size));
      if (!sizeObj) {
        hasStockIssues = true;
        issues.push({
          name: item.product.name,
          size: item.size,
          requested: item.quantity,
          available: 0,
          reason: 'Size no longer available'
        });
        continue;
      }

      const stockAvailable = sizeObj.quantity;
      if (stockAvailable < item.quantity) {
        hasStockIssues = true;
        issues.push({
          name: item.product.name,
          size: item.size,
          requested: item.quantity,
          available: stockAvailable,
          reason: 'Insufficient stock'
        });
      }
    }

    res.json({
      isValid: !hasStockIssues,
      issues: issues
    });
  } catch (error) {
    console.error('Error validating stock:', error);
    res.status(500).json({ 
      isValid: false, 
      issues: [{
        name: 'Unknown Product',
        size: 'Unknown',
        requested: 0,
        available: 0,
        reason: 'Error checking stock'
      }]
    });
  }
}; 