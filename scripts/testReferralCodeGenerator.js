import mongoose from 'mongoose';
import User from '../models/userModel.js';
import { 
  generateReferralCode, 
  validateReferralCode, 
  checkReferralCode, 
  calculateReferralReward, 
  processReferralReward 
} from '../utils/referralCodeGenerator.js';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const testReferralCodeGenerator = async () => {
  try {
    await connectDB();

    console.log('\n=== TESTING REFERRAL CODE GENERATOR ===\n');

    // Test 1: Generate referral codes
    console.log('1. Testing generateReferralCode function:');
    const testUsernames = ['john_doe', 'jane_smith', 'test_user', 'admin_user'];
    
    for (const username of testUsernames) {
      try {
        const referralCode = await generateReferralCode(username);
        console.log(`   ✅ Generated for "${username}": ${referralCode}`);
      } catch (error) {
        console.log(`   ❌ Failed for "${username}": ${error.message}`);
      }
    }

    // Test 2: Validate referral codes
    console.log('\n2. Testing validateReferralCode function:');
    const testCodes = [
      'VALID123',
      'invalid@code',
      'short',
      'very_long_referral_code_that_exceeds_limit',
      '',
      null,
      'VALID_CODE_123'
    ];

    testCodes.forEach(code => {
      const result = validateReferralCode(code);
      console.log(`   ${result.isValid ? '✅' : '❌'} "${code}": ${result.message}`);
    });

    // Test 3: Check existing referral codes in database
    console.log('\n3. Testing checkReferralCode function:');
    
    // Get some existing users with referral codes
    const existingUsers = await User.find({ referralCode: { $exists: true, $ne: null } }).limit(3);
    
    if (existingUsers.length > 0) {
      for (const user of existingUsers) {
        const result = await checkReferralCode(user.referralCode);
        console.log(`   ${result.valid ? '✅' : '❌'} "${user.referralCode}" (${user.username}): ${result.message}`);
      }
    } else {
      console.log('   ⚠️  No users with referral codes found in database');
    }

    // Test 4: Calculate referral rewards
    console.log('\n4. Testing calculateReferralReward function:');
    const testOrderAmounts = [100, 500, 1000, 5000, 10000, 15000];
    
    testOrderAmounts.forEach(amount => {
      const reward = calculateReferralReward(amount);
      const percentage = ((reward / amount) * 100).toFixed(1);
      console.log(`   Order: ₹${amount.toLocaleString()} → Reward: ₹${reward} (${percentage}%)`);
    });

    // Test 5: Process referral reward (if we have a valid referrer)
    console.log('\n5. Testing processReferralReward function:');
    
    if (existingUsers.length > 0) {
      const testReferrer = existingUsers[0];
      const testOrderAmount = 2000;
      
      try {
        console.log(`   Testing with referrer: ${testReferrer.username} (${testReferrer.referralCode})`);
        console.log(`   Order amount: ₹${testOrderAmount.toLocaleString()}`);
        
        const beforeBalance = testReferrer.wallet?.balance || 0;
        const beforeRewards = testReferrer.referralRewards || 0;
        
        const result = await processReferralReward(testReferrer._id, testOrderAmount);
        
        console.log(`   ✅ Success!`);
        console.log(`      Reward amount: ₹${result.rewardAmount}`);
        console.log(`      Previous balance: ₹${beforeBalance}`);
        console.log(`      New balance: ₹${result.newBalance}`);
        console.log(`      Previous rewards: ₹${beforeRewards}`);
        console.log(`      Total rewards: ₹${result.totalReferralRewards}`);
        
        // Revert the change for testing
        testReferrer.wallet.balance = beforeBalance;
        testReferrer.referralRewards = beforeRewards;
        await testReferrer.save();
        console.log(`   🔄 Reverted changes for testing`);
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    } else {
      console.log('   ⚠️  No users available to test referral reward processing');
    }

    // Test 6: Check database state
    console.log('\n6. Database State Check:');
    const totalUsers = await User.countDocuments();
    const usersWithReferralCodes = await User.countDocuments({ referralCode: { $exists: true, $ne: null } });
    const usersWithReferralRewards = await User.countDocuments({ referralRewards: { $exists: true, $gt: 0 } });
    const usersWithWallet = await User.countDocuments({ 'wallet.balance': { $exists: true, $gt: 0 } });
    
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with referral codes: ${usersWithReferralCodes}`);
    console.log(`   Users with referral rewards: ${usersWithReferralRewards}`);
    console.log(`   Users with wallet balance: ${usersWithWallet}`);

    // Test 7: Check for potential issues
    console.log('\n7. Potential Issues Check:');
    
    // Check for duplicate referral codes
    const duplicateCodes = await User.aggregate([
      { $group: { _id: '$referralCode', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
    ]);
    
    if (duplicateCodes.length > 0) {
      console.log(`   ⚠️  Found ${duplicateCodes.length} duplicate referral codes:`);
      duplicateCodes.forEach(dup => {
        console.log(`      "${dup._id}" appears ${dup.count} times`);
      });
    } else {
      console.log('   ✅ No duplicate referral codes found');
    }

    // Check for users without referral codes
    const usersWithoutCodes = await User.countDocuments({ 
      $or: [
        { referralCode: { $exists: false } },
        { referralCode: null },
        { referralCode: '' }
      ]
    });
    
    if (usersWithoutCodes > 0) {
      console.log(`   ⚠️  Found ${usersWithoutCodes} users without referral codes`);
    } else {
      console.log('   ✅ All users have referral codes');
    }

    await mongoose.disconnect();
    console.log('\n✅ Referral code generator test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await mongoose.disconnect();
  }
};

testReferralCodeGenerator(); 