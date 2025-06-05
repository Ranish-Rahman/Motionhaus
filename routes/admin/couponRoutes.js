import express from 'express';
import {
    getAllCoupons,
    createCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    getCoupon
} from '../../controllers/admin/couponController.js';
import { isAdmin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Apply isAdmin middleware to all routes
router.use(isAdmin);

// Coupon routes
router.get('/', getAllCoupons);
router.post('/', createCoupon);
router.get('/:id', getCoupon);
router.put('/:id', updateCoupon);
router.patch('/:id/toggle-status', toggleCouponStatus);
router.delete('/:id', deleteCoupon);

export default router; 