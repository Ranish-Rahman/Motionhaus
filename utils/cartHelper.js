import mongoose from 'mongoose';
import Offer from '../models/OfferModel.js';
import Product from '../models/ProductModel.js';
import Category from '../models/categoryModel.js';

/**
 * Finds the best active offer for a given product.
 * It checks for product-specific offers first, then for category-specific offers.
 * @param {string} productId - The ID of the product.
 * @returns {Promise<Object|null>} The best offer object or null if no active offer is found.
 */
async function getBestOffer(productId) {
  const now = new Date();
  
  // Find product-specific offers
  const productOffers = await Offer.find({
    'products.productId': productId,
    startDate: { $lte: now },
    endDate: { $gte: now },
    isBlocked: false,
  }).lean();

  if (productOffers.length > 0) {
    // Return the product-specific offer with the highest discount
    return productOffers.reduce((best, current) => (current.discount > best.discount ? current : best), productOffers[0]);
  }

  // If no product offer, find category offers
  const product = await Product.findById(productId).populate('category').lean();
  if (!product || !product.category) {
    return null;
  }
  
  const categoryOffers = await Offer.find({
    'categories.categoryId': product.category._id,
    startDate: { $lte: now },
    endDate: { $gte: now },
    isBlocked: false,
  }).lean();

  if (categoryOffers.length > 0) {
    // Return the category offer with the highest discount
    return categoryOffers.reduce((best, current) => (current.discount > best.discount ? current : best), categoryOffers[0]);
  }

  return null;
}


/**
 * Calculates all totals for a given cart, including offer and coupon discounts.
 * @param {Object} cart - The user's cart object, populated with product and coupon details.
 * @param {Function} getBestOfferFunc - The function to fetch the best offer for a product.
 * @returns {Promise<Object>} An object containing all calculated totals and processed items.
 */
export async function calculateCartTotals(cart, getBestOfferFunc) {
  if (!cart || !cart.items) {
    return { subtotal: 0, offerDiscount: 0, couponDiscount: 0, totalDiscount: 0, finalAmount: 0, items: [], couponCode: null };
  }

  // The cart should be pre-populated by the controller before calling this function.

  let subtotal = 0;
  let totalOfferDiscount = 0;
  const processedItems = [];

  // 1. Calculate Subtotal and Item-level prices after OFFERS
  for (const item of cart.items) {
    if (!item.product || item.product.isBlocked) continue;

    const originalPrice = parseFloat(item.product.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    subtotal += originalPrice * quantity;

    let priceAfterOffer = originalPrice;
    
    // Final check to find the root cause
    console.log(`[Cart Helper] About to call getBestOffer for product ID: ${item.product._id}`);
    const bestOffer = await getBestOfferFunc(item.product._id);
    
    // --- Detailed Debugging ---
    console.log(`[Cart Helper DEBUG] Item: ${item.product.name}, Original Price: ${originalPrice}`);
    if (bestOffer) {
      console.log(`[Cart Helper DEBUG] Found Offer: ${bestOffer.name}, Discount: ${bestOffer.discount}%`);
      const offerDiscountOnItem = Math.round(originalPrice * (bestOffer.discount / 100));
      console.log(`[Cart Helper DEBUG] Calculated Discount Per Item: ${offerDiscountOnItem}`);
      priceAfterOffer -= offerDiscountOnItem;
      totalOfferDiscount += offerDiscountOnItem * quantity;
    } else {
      console.log(`[Cart Helper DEBUG] No offer found for ${item.product.name}`);
    }
    // --- End Debugging ---

    processedItems.push({
      ...item.toObject(),
      finalPrice: priceAfterOffer, // This is price per unit after offer
    });
  }

  // 2. Calculate Coupon Discount on the total AFTER offers have been applied
  const subtotalAfterOffers = subtotal - totalOfferDiscount;
  let couponDiscount = 0;
  if (cart.coupon && typeof cart.coupon.value === 'number' && cart.coupon.value >= 0) {
    let calculatedDiscount = 0;
    if (cart.coupon.type.toLowerCase() === 'percentage') {
      calculatedDiscount = (subtotalAfterOffers * cart.coupon.value) / 100;
    } else { // Fixed amount
      calculatedDiscount = cart.coupon.value;
    }
    couponDiscount = Math.round(Math.min(calculatedDiscount, subtotalAfterOffers));
  }
  
  // 3. Final Totals
  const totalDiscount = totalOfferDiscount + couponDiscount;
  const finalAmount = subtotal - totalDiscount;

  console.log(`[Cart Helper] Subtotal: ${subtotal}, Offer Discount: ${totalOfferDiscount}, Coupon Discount: ${couponDiscount}, Final Amount: ${finalAmount}`);

  return {
    subtotal,
    offerDiscount: totalOfferDiscount,
    couponDiscount,
    totalDiscount,
    finalAmount,
    items: processedItems,
    couponCode: cart.coupon ? cart.coupon.code : null,
    coupon: cart.coupon ? cart.coupon.toObject() : null
  };
} 