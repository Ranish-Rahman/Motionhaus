import User from '../models/userModel.js';

// Generate a unique referral code for a user
export const generateReferralCode = async (username) => {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniquePart = Math.floor(1000 + Math.random() * 9000);
    let referralCode = `${cleanUsername}${uniquePart}`;
    
    // Check if code already exists and generate a new one if needed
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        const existingUser = await User.findOne({ referralCode });
        if (!existingUser) {
            return referralCode;
        }
        
        // Generate a new code with different random part 
        const newUniquePart = Math.floor(1000 + Math.random() * 9000);
        referralCode = `${cleanUsername}${newUniquePart}`;
        attempts++;
    }
    
    // If we can't find a unique code after max attempts, add timestamp
    const timestamp = Date.now().toString().slice(-4);
    return `${cleanUsername}${timestamp}`;
};

// Validate referral code format
export const validateReferralCode = (code) => {
    if (!code || typeof code !== 'string') {
        return { isValid: false, message: 'Referral code is required' };
    }
    
    if (code.length < 5 || code.length > 20) {
        return { isValid: false, message: 'Referral code must be between 5 and 20 characters' };
    }
    
    // Check if code contains only alphanumeric characters
    if (!/^[a-zA-Z0-9]+$/.test(code)) {
        return { isValid: false, message: 'Referral code can only contain letters and numbers' };
    }
    
    return { isValid: true, message: 'Valid referral code' };
};

// Check if referral code exists and is valid
export const checkReferralCode = async (code) => {
    const validation = validateReferralCode(code);
    if (!validation.isValid) {
        return { exists: false, valid: false, message: validation.message };
    }
    
    try {
        const user = await User.findOne({ referralCode: code });
        if (!user) {
            return { exists: false, valid: true, message: 'Referral code not found' };
        }
        
        if (user.isBlocked) {
            return { exists: true, valid: false, message: 'Referral code belongs to a blocked account' };
        }
        
        return { 
            exists: true, 
            valid: true, 
            message: 'Valid referral code',
            referrer: user._id,
            referrerUsername: user.username
        };
    } catch (error) {
        console.error('Error checking referral code:', error);
        return { exists: false, valid: false, message: 'Error validating referral code' };
    }
};

// Calculate referral reward amount
export const calculateReferralReward = (orderAmount) => {
    // 5% of order amount as referral reward, minimum ₹50, maximum ₹500
    const rewardPercentage = 0.05;
    const minReward = 50;
    const maxReward = 500;
    
    const calculatedReward = orderAmount * rewardPercentage;
    
    if (calculatedReward < minReward) {
        return minReward;
    } else if (calculatedReward > maxReward) {
        return maxReward;
    }
    
    return Math.round(calculatedReward);
};

// Process referral reward
export const processReferralReward = async (referrerId, orderAmount) => {
    try {
        const rewardAmount = calculateReferralReward(orderAmount);
        
        const referrer = await User.findById(referrerId);
        if (!referrer) {
            throw new Error('Referrer not found');
        }
        
        // Initialize wallet and referralRewards if they don't exist
        if (!referrer.wallet) {
            referrer.wallet = { balance: 0 };
        }
        if (typeof referrer.wallet.balance !== 'number' || isNaN(referrer.wallet.balance)) {
            referrer.wallet.balance = 0;
        }
        if (typeof referrer.referralRewards !== 'number' || isNaN(referrer.referralRewards)) {
            referrer.referralRewards = 0;
        }
        
        // Add reward to referrer's wallet
        referrer.wallet.balance += rewardAmount;
        referrer.referralRewards += rewardAmount;
        await referrer.save();
        
        return {
            success: true,
            rewardAmount,
            newBalance: referrer.wallet.balance,
            totalReferralRewards: referrer.referralRewards
        };
    } catch (error) {
        console.error('Error processing referral reward:', error);
        throw error;
    }
};

export default generateReferralCode;