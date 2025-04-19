import Product from '../../models/ProductModel.js';

// List products for users
export const listProducts = async (req, res) => {
  try {
    // Get query parameters
    const { search, sort, minPrice, maxPrice, category, size } = req.query;
    
    // Build query
    let query = { isDeleted: false };
    
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

    // Add category filter if provided
    if (category && category !== 'All') {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
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

    // Fetch all unique categories from products
    const categories = [...new Set(products.map(product => product.category))];

    res.render('user/products', {
      products,
      categories,
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