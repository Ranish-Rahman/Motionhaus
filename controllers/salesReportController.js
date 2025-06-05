import moment from 'moment-timezone';
import Order from '../models/orderModel.js';
import Coupon from '../models/couponModel.js';

// Render the sales report EJS page
export const getSalesReportPage = (req, res) => {
  res.render('admin/sales-report', { 
    title: 'Sales Report',
    path: '/admin/sales-report'
  });
};

// Fetch sales report data (AJAX)
export const getSalesReport = async (req, res) => {
  try {
    console.log('Sales Report Request:', {
      query: req.query,
      path: req.path,
      method: req.method
    });

    const { range, startDate, endDate } = req.query;
    const timezone = 'Asia/Kolkata';
    let start, end;

    if (range === 'daily') {
      start = moment().tz(timezone).startOf('day');
      end = moment().tz(timezone).endOf('day');
    } else if (range === 'weekly') {
      start = moment().tz(timezone).startOf('week');
      end = moment().tz(timezone).endOf('week');
    } else if (range === 'yearly') {
      start = moment().tz(timezone).startOf('year');
      end = moment().tz(timezone).endOf('year');
    } else if (range === 'custom' && startDate && endDate) {
      start = moment.tz(startDate, timezone).startOf('day');
      end = moment.tz(endDate, timezone).endOf('day');
    } else {
      console.log('Invalid range or dates:', { range, startDate, endDate });
      return res.status(400).json({ error: 'Invalid range or dates' });
    }

    console.log('Date Range:', {
      start: start.format(),
      end: end.format(),
      timezone
    });

    // Fetch orders in the date range
    const orders = await Order.find({
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
      status: { $nin: ['Cancelled', 'Returned'] },
    });

    console.log('Found Orders:', {
      count: orders.length,
      firstOrder: orders[0] ? {
        id: orders[0]._id,
        createdAt: orders[0].createdAt,
        totalAmount: orders[0].totalAmount,
        status: orders[0].status
      } : null
    });

    // Calculate summary
    let totalSales = 0;
    let totalOrders = orders.length;
    let totalDiscount = 0;
    let totalProducts = 0;

    for (const order of orders) {
      totalSales += order.totalAmount || 0;
      totalProducts += order.products ? order.products.length : 0;
      if (order.coupon) {
        const coupon = await Coupon.findById(order.coupon).lean();
        if (coupon && coupon.discountAmount) {
          totalDiscount += coupon.discountAmount;
        }
      }
    }

    console.log('Summary:', {
      totalSales,
      totalOrders,
      totalDiscount,
      totalProducts
    });

    // Prepare table data
    const tableData = orders.map(order => ({
      id: order._id,
      date: moment(order.createdAt).tz(timezone).format('YYYY-MM-DD HH:mm'),
      customer: order.user?.name || 'N/A',
      total: order.totalAmount,
      status: order.status,
      products: order.products?.length || 0,
      coupon: order.coupon || '-',
    }));

    res.json({
      summary: {
        totalSales,
        totalOrders,
        totalDiscount,
        totalProducts,
      },
      tableData,
    });
  } catch (err) {
    console.error('Sales report error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}; 