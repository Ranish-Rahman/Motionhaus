import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Product', 'Category']  // We can add 'Referral' later
    },
    discount: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        default: 'Active',
        enum: ['Active', 'Inactive']
    },
    target: {
        // For Product type: Product ID
        // For Category type: Category ID
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'targetModel'
    },
    targetModel: {
        type: String,
        required: true,
        enum: ['Product', 'Category']  // Using the model names as registered
    }
}, {
    timestamps: true
});

// Method to check if offer is valid
offerSchema.methods.isValid = function() {
    const now = new Date();
    return (
        this.status === 'Active' &&
        this.startDate <= now &&
        this.endDate >= now
    );
};

const OfferModel = mongoose.model('Offer', offerSchema);
export default OfferModel; 