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

const updateOrderStatus = async () => {
  try {
    await connectDB();

    // Find orders with payment status 'paid' and update them to 'Delivered'
    const result = await Order.updateMany(
      { 
        paymentStatus: 'paid',
        status: { $ne: 'Delivered' } // Don't update already delivered orders
      },
      { 
        $set: { 
          status: 'Delivered',
          paymentStatus: 'paid'
        } 
      }
    );

    console.log('\n=== ORDER STATUS UPDATE ===');
    console.log(`Updated ${result.modifiedCount} orders to 'Delivered' status`);
    console.log(`Matched ${result.matchedCount} orders with payment status 'paid'`);

    // Show some updated orders
    const updatedOrders = await Order.find({ status: 'Delivered' })
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log('\n=== RECENTLY DELIVERED ORDERS ===');
    updatedOrders.forEach((order, index) => {
      console.log(`\n${index + 1}. Order ID: ${order.orderID}`);
      console.log(`   User: ${order.user?.username || order.user?.email || 'N/A'}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Payment Status: ${order.paymentStatus}`);
      console.log(`   Total Amount: ₹${order.totalAmount}`);
      console.log(`   Created: ${order.createdAt}`);
    });

    // Count orders by status
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n=== ORDERS BY STATUS (After Update) ===');
    statusCounts.forEach(status => {
      console.log(`${status._id || 'No Status'}: ${status.count} orders`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

updateOrderStatus(); 