import mongoose from 'mongoose';
import User from '../models/userModel.js';
import { checkReferralCode } from '../utils/referralCodeGenerator.js';
import connectDB from '../models/mongodb.js';

const debugSignup = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Check darry's referral code
    console.log('\n1. Checking darry\'s referral code:');
    const darry = await User.findOne({ username: 'darry' });
    if (darry) {
      console.log(`   darry's referral code: "${darry.referralCode}"`);
      console.log(`   darry's referral code (uppercase): "${darry.referralCode.toUpperCase()}"`);
      console.log(`   darry's referral code (lowercase): "${darry.referralCode.toLowerCase()}"`);
    }

    // Test different variations of darry's referral code
    console.log('\n2. Testing referral code validation:');
    if (darry) {
      const testCodes = [
        darry.referralCode,
        darry.referralCode.toUpperCase(),
        darry.referralCode.toLowerCase(),
        'darry2144',
        'DARRY2144',
        'darry2144',
        'darry2144 ',
        ' darry2144',
        'darry2144\n',
        'darry2144\t'
      ];

      for (const testCode of testCodes) {
        console.log(`\n   Testing code: "${testCode}"`);
        const result = await checkReferralCode(testCode);
        console.log(`   Result:`, {
          exists: result.exists,
          valid: result.valid,
          message: result.message,
          referrer: result.referrer,
          referrerUsername: result.referrerUsername
        });
      }
    }

    // Check all users and their referral codes
    console.log('\n3. All users and their referral codes:');
    const allUsers = await User.find({}).select('username email referralCode referredBy');
    allUsers.forEach(user => {
      console.log(`   ${user.username}: "${user.referralCode}" (referred by: ${user.referredBy || 'None'})`);
    });

    // Check if there are any users with similar referral codes
    console.log('\n4. Checking for similar referral codes:');
    const darryCode = darry?.referralCode;
    if (darryCode) {
      const similarCodes = allUsers.filter(user => 
        user.referralCode && 
        (user.referralCode.toLowerCase().includes(darryCode.toLowerCase()) ||
         darryCode.toLowerCase().includes(user.referralCode.toLowerCase()))
      );
      
      console.log(`   Users with similar codes to "${darryCode}":`);
      similarCodes.forEach(user => {
        console.log(`      ${user.username}: "${user.referralCode}"`);
      });
    }

  } catch (error) {
    console.error('❌ Error debugging signup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

debugSignup(); 