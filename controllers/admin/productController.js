// controllers/admin/productController.js
import Product from '../../models/ProductModel.js';
import Category from '../../models/categoryModel.js';
import mongoose from 'mongoose';

// Get all products
export const getProducts = async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }

    const showDeleted = req.query.showDeleted === 'true';
    const query = showDeleted ? {} : { isDeleted: false };

    const products = await Product.find(query)
      .sort({ createdAt: -1 });

    // Ensure all image paths are valid
    products.forEach(product => {
      product.images = product.images.map(image => {
        if (!image.startsWith('/uploads/')) {
          return `/uploads/${image}`;
        }
        return image;
      });
    });

    res.render('admin/products', {
      products,
      title: 'Products',
      path: '/admin/products',
      success: req.flash('success'),
      error: req.flash('error'),
      showDeleted
    });
  } catch (error) {
    console.error('Error fetching products:', error.message);
    req.flash('error', 'Error fetching products');
    res.redirect('/admin/dashboard');
  }
};

// Get add product page
export const getAddProduct = async (req, res) => {
  try {
    // Fetch active categories from the database
    const categories = await Category.find({ isDeleted: false }).select('name');
    
    res.render('admin/add-product', {
      title: 'Add Product',
      path: '/admin/products/add',
      categories: categories.map(cat => cat.name),
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error in getAddProduct:', error);
    res.status(500).render('admin/add-product', {
      title: 'Add Product',
      error: 'Failed to load add product page. Please try again later.',
      path: '/admin/products/add',
      categories: []
    });
  }
};

// Add new product
export const addProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    const sizes = req.body.sizes || [];

    // Validate required fields
    const errors = [];

    // Name validation
    if (!name || !name.trim()) {
      errors.push('Product name is required');
    } else if (name.length < 3) {
      errors.push('Product name must be at least 3 characters long');
    }

    // Description validation
    if (!description || !description.trim()) {
      errors.push('Product description is required');
    } else if (description.length < 10) {
      errors.push('Product description must be at least 10 characters long');
    }

    // Price validation
    if (!price) {
      errors.push('Product price is required');
    } else {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum)) {
        errors.push('Price must be a valid number');
      } else if (priceNum <= 0) {
        errors.push('Price must be greater than 0');
      }
    }

    // Stock validation
    if (stock === undefined || stock === '') {
      errors.push('Stock quantity is required');
    } else {
      const stockNum = parseInt(stock);
      if (isNaN(stockNum)) {
        errors.push('Stock must be a valid number');
      } else if (stockNum < 0) {
        errors.push('Stock cannot be negative');
      }
    }

    // Category validation
    if (!category) {
      errors.push('Product category is required');
    }

    // Sizes validation
    if (!sizes || sizes.length === 0) {
      errors.push('At least one size must be selected');
    }

    // Images validation
    if (!req.uploadedImages || req.uploadedImages.length < 3) {
      errors.push('At least 3 images are required');
    } else if (req.uploadedImages.length > 10) {
      errors.push('Maximum 10 images allowed');
    }

    // If there are any errors, redirect back with error messages
    if (errors.length > 0) {
      req.flash('error', errors.join(', '));
      return res.redirect('/admin/products/add');
    }

    // Convert sizes to array of numbers
    const sizesArray = Array.isArray(sizes) ? sizes.map(Number) : [Number(sizes)];

    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category,
      sizes: sizesArray,
      stock: parseInt(stock),
      images: req.uploadedImages
    });

    await product.save();
    req.flash('success', 'Product added successfully');
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error adding product:', error.message);
    req.flash('error', error.message || 'Error adding product');
    res.redirect('/admin/products/add');
  }
};

// Get edit product page
export const getEditProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/admin/products');
    }

    // Fetch active categories from the database
    const categories = await Category.find({ isDeleted: false }).select('name');

    res.render('admin/edit-product', {
      title: 'Edit Product',
      path: '/admin/products/edit',
      product,
      categories: categories.map(cat => cat.name),
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error in getEditProduct:', error);
    req.flash('error', 'Error loading product');
    res.redirect('/admin/products');
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    const sizes = req.body.sizes || [];
    const productId = req.params.id;
    const removedImages = req.body.removedImages || [];

    // Validate required fields
    const errors = [];

    // Name validation
    if (!name || !name.trim()) {
      errors.push('Product name is required');
    } else if (name.length < 3) {
      errors.push('Product name must be at least 3 characters long');
    }

    // Description validation
    if (!description || !description.trim()) {
      errors.push('Product description is required');
    } else if (description.length < 10) {
      errors.push('Product description must be at least 10 characters long');
    }

    // Price validation
    if (!price) {
      errors.push('Product price is required');
    } else {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum)) {
        errors.push('Price must be a valid number');
      } else if (priceNum <= 0) {
        errors.push('Price must be greater than 0');
      }
    }

    // Stock validation
    if (stock === undefined || stock === '') {
      errors.push('Stock quantity is required');
    } else {
      const stockNum = parseInt(stock);
      if (isNaN(stockNum)) {
        errors.push('Stock must be a valid number');
      } else if (stockNum < 0) {
        errors.push('Stock cannot be negative');
      }
    }

    // Category validation
    if (!category) {
      errors.push('Product category is required');
    }

    // Sizes validation
    if (!sizes || sizes.length === 0) {
      errors.push('At least one size must be selected');
    }

    // Get existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      req.flash('error', 'Product not found');
      return res.redirect('/admin/products');
    }

    // Handle image updates
    let updatedImages = [...existingProduct.images];
    
    // Remove images that were marked for deletion
    if (removedImages.length > 0) {
      updatedImages = updatedImages.filter((_, index) => !removedImages.includes(index.toString()));
    }

    // Add new images if any were uploaded
    if (req.uploadedImages && req.uploadedImages.length > 0) {
      updatedImages = [...updatedImages, ...req.uploadedImages];
    }

    // Images validation
    if (updatedImages.length < 3) {
      errors.push('Product must have at least 3 images');
    } else if (updatedImages.length > 10) {
      errors.push('Maximum 10 images allowed');
    }

    // If there are any errors, redirect back with error messages
    if (errors.length > 0) {
      req.flash('error', errors.join(', '));
      return res.redirect(`/admin/products/edit/${productId}`);
    }

    // Convert sizes to array of numbers
    const sizesArray = Array.isArray(sizes) ? sizes.map(Number) : [Number(sizes)];

    const updateData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category,
      sizes: sizesArray,
      stock: parseInt(stock),
      images: updatedImages
    };

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    );

    if (!updatedProduct) {
      req.flash('error', 'Failed to update product');
      return res.redirect('/admin/products');
    }

    req.flash('success', 'Product updated successfully');
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error updating product:', error.message);
    req.flash('error', error.message || 'Error updating product');
    res.redirect(`/admin/products/edit/${req.params.id}`);
  }
};

// List products for users
export const listProducts = async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }

    // Get query parameters
    const { search, sort, minPrice, maxPrice, category, size } = req.query;
    
    console.log('Query parameters:', { search, sort, minPrice, maxPrice, category, size });
    
    // Build query - IMPORTANT: Filter out both deleted and blocked products
    let query = { 
      isDeleted: false,
      isBlocked: false // Ensure blocked products are filtered out
    };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Add category filter if provided
    if (category && category !== 'All') {
      console.log('Applying category filter:', category);
      console.log('Category type:', typeof category);
      console.log('Category value:', category);
      
      // First, let's check what categories exist in the database
      const allProducts = await Product.find({ 
        isDeleted: false,
        isBlocked: false // Filter out blocked products here too
      });
      console.log('All available categories in database:', [...new Set(allProducts.map(p => p.category))]);
      
      // Use case-insensitive matching and normalize spaces
      const normalizedCategory = category.toLowerCase().trim();
      query.category = { 
        $regex: new RegExp(`^${normalizedCategory}$`, 'i') 
      };
      
      console.log('Final category query:', query.category);
    }

    // Add size filter if provided
    if (size) {
      console.log('Applying size filter:', size);
      const sizes = Array.isArray(size) ? size : [size];
      query.sizes = { $in: sizes.map(Number) };
    }

    // Add price range filter if provided
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    console.log('Final query:', JSON.stringify(query, null, 2));

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort by newest
    if (sort) {
      switch (sort) {
        case 'price-asc':
          sortOptions = { price: 1 };
          break;
        case 'price-desc':
          sortOptions = { price: -1 };
          break;
        case 'az':
          sortOptions = { name: 1 };
          break;
        case 'za':
          sortOptions = { name: -1 };
          break;
      }
    }

    // Fetch all active categories from the Category model
    const categories = await Category.find({ 
      isDeleted: false 
    }).select('name');

    // Fetch filtered products
    const products = await Product.find(query)
      .sort(sortOptions);

    console.log('Found products:', products.length);
    if (products.length > 0) {
      console.log('Sample product categories:', products.map(p => p.category));
      console.log('Sample product names:', products.map(p => p.name));
    } else {
      console.log('No products found with the given query');
    }

    res.render('user/products', {
      products,
      categories: categories.map(cat => cat.name),
      selectedCategories: category ? [category] : [],
      search: search || '',
      sort: sort || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || '',
      query: {
        minPrice: minPrice || '',
        maxPrice: maxPrice || '',
        sort: sort || '',
        category: category || '',
        size: size || ''
      },
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error loading products:', error);
    req.flash('error', 'Error loading products');
    res.render('user/products', {
      products: [],
      categories: [],
      selectedCategories: [],
      search: '',
      sort: '',
      minPrice: '',
      maxPrice: '',
      query: {
        minPrice: '',
        maxPrice: '',
        sort: '',
        category: '',
        size: ''
      },
      error: 'Error loading products'
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to soft delete product with ID:', id);
    
    // First check if product exists
    const product = await Product.findById(id);
    if (!product) {
      console.log('Product not found');
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Perform soft delete by setting isDeleted to true
    const result = await Product.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    console.log('Soft delete result:', result);

    if (!result) {
      console.log('Failed to soft delete product');
      return res.status(500).json({ success: false, message: 'Failed to soft delete product' });
    }

    console.log('Product soft deleted successfully');
    res.json({ success: true, message: 'Product soft deleted successfully' });
  } catch (error) {
    console.error('Error soft deleting product:', error);
    res.status(500).json({ success: false, message: 'Error soft deleting product' });
  }
};

export const blockProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isBlocked = true;
    await product.save();

    res.json({ success: true, message: 'Product blocked successfully' });
  } catch (error) {
    console.error('Error blocking product:', error);
    res.status(500).json({ success: false, message: 'Error blocking product' });
  }
};

export const unblockProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isBlocked = false;
    await product.save();

    res.json({ success: true, message: 'Product unblocked successfully' });
  } catch (error) {
    console.error('Error unblocking product:', error);
    res.status(500).json({ success: false, message: 'Error unblocking product' });
  }
};

export const restoreProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to restore product with ID:', id);
    
    // First check if product exists
    const product = await Product.findById(id);
    if (!product) {
      console.log('Product not found');
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Restore product by setting isDeleted to false
    const result = await Product.findByIdAndUpdate(
      id,
      { isDeleted: false },
      { new: true }
    );

    console.log('Restore result:', result);

    if (!result) {
      console.log('Failed to restore product');
      return res.status(500).json({ success: false, message: 'Failed to restore product' });
    }

    console.log('Product restored successfully');
    res.json({ success: true, message: 'Product restored successfully' });
  } catch (error) {
    console.error('Error restoring product:', error);
    res.status(500).json({ success: false, message: 'Error restoring product' });
  }
};
