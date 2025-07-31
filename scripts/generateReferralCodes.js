import mongoose from 'mongoose';
import User from '../models/userModel.js';
import { generateReferralCode } from '../utils/referralCodeGenerator.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus');
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Generate referral codes for existing users
const generateReferralCodesForExistingUsers = async () => {
  try {
    console.log('Starting referral code generation for existing users...');
    
    // Find users without referral codes
    const usersWithoutReferralCodes = await User.find({
      $or: [
        { referralCode: { $exists: false } },
        { referralCode: null },
        { referralCode: '' }
      ]
    });
    
    console.log(`Found ${usersWithoutReferralCodes.length} users without referral codes`);
    
    if (usersWithoutReferralCodes.length === 0) {
      console.log('All users already have referral codes!');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of usersWithoutReferralCodes) {
      try {
        // Generate unique referral code
        const referralCode = await generateReferralCode(user.username);
        
        // Update user with referral code
        await User.findByIdAndUpdate(user._id, {
          referralCode: referralCode
        });
        
        console.log(`Generated referral code "${referralCode}" for user "${user.username}"`);
        successCount++;
      } catch (error) {
        console.error(`Error generating referral code for user "${user.username}":`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\nReferral code generation completed:`);
    console.log(`✅ Successfully generated: ${successCount} codes`);
    console.log(`❌ Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error in referral code generation:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await generateReferralCodesForExistingUsers();
  
  console.log('\nScript completed. Disconnecting from database...');
  await mongoose.disconnect();
  console.log('Database disconnected');
  process.exit(0);
};

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Disconnecting from database...');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 