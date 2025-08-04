import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import connectDB from '../models/mongodb.js';

const checkRecentReferral = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Check user 'gerry' and 'darry'
    console.log('\n1. Checking Users:');
    const gerry = await User.findOne({ username: 'gerry' });
    const darry = await User.findOne({ username: 'darry' });
    
    if (gerry) {
      console.log(`   👤 User 'gerry':`);
      console.log(`      ID: ${gerry._id}`);
      console.log(`      Email: ${gerry.email}`);
      console.log(`      Referral Code: ${gerry.referralCode}`);
      console.log(`      Referred By: ${gerry.referredBy || 'None'}`);
      console.log(`      Created: ${gerry.createdAt.toLocaleDateString()}`);
    } else {
      console.log('   ❌ User "gerry" not found');
    }

    if (darry) {
      console.log(`   👤 User 'darry':`);
      console.log(`      ID: ${darry._id}`);
      console.log(`      Email: ${darry.email}`);
      console.log(`      Referral Code: ${darry.referralCode}`);
      console.log(`      Wallet Balance: ₹${darry.wallet?.balance || 0}`);
      console.log(`      Referral Rewards: ₹${darry.referralRewards || 0}`);
    } else {
      console.log('   ❌ User "darry" not found');
    }

    // Check recent orders by gerry
    console.log('\n2. Checking Recent Orders by gerry:');
    const gerryOrders = await Order.find({ user: gerry?._id })
      .sort({ createdAt: -1 })
      .limit(5);

    if (gerryOrders.length > 0) {
      gerryOrders.forEach(order => {
        console.log(`   📦 Order ${order.orderID}:`);
        console.log(`      Amount: ₹${order.totalAmount}`);
        console.log(`      Payment Method: ${order.paymentMethod}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Date: ${order.createdAt.toLocaleDateString()}`);
      });
    } else {
      console.log('   ⚠️  No orders found for gerry');
    }

    // Check if gerry was referred by darry
    if (gerry && darry) {
      console.log('\n3. Referral Relationship Check:');
      if (gerry.referredBy && gerry.referredBy.toString() === darry._id.toString()) {
        console.log('   ✅ gerry IS referred by darry');
        console.log(`   📊 darry's current wallet: ₹${darry.wallet?.balance || 0}`);
        console.log(`   📊 darry's referral rewards: ₹${darry.referralRewards || 0}`);
        
        // Check if any of gerry's orders should have triggered referral rewards
        const successfulOrders = gerryOrders.filter(order => 
          order.status !== 'payment-failed' && 
          order.status !== 'cancelled'
        );
        
        console.log(`   📦 gerry has ${successfulOrders.length} successful orders`);
        
        if (successfulOrders.length > 0) {
          console.log('   ⚠️  These orders should have triggered referral rewards!');
          successfulOrders.forEach(order => {
            console.log(`      - Order ${order.orderID}: ₹${order.totalAmount} (${order.paymentMethod})`);
          });
        }
      } else {
        console.log('   ❌ gerry is NOT referred by darry');
        console.log(`   gerry.referredBy: ${gerry.referredBy}`);
        console.log(`   darry._id: ${darry._id}`);
      }
    }

    // Check all users who are referred by darry
    console.log('\n4. All Users Referred by darry:');
    if (darry) {
      const referredUsers = await User.find({ referredBy: darry._id });
      console.log(`   📊 darry has referred ${referredUsers.length} users:`);
      referredUsers.forEach(user => {
        console.log(`      - ${user.username} (${user.email})`);
      });
    }

    // Check all orders that should have triggered referral rewards for darry
    console.log('\n5. Orders That Should Have Triggered Referral Rewards for darry:');
    if (darry) {
      const referredUsers = await User.find({ referredBy: darry._id });
      const referredUserIds = referredUsers.map(user => user._id);
      
      const ordersForReferrals = await Order.find({ 
        user: { $in: referredUserIds },
        status: { $nin: ['payment-failed', 'cancelled'] }
      }).populate('user', 'username email');

      console.log(`   📦 Found ${ordersForReferrals.length} orders from darry's referrals:`);
      ordersForReferrals.forEach(order => {
        console.log(`      - Order ${order.orderID}: ${order.user.username} - ₹${order.totalAmount} (${order.paymentMethod})`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking recent referral:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

checkRecentReferral(); 