import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import { processReferralReward } from '../utils/referralCodeGenerator.js';
import connectDB from '../models/mongodb.js';

const testReferralComplete = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Test 1: Check if users have referral relationships
    console.log('\n1. Checking Referral Relationships:');
    const users = await User.find({}).limit(5);
    
    if (users.length === 0) {
      console.log('   ⚠️  No users found in database');
      return;
    }

    users.forEach(user => {
      console.log(`   👤 ${user.username || user.email}:`);
      console.log(`      Referral Code: ${user.referralCode || 'None'}`);
      console.log(`      Referred By: ${user.referredBy || 'None'}`);
      console.log(`      Wallet Balance: ₹${user.wallet?.balance || 0}`);
      console.log(`      Referral Rewards: ₹${user.referralRewards || 0}`);
    });

    // Test 2: Check recent orders and their referral status
    console.log('\n2. Checking Recent Orders:');
    const recentOrders = await Order.find({})
      .populate('user', 'username email referralCode referredBy')
      .sort({ createdAt: -1 })
      .limit(10);

    if (recentOrders.length === 0) {
      console.log('   ⚠️  No orders found in database');
      return;
    }

    recentOrders.forEach(order => {
      console.log(`   📦 Order ${order.orderID}:`);
      console.log(`      User: ${order.user?.username || order.user?.email}`);
      console.log(`      Amount: ₹${order.totalAmount}`);
      console.log(`      Payment Method: ${order.paymentMethod}`);
      console.log(`      Status: ${order.status}`);
      console.log(`      User Referred By: ${order.user?.referredBy || 'None'}`);
      console.log(`      Order Date: ${order.createdAt.toLocaleDateString()}`);
    });

    // Test 3: Test referral reward processing
    console.log('\n3. Testing Referral Reward Processing:');
    
    // Find a user who was referred
    const referredUser = await User.findOne({ referredBy: { $exists: true, $ne: null } });
    
    if (referredUser) {
      console.log(`   ✅ Found referred user: ${referredUser.username || referredUser.email}`);
      console.log(`      Referred by: ${referredUser.referredBy}`);
      
      // Find the referrer
      const referrer = await User.findById(referredUser.referredBy);
      if (referrer) {
        console.log(`   ✅ Found referrer: ${referrer.username || referrer.email}`);
        console.log(`      Current wallet balance: ₹${referrer.wallet?.balance || 0}`);
        console.log(`      Current referral rewards: ₹${referrer.referralRewards || 0}`);
        
        // Test processing a referral reward
        const testOrderAmount = 2000;
        console.log(`   🧪 Testing referral reward for ₹${testOrderAmount} order...`);
        
        try {
          const beforeBalance = referrer.wallet?.balance || 0;
          const beforeRewards = referrer.referralRewards || 0;
          
          const result = await processReferralReward(referrer._id, testOrderAmount);
          
          console.log(`   ✅ Referral reward processed successfully!`);
          console.log(`      Reward amount: ₹${result.rewardAmount}`);
          console.log(`      Previous balance: ₹${beforeBalance}`);
          console.log(`      New balance: ₹${result.newBalance}`);
          console.log(`      Previous rewards: ₹${beforeRewards}`);
          console.log(`      Total rewards: ₹${result.totalReferralRewards}`);
          
          // Revert the change for testing
          referrer.wallet.balance = beforeBalance;
          referrer.referralRewards = beforeRewards;
          await referrer.save();
          console.log(`   🔄 Reverted changes for testing`);
          
        } catch (error) {
          console.log(`   ❌ Error processing referral reward: ${error.message}`);
        }
      } else {
        console.log(`   ❌ Referrer not found: ${referredUser.referredBy}`);
      }
    } else {
      console.log('   ⚠️  No referred users found');
    }

    // Test 4: Check for any orders that should have triggered referral rewards
    console.log('\n4. Checking Orders That Should Have Triggered Referrals:');
    
    const ordersWithReferrals = await Order.find({})
      .populate({
        path: 'user',
        select: 'username email referredBy referralCode wallet referralRewards'
      })
      .sort({ createdAt: -1 });

    let referralOrdersFound = 0;
    ordersWithReferrals.forEach(order => {
      if (order.user?.referredBy && order.status !== 'payment-failed' && order.status !== 'cancelled') {
        referralOrdersFound++;
        console.log(`   📦 Order ${order.orderID}:`);
        console.log(`      User: ${order.user.username || order.user.email}`);
        console.log(`      Referred by: ${order.user.referredBy}`);
        console.log(`      Order amount: ₹${order.totalAmount}`);
        console.log(`      Payment method: ${order.paymentMethod}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Date: ${order.createdAt.toLocaleDateString()}`);
      }
    });

    if (referralOrdersFound === 0) {
      console.log('   ⚠️  No orders found that should have triggered referral rewards');
    } else {
      console.log(`   📊 Found ${referralOrdersFound} orders that should have triggered referral rewards`);
    }

    // Test 5: Summary
    console.log('\n5. Summary:');
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const usersWithReferralCodes = await User.countDocuments({ referralCode: { $exists: true, $ne: null } });
    const usersReferredByOthers = await User.countDocuments({ referredBy: { $exists: true, $ne: null } });
    
    console.log(`   👥 Total users: ${totalUsers}`);
    console.log(`   📦 Total orders: ${totalOrders}`);
    console.log(`   🎫 Users with referral codes: ${usersWithReferralCodes}`);
    console.log(`   🔗 Users referred by others: ${usersReferredByOthers}`);

    console.log('\n✅ Referral system test completed!');

  } catch (error) {
    console.error('❌ Error testing referral system:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

testReferralComplete(); 