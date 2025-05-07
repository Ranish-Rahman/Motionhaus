import bcrypt from 'bcrypt';
import User from '../../models/userModel.js';
import Address from '../../models/addressModel.js';
import { sendOTPEmail, generateOTP } from '../../utils/otp.js';
import Product from '../../models/ProductModel.js';
import Wishlist from '../../models/wishlistModel.js';
import Cart from '../../models/cartModel.js';
import Order from '../../models/orderModel.js';

// Simple password validator
const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return { isValid: false, message: "Password must be at least 6 characters" };
  }
  return { isValid: true };
};

// Render signup page
const signUpPage = (req, res) => {
  res.render("user/signup");
};

// Render login page
const getLogin = (req, res) => {
  res.render("user/login"); 
};

// Render home page
const getHome = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render("user/home", { 
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error')
  });
};

// Render forgot password page
const getForgotPassword = (req, res) => {
  res.render("user/forgot-password");
};

// Handle signup
const postSignup = async (req, res) => {
  try {
    // Clear any existing session data before starting new signup
    if (req.session.tempUser) {
      delete req.session.tempUser;
    }

    const { username, email, password } = req.body;

    console.log(" Signup request received:");
    console.log("   ↳ Username:", username);
    console.log("   ↳ Email:", email);

    //Validate username
    if (!username || !/^[a-zA-Z]{3,10}$/.test(username.trim())) {
      console.log(" Username validation failed");
      return res.status(400).json({
        success: false,
        message: 'Username should contain only letters (3-10 characters)'
      });
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log(" Email validation failed");
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      console.log(" Password validation failed");
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    //  Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(" Email already registered:", email);
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login.'
      });
    }

    //  Generate OTP
    const otp = generateOTP();

    console.log(" OTP Generated:", otp);

    //  Save new user temporarily in session
    req.session.tempUser = {
      username: username.trim(),
      email,
      password, // Store plain password, model will hash it
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes
      attempts: 0
    };

    console.log("Temp user saved in session");

    //  Send OTP email
    console.log(" Sending OTP email to:", email);
    await sendOTPEmail(email, otp);

    console.log(" OTP email sent!");

    return res.json({
      success: true,
      message: "OTP sent to your email",
      email
    });

  } catch (error) {
    console.error(" Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Signup failed"
    });
  }
};

// Handle OTP verification
const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const tempUser = req.session.tempUser;

    if (!tempUser) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please try signing up again."
      });
    }

    if (Date.now() > tempUser.expiresAt) {
      delete req.session.tempUser;
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please try signing up again."
      });
    }

    if (tempUser.attempts >= 3) {
      delete req.session.tempUser;
      return res.status(400).json({
        success: false,
        message: "Too many attempts. Please try signing up again."
      });
    }

    if (otp !== tempUser.otp) {
      tempUser.attempts++;
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again."
      });
    }

    // Create new user with plain password (model will hash it)
    const newUser = new User({
      username: tempUser.username,
      email: tempUser.email,
      password: tempUser.password // Plain password, model will hash it
    });

    await newUser.save();
    delete req.session.tempUser;

    return res.json({
      success: true,
      message: "Account created successfully!"
    });

  } catch (error) {
    console.error(" OTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed"
    });
  }
};

// Handle login
const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(" Login attempt for email:", email);

    // Basic validation
    if (!email || !password) {
      console.log(" Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    console.log(" User found:", user ? "Yes" : "No");

    if (!user) {
      console.log(" User not found");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      console.log(" User is blocked");
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support for assistance."
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(" Password match:", isMatch ? "Yes" : "No");
    console.log(" Input password:", password);
    console.log(" Stored password hash:", user.password);

    if (!isMatch) {
      console.log(" Password mismatch");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Login successful
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
    };

    console.log(" Login successful for user:", user.username);

    return res.json({
      success: true,
      message: "Login successful",
    });

  } catch (error) {
    console.error(" Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};

// Handle OTP resend
const resendOTP = async (req, res) => {
  try {
    const tempUser = req.session.tempUser;

    // Check if there's an ongoing signup session
    if (!tempUser) {
      return res.status(400).json({
        success: false,
        message: "No active signup session. Please start signup again."
      });
    }

    // Check if too many resend attempts (limit to 3 resends)
    if (tempUser.resendCount >= 3) {
      delete req.session.tempUser;
      return res.status(400).json({
        success: false,
        message: "Maximum resend attempts reached. Please try signing up again."
      });
    }

    // Generate new OTP
    const newOTP = generateOTP();
    
    // Update session with new OTP and reset expiry
    tempUser.otp = newOTP;
    tempUser.expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes
    tempUser.attempts = 0; // Reset verification attempts
    tempUser.resendCount = (tempUser.resendCount || 0) + 1; // Increment resend counter

    // Save updated session
    req.session.tempUser = tempUser;

    // Send new OTP
    await sendOTPEmail(tempUser.email, newOTP);

    return res.json({
      success: true,
      message: "New OTP sent successfully",
      remainingResends: 3 - tempUser.resendCount
    });

  } catch (error) {
    console.error(" Resend OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP"
    });
  }
};

// Handle forgot password request
const postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address"
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email"
      });
    }

    // Generate reset token
    const resetToken = generateOTP();
    const resetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store reset token in session
    req.session.resetPassword = {
      email,
      token: resetToken,
      expiresAt: resetExpires
    };

    // Send reset email
    await sendOTPEmail(email, resetToken);

    return res.json({
      success: true,
      message: "Reset instructions sent to your email"
    });

  } catch (error) {
    console.error(" Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process request"
    });
  }
};

// Handle password reset
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const resetData = req.session.resetPassword;

    // Check if reset session exists
    if (!resetData) {
      return res.status(400).json({
        success: false,
        message: "Reset session expired. Please try again."
      });
    }

    // Check if token matches
    if (token !== resetData.token) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset token"
      });
    }

    // Check if token expired
    if (Date.now() > resetData.expiresAt) {
      delete req.session.resetPassword;
      return res.status(400).json({
        success: false,
        message: "Reset token expired. Please request a new one."
      });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Update user password
    const user = await User.findOne({ email: resetData.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.password = newPassword;
    await user.save();

    // Clear reset session
    delete req.session.resetPassword;

    return res.json({
      success: true,
      message: "Password reset successful"
    });

  } catch (error) {
    console.error(" Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password"
    });
  }
};

// Handle live search
const liveSearch = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json([]);
    }

    const products = await Product.find({
      name: { $regex: q, $options: 'i' },
      isDeleted: false
    }).select('name price images brand').limit(10);

    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      imageUrl: product.images[0],
      brand: product.brand || 'MotionHaus'
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error('Live search error:', error);
    res.status(500).json([]);
  }
};

// Get cart page
const getCart = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const userId = req.session.user._id || req.session.user.id;
  // Fetch cart from DB and populate product details
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  res.render('user/cart', {
    user: req.session.user,
    cart: cart || { items: [], subtotal: 0 },
    success: req.flash('success'),
    error: req.flash('error')
  });
};

// Get wishlist page
const getWishlist = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    // Find the user's wishlist
    const wishlist = await Wishlist.findOne({ user: req.session.user.id })
      .populate({
        path: 'items.product',
        select: 'name images price originalPrice stock'
      });
    
    res.render('user/wishlist', {
      user: req.session.user,
      wishlist: wishlist || { items: [] },
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.render('user/wishlist', {
      user: req.session.user,
      wishlist: { items: [] },
      success: req.flash('success'),
      error: req.flash('error')
    });
  }
};

// Get profile page
const getProfile = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('user/user-profile', {
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error'),
    currentPage: 'profile'
  });
};

// Get address page
const getAddress = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    // Fetch user's addresses from the database
    const addresses = await Address.find({ userId: req.session.user.id });
    
    res.render('user/address', {
      user: req.session.user,
      addresses: addresses,
      success: req.flash('success'),
      error: req.flash('error'),
      currentPage: 'address'
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    req.flash('error', 'Failed to load addresses. Please try again.');
    res.render('user/address', {
      user: req.session.user,
      addresses: [],
      success: req.flash('success'),
      error: req.flash('error'),
      currentPage: 'address'
    });
  }
};

// Add new address
const addAddress = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      addressType,
      defaultAddress
    } = req.body;
    
    // Server-side validation
    const validationErrors = [];
    
    // Validate full name (2-50 characters, letters and spaces only)
    if (!fullName || !/^[A-Za-z\s]{2,50}$/.test(fullName)) {
      validationErrors.push('Full name should contain only letters and spaces (2-50 characters)');
    }
    
    // Validate phone number (10-15 digits, can include +, -, (, ), and spaces)
    if (!phone || !/^[0-9+\s()-]{10,15}$/.test(phone)) {
      validationErrors.push('Phone number should be 10-15 digits');
    }
    
    // Validate address line 1 (5-100 characters)
    if (!addressLine1 || addressLine1.length < 5 || addressLine1.length > 100) {
      validationErrors.push('Address line 1 should be 5-100 characters');
    }
    
    // Validate address line 2 (optional, max 100 characters)
    if (addressLine2 && addressLine2.length > 100) {
      validationErrors.push('Address line 2 should not exceed 100 characters');
    }
    
    // Validate city (2-50 characters, letters and spaces only)
    if (!city || !/^[A-Za-z\s]{2,50}$/.test(city)) {
      validationErrors.push('City should contain only letters and spaces (2-50 characters)');
    }
    
    // Validate state (2-50 characters, letters and spaces only)
    if (!state || !/^[A-Za-z\s]{2,50}$/.test(state)) {
      validationErrors.push('State/province should contain only letters and spaces (2-50 characters)');
    }
    
    // Validate ZIP code (3-10 characters, alphanumeric, spaces, and hyphens)
    if (!zipCode || !/^[0-9A-Za-z\s-]{3,10}$/.test(zipCode)) {
      validationErrors.push('ZIP/postal code should be 3-10 characters');
    }
    
    // Validate country (required)
    if (!country) {
      validationErrors.push('Country is required');
    }
    
    // If there are validation errors, redirect back with error messages
    if (validationErrors.length > 0) {
      req.flash('error', validationErrors.join(', '));
      return res.redirect('/profile/address');
    }
    
    // Create new address
    const newAddress = new Address({
      userId: req.session.user.id,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      addressType,
      isDefault: defaultAddress === 'on'
    });
    
    await newAddress.save();
    
    req.flash('success', 'Address added successfully');
    res.redirect('/profile/address');
  } catch (error) {
    console.error('Error adding address:', error);
    req.flash('error', 'Failed to add address. Please try again.');
    res.redirect('/profile/address');
  }
};

// Get address for editing
const getEditAddress = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const addressId = req.params.id;
    
    // Find the address and ensure it belongs to the current user
    const address = await Address.findOne({
      _id: addressId,
      userId: req.session.user.id
    });
    
    if (!address) {
      req.flash('error', 'Address not found');
      return res.redirect('/profile/address');
    }
    
    res.render('user/edit-address', {
      user: req.session.user,
      address: address,
      success: req.flash('success'),
      error: req.flash('error'),
      currentPage: 'address'
    });
  } catch (error) {
    console.error('Error fetching address for edit:', error);
    req.flash('error', 'Failed to load address. Please try again.');
    res.redirect('/profile/address');
  }
};

// Update address
const updateAddress = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const addressId = req.params.id;
    
    // Find the address and ensure it belongs to the current user
    const address = await Address.findOne({
      _id: addressId,
      userId: req.session.user.id
    });
    
    if (!address) {
      req.flash('error', 'Address not found');
      return res.redirect('/profile/address');
    }
    
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      addressType,
      defaultAddress
    } = req.body;
    
    // Server-side validation
    const validationErrors = [];
    
    // Validate full name (2-50 characters, letters and spaces only)
    if (!fullName || !/^[A-Za-z\s]{2,50}$/.test(fullName)) {
      validationErrors.push('Full name should contain only letters and spaces (2-50 characters)');
    }
    
    // Validate phone number (10-15 digits, can include +, -, (, ), and spaces)
    if (!phone || !/^[0-9+\s()-]{10,15}$/.test(phone)) {
      validationErrors.push('Phone number should be 10-15 digits');
    }
    
    // Validate address line 1 (5-100 characters)
    if (!addressLine1 || addressLine1.length < 5 || addressLine1.length > 100) {
      validationErrors.push('Address line 1 should be 5-100 characters');
    }
    
    // Validate address line 2 (optional, max 100 characters)
    if (addressLine2 && addressLine2.length > 100) {
      validationErrors.push('Address line 2 should not exceed 100 characters');
    }
    
    // Validate city (2-50 characters, letters and spaces only)
    if (!city || !/^[A-Za-z\s]{2,50}$/.test(city)) {
      validationErrors.push('City should contain only letters and spaces (2-50 characters)');
    }
    
    // Validate state (2-50 characters, letters and spaces only)
    if (!state || !/^[A-Za-z\s]{2,50}$/.test(state)) {
      validationErrors.push('State/province should contain only letters and spaces (2-50 characters)');
    }
    
    // Validate ZIP code (3-10 characters, alphanumeric, spaces, and hyphens)
    if (!zipCode || !/^[0-9A-Za-z\s-]{3,10}$/.test(zipCode)) {
      validationErrors.push('ZIP/postal code should be 3-10 characters');
    }
    
    // Validate country (required)
    if (!country) {
      validationErrors.push('Country is required');
    }
    
    // If there are validation errors, redirect back with error messages
    if (validationErrors.length > 0) {
      req.flash('error', validationErrors.join(', '));
      return res.redirect(`/profile/address/edit/${addressId}`);
    }
    
    // Update address fields
    address.fullName = fullName;
    address.phone = phone;
    address.addressLine1 = addressLine1;
    address.addressLine2 = addressLine2;
    address.city = city;
    address.state = state;
    address.zipCode = zipCode;
    address.country = country;
    address.addressType = addressType;
    address.isDefault = defaultAddress === 'on';
    
    await address.save();
    
    req.flash('success', 'Address updated successfully');
    res.redirect('/profile/address');
  } catch (error) {
    console.error('Error updating address:', error);
    req.flash('error', 'Failed to update address. Please try again.');
    res.redirect('/profile/address');
  }
};

// Delete address
const deleteAddress = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const addressId = req.params.id;
    
    // Find and delete the address, ensuring it belongs to the current user
    const result = await Address.findOneAndDelete({
      _id: addressId,
      userId: req.session.user.id
    });
    
    if (!result) {
      req.flash('error', 'Address not found');
      return res.redirect('/profile/address');
    }
    
    req.flash('success', 'Address deleted successfully');
    res.redirect('/profile/address');
  } catch (error) {
    console.error('Error deleting address:', error);
    req.flash('error', 'Failed to delete address. Please try again.');
    res.redirect('/profile/address');
  }
};

// Set address as default
const setDefaultAddress = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const addressId = req.params.id;
    
    // Find the address and ensure it belongs to the current user
    const address = await Address.findOne({
      _id: addressId,
      userId: req.session.user.id
    });
    
    if (!address) {
      req.flash('error', 'Address not found');
      return res.redirect('/profile/address');
    }
    
    // Set this address as default (the pre-save hook will handle unsetting others)
    address.isDefault = true;
    await address.save();
    
    req.flash('success', 'Default address updated successfully');
    res.redirect('/profile/address');
  } catch (error) {
    console.error('Error setting default address:', error);
    req.flash('error', 'Failed to update default address. Please try again.');
    res.redirect('/profile/address');
  }
};

// Get orders page
const getOrders = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const userId = req.session.user._id || req.session.user.id;
  const orders = await Order.find({ user: userId })
    .select('_id orderID orderDate totalAmount status returnRequest')
    .sort({ orderDate: -1 });
  
  res.render('user/orders', {
    user: req.session.user,
    orders,
    success: req.flash('success'),
    error: req.flash('error')
  });
};

// Get order details page
const getOrderDetails = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name price images');

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/profile/orders');
    }

    // Check if the order belongs to the current user
    if (!order.user || !order.user._id) {
      req.flash('error', 'Order user not found');
      return res.redirect('/profile/orders');
    }

    const userId = req.session.user._id || req.session.user.id;
    if (order.user._id.toString() !== userId.toString()) {
      req.flash('error', 'You are not authorized to view this order');
      return res.redirect('/profile/orders');
    }

    res.render('user/order-details', {
      user: req.session.user,
      order,
      success: req.flash('success'),
      error: req.flash('error'),
      currentPage: 'orders'
    });
  } catch (error) {
    console.error('Order details error:', error);
    req.flash('error', 'Failed to fetch order details');
    res.redirect('/profile/orders');
  }
};

// Get change password page
const getChangePassword = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('user/change-password', {
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error'),
    currentPage: 'change-password'
  });
};

// Handle change password
const postChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.redirect('/profile/change-password');
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/profile/change-password');
    }

    // Verify current password
    const user = await User.findById(req.session.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/profile/change-password');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    req.flash('success', 'Password updated successfully');
    res.redirect('/profile/change-password');
  } catch (error) {
    console.error('Error changing password:', error);
    req.flash('error', 'An error occurred while changing password');
    res.redirect('/profile/change-password');
  }
};

const getCheckout = async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user.id;
    // Fetch user's addresses from the database
    const addresses = await Address.find({ userId });
    // Fetch cart from DB and populate product details
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    res.render('user/checkout', { 
      cart: cart || { items: [], subtotal: 0 },
      addresses: addresses
    });
  } catch (error) {
    console.error('Error fetching addresses for checkout:', error);
    res.render('user/checkout', { 
      cart: { items: [], subtotal: 0 },
      addresses: []
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    if (!addressId || !paymentMethod) {
      return res.status(400).json({ message: 'Address and payment method are required' });
    }

    const userId = req.session.user._id || req.session.user.id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items || !cart.items.length) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    // Check for blocked products and remove them
    const blockedProducts = [];
    const validItems = [];
    for (const item of cart.items) {
      if (item.product && !item.product.isBlocked) {
        validItems.push(item);
      } else if (item.product) {
        blockedProducts.push(item.product.name);
      }
    }
    cart.items = validItems;
    cart.subtotal = cart.items.reduce(
      (total, item) => total + (item.product.price * item.quantity),
      0
    );

    if (cart.items.length === 0) {
      return res.status(400).json({ 
        message: 'All items in your cart are no longer available',
        cart: cart
      });
    }
    if (blockedProducts.length > 0) {
      return res.status(400).json({ 
        message: `Some items in your cart are no longer available: ${blockedProducts.join(', ')}`,
        cart: cart
      });
    }

    // Generate orderID
    const orderID = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const order = new Order({
      orderID,
      user: userId,
      address: addressId,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        size: item.size
      })),
      totalAmount: cart.subtotal,
      paymentMethod,
      status: 'Pending', // Changed to match enum case
      paymentStatus: paymentMethod === 'cod' ? 'Pending' : 'Not Paid'
    });

    await order.save();

    // Clear the user's cart in the database
    cart.items = [];
    cart.subtotal = 0;
    await cart.save();

    // Render the order success page
    res.render('user/order-success', {
      user: req.session.user,
      order: {
        _id: order._id,
        orderID: order.orderID,
        createdAt: order.createdAt,
        total: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
};

const requestReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Please provide a reason for return' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Return can only be requested for delivered orders' });
    }

    // Check if return request already exists
    if (order.returnRequest && order.returnRequest.status) {
      return res.status(400).json({ success: false, message: 'Return request already exists for this order' });
    }

    // Update order with return request
    order.returnRequest = {
      status: 'pending',
      reason,
      requestedAt: new Date()
    };

    // Save the updated order
    await order.save();

    res.status(200).json({ 
      success: true, 
      message: 'Return request submitted successfully' 
    });
  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing return request' 
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.status === 'pending' || order.status === 'processing') {
      order.status = 'cancelled';
      order.cancelReason = reason;
      order.cancelledAt = new Date();
      // Increment stock for each product
      for (const item of order.items) {
        if (item.product) {
          item.product.stock += item.quantity;
          await item.product.save();
        }
      }
      await order.save();
      return res.json({ success: true, message: 'Order cancelled and stock updated' });
    } else {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export {
  signUpPage,
  getLogin,
  getHome,
  getForgotPassword,
  postSignup,
  verifyOTP,
  resendOTP,
  postLogin,
  postForgotPassword,
  resetPassword,
  liveSearch,
  getCart,
  getWishlist,
  getProfile,
  getOrders,
  getOrderDetails,
  getAddress,
  addAddress,
  getEditAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getChangePassword,
  postChangePassword,
  getCheckout,
  createOrder,
  requestReturn
};

