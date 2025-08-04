import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Coupon from '../models/couponModel.js';
import connectDB from '../models/mongodb.js';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Kolkata';

const testSalesReportAPI = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Test the same logic as the sales report controller
    const range = 'yearly'; // Change this to test different ranges
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

    console.log(`\nTesting ${range} range:`);
    console.log(`Start: ${start.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`End: ${end.format('YYYY-MM-DD HH:mm:ss')}`);

    const matchStage = {
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
      status: 'Delivered',
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

    console.log('\nSummary:');
    console.log(`Total Sales: ₹${summary.totalSales}`);
    console.log(`Total Orders: ${summary.totalOrders}`);
    console.log(`Total Discount: ₹${summary.totalDiscount}`);

    // Test fetching orders
    const orders = await Order.find(matchStage)
      .populate('user', 'name email')
      .populate('items.product', 'name')
      .populate('coupon', 'code')
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`\nFound ${orders.length} orders:`);
    orders.forEach((order, index) => {
      console.log(`${index + 1}. ID: ${order._id}`);
      console.log(`   Date: ${moment(order.createdAt).tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`   Customer: ${order.user?.name || order.user?.email || 'N/A'}`);
      console.log(`   Amount: ₹${order.totalAmount}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Coupon: ${order.coupon?.code || 'None'}`);
      console.log('---');
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
};

testSalesReportAPI(); 