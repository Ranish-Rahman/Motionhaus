import Product from '../../models/ProductModel.js';

// Add to cart
export const addToCart = async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
    }

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

    // Validate size
    if (!product.sizes.includes(parseInt(size))) {
      return res.status(400).json({ success: false, message: 'Invalid size selected' });
    }

    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }
    if (qty > product.stock) {
      return res.status(400).json({ success: false, message: 'Not enough stock available' });
    }

    // Initialize cart if it doesn't exist
    if (!req.session.cart) {
      req.session.cart = {
        items: [],
        subtotal: 0
      };
    }

    // Check if item already exists in cart
    const existingItemIndex = req.session.cart.items.findIndex(
      item => item.product._id.toString() === productId && item.size === parseInt(size)
    );

    if (existingItemIndex > -1) {
      // Update existing item
      const newQuantity = req.session.cart.items[existingItemIndex].quantity + qty;
      if (newQuantity > product.stock) {
        return res.status(400).json({ success: false, message: 'Not enough stock available' });
      }
      req.session.cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      req.session.cart.items.push({
        product: {
          _id: product._id,
          name: product.name,
          price: product.price,
          images: product.images
        },
        size: parseInt(size),
        quantity: qty
      });
    }

    // Calculate subtotal
    req.session.cart.subtotal = req.session.cart.items.reduce(
      (total, item) => total + (item.product.price * item.quantity),
      0
    );

    res.json({
      success: true,
      message: 'Item added to cart',
      cart: req.session.cart
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

    const { itemId } = req.params;
    const { quantity } = req.body;

    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    // Find item in cart
    const itemIndex = req.session.cart.items.findIndex(item => item.product._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    // Check stock availability
    const product = await Product.findById(itemId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (qty > product.stock) {
      return res.status(400).json({ success: false, message: 'Not enough stock available' });
    }

    // Update quantity
    req.session.cart.items[itemIndex].quantity = qty;

    // Recalculate subtotal
    req.session.cart.subtotal = req.session.cart.items.reduce(
      (total, item) => total + (item.product.price * item.quantity),
      0
    );

    res.json({
      success: true,
      message: 'Cart updated',
      cart: req.session.cart
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

    const { itemId } = req.params;

    // Remove item from cart
    req.session.cart.items = req.session.cart.items.filter(
      item => item.product._id.toString() !== itemId
    );

    // Recalculate subtotal
    req.session.cart.subtotal = req.session.cart.items.reduce(
      (total, item) => total + (item.product.price * item.quantity),
      0
    );

    res.json({
      success: true,
      message: 'Item removed from cart',
      cart: req.session.cart
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Failed to remove item from cart' });
  }
}; 