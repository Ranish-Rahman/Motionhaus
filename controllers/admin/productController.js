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

    const products = await Product.find({ isDeleted: false })
      .sort({ createdAt: -1 });

    console.log(`Fetched ${products.length} products`);

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
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching products:', error);
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
    if (!name || !description || !price || !category || !sizes || sizes.length === 0 || stock === undefined) {
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/products/add');
    }

    // Validate images
    if (!req.uploadedImages || req.uploadedImages.length < 3) {
      req.flash('error', 'At least 3 images are required');
      return res.redirect('/admin/products/add');
    }

    // Convert sizes to array of numbers
    const sizesArray = Array.isArray(sizes) ? sizes.map(Number) : [Number(sizes)];

    const product = new Product({
      name,
      description,
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
    console.error('Error adding product:', error);
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

    // Validate required fields
    if (!name || !description || !price || !category || !sizes || sizes.length === 0 || stock === undefined) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/admin/products/edit/${productId}`);
    }

    // Get existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      req.flash('error', 'Product not found');
      return res.redirect('/admin/products');
    }

    // Convert sizes to array of numbers
    const sizesArray = Array.isArray(sizes) ? sizes.map(Number) : [Number(sizes)];

    const updateData = {
      name,
      description,
      price: parseFloat(price),
      category,
      sizes: sizesArray,
      stock: parseInt(stock)
    };

    // Handle image updates
    if (req.uploadedImages && req.uploadedImages.length > 0) {
      updateData.images = req.uploadedImages;
    } else {
      // Keep existing images if no new ones are uploaded
      updateData.images = existingProduct.images;
    }

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
    console.error('Error updating product:', error);
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

    // Fetch all unique categories from the database first
    const allProducts = await Product.find({ 
      isDeleted: false,
      isBlocked: false // Filter out blocked products here too
    });
    const categories = [...new Set(allProducts.map(product => product.category))];
    console.log('All available categories in database:', categories);

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
      categories, // Use the categories from all products
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
    console.log('Attempting to delete product with ID:', id);
    
    // First check if product exists
    const product = await Product.findById(id);
    if (!product) {
      console.log('Product not found');
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Perform hard delete instead of soft delete
    const result = await Product.findByIdAndDelete(id);

    console.log('Delete result:', result);

    if (!result) {
      console.log('Failed to delete product');
      return res.status(500).json({ success: false, message: 'Failed to delete product' });
    }

    console.log('Product deleted successfully');
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Error deleting product' });
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
