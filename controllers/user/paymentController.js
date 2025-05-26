import crypto from 'crypto';
import Cart from '../../models/cartModel.js';
import Product from '../../models/ProductModel.js';
import Order from '../../models/orderModel.js';
import { nanoid } from 'nanoid';
import Address from '../../models/addressModel.js';
import razorpay from '../../utils/razorpay.js';

export const createRazorpayOrder = async (req, res) => {
  try {
    const { addressId } = req.body;
    const userId = req.session.user._id;

    // Get the cart items
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    // Get the selected address
    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: 'Selected address not found' });
    }

    // Generate custom orderID
    const orderID = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${nanoid(8).toUpperCase()}`;

    // Calculate amount in paise (multiply by 100 and ensure it's an integer)
    const amount = Math.round(cart.subtotal * 100);
    console.log('Amount in paise:', amount);

    // Create Razorpay order first
    const options = {
      amount: amount,
      currency: 'INR',
      receipt: orderID,
      payment_capture: 1,
      notes: {
        orderID: orderID,
        userId: userId.toString(),
        addressId: addressId
      }
    };

    console.log('Creating Razorpay order with options:', options);
    const razorpayOrder = await razorpay.orders.create(options);
    console.log('Razorpay order created:', razorpayOrder);

    // Store order data in session for later use
    req.session.pendingOrder = {
      orderID,
      userId,
      items: cart.items.map(item => ({
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
      paymentMethod: 'razorpay',
      razorpayOrderId: razorpayOrder.id
    };

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderID: orderID
      }
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create Razorpay order',
      error: error.message 
    });
  }
};

export const verifyPayment = async (req, res) => {
    try {
        console.log('Payment verification request body:', req.body);
        
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderID
        } = req.body;

        const userId = req.session.user._id;
        console.log('Verifying payment for user:', userId);

        // Check for missing fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderID) {
            console.log('Missing payment details:', {
                razorpay_order_id: !!razorpay_order_id,
                razorpay_payment_id: !!razorpay_payment_id,
                razorpay_signature: !!razorpay_signature,
                orderID: !!orderID
            });
            return res.status(400).json({
                success: false, 
                message: 'Missing payment details',
                orderId: orderID
            });
        }

        // Get pending order data from session
        const pendingOrder = req.session.pendingOrder;
        if (!pendingOrder || pendingOrder.orderID !== orderID) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order session',
                orderId: orderID
            });
        }

        // Verify the signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        console.log('Signature verification:', {
            generated: generatedSignature,
            received: razorpay_signature
        });

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false, 
                message: 'Payment verification failed',
                orderId: orderID
            });
        }

        // Create order in database only after successful payment verification
        const order = new Order({
            orderID: pendingOrder.orderID,
            user: pendingOrder.userId,
            items: pendingOrder.items,
            totalAmount: pendingOrder.totalAmount,
            shippingAddress: pendingOrder.shippingAddress,
            paymentMethod: pendingOrder.paymentMethod,
            status: 'Completed',
            paymentStatus: 'paid',
            paymentDetails: {
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature
            }
        });

        await order.save();
        console.log('Order saved in database:', order.orderID);

        // Clear the cart after successful payment
        const cart = await Cart.findOne({ user: userId });
        if (cart) {
            cart.items = [];
            cart.subtotal = 0;
            await cart.save();
            console.log('Cart cleared for user:', userId);
        }

        // Clear pending order from session
        delete req.session.pendingOrder;

        return res.json({
            success: true, 
            message: 'Payment verified successfully', 
            orderId: order._id
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({
            success: false, 
            message: 'Internal server error',
            orderId: req.body.orderID
        });
    }
};