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
    type: [Number], // <-- numerical shoe sizes
    required: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
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

// Check if model exists before creating it
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
