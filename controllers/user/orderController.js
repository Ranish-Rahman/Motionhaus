import Order from '../../models/orderModel.js';
import Product from '../../models/ProductModel.js';  // Ensure Product model is imported if used for stock updates
import mongoose from 'mongoose';
import { nanoid } from 'nanoid'; // Ensure nanoid is imported
import Cart from '../../models/cartModel.js';
import Address from '../../models/addressModel.js';
import Razorpay from 'razorpay';
import User from '../../models/userModel.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

// Place Order function
export const placeOrder = async (req, res) => {
  console.log('=== ORDER PLACEMENT STARTED ===');
  console.log('Request body:', req.body);
  
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.session.user._id;

    // Validate required fields
    if (!addressId) {
      throw new Error('Delivery address is required');
    }

    // Get the cart items
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new Error('Your cart is empty');
    }

    // Get the selected address
    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress) {
      throw new Error('Selected address not found');
    }

    // Filter out blocked products
    const validItems = cart.items.filter(item => item.product && !item.product.isBlocked);
    if (validItems.length === 0) {
      throw new Error('All items in your cart are no longer available');
    }

    console.log('Processing cart items:', validItems);

  if(paymentMethod === 'wallet'){
    const user = await User.findById(userId);
    if(!user.wallet || user.wallet.balance < cart.subtotal){
    throw new Error('Insufficient wallet balance to place the order');
    }
    user.wallet.balance -= cart.subtotal;
    await user.save();

  }

    // Generate custom orderID
    const orderID = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${nanoid(8).toUpperCase()}`;

    // Check stock availability for each item
    for (const item of validItems) {
      const product = await Product.findById(item.product._id);
      console.log(`Checking stock for product ${item.product._id}:`, {
        product: product?.name,
        size: item.size,
        requestedQuantity: item.quantity
      });
      
      if (!product) {
        throw new Error(`Product not found: ${item.product.name}`);
      }

      // Find the size in the product's sizes array
      const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
      if (!sizeObj) {
        throw new Error(`Size ${item.size} not available for ${product.name}`);
      }

      if (sizeObj.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name} in size ${item.size}`);
      }
    }

    // Create order
    const order = new Order({
      orderID,
      user: userId,
      items: validItems.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        size: item.size
      })),
      totalAmount: cart.subtotal,
      shippingAddress: {
        fullName: selectedAddress.fullName,
        address: selectedAddress.addressLine1 + (selectedAddress.addressLine2 ? ', ' + selectedAddress.addressLine2 : ''),
        city: selectedAddress.city,
        state: selectedAddress.state,
        postalCode: selectedAddress.zipCode,
        phone: selectedAddress.phone
      },
      paymentMethod: ['wallet', 'razorpay'].includes(paymentMethod) ? paymentMethod : 'cod',
      status: 'Pending',
      paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending'
    });

    await order.save();
    console.log('Order created successfully:', orderID);

    if(paymentMethod === 'razorpay') {
      const options = {
        amount: cart.subtotal * 100, // Amount in paise
        currency: 'INR',
        receipt: orderID,
        payment_capture: 1 
      };

      const razorpayOrder = await razorpay.orders.create(options);
      
      // Update order with Razorpay order ID
      order.paymentDetails = {
        razorpayOrderId: razorpayOrder.id
      };
      await order.save();

      return res.json({
        success: true,
        isRazorpay: true,
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          orderID: order.orderID
        }
      });
    }

    // Decrease stock for each item
    for (const item of validItems) {
      console.log(`Attempting to reduce stock for product ${item.product._id} size ${item.size} by ${item.quantity}`);
      
      const product = await Product.findById(item.product._id);
      const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
      
      // Reduce stock for this size
      sizeObj.quantity -= item.quantity;
      await product.save();
      
      console.log('Stock update result:', {
        productId: item.product._id,
        size: item.size,
        newStock: sizeObj.quantity
      });
    }

    // Clear the cart
    cart.items = [];
    cart.subtotal = 0;
    await cart.save();

    console.log('Order process completed successfully');

    // Check if the request wants JSON response
    if (req.xhr || req.headers.accept?.includes('application/json') || req.headers['content-type']?.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Order placed successfully',
        order: {
          _id: order._id,
          orderID: order.orderID,
          createdAt: order.createdAt,
          total: order.totalAmount,
          paymentMethod: order.paymentMethod,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
    }

    // For regular form submissions, redirect to order success page
    res.render('user/order-success', {
      order: {
        orderNumber: order.orderID,
        createdAt: order.createdAt,
        total: order.totalAmount,
        paymentMethod: order.paymentMethod
      }
    });
  } catch (err) {
    console.error('Order placement failed:', err);
    
    // Check if the request wants JSON response
    if (req.xhr || req.headers.accept?.includes('application/json') || req.headers['content-type']?.includes('application/json')) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    // For regular form submissions, send error page
    res.status(500).send('Error placing order: ' + err.message);
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
      const product = await Product.findById(item.product._id);
      if (product) {
        // Find the size in the product's sizes array
        const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
        if (sizeObj) {
          // Increment stock for this size
          sizeObj.quantity += item.quantity;
          await product.save();
          console.log(`Updated stock for product ${product.name} size ${item.size}: +${item.quantity}`);
        } else {
          console.error(`Size ${item.size} not found for product ${product.name}`);
        }
      }
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

    const order = await Order.findById(orderId).populate('items.product');
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

// Add new function to handle return approval
export const approveItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Find the specific item
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    // Check if item has a pending return request
    if (!item.returnRequest || item.returnRequest.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'No pending return request found for this item' 
      });
    }

    // Update return request status
    item.returnRequest.status = 'approved';
    item.returnRequest.processedAt = new Date();
    item.status = 'Returned';

    // Increment stock for the product
    if (item.product) {
      console.log('Attempting to increment stock for returned item:', {
        productId: item.product._id,
        size: item.size,
        quantity: item.quantity
      });

      const product = await Product.findById(item.product._id);
      if (product) {
        // Find the size in the product's sizes array
        const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
        if (sizeObj) {
          // Increment stock for this size
          sizeObj.quantity += item.quantity;
          await product.save();
          console.log('Stock updated successfully:', {
            productName: product.name,
            size: item.size,
            newQuantity: sizeObj.quantity
          });
        } else {
          console.error(`Size ${item.size} not found for product ${product.name}`);
          return res.status(500).json({
            success: false,
            message: `Size ${item.size} not found for product ${product.name}`
          });
        }
      } else {
        console.error(`Product not found: ${item.product._id}`);
        return res.status(500).json({
          success: false,
          message: 'Product not found'
        });
      }
    }

    // Save the updated order
    await order.save();

    return res.json({ 
      success: true, 
      message: 'Return request approved and stock updated successfully',
      order: {
        status: order.status,
        items: order.items
      }
    });
  } catch (error) {
    console.error('Error approving item return:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to approve return request',
      error: error.message 
    });
  }
};

// Cancel entire order
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    
    console.log('Cancelling order:', { orderId, reason });
    
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      console.log('Order not found:', orderId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    console.log('Current order status:', order.status);

    // Check if order can be cancelled (case-insensitive)
    const allowedStatuses = ['pending', 'confirmed', 'processing'];
    if (!allowedStatuses.includes(order.status.toLowerCase())) {
      console.log('Order cannot be cancelled. Current status:', order.status);
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be cancelled in its current state (${order.status})` 
      });
    }

    // Update order status
    order.status = 'Cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date();

    // Increment stock for each product
    for (const item of order.items) {
      if (item.product) {
        item.product.stock += item.quantity;
        await item.product.save();
        console.log(`Updated stock for product ${item.product._id}: +${item.quantity}`);
      }
    }

    // Save the updated order
    await order.save();
    console.log('Order cancelled successfully:', orderId);

    return res.json({ 
      success: true, 
      message: 'Order cancelled successfully',
      order: {
        status: order.status,
        cancelledAt: order.cancelledAt
      }
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel order',
      error: error.message 
    });
  }
};
