import express from 'express';
import { getWallet } from '../../controllers/user/walletController.js';
import { isAuthenticated } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Wallet routes
router.get('/', isAuthenticated, getWallet);

export default router; 