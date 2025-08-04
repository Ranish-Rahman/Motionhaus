import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const setSalesTarget = async () => {
  try {
    await connectDB();

    // Get command line arguments
    const args = process.argv.slice(2);
    const targetAmount = parseInt(args[0]);

    if (!targetAmount || isNaN(targetAmount)) {
      console.log('\n=== SALES TARGET CONFIGURATION ===');
      console.log('Usage: node scripts/setSalesTarget.js <amount>');
      console.log('Example: node scripts/setSalesTarget.js 75000');
      console.log('\nThis will set the monthly sales target to ₹75,000');
      return;
    }

    // Create target config file
    const configPath = path.join(process.cwd(), 'config', 'salesTarget.json');
    const configDir = path.dirname(configPath);

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const targetConfig = {
      monthlyTarget: targetAmount,
      lastUpdated: new Date().toISOString(),
      description: `Monthly sales target set to ₹${targetAmount.toLocaleString()}`
    };

    fs.writeFileSync(configPath, JSON.stringify(targetConfig, null, 2));

    console.log('\n=== SALES TARGET UPDATED ===');
    console.log(`✅ Monthly target set to: ₹${targetAmount.toLocaleString()}`);
    console.log(`📁 Configuration saved to: ${configPath}`);
    console.log(`🕒 Last updated: ${new Date().toLocaleString()}`);

    // Show what this means
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    
    console.log('\n=== TARGET BREAKDOWN ===');
    console.log(`Monthly Target: ₹${targetAmount.toLocaleString()}`);
    console.log(`Days in Current Month: ${daysInMonth}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
};

setSalesTarget(); 