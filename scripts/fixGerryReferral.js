import mongoose from 'mongoose';
import User from '../models/userModel.js';
import connectDB from '../models/mongodb.js';

const fixGerryReferral = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Find gerry and darry
    const gerry = await User.findOne({ username: 'gerry' });
    const darry = await User.findOne({ username: 'darry' });

    if (!gerry) {
      console.log('❌ User "gerry" not found');
      return;
    }

    if (!darry) {
      console.log('❌ User "darry" not found');
      return;
    }

    console.log('\n1. Current Status:');
    console.log(`   gerry.referredBy: ${gerry.referredBy || 'None'}`);
    console.log(`   darry._id: ${darry._id}`);

    // Update gerry to be referred by darry
    gerry.referredBy = darry._id;
    await gerry.save();

    console.log('\n2. Updated gerry:');
    console.log(`   gerry.referredBy: ${gerry.referredBy}`);
    console.log(`   darry._id: ${darry._id}`);

    // Verify the relationship
    const updatedGerry = await User.findOne({ username: 'gerry' });
    console.log('\n3. Verification:');
    console.log(`   Updated gerry.referredBy: ${updatedGerry.referredBy}`);

    if (updatedGerry.referredBy && updatedGerry.referredBy.toString() === darry._id.toString()) {
      console.log('   ✅ Referral relationship established successfully!');
    } else {
      console.log('   ❌ Referral relationship not established');
    }

    // Check darry's current wallet
    console.log('\n4. darry\'s current status:');
    console.log(`   Wallet Balance: ₹${darry.wallet?.balance || 0}`);
    console.log(`   Referral Rewards: ₹${darry.referralRewards || 0}`);

  } catch (error) {
    console.error('❌ Error fixing gerry referral:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

fixGerryReferral(); 