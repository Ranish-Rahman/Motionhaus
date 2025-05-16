import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
   items: [{
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}]

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });

// Method to check if product exists in wishlist
wishlistSchema.methods.hasProduct = function(productId, size) {
    console.log('Checking product existence:', {
        productId,
        size,
        items: this.items.map(item => ({
            product: item.product.toString(),
            size: item.size
        }))
    });
    return this.items.some(item => 
        item.product.toString() === productId.toString() && 
        item.size === size
    );
};

// Method to add product to wishlist
wishlistSchema.methods.addProduct = function(productId, size) {
    console.log('Adding product:', { productId, size });
    if (!this.hasProduct(productId, size)) {
        this.items.push({ 
            product: productId,
            size: Number(size),
            quantity: 1,
            addedAt: new Date()
        });
        console.log('Product added to items array');
    } else {
        console.log('Product already exists in wishlist');
    }
};

// Method to remove product from wishlist
wishlistSchema.methods.removeProduct = function(productId, size) {
    console.log('Removing product:', { productId, size });
    const initialLength = this.items.length;
    this.items = this.items.filter(item => 
        !(item.product.toString() === productId.toString() && item.size === size)
    );
    console.log(`Removed ${initialLength - this.items.length} items`);
};

// Virtual for total items count
wishlistSchema.virtual('totalItems').get(function() {
    return this.items.length;
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist; 