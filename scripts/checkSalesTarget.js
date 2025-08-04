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

const checkSalesTarget = async () => {
  try {
    await connectDB();

    // Get current month data
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    
    const currentPeriodStart = new Date(currentYear, currentMonth, 1);
    const currentPeriodEnd = new Date(now);

    // Fetch current month orders
    const currentOrders = await Order.find({ 
      createdAt: { $gte: currentPeriodStart, $lt: currentPeriodEnd }, 
      paymentStatus: 'paid' 
    });

    // Calculate stats
    const totalRevenue = currentOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const monthlyTarget = 50000; // ₹50,000 monthly target
    const remainingDays = daysInMonth - currentDay + 1;
    const remainingTarget = Math.max(0, monthlyTarget - totalRevenue);
    const targetPercentage = Math.min(100, Math.round((totalRevenue / monthlyTarget) * 100));

    console.log('\n=== SALES TARGET ANALYSIS ===');
    console.log(`Current Date: ${now.toLocaleDateString()}`);
    console.log(`Current Month: ${now.toLocaleString('default', { month: 'long' })} ${currentYear}`);
    console.log(`Days in Month: ${daysInMonth}`);
    console.log(`Current Day: ${currentDay}`);
    console.log(`Remaining Days: ${remainingDays}`);
    
    console.log('\n=== TARGET CALCULATIONS ===');
    console.log(`Monthly Target: ₹${monthlyTarget.toLocaleString()}`);
    console.log(`Current Revenue: ₹${totalRevenue.toLocaleString()}`);
    console.log(`Remaining Target: ₹${remainingTarget.toLocaleString()}`);
    console.log(`Target Percentage: ${targetPercentage}%`);
    
    console.log('\n=== PROGRESS ANALYSIS ===');
    if (targetPercentage >= 100) {
      console.log('🎉 TARGET ACHIEVED! You have exceeded your monthly target!');
    } else {
      console.log(`📊 You need ₹${remainingTarget.toLocaleString()} more to reach your target`);
      console.log(`📈 Current daily average: ₹${Math.round(totalRevenue / currentDay).toLocaleString()}`);
    }

    // Show order breakdown
    console.log('\n=== ORDER BREAKDOWN ===');
    console.log(`Total Orders this month: ${currentOrders.length}`);
    
    const orderByDay = {};
    currentOrders.forEach(order => {
      const day = order.createdAt.getDate();
      if (!orderByDay[day]) orderByDay[day] = { count: 0, revenue: 0 };
      orderByDay[day].count++;
      orderByDay[day].revenue += order.totalAmount;
    });

    console.log('\nDaily breakdown:');
    Object.keys(orderByDay).sort((a, b) => parseInt(a) - parseInt(b)).forEach(day => {
      const data = orderByDay[day];
      console.log(`  Day ${day}: ${data.count} orders, ₹${data.revenue.toLocaleString()}`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

checkSalesTarget(); 