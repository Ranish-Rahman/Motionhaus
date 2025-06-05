import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderID: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
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
    price: {
      type: Number,
      required: true
    },
    originalPrice: {
      type: Number,
      required: true
    },
    discountApplied: {
      type: Number,
      default: null
    },
    size: String,
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
      default: 'Pending'
    },
    returnRequest: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'denied'],
        default: null
      },
      reason: String,
      amount: Number,
      refundMethod: String,
      adminResponse: String,
      requestedAt: Date,
      processedAt: Date
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Partially Cancelled', 'Shipped', 'Delivered', 'Cancelled', 'Completed', 'Returned', 'payment-failed'],
    default: 'Pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: String,
  paymentDetails: {
    razorpayOrderId: {
      type: String,
      required: false
    },
    razorpayPaymentId:{
      type: String,
      required: false
    },
    razorpaySignature: {
      type: String,
      required: false
    }
  },
  cancellationReason: String,
  returnReason: String,
  shippingAddress: {
    fullName: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  paymentMethod: String,
  orderDate: {
    type: Date,
    default: Date.now
  },
  cancelledAt: Date,
  cancelReason: String,
  returnRequest: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied'],
      required: false
    },
    reason: String,
    requestedAt: {
      type: Date,
      default: Date.now
    },
    adminResponse: String,
    processedAt: Date
  }
}, {
  timestamps: true
});

// Add index for return requests
orderSchema.index({ 'returnRequest.status': 1 });

// Method to update overall order status based on item statuses
orderSchema.methods.updateOrderStatus = function() {
  const itemStatuses = this.items.map(item => item.status);
  
  // Check if all items are cancelled
  if (itemStatuses.every(status => status === 'Cancelled')) {
    this.status = 'Cancelled';
  }
  // Check if some items are cancelled
  else if (itemStatuses.some(status => status === 'Cancelled')) {
    this.status = 'Partially Cancelled';
  }
  // Check if all items are shipped
  else if (itemStatuses.every(status => status === 'Shipped')) {
    this.status = 'Shipped';
  }
  // Check if all items are delivered
  else if (itemStatuses.every(status => status === 'Delivered')) {
    this.status = 'Completed';
  }
  // Default to Pending if no other conditions are met
  else {
    this.status = 'Pending';
  }
};

// Pre-save middleware to update order status
orderSchema.pre('save', function(next) {
  this.updateOrderStatus();
  next();
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
