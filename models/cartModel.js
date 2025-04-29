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

// Pre-save middleware to calculate subtotal
cartSchema.pre('save', function(next) {
  this.calculateSubtotal();
  next();
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart; 