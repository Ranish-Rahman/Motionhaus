import cloudinary from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Get credentials from environment variables
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// Validate required environment variables
if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing required Cloudinary environment variables');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

console.log('Cloudinary configured successfully');

export default cloudinary.v2; 