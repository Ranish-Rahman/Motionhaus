import Product from '../../models/ProductModel.js';
import Category from '../../models/categoryModel.js';

// List products for users
export const listProducts = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }

    // Get query parameters
    const { search, sort, minPrice, maxPrice, category, size } = req.query;
    
    // Build query
    let query = { 
      isDeleted: false,
      isBlocked: false
    };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Add price range filter if provided
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    // Fetch active categories from Category model
    const categories = await Category.find({ 
      isDeleted: false
    }).select('name');

    // Get list of active category names
    const activeCategoryNames = categories.map(cat => cat.name);

    // Add category filter if provided
    if (category && category !== 'All') {
      query.category = category;
    } else {
      query.category = { $in: activeCategoryNames };
    }

    // Add size filter if provided
    if (size) {
      const sizes = Array.isArray(size) ? size : [size];
      query.sizes = { $in: sizes.map(Number) };
    }

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

    // Fetch products
    const products = await Product.find(query)
      .sort(sortOptions);

    console.log('Category filter:', category);
    console.log('Active categories:', activeCategoryNames);
    console.log('Found products:', products.length);
    if (products.length > 0) {
      console.log('Sample product categories:', products.map(p => p.category));
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
    res.redirect('/login');
  }
};

// Get product details
export const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('Fetching product details for ID:', productId);

    const product = await Product.findById(productId);

    if (!product || product.isDeleted) {
      console.log('Product not found for ID:', productId);
      return res.status(404).render('user/error', { 
        message: 'Product not found',
        error: { status: 404 }
      });
    }

    // Get related products (same category)
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isDeleted: false,
      isBlocked: false
    }).limit(4);

    console.log('Product found:', {
      id: product._id,
      name: product.name,
      category: product.category,
      brand: product.brand
    });

    res.render('user/product-details', {
      product,
      relatedProducts,
      title: `${product.name} - Product Details`,
      user: req.session.user,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error in getProductDetails:', error);
    res.status(500).render('user/error', {
      message: 'Error fetching product details',
      error: { status: 500, stack: error.stack }
    });
  }
}; 