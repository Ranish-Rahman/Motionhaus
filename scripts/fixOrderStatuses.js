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

const fixOrderStatuses = async () => {
  try {
    await connectDB();

    // Get all orders
    const orders = await Order.find().populate('user', 'username email');

    console.log('\n=== FIXING ORDER STATUSES ===');
    let fixedCount = 0;

    for (const order of orders) {
      let needsUpdate = false;
      const updates = {};

      // Check if all items are delivered
      const allItemsDelivered = order.items.every(item => item.status === 'Delivered');
      const allItemsCancelled = order.items.every(item => item.status === 'Cancelled');
      const allItemsReturned = order.items.every(item => item.status === 'Returned');

      // Determine correct order status
      let correctOrderStatus = 'Pending';
      if (allItemsDelivered) {
        correctOrderStatus = 'Delivered';
      } else if (allItemsCancelled) {
        correctOrderStatus = 'Cancelled';
      } else if (allItemsReturned) {
        correctOrderStatus = 'Returned';
      } else {
        const hasDeliveredItems = order.items.some(item => item.status === 'Delivered');
        const hasShippedItems = order.items.some(item => item.status === 'Shipped');
        
        if (hasDeliveredItems || hasShippedItems) {
          correctOrderStatus = 'Shipped';
        }
      }

      // Check if order status needs update
      if (order.status !== correctOrderStatus) {
        updates.status = correctOrderStatus;
        needsUpdate = true;
        console.log(`Order ${order.orderID}: Status "${order.status}" → "${correctOrderStatus}"`);
      }

      // Fix payment status for COD orders that are delivered
      if (order.paymentMethod === 'cod' && 
          (order.status === 'Delivered' || correctOrderStatus === 'Delivered') && 
          order.paymentStatus === 'pending') {
        updates.paymentStatus = 'paid';
        needsUpdate = true;
        console.log(`Order ${order.orderID}: Payment Status "pending" → "paid" (COD delivered)`);
      }

      // Fix "Completed" status to "Delivered"
      if (order.status === 'Completed' && allItemsDelivered) {
        updates.status = 'Delivered';
        needsUpdate = true;
        console.log(`Order ${order.orderID}: Status "Completed" → "Delivered"`);
      }

      // Update the order if needed
      if (needsUpdate) {
        await Order.findByIdAndUpdate(order._id, { $set: updates });
        fixedCount++;
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} orders`);

    // Show summary of fixed orders
    const summary = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n=== ORDER STATUS SUMMARY ===');
    summary.forEach(status => {
      console.log(`${status._id || 'No Status'}: ${status.count} orders`);
    });

    // Show COD payment status summary
    const codSummary = await Order.aggregate([
      {
        $match: { paymentMethod: 'cod' }
      },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n=== COD ORDERS PAYMENT STATUS ===');
    codSummary.forEach(status => {
      console.log(`${status._id || 'No Payment Status'}: ${status.count} orders`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

fixOrderStatuses(); 