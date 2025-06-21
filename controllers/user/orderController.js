import Order from '../../models/orderModel.js';
import Product from '../../models/ProductModel.js';  // Ensure Product model is imported if used for stock updates
import mongoose from 'mongoose';
import { nanoid } from 'nanoid'; // Ensure nanoid is imported
import Cart from '../../models/cartModel.js';
import Address from '../../models/addressModel.js';
import User from '../../models/userModel.js';
import razorpay from '../../utils/razorpay.js';
import Transaction from '../../models/transactionModel.js';
import { addRefund } from './walletController.js';

// Place Order function
export const placeOrder = async (req, res) => {
  console.log('=== COD/WALLET ORDER PLACEMENT STARTED ===');

  try {
    const userId = req.session.user._id;
    const { addressId, paymentMethod } = req.body;

    // 1. Get checkout data from session - THIS IS THE SINGLE SOURCE OF TRUTH
    const checkoutData = req.session.checkoutData;
    if (!checkoutData) {
      return res.status(400).json({
        success: false,
        message: 'Your session has expired. Please return to checkout and try again.'
      });
    }

    // Use the verified amounts from the session
    const { finalAmount, cartTotal, totalDiscount, items: checkoutItems, couponCode } = checkoutData;
    const orderID = `ORD-${Date.now()}-${nanoid(6)}`;

    // Get selected address
    const selectedAddress = await Address.findById(addressId).lean();
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    // 2. STOCK VALIDATION: Use items from checkoutData for validation
    for (const item of checkoutItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product with ID ${item.product} not found.`);
      }
      const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
      if (!sizeObj) {
        throw new Error(`Size ${item.size} not available for ${product.name}`);
      }
      if (sizeObj.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name} (Size: ${item.size}). Only ${sizeObj.quantity} left.`,
          outOfStock: true
        });
      }
    }

    // 3. Handle wallet payment using the verified finalAmount
    if (paymentMethod === 'wallet') {
      const user = await User.findById(userId);
      const walletBalance = user.wallet?.balance || 0;
      if (walletBalance < finalAmount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance'
        });
      }

      // Deduct from wallet and record transaction
      user.wallet.balance -= finalAmount;
      const transaction = new Transaction({
        user: userId,
        type: 'debit',
        amount: finalAmount,
        description: `Payment for order ${orderID}`,
        balance: user.wallet.balance,
        status: 'completed'
      });
      await Promise.all([user.save(), transaction.save()]);
    }

    // 4. Create the new order using checkoutData from session
    const order = new Order({
      orderID,
      user: userId,
      items: checkoutItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice,
        size: item.size
      })),
      totalAmount: finalAmount,
      originalAmount: cartTotal,
      discountAmount: totalDiscount,
      coupon: couponCode, // Store the coupon code used
      shippingAddress: {
        fullName: selectedAddress.fullName,
        address: selectedAddress.addressLine1 + (selectedAddress.addressLine2 ? ', ' + selectedAddress.addressLine2 : ''),
        city: selectedAddress.city,
        state: selectedAddress.state,
        postalCode: selectedAddress.zipCode,
        phone: selectedAddress.phone
      },
      paymentMethod,
      status: 'pending', // Initial status
      paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending'
    });

    await order.save();
    console.log('Order created successfully with unified calculation:', orderID);

    // 5. Decrease stock after successful order creation
    for (const item of checkoutItems) {
      await Product.updateOne({
        _id: item.product,
        'sizes.size': item.size
      }, {
        $inc: {
          'sizes.$.quantity': -item.quantity
        }
      });
    }

    // 6. Clear user cart and session data
    await Cart.findOneAndDelete({ user: userId });
    delete req.session.checkoutData;
    delete req.session.pendingOrder; // Also clear any pending razorpay orders
    await req.session.save();

    res.json({
      success: true,
      orderID: order.orderID, // Use the ID from the created order document
      message: 'Order placed successfully'
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to place order'
    });
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

    // Calculate refund amount for the item
    const refundAmount = item.price * item.quantity;

    // Process refund to wallet if payment was made
    if (order.paymentStatus === 'paid' && ['razorpay', 'wallet', 'cod'].includes(order.paymentMethod)) {
      try {
        await addRefund(
          order.user,
          refundAmount,
          `Refund for cancelled item in order #${order.orderID}`,
          order._id
        );
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process refund'
        });
      }
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

    // Calculate refund amount for the item
    const refundAmount = item.price * item.quantity;

    // Process refund to wallet
    try {
      await addRefund(
        order.user,
        refundAmount,
        `Refund for returned item in order #${order.orderID}`,
        order._id
      );
    } catch (refundError) {
      console.error('Error processing refund:', refundError);
      return res.status(500).json({
        success: false,
        message: 'Failed to process refund'
      });
    }

    // Update item status
    item.status = 'returned';
    item.returnRequest.status = 'approved';
    item.returnRequest.processedAt = new Date();

    // Check if all items are returned
    const allItemsReturned = order.items.every(item => item.status === 'returned');
    if (allItemsReturned) {
      order.status = 'returned';
    }

    // Save the updated order
    await order.save();

    return res.json({ 
      success: true, 
      message: 'Return request approved and refund processed',
      order: {
        status: order.status,
        items: order.items
      }
    });
  } catch (error) {
    console.error('Approve return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve return'
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

    // If payment was made, process refund to wallet
    if (order.paymentStatus === 'paid' && ['razorpay', 'wallet'].includes(order.paymentMethod)) {
      try {
        await addRefund(
          order.user,
          order.totalAmount,
          `Refund for cancelled order #${order.orderID}`,
          order._id
        );
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process refund'
        });
      }
    }

    // Update order status
    order.status = 'cancelled';
    order.cancelReason = reason;

    // Save the updated order
    await order.save();

    console.log('Order cancelled successfully');

    // Decrease stock for each item
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
        if (sizeObj) {
          sizeObj.quantity += item.quantity;
          await product.save();
          console.log(`Updated stock for product ${product.name} size ${item.size}: +${item.quantity}`);
        } else {
          console.error(`Size ${item.size} not found for product ${product.name}`);
        }
      }
    }

    // Clear the cart
    const cart = await Cart.findOne({ user: order.user });
    if (cart) {
      cart.items = [];
      cart.subtotal = 0;
      await cart.save();
    }

    if (req.xhr || req.headers.accept?.includes('application/json') || req.headers['content-type']?.includes('application/json')) {
    return res.json({ 
      success: true, 
      message: 'Order cancelled successfully',
      order: {
          _id: order._id,
          orderID: order.orderID,
          createdAt: order.createdAt,
          total: order.totalAmount,
          paymentMethod: order.paymentMethod,
        status: order.status,
          cancelReason: order.cancelReason
        }
      });
    }

    res.render('user/order-cancelled', {
      order: {
        orderNumber: order.orderID,
        createdAt: order.createdAt,
        total: order.totalAmount,
        paymentMethod: order.paymentMethod,
        cancelReason: order.cancelReason
      }
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
};

// Retry Payment endpoint
export const retryPayment = async (req, res) => {
  try {
    // Test log to verify Razorpay configuration
    console.log('Razorpay Configuration Check:', {
      keyIdExists: !!process.env.RAZORPAY_KEY_ID,
      keySecretExists: !!process.env.RAZORPAY_KEY_SECRET,
      keyIdLength: process.env.RAZORPAY_KEY_ID?.length,
      keySecretLength: process.env.RAZORPAY_KEY_SECRET?.length
    });

    const { orderId } = req.params;
    const userId = req.session.user._id;

    // Find the order and populate user details
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order is eligible for payment retry
    if (order.paymentStatus !== 'failed' || order.paymentMethod !== 'razorpay') {
      return res.status(400).json({ 
        success: false, 
        message: 'This order is not eligible for payment retry' 
      });
    }

    // Validate shipping address
    if (!order.shippingAddress || !order.shippingAddress.address || !order.shippingAddress.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shipping address. Please update the order with complete shipping details.'
      });
    }

    console.log('Creating Razorpay order with amount:', order.totalAmount);

    // Create new Razorpay order
    const options = {
      amount: Math.round(order.totalAmount * 100), // Amount in paise, ensure it's rounded
      currency: 'INR',
      receipt: order.orderID,
      payment_capture: 1,
      notes: {
        orderID: order.orderID,
        mongoOrderId: order._id.toString()
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);
    console.log('Razorpay order created:', razorpayOrder);

    res.json({
      success: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: razorpayOrder.id,
      receipt: razorpayOrder.receipt,
      orderData: {
        orderID: order.orderID,
        totalAmount: order.totalAmount
      }
    });

  } catch (error) {
    console.error('Error retrying payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error initializing payment retry'
    });
  }
};

// Verify Payment endpoint
export const verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const userId = req.session.user._id;

    console.log('Verifying payment:', {
      orderId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    });

    // Find the order and populate product details
    const order = await Order.findOne({ _id: orderId, user: userId }).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const crypto = await import('crypto');
    
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('Razorpay secret key not found in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Payment verification failed - Configuration error'
      });
    }

    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    console.log('Signature verification:', {
      expected: expectedSignature,
      received: razorpay_signature
    });

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // If payment is successful, decrease stock
    try {
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (!product) {
          console.error(`Product not found: ${item.product._id}`);
          continue;
        }
        const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
        if (!sizeObj) {
          console.error(`Size ${item.size} not found for product ${product.name}`);
          continue;
        }
        sizeObj.quantity -= item.quantity;
        await product.save();
        console.log(`Updated stock for product ${product.name} size ${item.size}: -${item.quantity}`);
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      // Even if stock update fails, we'll continue with order update
      // but log the error for manual intervention
    }

    // Update order payment status
    order.paymentStatus = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpayOrderId = razorpay_order_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();

    console.log('Payment verified and order updated successfully');

    res.json({
      success: true,
      message: 'Payment verified successfully'
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error verifying payment'
    });
  }
};