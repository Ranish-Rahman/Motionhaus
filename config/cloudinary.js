import cloudinary from 'cloudinary';

// Hardcoded values for testing
const cloudName = 'dgsbaufcs';
const apiKey = '636771691486395';
const apiSecret = 'FIiz9NnksQqPzpopxgNRXs_uJTA';

// Log the values for debugging
console.log('Cloudinary Config:', {
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

console.log('Cloudinary configured successfully');

export default cloudinary.v2; 