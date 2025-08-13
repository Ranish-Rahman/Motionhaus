import crypto from 'crypto';
import Cart from '../../models/cartModel.js';
import Product from '../../models/ProductModel.js';
import Order from '../../models/orderModel.js';
import { nanoid } from 'nanoid';
import Address from '../../models/addressModel.js';
import razorpay from '../../utils/razorpay.js';
import { getBestOffer } from './productController.js';
import Coupon from '../../models/couponModel.js';
import User from '../../models/userModel.js';
import { processReferralReward } from '../../utils/referralCodeGenerator.js';
import Category from '../../models/categoryModel.js';
import { calculateCartTotals } from '../../utils/cartHelper.js';

// Helper function to check if product's category is deleted
const isProductCategoryDeleted = async (product) => {
  if (!product || !product.category) return false;
  
  const category = await Category.findOne({ 
    name: product.category, 
    isDeleted: false 
  });
  
  return !category; // Return true if category is deleted or doesn't exist
};

// Generate unique order ID
const generateOrderId = () => {
    return `ORD-${Date.now()}-${nanoid(8).toUpperCase()}`;
};

export const createRazorpayOrder = async (req, res) => {
    try {
        const { addressId, retryOrderId, isRetry, shippingAddress: providedAddress } = req.body;
        
        // Use standardized session accessor
        const sessionUser = req.user || req.session.user || req.session.userData;
        if (!sessionUser) {
            return res.status(401).json({
                success: false,
                message: 'User not logged in'
            });
        }
        const userId = sessionUser._id || sessionUser.id;

        // Get checkout data from session
        const checkoutData = req.session.checkoutData;
        if (!checkoutData) {
            return res.status(400).json({
                success: false,
                message: 'Checkout data not found. Please try again.'
            });
        }

        // Get shipping address - handle both normal and retry cases
        let shippingAddress;
        if (isRetry && providedAddress) {
            // For retry payments, use the provided address data
            shippingAddress = providedAddress;
            console.log('[Debug] Retry payment - provided address:', providedAddress);
        } else if (addressId) {
            // For normal payments, find address by ID
            shippingAddress = await Address.findOne({ _id: addressId, userId });
            if (!shippingAddress) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid shipping address'
                });
            }
            console.log('[Debug] Normal payment - found address:', shippingAddress);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Shipping address is required'
            });
        }

        // Validate shipping address has required fields
        const requiredFields = [
            { name: 'fullName', check: (addr) => addr.fullName },
            { name: 'phone', check: (addr) => addr.phone },
            { name: 'address', check: (addr) => addr.address || addr.addressLine1 },
            { name: 'city', check: (addr) => addr.city },
            { name: 'state', check: (addr) => addr.state },
            { name: 'postalCode', check: (addr) => addr.postalCode || addr.zipCode }
        ];
        
        const missingFields = requiredFields.filter(field => !field.check(shippingAddress));
        
        if (missingFields.length > 0) {
            console.error('[Debug] Missing required address fields:', missingFields.map(f => f.name));
            console.error('[Debug] Shipping address data:', shippingAddress);
            return res.status(400).json({
                success: false,
                message: `Missing required address fields: ${missingFields.map(f => f.name).join(', ')}`
            });
        }

        // Validate stock availability for all items
        console.log('[Debug] Validating stock for items:', checkoutData.items);
        console.log('[Debug] Is retry payment:', isRetry);
        
        for (const item of checkoutData.items) {
            try {
                const product = await Product.findById(item.product);
                if (!product) {
                    return res.status(400).json({
                        success: false,
                        message: `Product not found: ${item.product}`
                    });
                }

                console.log(`[Debug] Product ${product.name} sizes:`, product.sizes);
                console.log(`[Debug] Looking for size: ${item.size} (type: ${typeof item.size})`);
                
                // Use the same logic as stock reduction - find size with Number conversion
                const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
                if (!sizeObj) {
                    console.error(`[Debug] Size ${item.size} not found for product ${product.name}`);
                    console.error(`[Debug] Available sizes:`, product.sizes.map(s => s.size));
                    return res.status(400).json({
                        success: false,
                        message: `Size ${item.size} not available for ${product.name}. Available sizes: ${product.sizes.map(s => s.size).join(', ')}`
                    });
                }

                // For retry payments, stock was already reduced, so we don't need to check availability
                if (!isRetry && sizeObj.quantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product.name} (${item.size}). Available: ${sizeObj.quantity}, Requested: ${item.quantity}`
                    });
                }

                // Always check stock availability for retry payments too, since stock might have been restored
                if (sizeObj.quantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product.name} (${item.size}). Available: ${sizeObj.quantity}, Requested: ${item.quantity}`
                    });
                }

                console.log(`[Debug] Stock validation passed for ${product.name} size ${item.size}: ${sizeObj.quantity} available`);
            } catch (stockError) {
                console.error(`[Debug] Error validating stock for product ${item.product}:`, stockError);
                return res.status(500).json({
                    success: false,
                    message: 'Error validating stock availability'
                });
            }
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

        console.log('[Debug] Creating Razorpay order:', {
            orderID,
            amountInPaise,
            finalAmount,
            currency: 'INR',
            receipt: orderID
        });

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
                isRetry: isRetry || false,
                paymentAttempt: 1,
                couponCode: checkoutData.couponCode || null,
                retryOrderId: retryOrderId || null
            }
        });

        console.log('[Debug] Razorpay order created successfully:', {
            razorpayOrderId: razorpayOrder.id,
            orderID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            status: razorpayOrder.status
        });

        // Save order details in session
        req.session.pendingOrder = {
            orderID: isRetry ? retryOrderId : orderID,
            razorpayOrderId: razorpayOrder.id,
            totalAmount: finalAmount,
            originalAmount,
            discountAmount,
            items: checkoutData.items,
            shippingAddress: {
                _id: shippingAddress._id || shippingAddress.id || null,
                userId: shippingAddress.userId || userId,
                fullName: shippingAddress.fullName || 'N/A',
                phone: shippingAddress.phone || 'N/A',
                address: shippingAddress.address || shippingAddress.addressLine1 || 'N/A',
                addressLine1: shippingAddress.addressLine1 || shippingAddress.address || 'N/A',
                addressLine2: shippingAddress.addressLine2 || '',
                city: shippingAddress.city || 'N/A',
                state: shippingAddress.state || 'N/A',
                postalCode: shippingAddress.postalCode || shippingAddress.zipCode || 'N/A',
                zipCode: shippingAddress.zipCode || shippingAddress.postalCode || 'N/A',
                country: shippingAddress.country || 'India',
                addressType: shippingAddress.addressType || 'home',
                isDefault: shippingAddress.isDefault || false
            },
            userId: userId,
            isRetry: isRetry || false,
            couponCode: checkoutData.couponCode || null,
            couponDiscount: checkoutData.couponDiscount || 0,
            paymentMethod: 'razorpay'
        };

        console.log('[Debug] Session pendingOrder shippingAddress:', req.session.pendingOrder.shippingAddress);
        
        await req.session.save();
        console.log('[Debug] Session saved with pendingOrder:', req.session.pendingOrder);
        
        // Verify session was saved properly
        if (!req.session.pendingOrder || !req.session.pendingOrder.razorpayOrderId) {
            console.error('[Debug] Session not saved properly after order creation');
            return res.status(500).json({
                success: false,
                message: 'Failed to save order details. Please try again.'
            });
        }

        // Return response with proper price information
        res.json({
            success: true,
            order: razorpayOrder,
            orderID: isRetry ? retryOrderId : orderID,
            receipt: orderID, // Razorpay receipt ID
            amount: amountInPaise,
            currency: 'INR',
            customerName: shippingAddress.fullName,
            customerEmail: sessionUser.email,
            customerPhone: shippingAddress.phone,
            notes: {
                originalAmount,
                discountAmount,
                finalAmount,
                isRetry: isRetry || false,
                retryOrderId: retryOrderId || null
            },
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
        
        // Use standardized session accessor
        const sessionUser = req.user || req.session.user || req.session.userData;
        if (!sessionUser) {
            return res.status(401).json({
                success: false,
                message: 'User not logged in'
            });
        }
        const userId = sessionUser._id || sessionUser.id;

        console.log('[Debug] verifyPayment - Request received:', {
            hasUserId: !!userId,
            hasRazorpayPaymentId: !!razorpay_payment_id,
            hasRazorpayOrderId: !!razorpay_order_id,
            hasRazorpaySignature: !!razorpay_signature,
            hasOrderID: !!orderID,
            sessionKeys: Object.keys(req.session)
        });

        const pendingOrder = req.session.pendingOrder;
        if (!pendingOrder) {
            console.error('[Debug] verifyPayment: No pending order found in session');
            console.error('[Debug] verifyPayment: Session data:', {
                sessionKeys: Object.keys(req.session),
                hasUser: !!sessionUser,
                hasCheckoutData: !!req.session.checkoutData
            });
            return res.status(400).json({
                success: false,
                message: 'No pending order found. Please try placing your order again.'
            });
        }

        const orderIdToSearch = orderID || pendingOrder.orderID;
        
        // Use session razorpay order ID if not provided in response
        const razorpayOrderIdToUse = razorpay_order_id || pendingOrder.razorpayOrderId;

        console.log('[Debug] verifyPayment - IDs:', {
            sessionRazorpayOrderId: pendingOrder.razorpayOrderId,
            receivedRazorpayOrderId: razorpay_order_id,
            razorpayOrderIdToUse: razorpayOrderIdToUse,
            sessionInternalOrderID: pendingOrder.orderID,
            receivedInternalOrderID: orderIdToSearch
        });

        console.log('[Debug] verifyPayment - Shipping address from session:', {
            fullName: pendingOrder.shippingAddress?.fullName,
            addressLine1: pendingOrder.shippingAddress?.addressLine1,
            addressLine2: pendingOrder.shippingAddress?.addressLine2,
            city: pendingOrder.shippingAddress?.city,
            state: pendingOrder.shippingAddress?.state,
            zipCode: pendingOrder.shippingAddress?.zipCode,
            postalCode: pendingOrder.shippingAddress?.postalCode,
            phone: pendingOrder.shippingAddress?.phone,
            completeAddress: pendingOrder.shippingAddress
        });

        // Check if we have the essential data for verification
        if (!razorpayOrderIdToUse) {
            console.error('[Debug] verifyPayment - No Razorpay order ID available');
            console.error('[Debug] verifyPayment - Request body:', req.body);
            console.error('[Debug] verifyPayment - Session pendingOrder:', pendingOrder);
            return res.status(400).json({
                success: false,
                message: 'Razorpay order ID not found. Please try again or contact support.'
            });
        }

        // Verify internal order ID matches
        if (pendingOrder.orderID !== orderIdToSearch) {
            console.error('[Debug] verifyPayment - Internal Order ID mismatch:', {
                pendingInternalOrderID: pendingOrder.orderID,
                receivedInternalOrderID: orderIdToSearch
            });
            return res.status(400).json({
                success: false,
                message: 'Internal Order ID mismatch. Please try again.'
            });
        }

        // If razorpay_order_id was provided in response, verify it matches session
        if (razorpay_order_id && pendingOrder.razorpayOrderId !== razorpay_order_id) {
            console.error('[Debug] verifyPayment - Razorpay Order ID mismatch:', {
                pendingRazorpayOrderId: pendingOrder.razorpayOrderId,
                receivedRazorpayOrderId: razorpay_order_id
            });
            return res.status(400).json({
                success: false,
                message: 'Razorpay Order ID mismatch. Please try again.'
            });
        }

        // Check if payment ID is provided
        if (!razorpay_payment_id) {
            console.error('[Debug] verifyPayment - No payment ID provided');
            return res.status(400).json({
                success: false,
                message: 'Payment ID not found. Please try again.'
            });
        }

        // Validate shipping address has minimum required data
        if (!pendingOrder.shippingAddress || !pendingOrder.shippingAddress.fullName) {
            console.error('[Debug] verifyPayment - Invalid shipping address data');
            return res.status(400).json({
                success: false,
                message: 'Invalid shipping address. Please try placing your order again.'
            });
        }

        if (razorpay_signature) {
            const generated_signature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(razorpayOrderIdToUse + '|' + razorpay_payment_id)
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

        // Look up coupon by code and set coupon field
        let couponId = null;
        if (pendingOrder.couponCode) {
            const coupon = await Coupon.findOne({ code: pendingOrder.couponCode });
            if (coupon) {
                // Validate coupon is still valid at order placement time
                const now = new Date();
                if (!coupon.isActive) {
                    return res.status(400).json({
                        success: false,
                        message: 'The applied coupon is no longer active.'
                    });
                }
                
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
                
                // Check usage limits
                if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
                    return res.status(400).json({
                        success: false,
                        message: 'This coupon has reached its maximum usage limit.'
                    });
                }
                
                // Check if user has already used this coupon
                if (coupon.usedBy && coupon.usedBy.includes(userId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have already used this coupon.'
                    });
                }
                
                couponId = coupon._id;
            }
        }

        // Validate that no products have deleted categories
        if (pendingOrder.items && pendingOrder.items.length > 0) {
            for (const item of pendingOrder.items) {
                const product = await Product.findById(item.product);
                if (product) {
                    const categoryDeleted = await isProductCategoryDeleted(product);
                    if (categoryDeleted) {
                        return res.status(400).json({
                            success: false,
                            message: `Product "${product.name}" is no longer available as its category has been removed. Please remove it from your cart and try again.`
                        });
                    }
                }
            }
        }

        // Check if this is a retry payment by looking for existing order
        const existingOrder = await Order.findOne({ 
            orderID: orderIdToSearch,
            user: userId 
        });

        let order;
        if (existingOrder) {
            // This is a retry payment - update the existing order
            console.log('[Debug] Updating existing order for retry payment:', existingOrder.orderID);
            
            order = await Order.findOneAndUpdate(
                { 
                    orderID: orderIdToSearch,
                    user: userId
                },
                {
                    $set: {
                        status: 'Pending',
                        paymentStatus: 'paid',
                        paymentDetails: {
                            razorpayOrderId: razorpayOrderIdToUse,
                            razorpayPaymentId: razorpay_payment_id,
                            razorpaySignature: razorpay_signature || null,
                            paymentAttempts: (existingOrder.paymentDetails?.paymentAttempts || 0) + 1,
                            lastPaymentAttempt: new Date()
                        }
                    }
                },
                { 
                    new: true,
                    runValidators: true
                }
            );
        } else {
            // This is a new order - create it
            console.log('[Debug] Creating new order for payment');
            
            // --- PATCH: Distribute discount and set finalPrice ---
            let items = pendingOrder.items;
            const discountAmount = pendingOrder.discountAmount || 0;
            if (discountAmount > 0 && items && items.length > 0) {
                const subtotal = items.reduce((sum, item) => sum + (item.originalPrice || item.price) * item.quantity, 0);
                items = items.map(item => {
                    const itemSubtotal = (item.originalPrice || item.price) * item.quantity;
                    const itemShare = itemSubtotal / subtotal;
                    const itemDiscount = discountAmount * itemShare;
                    const paidPrice = ((item.originalPrice || item.price) * item.quantity - itemDiscount) / item.quantity;
                    return {
                        ...item,
                        originalPrice: item.originalPrice || item.price,
                        paidPrice: Number(paidPrice.toFixed(2)),
                        discountApplied: itemDiscount,
                    };
                });
            } else if (items && items.length > 0) {
                items = items.map(item => ({
                    ...item,
                    originalPrice: item.originalPrice || item.price,
                    paidPrice: item.price,
                    discountApplied: 0,
                }));
            }
            // --- END PATCH ---

            order = await Order.create({
                orderID: orderIdToSearch,
                user: userId,
                items,
                totalAmount: pendingOrder.totalAmount,
                originalAmount: pendingOrder.originalAmount,
                discountAmount: pendingOrder.discountAmount,
                coupon: couponId,
                couponDiscount: pendingOrder.couponDiscount,
                shippingAddress: {
                    fullName: pendingOrder.shippingAddress.fullName || 'N/A',
                    address: (pendingOrder.shippingAddress.addressLine1 || 'N/A') + 
                        (pendingOrder.shippingAddress.addressLine2 ? ', ' + pendingOrder.shippingAddress.addressLine2 : ''),
                    city: pendingOrder.shippingAddress.city || 'N/A',
                    state: pendingOrder.shippingAddress.state || 'N/A',
                    postalCode: pendingOrder.shippingAddress.zipCode || pendingOrder.shippingAddress.postalCode || 'N/A',
                    phone: pendingOrder.shippingAddress.phone || 'N/A'
                },
                status: 'Pending',
                paymentStatus: 'paid',
                paymentMethod: 'razorpay',
                paymentDetails: {
                    razorpayOrderId: razorpayOrderIdToUse,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature || null,
                    paymentAttempts: 1,
                    lastPaymentAttempt: new Date()
                }
            });
        }

        // Update stock for all items in the order when payment is successful
        console.log('[Debug] Updating stock for successful payment');
        console.log('[Debug] Order items to process:', JSON.stringify(order.items, null, 2));
        
        // If payment is successful, decrease stock
        try {
            for (const item of order.items) {
                console.log(`[Debug] Processing item:`, {
                    productId: item.product,
                    size: item.size,
                    quantity: item.quantity,
                    productType: typeof item.product,
                    sizeType: typeof item.size
                });
                
                const product = await Product.findById(item.product);
                if (!product) {
                    console.error(`[Debug] Product not found: ${item.product}`);
                    continue;
                }
                
                console.log(`[Debug] Found product: ${product.name}`);
                console.log(`[Debug] Product sizes:`, product.sizes);
                
                const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
                if (!sizeObj) {
                    console.error(`[Debug] Size ${item.size} not found for product ${product.name}`);
                    console.error(`[Debug] Available sizes:`, product.sizes.map(s => s.size));
                    continue;
                }
                
                console.log(`[Debug] Found size variant:`, {
                    size: sizeObj.size,
                    currentQuantity: sizeObj.quantity,
                    reducingBy: item.quantity
                });
                
                const oldQuantity = sizeObj.quantity;
                sizeObj.quantity -= item.quantity;
                if (sizeObj.quantity < 0) {
                    sizeObj.quantity = 0;
                }
                
                console.log(`[Debug] Stock updated: ${oldQuantity} -> ${sizeObj.quantity}`);
                
                await product.save();
                console.log(`[Debug] Updated stock for product ${product.name} size ${item.size}: -${item.quantity}`);
            }
        } catch (error) {
            console.error('[Debug] Error updating stock:', error);
            // Even if stock update fails, we'll continue with order update
            // but log the error for manual intervention
        }

        // Process referral reward if user was referred
        const user = await User.findById(userId);
        if (user && user.referredBy) {
          try {
            const referralResult = await processReferralReward(user.referredBy, order.totalAmount);
            console.log('Referral reward processed:', {
              referrer: user.referredBy,
              rewardAmount: referralResult.rewardAmount,
              orderAmount: order.totalAmount
            });
          } catch (referralError) {
            console.error('Error processing referral reward:', referralError);
            // Don't fail the order if referral reward fails
          }
        }

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
    
    // Use standardized session accessor
    const sessionUser = req.user || req.session.user || req.session.userData;
    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: 'User not logged in'
      });
    }
    const userId = sessionUser._id || sessionUser.id;
    
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

    // Restore stock if this was a new order (not a retry)
    if (req.session.pendingOrder && !req.session.pendingOrder.isRetry) {
      console.log('[Debug] Restoring stock for failed payment');
      for (const item of req.session.pendingOrder.items) {
        try {
          const product = await Product.findById(item.product);
          if (product) {
            const sizeVariant = product.sizes.find(s => s.size === item.size);
            if (sizeVariant) {
              // Restore stock
              sizeVariant.quantity += item.quantity;
              console.log(`[Debug] Restored stock for product ${product.name} size ${item.size}: ${sizeVariant.quantity}`);
              await product.save();
            }
          }
        } catch (stockError) {
          console.error(`[Debug] Error restoring stock for product ${item.product}:`, stockError);
        }
      }
    } else {
      console.log('[Debug] Skipping stock restoration - this was a retry payment');
    }

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
            paidPrice: item.price, // For failed orders, paidPrice = original price
            discountApplied: 0,
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