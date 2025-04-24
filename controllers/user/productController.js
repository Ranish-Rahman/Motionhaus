import Product from '../../models/ProductModel.js';
import Category from '../../models/categoryModel.js';

// List products for users
export const listProducts = async (req, res) => {
  try {
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
      // Use exact matching for category
      query.category = category;
    } else {
      // When no category is selected, only show products from active categories
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

// Get product details
export const getProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product || product.isDeleted) {
      req.flash('error', 'Product not found');
      return res.redirect('/products');
    }

    console.log('Current product category:', product.category);

    // Get recommended products from the same category
    const recommendedProducts = await Product.find({
      _id: { $ne: product._id }, // Exclude current product
      category: product.category,
      isDeleted: false
    }).limit(4).select('name price images');

    console.log('Number of recommended products found:', recommendedProducts.length);
    console.log('Recommended products:', recommendedProducts);

    res.render('user/product-details', {
      product,
      recommendedProducts,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error loading product details:', error);
    req.flash('error', 'Error loading product details');
    res.redirect('/products');
  }
}; 