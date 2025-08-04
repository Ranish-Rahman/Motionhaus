import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import connectDB from '../models/mongodb.js';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Kolkata';

const checkAllOrders = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Get all orders with populated user data
    const allOrders = await Order.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    console.log(`\n=== DATABASE ORDER ANALYSIS ===`);
    console.log(`Total orders in database: ${allOrders.length}`);

    if (allOrders.length === 0) {
      console.log('❌ No orders found in database');
      return;
    }

    // Group orders by status
    const statusCounts = {};
    allOrders.forEach(order => {
      const status = order.status || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('\n📊 Orders by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} orders`);
    });

    // Check recent orders (last 7 days)
    const sevenDaysAgo = moment().tz(TIMEZONE).subtract(7, 'days');
    const recentOrders = allOrders.filter(order => 
      moment(order.createdAt).tz(TIMEZONE).isAfter(sevenDaysAgo)
    );

    console.log(`\n📅 Recent orders (last 7 days): ${recentOrders.length}`);

    // Show detailed order information
    console.log('\n📋 Detailed Order Information:');
    allOrders.slice(0, 10).forEach((order, index) => {
      const orderDate = moment(order.createdAt).tz(TIMEZONE);
      const isRecent = orderDate.isAfter(sevenDaysAgo);
      
      console.log(`\n${index + 1}. Order ID: ${order._id}`);
      console.log(`   Order ID (custom): ${order.orderID || 'N/A'}`);
      console.log(`   Status: ${order.status || 'No Status'}`);
      console.log(`   Total Amount: ₹${order.totalAmount}`);
      console.log(`   Payment Method: ${order.paymentMethod || 'N/A'}`);
      console.log(`   Payment Status: ${order.paymentStatus || 'N/A'}`);
      console.log(`   Customer: ${order.user?.name || order.user?.email || 'N/A'}`);
      console.log(`   Created: ${orderDate.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`   Recent (7 days): ${isRecent ? '✅ YES' : '❌ NO'}`);
      console.log(`   Items Count: ${order.items?.length || 0}`);
      
      if (order.items && order.items.length > 0) {
        console.log(`   Items:`);
        order.items.forEach((item, itemIndex) => {
          console.log(`     ${itemIndex + 1}. Product: ${item.product || 'N/A'}`);
          console.log(`        Size: ${item.size || 'N/A'}`);
          console.log(`        Quantity: ${item.quantity || 0}`);
          console.log(`        Price: ₹${item.price || 0}`);
        });
      }
      
      console.log('   ---');
    });

    // Check for any orders without proper data
    const problematicOrders = allOrders.filter(order => 
      !order.totalAmount || 
      !order.status || 
      !order.user || 
      !order.items || 
      order.items.length === 0
    );

    if (problematicOrders.length > 0) {
      console.log(`\n⚠️  Problematic orders (${problematicOrders.length}):`);
      problematicOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ID: ${order._id}`);
        console.log(`      Missing totalAmount: ${!order.totalAmount}`);
        console.log(`      Missing status: ${!order.status}`);
        console.log(`      Missing user: ${!order.user}`);
        console.log(`      Missing items: ${!order.items || order.items.length === 0}`);
      });
    } else {
      console.log('\n✅ All orders appear to have proper data');
    }

    // Check for orders created today
    const today = moment().tz(TIMEZONE);
    const todaysOrders = allOrders.filter(order => {
      const orderDate = moment(order.createdAt).tz(TIMEZONE);
      return orderDate.isSame(today, 'day');
    });

    console.log(`\n📅 Orders created today: ${todaysOrders.length}`);
    if (todaysOrders.length > 0) {
      todaysOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ${order._id} - ${order.status} - ₹${order.totalAmount}`);
      });
    }

    // Check for orders with specific statuses
    const pendingOrders = allOrders.filter(order => order.status === 'Pending');
    const deliveredOrders = allOrders.filter(order => order.status === 'Delivered');
    const cancelledOrders = allOrders.filter(order => order.status === 'Cancelled');

    console.log(`\n📈 Status Summary:`);
    console.log(`   Pending: ${pendingOrders.length}`);
    console.log(`   Delivered: ${deliveredOrders.length}`);
    console.log(`   Cancelled: ${cancelledOrders.length}`);

    // Check total sales
    const totalSales = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const deliveredSales = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    console.log(`\n💰 Sales Summary:`);
    console.log(`   Total Sales (all orders): ₹${totalSales}`);
    console.log(`   Delivered Sales: ₹${deliveredSales}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
};

checkAllOrders(); 