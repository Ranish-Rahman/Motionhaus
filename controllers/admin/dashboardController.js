import Order from '../../models/orderModel.js';
import User from '../../models/userModel.js';
import Product from '../../models/ProductModel.js';
import Category from '../../models/categoryModel.js';
import fs from 'fs';
import path from 'path';

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export const getDashboard = async (req, res) => {
  const { period = 'monthly', startDate: startDateStr, endDate: endDateStr } = req.query;
  const now = new Date();
  
  let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;
  let activePeriod = period;

  if (startDateStr && endDateStr) {
    activePeriod = 'custom';
    currentPeriodStart = new Date(startDateStr);
    currentPeriodEnd = new Date(endDateStr);
    currentPeriodEnd.setHours(23, 59, 59, 999);
    
    const duration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
    previousPeriodStart = new Date(previousPeriodEnd.getTime() - duration);

  } else if (period === 'weekly') {
    currentPeriodEnd = new Date(now);
    currentPeriodStart = new Date(now.setDate(now.getDate() - 6));
    currentPeriodStart.setHours(0, 0, 0, 0);

    previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
    previousPeriodStart = new Date(new Date().setDate(currentPeriodStart.getDate() - 7));
    previousPeriodStart.setHours(0, 0, 0, 0);

  } else if (period === 'yearly') {
    currentPeriodStart = new Date(now.getFullYear(), 0, 1);
    currentPeriodEnd = new Date(now);

    previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
    previousPeriodEnd = new Date(now.getFullYear(), 0, 1);
    
  } else { // monthly
    currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentPeriodEnd = new Date(now);

    previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Fetch data for both periods
  const currentOrders = await Order.find({ createdAt: { $gte: currentPeriodStart, $lt: currentPeriodEnd }, paymentStatus: 'paid' });
  const previousOrders = await Order.find({ createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd }, paymentStatus: 'paid' });
  
  const currentCustomers = await User.countDocuments({ createdAt: { $gte: currentPeriodStart, $lt: currentPeriodEnd }});
  const previousCustomers = await User.countDocuments({ createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd }});

  // Calculate stats dynamically
  const totalRevenue = currentOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const lastRevenue = previousOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const revenueChange = lastRevenue ? Math.round(((totalRevenue - lastRevenue) / lastRevenue) * 100) : totalRevenue > 0 ? 100 : 0;

  const totalOrders = currentOrders.length;
  const lastOrders = previousOrders.length;
  const ordersChange = lastOrders ? Math.round(((totalOrders - lastOrders) / lastOrders) * 100) : totalOrders > 0 ? 100 : 0;

  const totalCustomers = currentCustomers;
  const lastCustomers = previousCustomers;
  const customersChange = lastCustomers ? Math.round(((totalCustomers - lastCustomers) / lastCustomers) * 100) : totalCustomers > 0 ? 100 : 0;

  // Pending Delivery (this is independent of period)
  const pendingDelivery = await Order.countDocuments({ status: 'Pending' });
  const pendingChange = 3; // Placeholder

  // Sales Analytics
  const salesAnalytics = { labels: [], data: [] };
  if (activePeriod === 'custom') {
    const dateIterator = new Date(currentPeriodStart);
    while (dateIterator <= currentPeriodEnd) {
      const dayStart = new Date(dateIterator);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateIterator);
      dayEnd.setHours(23, 59, 59, 999);

      const dayOrders = await Order.find({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        paymentStatus: 'paid'
      });

      salesAnalytics.labels.push(dayStart.toLocaleDateString('en-CA')); // YYYY-MM-DD
      salesAnalytics.data.push(dayOrders.reduce((sum, o) => sum + o.totalAmount, 0));
      
      dateIterator.setDate(dateIterator.getDate() + 1);
    }
  } else if (activePeriod === 'weekly') {
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(new Date().getDate() - i);
        const start = new Date(date.setHours(0, 0, 0, 0));
        const end = new Date(date.setHours(23, 59, 59, 999));

        const dayOrders = await Order.find({
            createdAt: { $gte: start, $lt: end },
            paymentStatus: 'paid'
        });
        salesAnalytics.labels.push(start.toLocaleString('default', { weekday: 'short' }));
        salesAnalytics.data.push(dayOrders.reduce((sum, o) => sum + o.totalAmount, 0));
    }
  } else if (activePeriod === 'yearly') {
      for (let i = 4; i >= 0; i--) {
          const year = new Date().getFullYear() - i;
          const start = new Date(year, 0, 1);
          const end = new Date(year + 1, 0, 1);

          const yearOrders = await Order.find({
              createdAt: { $gte: start, $lt: end },
              paymentStatus: 'paid'
          });
          salesAnalytics.labels.push(year.toString());
          salesAnalytics.data.push(yearOrders.reduce((sum, o) => sum + o.totalAmount, 0));
      }
  } else { // 'monthly' is the default
      for (let m = 0; m < 12; m++) {
          const start = new Date(new Date().getFullYear(), m, 1);
          const end = new Date(new Date().getFullYear(), m + 1, 1);
          const monthOrders = await Order.find({
            createdAt: { $gte: start, $lt: end },
            paymentStatus: 'paid'
          });
          salesAnalytics.labels.push(start.toLocaleString('default', { month: 'short' }));
          salesAnalytics.data.push(monthOrders.reduce((sum, o) => sum + o.totalAmount, 0));
      }
  }

  // Sales Target - Calculate based on current month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = new Date().getDate();
  
 
  let monthlyTarget = 120000; // Default ₹50,000 monthly target
  const configPath = path.join(process.cwd(), 'config', 'salesTarget.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const targetConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      monthlyTarget = targetConfig.monthlyTarget || monthlyTarget;
    }
  } catch (error) {
    console.error('Error reading sales target config:', error);
    // Use default target if config file is invalid
  }
  
  // Calculate remaining target
  const remainingDays = daysInMonth - currentDay + 1;
  const remainingTarget = Math.max(0, monthlyTarget - totalRevenue);
  const targetProgress = {
    achieved: totalRevenue,
    remaining: remainingTarget
  };
  
  // Calculate target percentage
  const targetPercentage = Math.min(100, Math.round((totalRevenue / monthlyTarget) * 100));

  // Top 10 Products
  const productAgg = await Order.aggregate([
    { $unwind: '$items' },
    { $group: { _id: '$items.product', count: { $sum: '$items.quantity' } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  const topProducts = await Promise.all(productAgg.map(async p => {
    const prod = await Product.findById(p._id);
    return {
      name: prod?.name || 'Unknown',
      image: prod?.images?.[0] || '/image/default.png',
      count: p.count
    };
  }));

  // Top 10 Categories
  const catAgg = await Order.aggregate([
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
    { $unwind: '$prod' },
    { $group: { _id: '$prod.category', count: { $sum: '$items.quantity' } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  const topCategories = await Promise.all(catAgg.map(async c => {
    let cat = null;
    // Try to find by ObjectId if possible
    if (typeof c._id === 'string' && c._id.length === 24 && /^[a-fA-F0-9]{24}$/.test(c._id)) {
      cat = await Category.findById(c._id);
    }
    if (!cat) {
      // Try by name if not found by ID
      cat = await Category.findOne({ name: c._id });
    }
    return {
      name: cat?.name || c._id || 'Unknown',
      count: c.count
    };
  }));

  // Top 10 Brands
  const brandAgg = await Order.aggregate([
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
    { $unwind: '$prod' },
    { $group: { _id: '$prod.brand', count: { $sum: '$items.quantity' } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  const topBrands = brandAgg.map(b => ({
    name: b._id || 'Unknown',
    count: b.count
  }));

  res.render('admin/dashboard', {
    stats: {
      totalRevenue,
      revenueChange,
      totalOrders,
      ordersChange,
      totalCustomers,
      customersChange,
      pendingDelivery,
      pendingChange,
      monthlyTarget,
      targetPercentage,
      remainingDays
    },
    salesAnalytics,
    targetProgress,
    topProducts,
    topCategories,
    topBrands,
    period: activePeriod,
    startDate: startDateStr || '',
    endDate: endDateStr || '',
    path: '/admin/dashboard'
  });
}; 