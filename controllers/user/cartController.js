import Cart from '../../models/cartModel.js';
import Product from '../../models/ProductModel.js';

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
    } else {
      // Add new item
      cart.items.push({
        product: product._id,
        size,
        quantity: qty,
        price: product.price
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
    
    if (qty > product.stock) {
      return res.status(400).json({ success: false, message: 'Not enough stock available' });
    }

    // Update quantity
    cart.items[itemIndex].quantity = qty;

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