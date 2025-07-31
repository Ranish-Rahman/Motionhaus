import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const checkReferralStatus = async () => {
  try {
    await connectDB();

    // Find Larry and Terry
    const larry = await User.findOne({ username: 'larry' });
    const terry = await User.findOne({ username: 'terry' });

    console.log('\n=== USER DATA ===');
    console.log('Larry:', {
      _id: larry?._id,
      username: larry?.username,
      email: larry?.email,
      referralCode: larry?.referralCode,
      referredBy: larry?.referredBy,
      wallet: larry?.wallet
    });

    console.log('\nTerry:', {
      _id: terry?._id,
      username: terry?.username,
      email: terry?.email,
      referralCode: terry?.referralCode,
      referredBy: terry?.referredBy,
      wallet: terry?.wallet,
      referralRewards: terry?.referralRewards
    });

    // Check if Larry was referred by Terry
    if (larry && terry) {
      console.log('\n=== REFERRAL RELATIONSHIP ===');
      console.log('Is Larry referred by Terry?', larry.referredBy?.toString() === terry._id.toString());
      console.log('Larry\'s referredBy:', larry.referredBy);
      console.log('Terry\'s _id:', terry._id);
    }

    // Check Larry's recent orders
    const larryOrders = await Order.find({ user: larry?._id }).sort({ createdAt: -1 }).limit(5);
    console.log('\n=== LARRY\'S RECENT ORDERS ===');
    larryOrders.forEach(order => {
      console.log({
        orderID: order.orderID,
        finalAmount: order.finalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt
      });
    });

    // Check Terry's wallet balance and referral rewards
    if (terry) {
      console.log('\n=== TERRY\'S WALLET & REFERRAL REWARDS ===');
      console.log('Wallet Balance:', terry.wallet?.balance || 0);
      console.log('Total Referral Rewards:', terry.referralRewards || 0);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

checkReferralStatus(); 