import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  size: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  discount: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String
  }
}, {
  timestamps: true
});

// Method to calculate subtotal
cartSchema.methods.calculateSubtotal = function() {
  this.subtotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
};

// Method to apply coupon
cartSchema.methods.applyCoupon = async function(coupon) {
  if (!coupon) {
    // Clear all coupon-related fields
    this.coupon = null;
    this.discount = 0;
    this.couponCode = null;
    return;
  }

  // Check minimum order amount
  if (this.subtotal < coupon.minAmount) {
    // Clear all coupon-related fields if minimum amount not met
    this.coupon = null;
    this.discount = 0;
    this.couponCode = null;
    return;
  }

  // Calculate discount
  let discount = 0;
  if (coupon.type === 'Percentage') {
    // For percentage discount
    discount = (this.subtotal * coupon.value) / 100;
    // Apply maximum amount limit if set
    if (coupon.maxAmount) {
      discount = Math.min(discount, coupon.maxAmount);
    }
  } else {
    // For fixed amount discount
    discount = coupon.value;
  }
  
  // Ensure discount doesn't exceed subtotal
  discount = Math.min(discount, this.subtotal);
  
  if (discount > 0) {
    this.coupon = coupon._id;
    this.discount = discount;
    this.couponCode = coupon.code;
  } else {
    // Clear all coupon-related fields if no valid discount
    this.coupon = null;
    this.discount = 0;
    this.couponCode = null;
  }
};

// Pre-save middleware to calculate subtotal
cartSchema.pre('save', function(next) {
  this.calculateSubtotal();
  next();
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart; 