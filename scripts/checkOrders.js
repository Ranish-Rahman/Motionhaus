import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
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

const checkOrders = async () => {
  try {
    await connectDB();

    // Get total count of orders
    const totalOrders = await Order.countDocuments();
    console.log('\n=== ORDERS OVERVIEW ===');
    console.log('Total orders in database:', totalOrders);

    if (totalOrders === 0) {
      console.log('❌ No orders found in database!');
      console.log('This means orders are not being saved properly.');
      return;
    }

    // Get all orders with details
    const orders = await Order.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(10);

    console.log('\n=== RECENT ORDERS (Last 10) ===');
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. Order ID: ${order.orderID || order._id}`);
      console.log(`   User: ${order.user?.username || order.user?.email || 'N/A'}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Payment Status: ${order.paymentStatus}`);
      console.log(`   Total Amount: ₹${order.totalAmount || order.finalAmount || 'N/A'}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Payment Method: ${order.paymentMethod || 'N/A'}`);
    });

    // Check orders by status
    console.log('\n=== ORDERS BY STATUS ===');
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    statusCounts.forEach(status => {
      console.log(`${status._id || 'No Status'}: ${status.count} orders`);
    });

    // Check orders by payment status
    console.log('\n=== ORDERS BY PAYMENT STATUS ===');
    const paymentStatusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    paymentStatusCounts.forEach(status => {
      console.log(`${status._id || 'No Payment Status'}: ${status.count} orders`);
    });

    // Check if any orders have 'Delivered' status
    const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
    console.log(`\n=== DELIVERED ORDERS ===`);
    console.log(`Orders with 'Delivered' status: ${deliveredOrders}`);

    if (deliveredOrders === 0) {
      console.log('⚠️  No orders have "Delivered" status - this is why sales report shows no data');
      console.log('You need to update order status to "Delivered" to see them in sales report');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

checkOrders(); 