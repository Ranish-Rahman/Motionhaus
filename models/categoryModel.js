import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters long'],
    maxlength: [50, 'Category name cannot exceed 50 characters'],
    match: [/^[a-zA-Z0-9\s-]+$/, 'Category name can only contain letters, numbers, spaces, and hyphens']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add a unique index for non-deleted categories
categorySchema.index({ name: 1, isDeleted: 1 }, { 
  unique: true,
  partialFilterExpression: { isDeleted: false }
});

const Category = mongoose.model('Category', categorySchema);

export default Category;
