import mongoose from 'mongoose';
import Order from '../models/orderModel.js';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const fixCodPaymentStatus = async () => {
  try {
    await connectDB();

    // Find COD orders that are delivered but still have pending payment status
    const result = await Order.updateMany(
      { 
        paymentMethod: 'cod',
        status: 'Delivered',
        paymentStatus: 'pending'
      },
      { 
        $set: { 
          paymentStatus: 'paid'
        } 
      }
    );

    console.log('\n=== COD PAYMENT STATUS FIX ===');
    console.log(`Updated ${result.modifiedCount} COD orders from 'pending' to 'paid' payment status`);
    console.log(`Matched ${result.matchedCount} COD orders with 'Delivered' status and 'pending' payment`);

    // Show some examples of fixed orders
    const fixedOrders = await Order.find({
      paymentMethod: 'cod',
      status: 'Delivered',
      paymentStatus: 'paid'
    })
    .populate('user', 'username email')
    .sort({ createdAt: -1 })
    .limit(5);

    console.log('\n=== EXAMPLES OF FIXED ORDERS ===');
    fixedOrders.forEach((order, index) => {
      console.log(`\n${index + 1}. Order ID: ${order.orderID}`);
      console.log(`   User: ${order.user?.username || order.user?.email || 'N/A'}`);
      console.log(`   Order Status: ${order.status}`);
      console.log(`   Payment Status: ${order.paymentStatus}`);
      console.log(`   Payment Method: ${order.paymentMethod}`);
      console.log(`   Total Amount: ₹${order.totalAmount}`);
    });

    // Count orders by payment status for COD orders
    const codStatusCounts = await Order.aggregate([
      {
        $match: { paymentMethod: 'cod' }
      },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n=== COD ORDERS BY PAYMENT STATUS ===');
    codStatusCounts.forEach(status => {
      console.log(`${status._id || 'No Payment Status'}: ${status.count} orders`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

fixCodPaymentStatus(); 