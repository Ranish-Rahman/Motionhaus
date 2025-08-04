import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Coupon from '../models/couponModel.js';
import connectDB from '../models/mongodb.js';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Kolkata';

const testSalesReportRanges = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Test different ranges
    const ranges = ['daily', 'weekly', 'yearly'];
    
    for (const range of ranges) {
      console.log(`\n=== TESTING ${range.toUpperCase()} RANGE ===`);
      
      let start, end;
      
      if (range === 'daily') {
        start = moment().tz(TIMEZONE).startOf('day');
        end = moment().tz(TIMEZONE).endOf('day');
      } else if (range === 'weekly') {
        start = moment().tz(TIMEZONE).startOf('week');
        end = moment().tz(TIMEZONE).endOf('week');
      } else if (range === 'yearly') {
        start = moment().tz(TIMEZONE).startOf('year');
        end = moment().tz(TIMEZONE).endOf('year');
      }

      console.log(`Date Range: ${start.format('YYYY-MM-DD HH:mm:ss')} to ${end.format('YYYY-MM-DD HH:mm:ss')}`);

      // Test with only Delivered status (current logic)
      const deliveredMatchStage = {
        createdAt: { $gte: start.toDate(), $lte: end.toDate() },
        status: 'Delivered',
      };

      const deliveredOrders = await Order.find(deliveredMatchStage)
        .populate('user', 'name email')
        .populate('coupon', 'code')
        .sort({ createdAt: -1 });

      console.log(`\n📊 Orders with status "Delivered" in ${range} range: ${deliveredOrders.length}`);

      // Test with all statuses
      const allMatchStage = {
        createdAt: { $gte: start.toDate(), $lte: end.toDate() },
      };

      const allOrders = await Order.find(allMatchStage)
        .populate('user', 'name email')
        .populate('coupon', 'code')
        .sort({ createdAt: -1 });

      console.log(`📊 All orders in ${range} range: ${allOrders.length}`);

      // Show status breakdown for all orders in this range
      const statusCounts = {};
      allOrders.forEach(order => {
        const status = order.status || 'No Status';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log(`\nStatus breakdown for ${range} range:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} orders`);
      });

      // Show sample orders
      if (allOrders.length > 0) {
        console.log(`\nSample orders in ${range} range:`);
        allOrders.slice(0, 3).forEach((order, index) => {
          const orderDate = moment(order.createdAt).tz(TIMEZONE);
          console.log(`   ${index + 1}. ${order._id}`);
          console.log(`      Status: ${order.status}`);
          console.log(`      Amount: ₹${order.totalAmount}`);
          console.log(`      Customer: ${order.user?.name || order.user?.email || 'N/A'}`);
          console.log(`      Date: ${orderDate.format('YYYY-MM-DD HH:mm:ss')}`);
          console.log(`      Payment: ${order.paymentMethod} (${order.paymentStatus})`);
        });
      }

      // Calculate totals
      const totalSales = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const deliveredSales = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      console.log(`\n💰 Sales Summary for ${range}:`);
      console.log(`   Total Sales (all orders): ₹${totalSales}`);
      console.log(`   Delivered Sales only: ₹${deliveredSales}`);
    }

    // Test custom date range
    console.log(`\n=== TESTING CUSTOM DATE RANGE ===`);
    const customStartDate = '2025-08-01';
    const customEndDate = '2025-08-04';
    
    const customStart = moment.tz(customStartDate, TIMEZONE).startOf('day');
    const customEnd = moment.tz(customEndDate, TIMEZONE).endOf('day');
    
    console.log(`Custom Range: ${customStart.format('YYYY-MM-DD HH:mm:ss')} to ${customEnd.format('YYYY-MM-DD HH:mm:ss')}`);

    const customDeliveredOrders = await Order.find({
      createdAt: { $gte: customStart.toDate(), $lte: customEnd.toDate() },
      status: 'Delivered',
    }).populate('user', 'name email');

    const customAllOrders = await Order.find({
      createdAt: { $gte: customStart.toDate(), $lte: customEnd.toDate() },
    }).populate('user', 'name email');

    console.log(`\n📊 Custom range results:`);
    console.log(`   Delivered orders: ${customDeliveredOrders.length}`);
    console.log(`   All orders: ${customAllOrders.length}`);

    // Show status breakdown for custom range
    const customStatusCounts = {};
    customAllOrders.forEach(order => {
      const status = order.status || 'No Status';
      customStatusCounts[status] = (customStatusCounts[status] || 0) + 1;
    });

    console.log(`\nStatus breakdown for custom range:`);
    Object.entries(customStatusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} orders`);
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
};

testSalesReportRanges(); 