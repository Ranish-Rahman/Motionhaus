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

const checkOrderItemStatus = async () => {
  try {
    await connectDB();

    // Find orders with mixed statuses
    const orders = await Order.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(10);

    console.log('\n=== ORDER STATUS ANALYSIS ===');
    
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. Order ID: ${order.orderID}`);
      console.log(`   User: ${order.user?.username || order.user?.email || 'N/A'}`);
      console.log(`   Order Status: ${order.status}`);
      console.log(`   Payment Status: ${order.paymentStatus}`);
      console.log(`   Total Amount: ₹${order.totalAmount}`);
      
      // Check item statuses
      console.log(`   Items:`);
      order.items.forEach((item, itemIndex) => {
        console.log(`     ${itemIndex + 1}. ${item.product?.name || 'Product'} (Size: ${item.size})`);
        console.log(`        Item Status: ${item.status}`);
        console.log(`        Quantity: ${item.quantity}`);
      });
      
      // Check if all items are delivered
      const allItemsDelivered = order.items.every(item => item.status === 'Delivered');
      const allItemsCancelled = order.items.every(item => item.status === 'Cancelled');
      const allItemsReturned = order.items.every(item => item.status === 'Returned');
      
      console.log(`   Analysis:`);
      console.log(`     All items delivered: ${allItemsDelivered}`);
      console.log(`     All items cancelled: ${allItemsCancelled}`);
      console.log(`     All items returned: ${allItemsReturned}`);
      
      // Check what the order status should be
      let expectedStatus = 'Pending';
      if (allItemsDelivered) {
        expectedStatus = 'Delivered';
      } else if (allItemsCancelled) {
        expectedStatus = 'Cancelled';
      } else if (allItemsReturned) {
        expectedStatus = 'Returned';
      } else {
        const hasDeliveredItems = order.items.some(item => item.status === 'Delivered');
        const hasShippedItems = order.items.some(item => item.status === 'Shipped');
        
        if (hasDeliveredItems || hasShippedItems) {
          expectedStatus = 'Shipped';
        }
      }
      
      console.log(`     Expected order status: ${expectedStatus}`);
      console.log(`     Status matches: ${order.status === expectedStatus ? '✅' : '❌'}`);
      
      if (order.status !== expectedStatus) {
        console.log(`     ⚠️  STATUS MISMATCH: Order shows "${order.status}" but should be "${expectedStatus}"`);
      }
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

checkOrderItemStatus(); 