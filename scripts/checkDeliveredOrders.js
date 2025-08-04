import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Coupon from '../models/couponModel.js';
import connectDB from '../models/mongodb.js';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Kolkata';

const checkDeliveredOrders = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Get all delivered orders
    const deliveredOrders = await Order.find({ status: 'Delivered' })
      .populate('user', 'name email')
      .populate('coupon', 'code')
      .sort({ createdAt: -1 });

    console.log(`\nTotal delivered orders: ${deliveredOrders.length}`);

    if (deliveredOrders.length === 0) {
      console.log('No delivered orders found');
      return;
    }

    // Check current date range (today)
    const today = moment().tz(TIMEZONE);
    const startOfDay = today.clone().startOf('day');
    const endOfDay = today.clone().endOf('day');

    console.log(`\nToday's date range:`);
    console.log(`Start: ${startOfDay.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`End: ${endOfDay.format('YYYY-MM-DD HH:mm:ss')}`);

    // Filter orders for today
    const todaysOrders = deliveredOrders.filter(order => {
      const orderDate = moment(order.createdAt).tz(TIMEZONE);
      return orderDate.isBetween(startOfDay, endOfDay, null, '[]');
    });

    console.log(`\nDelivered orders for today: ${todaysOrders.length}`);

    // Show all delivered orders with their dates
    console.log('\nAll delivered orders:');
    deliveredOrders.forEach((order, index) => {
      const orderDate = moment(order.createdAt).tz(TIMEZONE);
      const isToday = orderDate.isBetween(startOfDay, endOfDay, null, '[]');
      
      console.log(`${index + 1}. ID: ${order._id}`);
      console.log(`   Date: ${orderDate.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`   Customer: ${order.user?.name || order.user?.email || 'N/A'}`);
      console.log(`   Amount: ₹${order.totalAmount}`);
      console.log(`   Coupon: ${order.coupon?.code || 'None'}`);
      console.log(`   Is Today: ${isToday ? 'YES' : 'NO'}`);
      console.log('---');
    });

    // Check weekly range
    const startOfWeek = today.clone().startOf('week');
    const endOfWeek = today.clone().endOf('week');
    
    const weeklyOrders = deliveredOrders.filter(order => {
      const orderDate = moment(order.createdAt).tz(TIMEZONE);
      return orderDate.isBetween(startOfWeek, endOfWeek, null, '[]');
    });

    console.log(`\nDelivered orders for this week: ${weeklyOrders.length}`);

    // Check yearly range
    const startOfYear = today.clone().startOf('year');
    const endOfYear = today.clone().endOf('year');
    
    const yearlyOrders = deliveredOrders.filter(order => {
      const orderDate = moment(order.createdAt).tz(TIMEZONE);
      return orderDate.isBetween(startOfYear, endOfYear, null, '[]');
    });

    console.log(`\nDelivered orders for this year: ${yearlyOrders.length}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
};

checkDeliveredOrders(); 