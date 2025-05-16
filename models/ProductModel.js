// models/productModel.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true
  },
  sizes: {
    type: [
      {
        size: { type: Number, required: true },        // e.g., 6, 7, 8
        quantity: { type: Number, required: true, min: 0 } // e.g., 3, 5, 2
      }
    ],
    required: true
  },
  images: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length >= 3;
      },
      message: 'At least 3 images are required'
    }
  },
  brand: {
    type: String,
    default: 'MotionHaus'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure consistent model registration
let Product;
try {
    // Try to get existing model
    Product = mongoose.model('Product');
} catch (error) {
    // Model doesn't exist, create it
    Product = mongoose.model('Product', productSchema);
}

export default Product;
