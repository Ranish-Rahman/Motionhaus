import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Coupon from '../models/couponModel.js';
import connectDB from '../models/mongodb.js';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Kolkata';

const testUpdatedSalesReport = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Test the updated logic (including both Delivered and Completed)
    const ranges = ['daily', 'weekly', 'yearly'];
    
    for (const range of ranges) {
      console.log(`\n=== TESTING UPDATED ${range.toUpperCase()} RANGE ===`);
      
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

      // Test with updated logic (Delivered OR Completed)
      const matchStage = {
        createdAt: { $gte: start.toDate(), $lte: end.toDate() },
        status: { $in: ['Delivered', 'Completed'] },
      };

      // Test aggregation
      const summaryData = await Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$totalAmount" },
            totalDiscount: { $sum: { $ifNull: ["$discountAmount", 0] } },
            totalOrders: { $sum: 1 }
          }
        }
      ]);

      const summary = summaryData[0] || {
        totalSales: 0,
        totalDiscount: 0,
        totalOrders: 0
      };

      console.log(`\n📊 Updated Sales Report Results for ${range}:`);
      console.log(`   Total Orders: ${summary.totalOrders}`);
      console.log(`   Total Sales: ₹${summary.totalSales}`);
      console.log(`   Total Discount: ₹${summary.totalDiscount}`);

      // Test fetching orders
      const orders = await Order.find(matchStage)
        .populate('user', 'name email')
        .populate('coupon', 'code')
        .sort({ createdAt: -1 })
        .limit(5);

      console.log(`\n📋 Sample orders (${orders.length} found):`);
      orders.forEach((order, index) => {
        const orderDate = moment(order.createdAt).tz(TIMEZONE);
        console.log(`   ${index + 1}. ${order._id}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Amount: ₹${order.totalAmount}`);
        console.log(`      Customer: ${order.user?.name || order.user?.email || 'N/A'}`);
        console.log(`      Date: ${orderDate.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`      Payment: ${order.paymentMethod} (${order.paymentStatus})`);
      });
    }

    // Test custom date range
    console.log(`\n=== TESTING UPDATED CUSTOM DATE RANGE ===`);
    const customStartDate = '2025-08-01';
    const customEndDate = '2025-08-04';
    
    const customStart = moment.tz(customStartDate, TIMEZONE).startOf('day');
    const customEnd = moment.tz(customEndDate, TIMEZONE).endOf('day');
    
    console.log(`Custom Range: ${customStart.format('YYYY-MM-DD HH:mm:ss')} to ${customEnd.format('YYYY-MM-DD HH:mm:ss')}`);

    const customMatchStage = {
      createdAt: { $gte: customStart.toDate(), $lte: customEnd.toDate() },
      status: { $in: ['Delivered', 'Completed'] },
    };

    const customSummaryData = await Order.aggregate([
      { $match: customMatchStage },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalDiscount: { $sum: { $ifNull: ["$discountAmount", 0] } },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const customSummary = customSummaryData[0] || {
      totalSales: 0,
      totalDiscount: 0,
      totalOrders: 0
    };

    console.log(`\n📊 Custom Range Results:`);
    console.log(`   Total Orders: ${customSummary.totalOrders}`);
    console.log(`   Total Sales: ₹${customSummary.totalSales}`);
    console.log(`   Total Discount: ₹${customSummary.totalDiscount}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
};

testUpdatedSalesReport(); 