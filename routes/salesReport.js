import express from 'express';
import { getSalesReportPage, getSalesReport } from '../controllers/salesReportController.js';

const router = express.Router();

// Render the sales report page
router.get('/', getSalesReportPage);

// Fetch sales report data (AJAX)
router.get('/data', getSalesReport);

export default router; 