import Cart from '../../models/cartModel.js';
import Product from '../../models/ProductModel.js';
import Coupon from '../../models/couponModel.js';
import { getBestOffer } from './productController.js';

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

    // Populate product details for response
    await cart.populate('items.product');

    res.json({
      success: true,
      message: 'Cart updated',
      cart
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

    // Populate product details for response
    await cart.populate('items.product');

    res.json({
      success: true,
      message: 'Item removed from cart',
      cart
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
                message: 'Please login to apply coupon'
            });
        }

        const userId = req.session.user._id;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code is required'
            });
        }

        // Find cart
        const cart = await Cart.findOne({ user: userId });
        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Find coupon
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        // Debug logs before validation
        console.log('--- Before Coupon Validation ---');
        console.log('Cart subtotal:', cart.subtotal);
        console.log('Coupon:', coupon);
        console.log('Current time:', new Date());
        console.log('Valid from:', coupon.validFrom);
        console.log('Valid until:', coupon.validUntil);
        console.log('Is active:', coupon.isActive);
        console.log('Usage count:', coupon.usageCount);
        console.log('Usage limit:', coupon.usageLimit);

        // Validate coupon
        if (!coupon.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Coupon is inactive'
            });
        }

        const now = new Date();
        if (now < coupon.validFrom) {
            return res.status(400).json({
                success: false,
                message: `Coupon is not valid until ${coupon.validFrom.toLocaleDateString()}`
            });
        }

        if (now > coupon.validUntil) {
            return res.status(400).json({
                success: false,
                message: 'Coupon has expired'
            });
        }

        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: 'Coupon usage limit reached'
            });
        }

        // Check minimum order amount
        if (cart.subtotal < coupon.minAmount) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount of ₹${coupon.minAmount} is required for this coupon`
            });
        }

        // Apply coupon
        await cart.applyCoupon(coupon);
        await cart.save();

        // Debug logs
        console.log('--- After Coupon Application ---');
        console.log('Cart subtotal:', cart.subtotal);
        console.log('Coupon:', coupon);
        console.log('Cart discount after applying coupon:', cart.discount);
        console.log('Cart couponCode:', cart.couponCode);
        console.log('--------------------');

        // Increment usage count
        coupon.usageCount += 1;
        await coupon.save();

        // Populate cart items and coupon for response
        await cart.populate('items.product');
        await cart.populate('coupon');

        // Calculate final amount
        const finalAmount = cart.subtotal - cart.discount;

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            cart: {
                ...cart.toObject(),
                couponDiscount: cart.discount,
                couponCode: cart.couponCode,
                finalAmount
            },
            coupon: {
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                description: coupon.description
            },
            discount: cart.discount
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply coupon'
        });
    }
};

// Remove coupon from cart
export const removeCoupon = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Please login to remove coupon'
            });
        }

        const userId = req.session.user._id;

        // Find cart
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        // Debug logs before removal
        console.log('--- Before Coupon Removal ---');
        console.log('Cart ID:', cart._id);
        console.log('Current coupon:', cart.coupon);
        console.log('Current discount:', cart.discount);
        console.log('Current couponCode:', cart.couponCode);

        // If there was a coupon, decrement its usage count
        if (cart.coupon) {
            const coupon = await Coupon.findById(cart.coupon);
            if (coupon && coupon.usageCount > 0) {
                coupon.usageCount -= 1;
                await coupon.save();
            }
        }

        // Remove coupon from cart
        cart.coupon = null;
        cart.discount = 0;
        cart.couponCode = null;
        await cart.save();

        // Debug logs after removal
        console.log('--- After Coupon Removal ---');
        console.log('Cart ID:', cart._id);
        console.log('Coupon removed:', cart.coupon === null);
        console.log('Discount reset:', cart.discount === 0);
        console.log('CouponCode cleared:', cart.couponCode === null);

        // Populate cart items for response
        await cart.populate('items.product');

        res.json({
            success: true,
            message: 'Coupon removed successfully',
            cart: {
                ...cart.toObject(),
                discount: 0,
                couponCode: null
            }
        });
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove coupon'
        });
    }
}; 