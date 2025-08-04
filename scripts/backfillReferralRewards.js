import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import { processReferralReward } from '../utils/referralCodeGenerator.js';
import connectDB from '../models/mongodb.js';

const backfillReferralRewards = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Find all orders where the user was referred but referral reward wasn't processed
    console.log('\n🔍 Finding orders that need referral reward backfill...');
    
    const ordersToProcess = await Order.find({
      status: { $nin: ['payment-failed', 'cancelled'] } // Only successful orders
    }).populate({
      path: 'user',
      select: 'username email referredBy referralCode wallet referralRewards'
    });

    console.log(`📊 Found ${ordersToProcess.length} total orders to check`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const order of ordersToProcess) {
      // Check if user was referred
      if (!order.user?.referredBy) {
        skippedCount++;
        continue;
      }

      console.log(`\n📦 Processing order ${order.orderID}:`);
      console.log(`   User: ${order.user.username || order.user.email}`);
      console.log(`   Referred by: ${order.user.referredBy}`);
      console.log(`   Order amount: ₹${order.totalAmount}`);
      console.log(`   Payment method: ${order.paymentMethod}`);
      console.log(`   Status: ${order.status}`);

      try {
        // Find the referrer
        const referrer = await User.findById(order.user.referredBy);
        if (!referrer) {
          console.log(`   ❌ Referrer not found: ${order.user.referredBy}`);
          errorCount++;
          continue;
        }

        console.log(`   ✅ Found referrer: ${referrer.username || referrer.email}`);
        console.log(`   Current wallet balance: ₹${referrer.wallet?.balance || 0}`);
        console.log(`   Current referral rewards: ₹${referrer.referralRewards || 0}`);

        // Process the referral reward
        const result = await processReferralReward(referrer._id, order.totalAmount);
        
        console.log(`   ✅ Referral reward processed!`);
        console.log(`   Reward amount: ₹${result.rewardAmount}`);
        console.log(`   New wallet balance: ₹${result.newBalance}`);
        console.log(`   Total referral rewards: ₹${result.totalReferralRewards}`);
        
        processedCount++;

      } catch (error) {
        console.log(`   ❌ Error processing referral reward: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Successfully processed: ${processedCount} orders`);
    console.log(`   ⏭️  Skipped (no referral): ${skippedCount} orders`);
    console.log(`   ❌ Errors: ${errorCount} orders`);
    console.log(`   📦 Total checked: ${ordersToProcess.length} orders`);

    if (processedCount > 0) {
      console.log('\n🎉 Referral rewards backfill completed successfully!');
    } else {
      console.log('\nℹ️  No referral rewards needed to be backfilled.');
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

backfillReferralRewards(); 