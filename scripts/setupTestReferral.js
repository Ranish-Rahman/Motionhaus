import mongoose from 'mongoose';
import User from '../models/userModel.js';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const setupTestReferral = async () => {
  try {
    await connectDB();

    // Find Larry and Terry
    const larry = await User.findOne({ username: 'larry' });
    const terry = await User.findOne({ username: 'terry' });

    if (!larry || !terry) {
      console.log('Larry or Terry not found!');
      return;
    }

    console.log('\n=== BEFORE SETUP ===');
    console.log('Larry referredBy:', larry.referredBy);
    console.log('Terry referralRewards:', terry.referralRewards || 0);

    // Set Larry as referred by Terry
    larry.referredBy = terry._id;
    await larry.save();

    console.log('\n=== AFTER SETUP ===');
    console.log('Larry referredBy:', larry.referredBy);
    console.log('Is Larry now referred by Terry?', larry.referredBy?.toString() === terry._id.toString());

    console.log('\n✅ Referral relationship set up successfully!');
    console.log('Now when Larry places an order, Terry should receive a referral reward.');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

setupTestReferral(); 