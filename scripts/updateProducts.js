import mongoose from 'mongoose';
import Product from '../models/ProductModel.js';

async function updateProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Update all products that don't have isBlocked field
    const result = await Product.updateMany(
      { isBlocked: { $exists: false } },
      { $set: { isBlocked: false } }
    );

    console.log(`Updated ${result.nModified} products`);

    // Close the connection
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateProducts(); 