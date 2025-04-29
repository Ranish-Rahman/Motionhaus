import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  addressLine1: {
    type: String,
    required: true
  },
  addressLine2: {
    type: String
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  addressType: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// If this address is set as default, unset any other default addresses for this user
addressSchema.pre('save', async function(next) {
  try {
    // Only run this if isDefault is being modified
    if (this.isModified('isDefault') && this.isDefault) {
      // First, find if there's any existing default address
      const existingDefault = await this.constructor.findOne({
        userId: this.userId,
        _id: { $ne: this._id },
        isDefault: true
      });

      if (existingDefault) {
        // Update the existing default address
        existingDefault.isDefault = false;
        await existingDefault.save();
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Address = mongoose.model('Address', addressSchema);

export default Address; 