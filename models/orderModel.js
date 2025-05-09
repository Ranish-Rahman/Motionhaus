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
    },
    quantity: Number,
    price: Number,
    status: {
      type: String,
      enum: ['Ordered', 'Cancelled', 'Returned'],
      default: 'Ordered',
    }
  }],
  totalAmount: Number,
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Pending',
  },
  cancellationReason: String,
  returnReason: String,
  shippingAddress: {
    fullName: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    phone: String
  },
  paymentMethod: String,
  orderDate: {
    type: Date,
    default: Date.now,
  },
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

const Order = mongoose.model('Order', orderSchema);
export default Order;
