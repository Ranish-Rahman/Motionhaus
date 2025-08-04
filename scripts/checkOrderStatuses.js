import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import connectDB from '../models/mongodb.js';

const checkOrderStatuses = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Get all orders
    const allOrders = await Order.find({}).populate('user', 'name email');
    
    console.log(`\nTotal orders in database: ${allOrders.length}`);
    
    if (allOrders.length === 0) {
      console.log('No orders found in database');
      return;
    }

    // Group orders by status
    const statusCounts = {};
    allOrders.forEach(order => {
      const status = order.status || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('\nOrders by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count} orders`);
    });

    // Show sample orders
    console.log('\nSample orders:');
    allOrders.slice(0, 5).forEach(order => {
      console.log(`ID: ${order._id}`);
      console.log(`Status: ${order.status || 'No Status'}`);
      console.log(`Total Amount: ₹${order.totalAmount}`);
      console.log(`Customer: ${order.user?.name || order.user?.email || 'N/A'}`);
      console.log(`Created: ${order.createdAt}`);
      console.log('---');
    });

    // Check for delivered orders specifically
    const deliveredOrders = await Order.find({ status: 'Delivered' });
    console.log(`\nOrders with status "Delivered": ${deliveredOrders.length}`);

    // Check for case variations
    const deliveredCaseInsensitive = await Order.find({ 
      status: { $regex: /^delivered$/i } 
    });
    console.log(`Orders with status "delivered" (case insensitive): ${deliveredCaseInsensitive.length}`);

    // Check for any status containing "delivered"
    const anyDelivered = await Order.find({ 
      status: { $regex: /delivered/i } 
    });
    console.log(`Orders with status containing "delivered": ${anyDelivered.length}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
};

checkOrderStatuses(); 