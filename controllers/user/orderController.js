import Order from '../../models/orderModel.js';
import Product from '../../models/ProductModel.js';  // Ensure Product model is imported if used for stock updates

// Place Order function
export const placeOrder = async (req, res) => {
  try {
    const cartItems = req.body.items;
    const userId = req.session.user._id;
    
    // Generate custom orderID
    const orderID = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${nanoid(8).toUpperCase()}`;

    const order = new Order({
      orderID,
      user: userId,
      items: cartItems.map(item => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price
      })),
      totalAmount: req.body.totalAmount,
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
    });

    await order.save();

    // Decrease stock for each item
    for (const item of cartItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    res.redirect('/orders');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error placing order');
  }
};

// Request Return function
export const requestReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Please provide a reason for return' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order is delivered
    if (order.status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: 'Return can only be requested for delivered orders' 
      });
    }

    // Check if return request already exists
    if (order.returnRequest && order.returnRequest.status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Return request already exists for this order' 
      });
    }

    // Create a new return request
    order.returnRequest = {
      status: 'pending',
      reason,
      requestedAt: new Date()
    };

    // Save the updated order
    await order.save();

    res.status(200).json({ 
      success: true, 
      message: 'Return request submitted successfully' 
    });
  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing return request' 
    });
  }
};

// Deny Return Request function
export const denyReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if the return request exists and is pending
    if (order.returnRequest && order.returnRequest.status === 'pending') {
      // Deny the return request
      order.returnRequest.status = 'denied';
      order.returnRequest.processedAt = new Date(); // Track when the request was denied

      // Save the updated order
      await order.save();

      return res.status(200).json({ success: true, message: 'Return request denied successfully' });
    } else {
      return res.status(400).json({ success: false, message: 'Return request is not in pending state' });
    }
  } catch (error) {
    console.error('Error denying return request:', error);
    return res.status(500).json({ success: false, message: 'Error processing denial of return request' });
  }
};

// Cancel individual item
export const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a reason for cancellation' 
      });
    }
    
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Find the specific item
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    // Check if item is already cancelled
    if (item.status === 'Cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Item is already cancelled' 
      });
    }

    // Check if order can be cancelled
    const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Partially Cancelled'];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Items cannot be cancelled in the current order state (${order.status})` 
      });
    }

    // Update item status
    item.status = 'Cancelled';
    item.cancelReason = reason;

    // Increment stock for the product
    if (item.product) {
      item.product.stock += item.quantity;
      await item.product.save();
    }

    // Check if all items are cancelled
    const allItemsCancelled = order.items.every(item => item.status === 'Cancelled');
    if (allItemsCancelled) {
      order.status = 'Cancelled';
    } else {
      order.status = 'Partially Cancelled';
    }

    // Save the updated order
    await order.save();

    return res.json({ 
      success: true, 
      message: 'Item cancelled successfully',
      order: {
        status: order.status,
        items: order.items
      }
    });
  } catch (error) {
    console.error('Error cancelling item:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel item',
      error: error.message 
    });
  }
};

// Request return for individual item
export const requestItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Please provide a reason for return' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Find the specific item
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    // Check if item is delivered
    if (item.status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: 'Return can only be requested for delivered items' 
      });
    }

    // Check if item already has a return request
    if (item.returnRequest && item.returnRequest.status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Return request already exists for this item' 
      });
    }

    // Create a new return request for the item
    item.returnRequest = {
      status: 'pending',
      reason,
      requestedAt: new Date()
    };

    // Save the updated order
    await order.save();

    res.status(200).json({ 
      success: true, 
      message: 'Return request submitted successfully' 
    });
  } catch (error) {
    console.error('Error requesting item return:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing return request' 
    });
  }
};
