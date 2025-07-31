import Coupon from '../../models/couponModel.js';

// Get all coupons with pagination
export const getAllCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.status) {
            if (req.query.status === 'active') {
                query.isActive = true;
            } else if (req.query.status === 'inactive') {
                query.isActive = false;
            }
        }

        const coupons = await Coupon.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Coupon.countDocuments(query);

        res.json({
            success: true,
            coupons,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getAllCoupons:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch coupons'
        });
    }
};

// Create new coupon
export const createCoupon = async (req, res) => {
    try {
        const {
            code,
            type,
            value,
            minAmount,
            maxAmount,
            description,
            validFrom,
            validUntil,
            usageLimit
        } = req.body;

        // Validate dates
        const fromDate = new Date(validFrom);
        const untilDate = new Date(validUntil);
        const now = new Date();
        
        // Normalize dates to start of day for accurate comparison
        const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        console.log('--- Create Coupon Date Validation Debug ---');
        console.log('Raw validFrom:', validFrom);
        console.log('Raw validUntil:', validUntil);
        console.log('Parsed fromDate:', fromDate);
        console.log('Parsed untilDate:', untilDate);
        console.log('Current Date (now):', now);
        console.log('Normalized fromDateOnly:', fromDateOnly);
        console.log('Normalized nowOnly:', nowOnly);
        console.log('Comparison (fromDateOnly < nowOnly):', fromDateOnly < nowOnly);
        console.log('-------------------------------------------');

        if (fromDate >= untilDate) {
            return res.status(400).json({
                success: false,
                message: 'Valid until date must be after valid from date'
            });
        }

        if (fromDateOnly < nowOnly) {
            return res.status(400).json({
                success: false,
                message: 'Valid from date cannot be in the past'
            });
        }

        // Validate fixed amount coupon value against minimum amount
        if (type === 'Fixed' && Number(value) >= Number(minAmount)) {
            return res.status(400).json({
                success: false,
                message: 'For a fixed discount, the value must be less than the minimum purchase amount.'
            });
        }

        if(type ==='Percentage' && (value <=0 || value >=100)){
            return res.status(400).json({
                success: false,
                message: 'For percentage discounts, value must be between 1 and 99'
            })
        }

        if(type === 'Percentage' && !maxAmount){
            return res.status(400).json({
                success: false,
                message: 'Max discount amount is required for percentage coupons'
            })
        }

        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists'
            });
        }

        const coupon = new Coupon({
            code: code.toUpperCase(),
            type,
            value,
            minAmount,
            maxAmount,
            description,
            validFrom: fromDate,
            validUntil: untilDate,
            usageLimit
        });

        await coupon.save();

        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            coupon
        });
    } catch (error) {
        console.error('Error in createCoupon:', error);
        if (error.name === 'ValidationError') {
            const errors = {};
            for (const field in error.errors) {
                const errObj = error.errors[field];
                if (errObj.name === 'CastError' && errObj.kind === 'date') {
                    errors[field] = 'Please enter a valid date';
                } else if (errObj.message) {
                    errors[field] = errObj.message;
                } else {
                    errors[field] = 'Invalid value';
                }
            }
            return res.status(400).json({ success: false, errors });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to create coupon'
        });
    }
};

// Update coupon
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (updateData.validFrom && updateData.validUntil) {
            const fromDate = new Date(updateData.validFrom);
            const untilDate = new Date(updateData.validUntil);
            const now = new Date();

            // Normalize dates to start of day for accurate comparison
            const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
            const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            console.log('--- Update Coupon Date Validation Debug ---');
            console.log('Raw validFrom:', updateData.validFrom);
            console.log('Raw validUntil:', updateData.validUntil);
            console.log('Parsed fromDate:', fromDate);
            console.log('Parsed untilDate:', untilDate);
            console.log('Current Date (now):', now);
            console.log('Normalized fromDateOnly:', fromDateOnly);
            console.log('Normalized nowOnly:', nowOnly);
            console.log('Comparison (fromDateOnly < nowOnly):', fromDateOnly < nowOnly);
            console.log('-------------------------------------------');

            if (fromDate >= untilDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid until date must be after valid from date'
                });
            }

            if (fromDateOnly < nowOnly) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid from date cannot be in the past'
                });
            }
        }

        // Validate fixed amount coupon value on update
        const currentCoupon = await Coupon.findById(id);
        // Always define these, even if currentCoupon is null
        const newType = updateData.type || (currentCoupon && currentCoupon.type);
        const newValue = updateData.value || (currentCoupon && currentCoupon.value);
        const newMinAmount = updateData.minAmount || (currentCoupon && currentCoupon.minAmount);

        if (currentCoupon) {
            if (newType === 'Fixed' && Number(newValue) >= Number(newMinAmount)) {
                return res.status(400).json({
                    success: false,
                    message: 'For a fixed discount, the value must be less than the minimum purchase amount.'
                });
            }
        }

        if(newType === 'Percentage' && (newValue <= 0 || newValue >= 100)){
            return res.status(400).json({
                success: false,
                message: 'For percentage discounts, value must be between 1 and 99'
            })
        }

        const coupon = await Coupon.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.json({
            success: true,
            message: 'Coupon updated successfully',
            coupon
        });
    } catch (error) {
        console.error('Error in updateCoupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update coupon'
        });
    }
};

// Toggle coupon status (activate/deactivate)
export const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.json({
            success: true,
            message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
            coupon
        });
    } catch (error) {
        console.error('Error in toggleCouponStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle coupon status'
        });
    }
};

// Delete coupon
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.json({
            success: true,
            message: 'Coupon deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteCoupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete coupon'
        });
    }
};

// Get single coupon
export const getCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.json({
            success: true,
            coupon
        });
    } catch (error) {
        console.error('Error in getCoupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch coupon'
        });
    }
}; 