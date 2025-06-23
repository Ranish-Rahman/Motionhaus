console.log("--- LOADING LATEST VERSION of productController.js ---");
import Product from '../../models/ProductModel.js';
import Category from '../../models/categoryModel.js';
import Offer from '../../models/OfferModel.js';

// Helper function to get the best offer for a product
export const getBestOffer = async (productId) => {
  console.log(`[getBestOffer] Received request for product ID: ${productId}`);
  let bestOffer = null;
  try {
    const product = await Product.findById(productId);
    if (!product) {
      console.log(`[getBestOffer] CRITICAL: Product.findById returned null for ID: ${productId}.`);
      return null;
    }

    const now = new Date();

    // Get active product-specific offer
    const productOffer = await Offer.findOne({
      type: 'Product',
      target: productId,
      status: 'Active',
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    // Find the category document to get its ID
    const category = await Category.findOne({ 
      name: product.category,
      isDeleted: false
    });
    
    let categoryOffer = null;
    if (category) {
      categoryOffer = await Offer.findOne({
        type: 'Category',
        target: category._id,
        status: 'Active',
        startDate: { $lte: now },
        endDate: { $gte: now }
      });
    }

    // Determine the best offer
    if (productOffer && categoryOffer) {
      bestOffer = productOffer.discount >= categoryOffer.discount ? productOffer : categoryOffer;
    } else {
      bestOffer = productOffer || categoryOffer;
    }

    if (bestOffer) {
      console.log(`[getBestOffer] Selected offer: ${bestOffer.name} (${bestOffer.discount}%) for product: ${product.name}`);
    } else {
      console.log(`[getBestOffer] No active and valid offers found for product: ${product.name}`);
    }
    
  } catch (error) {
    console.error(`[getBestOffer] CRITICAL: An error occurred for product ID ${productId}:`, error);
    bestOffer = null; // Ensure null is returned on error
  }
  return bestOffer;
};

// List products for users
export const listProducts = async (req, res) => {
  try {
    // Get query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
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
      query['sizes'] = {
        $elemMatch: {
          size: { $in: sizes.map(Number) },
          quantity: { $gt: 0 }
        }
      };
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

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Get total count of matching products
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch products with pagination
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Get best offers for all products
    const productsWithOffers = await Promise.all(products.map(async (product) => {
      const bestOffer = await getBestOffer(product._id);
      let discountedPrice = product.price;
      if (bestOffer) {
        const discountAmount = (product.price * bestOffer.discount) / 100;
        discountedPrice = product.price - discountAmount;
      }
      return {
        ...product.toObject(),
        bestOffer,
        discountedPrice
      };
    }));

    // Calculate pagination info
    const pagination = {
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      totalItems: totalProducts,
      limit,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1)
    };

    res.render('user/products', {
      products: productsWithOffers,
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
      pagination,
      currentPage: page,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error loading products:', error);
    req.flash('error', 'Error loading products');
    res.redirect('/');
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

    // Get the best applicable offer for this product
    const bestOffer = await getBestOffer(productId);
    
    // Calculate discounted price if offer exists
    let discountedPrice = product.price;
    if (bestOffer) {
      const discountAmount = (product.price * bestOffer.discount) / 100;
      discountedPrice = product.price - discountAmount;
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
      brand: product.brand,
      bestOffer: bestOffer ? {
        name: bestOffer.name,
        discount: bestOffer.discount
      } : null
    });

    res.render('user/product-details', {
      product,
      bestOffer,
      discountedPrice,
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