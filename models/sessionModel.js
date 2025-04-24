import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  session: {
    type: Object,
    required: true
  },
  expires: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
sessionSchema.index({ 'session.user.id': 1 });
sessionSchema.index({ expires: 1 });

const Session = mongoose.model('Session', sessionSchema);

export default Session; 