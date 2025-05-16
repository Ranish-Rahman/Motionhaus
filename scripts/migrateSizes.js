import mongoose from 'mongoose';
import Product from '../models/ProductModel.js';

const migrateSizes = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/motionhaus', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Find products with old format (array of numbers)
        const products = await Product.find({
            'sizes.0': { $exists: true },
            'sizes.0.size': { $exists: false }
        });
        
        console.log(`Found ${products.length} products with old format`);

        let updated = 0;
        let errors = [];

        for (const product of products) {
            try {
                console.log(`Migrating sizes for product: ${product.name} (ID: ${product._id})`);
                
                // Convert old format to new format
                const newSizes = product.sizes.map(size => ({
                    size: parseInt(size),
                    quantity: 3 // Default quantity
                }));

                // Update the product
                await Product.findByIdAndUpdate(product._id, {
                    $set: { sizes: newSizes }
                });

                console.log(`Successfully updated product: ${product.name}`);
                updated++;
            } catch (error) {
                console.error(`Error updating product ${product.name}:`, error);
                errors.push({
                    productId: product._id,
                    name: product.name,
                    error: error.message
                });
            }
        }

        console.log('\nMigration Summary:');
        console.log(`- Products found with old format: ${products.length}`);
        console.log(`- Successfully updated: ${updated}`);
        console.log(`- Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.log('\nErrors encountered:');
            errors.forEach(error => {
                console.log(`- Product: ${error.name} (${error.productId})`);
                console.log(`  Error: ${error.error}`);
            });
        }

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

// Run the migration
migrateSizes(); 