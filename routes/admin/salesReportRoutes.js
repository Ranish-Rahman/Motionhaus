import express from 'express';
import { getSalesReport, downloadSalesReport } from '../../controllers/admin/salesReportController.js';
import { isAdmin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Get sales report page
router.get('/sales-report', isAdmin, (req, res) => {
    res.render('admin/salesReport', {
        title: 'Sales Report',
        path: '/admin/sales-report'
    });
});

// Get sales report data
router.get('/api/sales/report', isAdmin, getSalesReport);

// Download sales report
router.get('/api/sales/download/:format', isAdmin, downloadSalesReport);

export default router; 