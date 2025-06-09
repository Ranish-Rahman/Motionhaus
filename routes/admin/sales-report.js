import express from 'express';
// Import the necessary controller functions
import { getSalesReportPage, getSalesReport, downloadPdfReport, downloadExcelReport } from '../../controllers/admin/salesReportController.js';
// Assuming you need isAdmin middleware for these routes as well
import { isAdmin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Route for the sales report page (handled by getSalesReportPage)
router.get('/', isAdmin, getSalesReportPage);

// Route for fetching sales report data (handled by getSalesReport)
router.get('/data', isAdmin, getSalesReport);

// Download PDF
router.get('/download/pdf', isAdmin, downloadPdfReport);

// Download Excel
router.get('/download/excel', isAdmin, downloadExcelReport);

export default router;