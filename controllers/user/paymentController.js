import crypto from 'crypto';
import Cart from '../../models/cartModel.js';
import Product from '../../models/ProductModel.js';
import Order from '../../models/orderModel.js';
import { nanoid } from 'nanoid';
import Address from '../../models/addressModel.js';
import razorpay from '../../utils/razorpay.js';
import { getBestOffer } from './productController.js';
import Razorpay from 'razorpay';

// Initialize Razorpay
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Generate unique order ID
const generateOrderId = () => {
    return `ORD-${Date.now()}-${nanoid(8).toUpperCase()}`;
};

export const createRazorpayOrder = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not logged in'
            });
        }

        // Get checkout data from session
        const checkoutData = req.session.checkoutData;
        if (!checkoutData) {
            return res.status(400).json({
                success: false,
                message: 'Checkout data not found. Please try again.'
            });
        }

        // Get shipping address
        const shippingAddress = await Address.findOne({ _id: addressId, userId });
        if (!shippingAddress) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shipping address'
            });
        }

        // Use the verified amounts from checkout data
        const originalAmount = checkoutData.cartTotal;
        const discountAmount = checkoutData.totalDiscount;
        const finalAmount = checkoutData.finalAmount;

        console.log('[Debug] Price calculation:', {
            originalAmount,
            discountAmount,
            finalAmount,
            hasDiscount: discountAmount > 0,
            items: checkoutData.items.map(item => ({
                name: item.product?.name,
                originalPrice: item.originalPrice,
                finalPrice: item.price,
                discount: item.discountAmount
            }))
        });

        if (finalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order amount'
            });
        }

        const orderID = generateOrderId();
        const amountInPaise = Math.round(finalAmount * 100);

        // Create Razorpay order with proper description
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: orderID,
            payment_capture: 1,
            notes: {
                internal_order_id: orderID,
                originalAmount,
                discountAmount,
                finalAmount,
                isRetry: false,
                paymentAttempt: 1,
                couponCode: checkoutData.couponCode || null
            }
        });

        // Save order details in session
        req.session.pendingOrder = {
            orderID,
            razorpayOrderId: razorpayOrder.id,
            totalAmount: finalAmount,
            originalAmount,
            discountAmount,
            items: checkoutData.items,
            shippingAddress: {
                _id: shippingAddress._id,
                userId: shippingAddress.userId,
                fullName: shippingAddress.fullName,
                phone: shippingAddress.phone,
                addressLine1: shippingAddress.addressLine1,
                addressLine2: shippingAddress.addressLine2,
                city: shippingAddress.city,
                state: shippingAddress.state,
                zipCode: shippingAddress.zipCode,
                country: shippingAddress.country,
                addressType: shippingAddress.addressType,
                isDefault: shippingAddress.isDefault
            },
            userId: userId,
            isRetry: false,
            couponCode: checkoutData.couponCode || null,
            paymentMethod: 'razorpay'
        };

        await req.session.save();
        console.log('[Debug] Session saved with pendingOrder:', req.session.pendingOrder);

        // Return response with proper price information
        res.json({
            success: true,
            order: razorpayOrder,
            orderID,
            priceDetails: {
                originalAmount,
                discountAmount,
                finalAmount,
                hasDiscount: discountAmount > 0,
                discountType: checkoutData.couponCode ? 'coupon' : (checkoutData.items.some(item => item.offerDiscount > 0) ? 'offer' : null)
            }
        });

    } catch (error) {
        console.error('[Debug] Error in createRazorpayOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order: ' + error.message
        });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderID } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not logged in'
            });
        }

        const pendingOrder = req.session.pendingOrder;
        if (!pendingOrder) {
            console.error('[Debug] verifyPayment: No pending order found in session');
            return res.status(400).json({
                success: false,
                message: 'No pending order found'
            });
        }

        const orderIdToSearch = orderID || pendingOrder.orderID;

        console.log('[Debug] verifyPayment - IDs:', {
            sessionRazorpayOrderId: pendingOrder.razorpayOrderId,
            receivedRazorpayOrderId: razorpay_order_id,
            sessionInternalOrderID: pendingOrder.orderID,
            receivedInternalOrderID: orderIdToSearch
        });

        if (pendingOrder.razorpayOrderId !== razorpay_order_id || pendingOrder.orderID !== orderIdToSearch) {
            console.error('[Debug] verifyPayment - Order ID mismatch:', {
                pendingRazorpayOrderId: pendingOrder.razorpayOrderId,
                receivedRazorpayOrderId: razorpay_order_id,
                pendingInternalOrderID: pendingOrder.orderID,
                receivedInternalOrderID: orderIdToSearch
            });
            return res.status(400).json({
                success: false,
                message: 'Order ID mismatch'
            });
        }

        if (razorpay_signature) {
            const generated_signature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(razorpay_order_id + '|' + razorpay_payment_id)
                .digest('hex');

            if (generated_signature !== razorpay_signature) {
                console.error('[Debug] Signature mismatch:', {
                    generated: generated_signature,
                    received: razorpay_signature
                });
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment signature'
                });
            }
        }

        const order = await Order.findOneAndUpdate(
            { 
                orderID: orderIdToSearch,
                user: userId
            },
            {
                $setOnInsert: {
                    orderID: orderIdToSearch,
                    user: userId,
                    items: pendingOrder.items,
                    totalAmount: pendingOrder.totalAmount,
                    originalAmount: pendingOrder.originalAmount,
                    discountAmount: pendingOrder.discountAmount,
                    shippingAddress: {
                        fullName: pendingOrder.shippingAddress.fullName,
                        address: pendingOrder.shippingAddress.addressLine1 + 
                            (pendingOrder.shippingAddress.addressLine2 ? ', ' + pendingOrder.shippingAddress.addressLine2 : ''),
                        city: pendingOrder.shippingAddress.city,
                        state: pendingOrder.shippingAddress.state,
                        postalCode: pendingOrder.shippingAddress.zipCode,
                        phone: pendingOrder.shippingAddress.phone
                    },
                    status: 'Pending',
                    paymentStatus: 'paid',
                    paymentMethod: 'razorpay',
                    paymentDetails: {
                        razorpayOrderId: razorpay_order_id,
                        razorpayPaymentId: razorpay_payment_id,
                        razorpaySignature: razorpay_signature || null,
                        paymentAttempts: 1,
                        lastPaymentAttempt: new Date()
                    }
                }
            },
            { 
                upsert: true,
                new: true,
                runValidators: true
            }
        );

        await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { items: [], couponDiscount: 0, coupon: null } }
        );

        req.session.pendingOrder = null;
        req.session.couponDiscount = 0;
        req.session.coupon = null;
        await req.session.save();

        res.json({
            success: true,
            message: 'Payment verified successfully',
            order: {
                orderID: order.orderID,
                status: order.status,
                totalAmount: order.totalAmount
            }
        });

    } catch (error) {
        console.error('[Debug] Error in verifyPayment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment: ' + error.message
        });
    }
};

export const handlePaymentFailure = async (req, res) => {
  try {
    const { orderID, razorpayOrderId, error } = req.body;
    const userId = req.session.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not logged in'
      });
    }

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

    // Use findOneAndUpdate with upsert to prevent double order creation
    const order = await Order.findOneAndUpdate(
      { 
        $or: [
          { orderID: orderID },
          { 'paymentDetails.razorpayOrderId': razorpayOrderId }
        ],
        user: userId 
      },
      {
        $setOnInsert: {
          orderID: req.session.pendingOrder?.orderID || `ORD-${Date.now()}-${nanoid(8).toUpperCase()}`,
          user: userId,
          items: req.session.pendingOrder?.items.map(item => ({
            product: item.product?._id || item.product,
            quantity: item.quantity,
            price: item.price,
            originalPrice: item.originalPrice,
            size: item.size,
            status: 'Failed'
          })) || [],
          totalAmount: req.session.pendingOrder?.totalAmount || 0,
          originalAmount: req.session.pendingOrder?.originalAmount || 0,
          discountAmount: req.session.pendingOrder?.discountAmount || 0,
          shippingAddress: req.session.pendingOrder?.shippingAddress || {},
          paymentMethod: 'razorpay',
          status: 'payment-failed',
          paymentStatus: 'failed',
          cancelReason: error || 'Payment failed',
          paymentDetails: {
            razorpayOrderId: razorpayOrderId || req.session.pendingOrder?.razorpayOrderId
          }
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

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
      orderId: order.orderID,
      isRetry: Boolean(req.session.pendingOrder?.isRetry)
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