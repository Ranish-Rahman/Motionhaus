import OfferModel from '../../models/OfferModel.js';
import ProductModel from '../../models/ProductModel.js';
import Category from '../../models/categoryModel.js';

// Get all offers
export const getAllOffers = async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }

        // Get offers and populate target based on targetModel
        const offers = await OfferModel.find()
            .populate({
                path: 'target',
                refPath: 'targetModel'
            })
            .sort({ createdAt: -1 });
        
        // Get only active products and categories, sorted by name
        const products = await ProductModel.find({ 
            isDeleted: false,
            isBlocked: false
        }).sort({ name: 1 });
            
        const categories = await Category.find({ 
            isDeleted: false
        }).sort({ name: 1 });
        
        res.render('admin/offers', { 
            title: 'Offer Management',
            offers,
            products,
            categories,
            path: '/admin/offers',
            admin: req.session.admin,
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Error fetching offers:', error);
        req.flash('error', 'Error loading offers: ' + error.message);
        res.redirect('/admin/dashboard');
    }
};

// Create new offer
export const createOffer = async (req, res) => {
    try {
        const { name, type, discount, startDate, endDate, target, targetModel } = req.body;

        // Validate dates
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        // Check for existing offers on the same target
        const existingOffer = await OfferModel.findOne({
            target,
            status: 'Active',
            endDate: { $gte: new Date() }
        });

        if (existingOffer) {
            return res.status(400).json({ 
                error: 'An active offer already exists for this target' 
            });
        }

        const offer = new OfferModel({
            name,
            type,
            discount: parseFloat(discount),
            startDate,
            endDate,
            target,
            targetModel
        });

        await offer.save();
        res.status(201).json({ message: 'Offer created successfully' });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update offer status
export const updateOfferStatus = async (req, res) => {
    try {
        const { offerId } = req.params;
        const { status } = req.body;

        const offer = await OfferModel.findByIdAndUpdate(
            offerId,
            { status },
            { new: true }
        );

        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        res.json({ message: 'Offer status updated successfully' });
    } catch (error) {
        console.error('Error updating offer status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update offer
export const updateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, discount, startDate, endDate, target, targetModel } = req.body;

        // Validate dates
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        // Check for existing offers on the same target (excluding current offer)
        const existingOffer = await OfferModel.findOne({
            _id: { $ne: id },
            target,
            status: 'Active',
            endDate: { $gte: new Date() }
        });

        if (existingOffer) {
            return res.status(400).json({ 
                error: 'An active offer already exists for this target' 
            });
        }

        const updatedOffer = await OfferModel.findByIdAndUpdate(
            id,
            {
                name,
                type,
                discount: parseFloat(discount),
                startDate,
                endDate,
                target,
                targetModel
            },
            { new: true, runValidators: true }
        );

        if (!updatedOffer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        res.json({ message: 'Offer updated successfully', offer: updatedOffer });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get best applicable offer for a product
export const getBestOffer = async (productId) => {
    try {
        const product = await ProductModel.findById(productId).populate('category');
        const now = new Date();

        // Get active product offers
        const productOffer = await OfferModel.findOne({
            type: 'Product',
            target: productId,
            status: 'Active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        });

        // Get active category offers
        const categoryOffer = await OfferModel.findOne({
            type: 'Category',
            target: product.category._id,
            status: 'Active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        });

        // Compare and return the best offer
        if (!productOffer && !categoryOffer) return null;
        if (!productOffer) return categoryOffer;
        if (!categoryOffer) return productOffer;

        return productOffer.discount > categoryOffer.discount ? productOffer : categoryOffer;
    } catch (error) {
        console.error('Error getting best offer:', error);
        return null;
    }
}; 