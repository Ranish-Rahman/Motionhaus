// middleware/imageUpload.js
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define upload path relative to the project root
const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'products');

// Ensure upload directory exists
if (!fs.existsSync(uploadPath)) {
  try {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log('Created upload directory:', uploadPath);
  } catch (error) {
    console.error('Error creating upload directory:', error);
    throw new Error('Failed to create upload directory');
  }
}

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer upload
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Process images and upload to Cloudinary
export const processImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      console.log('No files to process');
      return next();
    }

    // Validate minimum number of images
    if (req.files.length < 3) {
      console.log('Insufficient number of images:', req.files.length);
      return res.status(400).json({
        success: false,
        message: 'At least 3 images are required'
      });
    }

    console.log(`Processing ${req.files.length} images for Cloudinary upload`);

    // Upload each image to Cloudinary
    const uploadPromises = req.files.map((file, index) => {
      return new Promise((resolve, reject) => {
        const uploadOptions = {
          folder: 'products',
          resource_type: 'auto',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        };

        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error(`Error uploading image ${index + 1}:`, error);
              reject(error);
            } else {
              console.log(`Successfully uploaded image ${index + 1}:`, result.secure_url);
              resolve(result.secure_url);
            }
          }
        ).end(file.buffer);
      });
    });

    // Wait for all uploads to complete
    const uploadedImages = await Promise.all(uploadPromises);
    console.log('All images uploaded successfully:', uploadedImages);

    // Attach the uploaded image URLs to the request
    req.uploadedImages = uploadedImages;
    next();
  } catch (error) {
    console.error('Error processing images:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing images: ' + error.message
    });
  }
};
