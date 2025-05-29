import Transaction from '../../models/transactionModel.js';
import User from '../../models/userModel.js';
import mongoose from 'mongoose';

// Get wallet page with transactions
export const getWallet = async (req, res) => {
    try {
        // Check if user exists in session
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).render('error', {
                title: 'Error',
                message: 'Please login to access wallet',
                statusCode: 401
            });
        }

        const userId = req.session.user._id;

        // Get user's transactions
        const transactions = await Transaction.find({ user: userId })
            .sort({ createdAt: -1 });

        // Get user data
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).render('error', {
                title: 'Error',
                message: 'User not found',
                statusCode: 404
            });
        }

        // Render wallet page
        res.render('user/wallet', {
            title: 'My Wallet',
            user: user,
            transactions,
            currentPage: 'wallet'
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load wallet',
            statusCode: 500
        });
    }
};

// Fix wallet balance based on transaction history
export const fixWalletBalance = async (req, res) => {
    try {
        const userId = req.session.user._id;

        // Get all transactions
        const transactions = await Transaction.find({ user: userId })
            .sort({ createdAt: 1 }); // Sort by oldest first

        // Calculate correct balance
        const calculatedBalance = transactions.reduce((balance, transaction) => {
            if (transaction.type === 'credit') {
                return balance + Number(transaction.amount);
            } else {
                return balance - Number(transaction.amount);
            }
        }, 0);

        // Update user's wallet with correct balance
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update wallet balance
        user.wallet = { balance: calculatedBalance };
        await user.save();

        // Create an adjustment transaction if needed
        const currentBalance = typeof user.wallet === 'number' ? user.wallet : 
                             (user.wallet && user.wallet.balance ? user.wallet.balance : 0);
        
        if (Math.abs(calculatedBalance - currentBalance) > 0.01) {
            const adjustmentTransaction = new Transaction({
                user: userId,
                type: calculatedBalance > currentBalance ? 'credit' : 'debit',
                amount: Math.abs(calculatedBalance - currentBalance),
                description: 'Balance adjustment based on transaction history',
                status: 'completed',
                balance: calculatedBalance
            });
            await adjustmentTransaction.save();
        }

        return res.json({
            success: true,
            message: 'Wallet balance corrected',
            oldBalance: currentBalance,
            newBalance: calculatedBalance,
            transactions: transactions.length
        });
    } catch (error) {
        console.error('Error fixing wallet balance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fix wallet balance'
        });
    }
};

// Add refund to wallet
export const addRefund = async (userId, amount, description, orderId) => {
    try {
        console.log('Starting refund process:', { userId, amount, description, orderId });
        
        // Get user
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Log current wallet state
        console.log('Current wallet state:', {
            wallet: user.wallet,
            type: typeof user.wallet,
            hasBalance: user.wallet && user.wallet.balance
        });

        // Handle case where wallet is a number (legacy data)
        let currentBalance = 0;
        if (typeof user.wallet === 'number') {
            currentBalance = user.wallet;
        } else if (user.wallet && typeof user.wallet.balance === 'number') {
            currentBalance = user.wallet.balance;
        }

        // Log balance calculation
        console.log('Balance calculation:', {
            currentBalance,
            amountToAdd: Number(amount),
            calculatedNewBalance: Number(currentBalance) + Number(amount)
        });

        // Calculate new balance
        const newBalance = Number(currentBalance) + Number(amount);

        // Update user's wallet - store as an object with balance property
        user.wallet = { balance: newBalance };
        await user.save();

        // Create transaction record
        const transaction = new Transaction({
            user: userId,
            type: 'credit',
            amount: Number(amount),
            description: description,
            orderId: orderId,
            status: 'completed',
            balance: newBalance
        });

        // Save transaction
        await transaction.save();

        console.log('Refund process completed:', {
            transactionId: transaction._id,
            finalBalance: newBalance
        });

        return {
            success: true,
            newBalance,
            transaction
        };
    } catch (error) {
        console.error('Add refund error:', error);
        throw error;
    }
}; 