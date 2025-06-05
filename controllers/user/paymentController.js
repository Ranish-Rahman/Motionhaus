import crypto from 'crypto';
import Cart from '../../models/cartModel.js';
import Product from '../../models/ProductModel.js';
import Order from '../../models/orderModel.js';
import { nanoid } from 'nanoid';
import Address from '../../models/addressModel.js';
import razorpay from '../../utils/razorpay.js';
import { getBestOffer } from './productController.js';

export const createRazorpayOrder = async (req, res) => {
  try {
    const { retryOrderId, isRetry } = req.body;
    console.log('[Debug] Creating Razorpay order:', req.body);
    console.log('[Debug] Session data:', req.session.pendingOrder);
    
    const userId = req.session.user._id;
    console.log('[Debug] User ID:', userId);

    let orderAmount;
    let orderItems;
    let existingOrder;
    let shippingAddress;
    let subtotal = 0;
    let discountAmount = 0;
    let finalAmount = 0;

    if (isRetry && retryOrderId) {
      console.log('[Debug] Fetching existing order for retry. OrderID:', retryOrderId);
      
      // First check session data
      if (req.session.pendingOrder && 
          (req.session.pendingOrder.orderID === retryOrderId || 
           req.session.pendingOrder.razorpayOrderId === retryOrderId)) {
        console.log('[Debug] Found order in session:', req.session.pendingOrder);
        orderAmount = req.session.pendingOrder.totalAmount;
        orderItems = req.session.pendingOrder.items;
        shippingAddress = req.session.pendingOrder.shippingAddress;
        subtotal = req.session.pendingOrder.originalAmount || orderAmount;
        discountAmount = req.session.pendingOrder.discountAmount || 0;
        finalAmount = req.session.pendingOrder.totalAmount;
        existingOrder = await Order.findOne({ 
          $or: [
            { orderID: req.session.pendingOrder.orderID },
            { 'paymentDetails.razorpayOrderId': req.session.pendingOrder.razorpayOrderId }
          ],
          user: userId
        });
      }

      // If not found in session or no matching order, try database
      if (!existingOrder) {
        existingOrder = await Order.findOne({
          $or: [
            { orderID: retryOrderId, user: userId },
            { 'paymentDetails.razorpayOrderId': retryOrderId, user: userId },
            { 'paymentDetails.previousRazorpayOrderIds': retryOrderId, user: userId }
          ]
        });
      }

      // If still not found and it's a Razorpay order ID, create minimal order data
      if (!existingOrder && retryOrderId.startsWith('order_')) {
        console.log('[Debug] Creating minimal order data for Razorpay order');
        
        // Try to get cart data for the order
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (cart && cart.items && cart.items.length > 0) {
          orderItems = cart.items;
          orderAmount = cart.items.reduce((total, item) => 
            total + (item.product.price * item.quantity), 0
          );
        }

        // Get user's default address
        const defaultAddress = await Address.findOne({ 
          userId: userId,
          isDefault: true 
        });

        if (!defaultAddress) {
          return res.status(400).json({
            success: false,
            message: 'No shipping address found. Please add a shipping address and try again.'
          });
        }

        existingOrder = new Order({
          orderID: `ORD-${Date.now()}-${nanoid(8).toUpperCase()}`,
          user: userId,
          items: orderItems.map(item => ({
            product: item.product._id,
            quantity: item.quantity,
            price: item.price,
            originalPrice: item.product.price || item.price,
            size: item.size,
            status: 'Pending'
          })) || [],
          totalAmount: orderAmount || 0,
          status: 'Pending',
          paymentStatus: 'pending',
          paymentMethod: 'razorpay',
          shippingAddress: {
            fullName: defaultAddress.fullName,
            phone: defaultAddress.phone,
            address: defaultAddress.addressLine1 + (defaultAddress.addressLine2 ? ', ' + defaultAddress.addressLine2 : ''),
            city: defaultAddress.city,
            state: defaultAddress.state,
            postalCode: defaultAddress.zipCode,
            country: defaultAddress.country
          },
          paymentDetails: {
            razorpayOrderId: retryOrderId
          }
        });
      }

      if (!existingOrder) {
        console.error('[Debug] Failed to find or create order for retry:', {
          retryOrderId,
          userId,
          sessionData: req.session.pendingOrder
        });
        return res.status(404).json({
          success: false,
          message: 'Original order not found'
        });
      }

      console.log('[Debug] Using order for retry:', {
        orderID: existingOrder.orderID,
        _id: existingOrder._id,
        amount: existingOrder.totalAmount,
        status: existingOrder.status
      });

      orderAmount = existingOrder.totalAmount;
      orderItems = existingOrder.items;
      shippingAddress = existingOrder.shippingAddress;
      subtotal = existingOrder.totalAmount;  // For retries without discount info
      finalAmount = existingOrder.totalAmount;
    } else {
      // Handle new order creation
      const cart = await Cart.findOne({ user: userId }).populate('items.product');
      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }

      // Validate items and calculate total
      const validItems = cart.items.filter(item => 
        item.product && !item.product.isBlocked && !item.product.isDeleted
      );

      if (validItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid items in cart'
        });
      }

      // Calculate amounts considering discounts
      subtotal = validItems.reduce((total, item) => 
        total + (item.product.price * item.quantity), 0
      );
      
      // Calculate discounts for each item
      for (const item of validItems) {
        const offer = await getBestOffer(item.product._id);
        if (offer) {
          const itemSubtotal = item.product.price * item.quantity;
          const itemDiscount = Math.round((itemSubtotal * offer.discount) / 100);
          discountAmount += itemDiscount;
        }
      }

      finalAmount = subtotal - discountAmount;
      orderAmount = finalAmount;

      // Calculate per-item discount proportionally
      const discountRatio = discountAmount > 0 ? discountAmount / subtotal : 0;
      orderItems = validItems.map(item => {
        const itemSubtotal = item.product.price * item.quantity;
        const itemDiscount = Math.round(itemSubtotal * discountRatio * 100) / 100;
        const finalItemPrice = Math.round((itemSubtotal - itemDiscount) * 100) / 100;
        
        return {
          product: item.product._id,
          quantity: item.quantity,
          price: finalItemPrice / item.quantity, // Per unit price after discount
          originalPrice: item.product.price,
          discountAmount: itemDiscount,
          size: item.size
        };
      });

      // Get shipping address
      const addressId = req.body.addressId;
      if (!addressId) {
        return res.status(400).json({
          success: false,
          message: 'Shipping address is required'
        });
      }

      shippingAddress = await Address.findOne({
        _id: addressId,
        userId: userId
      });

      if (!shippingAddress) {
        return res.status(400).json({
          success: false,
          message: 'Invalid shipping address'
        });
      }
    }

    // Create Razorpay order
    const amountInPaise = Math.round(orderAmount * 100);
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: existingOrder?.orderID || `ORD-${Date.now()}-${nanoid(8).toUpperCase()}`,
      payment_capture: 1,
      notes: {
        internal_order_id: existingOrder?.orderID || 'new_order',
        originalAmount: subtotal,
        discountAmount: discountAmount,
        finalAmount: finalAmount
      }
    };

    console.log('[Debug] Creating Razorpay order with options:', orderOptions);
    const razorpayOrder = await razorpay.orders.create(orderOptions);

    // Update existing order with new Razorpay order ID if this is a retry
    if (existingOrder) {
      existingOrder.paymentDetails = existingOrder.paymentDetails || {};
      existingOrder.paymentDetails.previousRazorpayOrderIds = existingOrder.paymentDetails.previousRazorpayOrderIds || [];
      
      if (existingOrder.paymentDetails.razorpayOrderId) {
        existingOrder.paymentDetails.previousRazorpayOrderIds.push(existingOrder.paymentDetails.razorpayOrderId);
      }
      
      existingOrder.paymentDetails.razorpayOrderId = razorpayOrder.id;
      await existingOrder.save();
    }

    // Store complete order information in session
    req.session.pendingOrder = {
      orderID: existingOrder?.orderID || orderOptions.receipt,
      razorpayOrderId: razorpayOrder.id,
      totalAmount: finalAmount,
      originalAmount: subtotal,
      discountAmount: discountAmount,
      items: orderItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice,
        discountAmount: item.discountAmount,
        size: item.size
      })),
      shippingAddress: shippingAddress,
      userId: userId,
      isRetry: Boolean(existingOrder)
    };

    // Save session explicitly
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          console.error('[Debug] Error saving session:', err);
          reject(err);
        } else {
          console.log('[Debug] Session saved successfully with pendingOrder:', req.session.pendingOrder);
          resolve();
        }
      });
    });

    // Send response
    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: razorpayOrder.currency,
      receipt: existingOrder?.orderID || orderOptions.receipt,
      key: process.env.RAZORPAY_KEY_ID,
      customerName: req.session.user.username,
      customerEmail: req.session.user.email,
      customerPhone: req.session.user.phone,
      notes: {
        internal_order_id: existingOrder?.orderID || orderOptions.receipt
      }
    });

  } catch (error) {
    console.error('[Debug] Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order'
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      orderID,
      isRetry
    } = req.body;

    console.log('[Debug] Verifying payment:', {
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      isRetry,    
      orderID,
      sessionData: {
        hasPendingOrder: !!req.session.pendingOrder,
        pendingOrderID: req.session.pendingOrder?.orderID,
        pendingRazorpayOrderId: req.session.pendingOrder?.razorpayOrderId
      }
    });

    // Verify the payment signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    const userId = req.session.user._id;
    let order;

    // Check session data matches
    if (req.session.pendingOrder && 
       (req.session.pendingOrder.razorpayOrderId === razorpay_order_id || 
        req.session.pendingOrder.orderID === orderID)) {
      
      // Try to find existing order
      order = await Order.findOne({
        $or: [
          { orderID: req.session.pendingOrder.orderID },
          { 'paymentDetails.razorpayOrderId': razorpay_order_id }
        ],
        user: userId
      });

      if (!order) {
        console.log('[Debug] Creating new order from session data');
        // Create new order from session data
        const orderItems = req.session.pendingOrder.items.map(item => ({
          product: item.product?._id || item.product, // Handle both populated and unpopulated products
          quantity: item.quantity,
          price: item.price,
          originalPrice: item.originalPrice,
          size: item.size,
          status: 'Pending'
        }));

        // Validate all items have product IDs
        const validItems = orderItems.filter(item => item.product);
        if (validItems.length === 0) {
          throw new Error('No valid items found in order');
        }

        order = new Order({
          orderID: req.session.pendingOrder.orderID,
          user: userId,
          items: validItems,
          totalAmount: req.session.pendingOrder.totalAmount,
          originalAmount: req.session.pendingOrder.originalAmount,
          discountAmount: req.session.pendingOrder.discountAmount,
          shippingAddress: {
            fullName: req.session.pendingOrder.shippingAddress.fullName,
            address: req.session.pendingOrder.shippingAddress.addressLine1 + 
                    (req.session.pendingOrder.shippingAddress.addressLine2 ? ', ' + req.session.pendingOrder.shippingAddress.addressLine2 : ''),
            city: req.session.pendingOrder.shippingAddress.city,
            state: req.session.pendingOrder.shippingAddress.state,
            postalCode: req.session.pendingOrder.shippingAddress.zipCode,
            phone: req.session.pendingOrder.shippingAddress.phone
          },
          status: 'Completed',
          paymentStatus: 'paid',
          paymentMethod: 'razorpay',
          paymentDetails: {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
          }
        });
      } else {
        // Update existing order
        order.status = 'Completed';
        order.paymentStatus = 'paid';
        order.paymentDetails = {
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        };
    }

    await order.save();

      // Clear cart
      await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [], subtotal: 0, discount: 0 } }
      );

      // Clear session data
      delete req.session.pendingOrder;
      await new Promise((resolve) => req.session.save(resolve));

      return res.json({
      success: true,
      message: "Payment verified successfully",
      orderId: order._id
    });
    }

    // If we get here, something went wrong
    console.error('[Debug] Payment verification failed:', {
      sessionMatch: false,
      pendingOrder: req.session.pendingOrder?.orderID,
      razorpayOrderId: razorpay_order_id,
      orderID
    });

    throw new Error('Invalid order session or mismatch in order IDs');

  } catch (error) {
    console.error('[Debug] Payment verification error:', error);
    // Forward to payment failure handler
    await handlePaymentFailure(req, res);
  }
};

export const handlePaymentFailure = async (req, res) => {
  try {
    const { orderID, razorpayOrderId, error } = req.body;
    const userId = req.session.user._id;

    console.log('[Debug] Handling failed payment:', { 
      orderID, 
      razorpayOrderId,
      error,
      sessionData: {
        hasPendingOrder: !!req.session.pendingOrder,
        pendingOrderID: req.session.pendingOrder?.orderID,
        requestedOrderID: orderID
      }
    });

    // First check if order already exists
    let order = await Order.findOne({ 
      $or: [
        { orderID: orderID },
        { 'paymentDetails.razorpayOrderId': razorpayOrderId }
      ],
      user: userId 
    });

    if (!order && req.session.pendingOrder) {
      console.log('[Debug] Creating new order for failed payment from session');
      
      const orderItems = req.session.pendingOrder.items.map(item => ({
        product: item.product?._id || item.product,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice,
        size: item.size,
        status: 'Failed'
      }));

      // Validate all items have product IDs
      const validItems = orderItems.filter(item => item.product);
      if (validItems.length === 0) {
        throw new Error('No valid items found in order');
      }

      order = new Order({
        orderID: req.session.pendingOrder.orderID,
        user: userId,
        items: validItems,
        totalAmount: req.session.pendingOrder.totalAmount,
        originalAmount: req.session.pendingOrder.originalAmount,
        discountAmount: req.session.pendingOrder.discountAmount,
        shippingAddress: req.session.pendingOrder.shippingAddress,
        paymentMethod: 'razorpay',
        status: 'payment-failed',
        paymentStatus: 'failed',
        cancelReason: error || 'Payment failed',
        paymentDetails: {
          razorpayOrderId: razorpayOrderId || req.session.pendingOrder.razorpayOrderId
        }
      });

      await order.save();
    }

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data'
      });
    }

    // Clear session and cart
    delete req.session.pendingOrder;
    await Promise.all([
      new Promise((resolve) => req.session.save(resolve)),
      Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [], subtotal: 0, discount: 0 } }
      )
    ]);

    res.json({
      success: true,
      message: 'Payment failure handled successfully',
      orderId: order.orderID
    });
  } catch (error) {
    console.error('[Debug] Error handling payment failure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle payment failure',
      error: error.message
    });
  }
};