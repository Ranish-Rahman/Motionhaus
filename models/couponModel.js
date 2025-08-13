import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Fixed', 'Percentage'],
        default: 'Fixed'
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    minAmount: {
        type: Number,
        required: true,
        min: 0
    },
    maxAmount: {
        type: Number,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usageLimit: {
        type: Number,
        min: 0
    },
    usageCount: {
        type: Number,
        default: 0
    },
    usedBy: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save middleware to update the updatedAt timestamp
couponSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Method to check if coupon is valid
couponSchema.methods.isValid = function() {
    const now = new Date();
    console.log('--- Coupon Validation Debug ---');
    console.log('Current time:', now);
    console.log('Valid from:', this.validFrom);
    console.log('Valid until:', this.validUntil);
    console.log('Is active:', this.isActive);
    console.log('Usage count:', this.usageCount);
    console.log('Usage limit:', this.usageLimit);
    
    const isValid = (
        this.isActive &&
        now >= this.validFrom &&
        now <= this.validUntil &&
        (!this.usageLimit || this.usageCount < this.usageLimit)
    );
    
    console.log('Is valid:', isValid);
    console.log('---------------------------');
    
    return isValid;
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(orderAmount) {
    if (!this.isValid()) return 0;
    
    if (orderAmount < this.minAmount) return 0;
    
    let discount = 0;
    if (this.type === 'Fixed') {
        discount = this.value;
    } else {
        // Percentage discount
        discount = (orderAmount * this.value) / 100;
    }
    
    // Apply maximum amount limit if set
    if (this.maxAmount) {
        discount = Math.min(discount, this.maxAmount);
    }
    
    return Math.min(discount, orderAmount);
};

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon; 