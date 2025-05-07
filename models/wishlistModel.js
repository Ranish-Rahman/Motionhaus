import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
});

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [wishlistItemSchema],
}, {
    timestamps: true
});

// Indexes for better query performance
wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });

// Method to check if product exists in wishlist
wishlistSchema.methods.hasProduct = function(productId) {
    return this.items.some(item => item.product.toString() === productId.toString());
};

// Method to add product to wishlist
wishlistSchema.methods.addProduct = function(productId) {
    if (!this.hasProduct(productId)) {
        this.items.push({ product: productId });
    }
};

// Method to remove product from wishlist
wishlistSchema.methods.removeProduct = function(productId) {
    this.items = this.items.filter(item => 
        item.product.toString() !== productId.toString()
    );
};

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist; 