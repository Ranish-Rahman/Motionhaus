import bcrypt from 'bcrypt';
import User from '../../models/userModel.js';
import Address from '../../models/addressModel.js';
import { sendOTPEmail, generateOTP } from '../../utils/otp.js';
import Product from '../../models/ProductModel.js';
import Wishlist from '../../models/wishlistModel.js';
import Cart from '../../models/cartModel.js';
import Order from '../../models/orderModel.js';
import { validatePassword } from '../../utils/passwordValidation.js';
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import razorpay from '../../utils/razorpay.js';
import { nanoid } from 'nanoid';
import { getBestOffer } from './productController.js';

// Render signup page
const signUpPage = (req, res) => {
  res.render("user/signup");
};

// Render login page
const getLogin = (req, res) => {
  res.render("user/login"); 
};

// Render home page
export const getHome = async (req, res) => {
  try {
    res.render('user/home', {
      title: 'Home',
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error in getHome:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load home page'
    });
  }
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

    // Compare password using the model's method
    const isMatch = await user.comparePassword(password);
    console.log(" Password match:", isMatch ? "Yes" : "No");
    console.log(" Input password:", password);

    if (!isMatch) {
      console.log(" Password mismatch");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Login successful
    req.session.user = {
      _id: user._id,
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
    const { q, page = 1, limit = 12 } = req.query;
    
    if (!q) {
      return res.json({ products: [], pagination: null });
    }

    // Escape special characters in the search query
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count of matching products
    const totalProducts = await Product.countDocuments({
      name: { $regex: escapedQuery, $options: 'i' },
      isDeleted: false,
      isBlocked: false
    });

    // Get paginated products
    const products = await Product.find({
      name: { $regex: escapedQuery, $options: 'i' },
      isDeleted: false,
      isBlocked: false
    })
    .select('name price images brand')
    .skip(skip)
    .limit(parseInt(limit));

    // Calculate pagination info
    const totalPages = Math.ceil(totalProducts / parseInt(limit));
    const pagination = {
      currentPage: parseInt(page),
      totalPages,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
      nextPage: parseInt(page) + 1,
      prevPage: parseInt(page) - 1,
      totalItems: totalProducts
    };

    // Format products
    const formattedProducts = products.map(product => ({
      _id: product._id,
      name: product.name,
      price: product.price,
      images: product.images,
      brand: product.brand || 'MotionHaus'
    }));

    res.json({
      products: formattedProducts,
      pagination
    });
  } catch (error) {
    console.error('Live search error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      products: [], 
      pagination: null,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Search failed'
    });
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

// Get profile page
const getProfile = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }

    res.render('user/user-profile', {
      user,
      success: req.flash('success'),
      error: req.flash('error'),
      currentPage: 'profile'
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/login');
  }
};

// Get address page
const getAddress = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    // Fetch user's addresses from the database
    const addresses = await Address.find({ userId: req.session.user._id });
    
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
      userId: req.session.user._id,
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
      userId: req.session.user._id
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
      userId: req.session.user._id
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
    
    // Only update isDefault if the field is present in the request
    if (typeof defaultAddress !== 'undefined') {
      if (defaultAddress === 'on') {
        // Unset default for all other addresses of this user
        await Address.updateMany(
          { userId: req.session.user._id, _id: { $ne: addressId } },
          { $set: { isDefault: false } }
        );
        address.isDefault = true;
      } else {
        address.isDefault = false;
      }
    }
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
      userId: req.session.user._id
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
      userId: req.session.user._id
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
export const getOrders = async (req, res) => {
  console.log('=== GET ORDERS STARTED ===');
  console.log('Session user:', req.session.user);
  
  if (!req.session.user) {
    console.log('No user session found, redirecting to login');
    return res.redirect('/login');
  }
  
  try {
    const userId = req.session.user._id || req.session.user.id;
    console.log('User ID:', userId);
    
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Number of orders per page
    const skip = (page - 1) * limit;

    // Get total count of orders
    const totalOrders = await Order.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalOrders / limit);
    
    const orders = await Order.find({ user: userId })
      .select('_id orderID orderDate totalAmount status returnRequest items')
      .populate('items.product', 'name price images')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);
    
    console.log('Found orders:', orders.length);
    console.log('Pagination info:', { page, totalPages, totalOrders });
    
    res.render('user/orders', {
      user: req.session.user,
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error in getOrders:', error);
    req.flash('error', 'Failed to load orders');
    res.redirect('/profile');
  }
};

// Get order details page
const getOrderDetails = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name price images')
      .select('+shippingAddress +returnRequest');  // Explicitly select shippingAddress and returnRequest

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

    // Set status class based on order status
    let statusClass = 'status-badge';
    switch (order.status.toLowerCase()) {
      case 'pending':
        statusClass += ' status-pending';
        break;
      case 'processing':
        statusClass += ' status-processing';
        break;
      case 'shipped':
        statusClass += ' status-shipped';
        break;
      case 'delivered':
        statusClass += ' status-delivered';
        break;
      case 'cancelled':
        statusClass += ' status-cancelled';
        break;
      case 'return approved':
        statusClass += ' status-return-approved';
        break;
      default:
        statusClass += ' status-pending';
    }

    res.render('user/order-details', {
      user: req.session.user,
      order,
      statusClass,
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

// Rate limiting for password changes
const passwordChangeAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// Handle change password
const postChangePassword = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    console.log('Attempting password change for user:', userId);
    console.log('Session user:', req.session.user);

    // Check rate limiting
    const attempts = passwordChangeAttempts.get(userId) || { count: 0, timestamp: Date.now() };
    
    // Reset attempts if lockout period has passed
    if (Date.now() - attempts.timestamp > LOCKOUT_TIME) {
      attempts.count = 0;
      attempts.timestamp = Date.now();
    }
    
    // Check if user is locked out
    if (attempts.count >= MAX_ATTEMPTS) {
      const remainingTime = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.timestamp)) / 60000);
      req.flash('error', `Too many attempts. Please try again in ${remainingTime} minutes.`);
      return res.redirect('/profile/change-password');
    }

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.redirect('/profile/change-password');
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/profile/change-password');
    }

    // Validate password requirements
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      req.flash('error', validation.message);
      return res.redirect('/profile/change-password');
    }

    // Verify current password
    const user = await User.findById(userId);
    console.log('Found user:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('User not found in database');
      req.flash('error', 'User not found');
      return res.redirect('/profile/change-password');
    }

    console.log('Comparing passwords...');
    const isMatch = await user.comparePassword(currentPassword);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      // Increment failed attempts
      attempts.count++;
      passwordChangeAttempts.set(userId, attempts);
      
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/profile/change-password');
    }

    // Update password - let the model handle hashing
    user.password = newPassword;
    await user.save();

    // Reset attempts on successful password change
    passwordChangeAttempts.delete(userId);

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
    const addresses = await Address.find({ userId });
    let cart = await Cart.findOne({ user: userId }).populate('items.product');
    
    if (!cart || !cart.items || cart.items.length === 0) {
      req.flash('error', 'Your cart is empty. Please add items before proceeding to checkout.');
      return res.redirect('/cart');
    }

    // Calculate cart totals and apply discounts
    let cartTotal = 0;
    let totalDiscount = 0;
    const processedItems = [];

    // Process each item and calculate discounts
    for (let item of cart.items) {
      if (!item.product || item.product.isBlocked) continue;

      const originalPrice = item.product.price;
      const itemSubtotal = originalPrice * item.quantity;
      cartTotal += itemSubtotal;

      // Get and apply offer
      const offer = await getBestOffer(item.product._id);
      if (offer) {
        const itemDiscount = Math.round((itemSubtotal * offer.discount) / 100);
        totalDiscount += itemDiscount;
        
        processedItems.push({
          ...item.toObject(),
          product: {
            ...item.product.toObject(),
            bestOffer: offer,
            originalPrice,
            discountedPrice: originalPrice - (itemDiscount / item.quantity)
          },
          discountAmount: itemDiscount,
          finalPrice: originalPrice - (itemDiscount / item.quantity),
          offerName: offer.name,
          offerDiscount: offer.discount
        });
      } else {
        processedItems.push({
          ...item.toObject(),
          product: {
            ...item.product.toObject(),
            originalPrice,
            discountedPrice: originalPrice
          },
          discountAmount: 0,
          finalPrice: originalPrice,
          offerName: null,
          offerDiscount: 0
        });
      }
    }

    // Calculate final amount
    const finalAmount = cartTotal - totalDiscount;

    // Store checkout data in session
    req.session.checkoutData = {
      cartTotal,
      totalDiscount,
      finalAmount,
      items: processedItems.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.finalPrice,
        originalPrice: item.product.originalPrice,
        discountAmount: item.discountAmount,
        size: item.size,
        offerName: item.offerName,
        offerDiscount: item.offerDiscount
      }))
    };

    // Save session explicitly
    await new Promise(resolve => req.session.save(resolve));

    console.log('Checkout calculation:', {
      cartTotal,
      totalDiscount,
      finalAmount,
      items: processedItems.map(item => ({
        name: item.product.name,
        price: item.product.originalPrice,
        discount: item.discountAmount,
        final: item.finalPrice,
        offer: item.offerName
      }))
    });

    res.render('user/checkout', {
      cart: {
        ...cart.toObject(),
        items: processedItems,
        subtotal: cartTotal,
        discount: totalDiscount,
        finalAmount,
        hasOffer: totalDiscount > 0
      },
      addresses,
      user: await User.findById(userId).lean()
    });

  } catch (error) {
    console.error('Error in checkout:', error);
    req.flash('error', 'An error occurred while loading the checkout page.');
    res.redirect('/cart');
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

// Send OTP for email verification
const sendProfileOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.session.user._id;

    // Enhanced email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Additional validation for common email domains
    const [localPart, domain] = email.split('@');
    
    // Check local part length (before @)
    if (localPart.length > 64) {
      return res.status(400).json({
        success: false,
        message: 'Email address is too long before the @ symbol'
      });
    }

    // Check domain length
    if (domain.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Email domain is too long'
      });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email: email, 
      _id: { $ne: userId } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already in use'
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in session
    req.session.profileOTP = {
      email,
      otp,
      expiresAt: Date.now() + 3 * 60 * 1000, // 3 minutes
      attempts: 0
    };

    // Send OTP email
    await sendOTPEmail(email, otp);

    return res.json({
      success: true,
      message: 'Verification code sent successfully'
    });

  } catch (error) {
    console.error('Send profile OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
};

// Verify OTP for email change
const verifyProfileOTP = async (req, res) => {
  try {
    const { otp, email } = req.body;
    const otpData = req.session.profileOTP;

    console.log('Verifying OTP:', { otp, email });
    console.log('Session OTP Data:', otpData);

    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: 'Verification session expired. Please try again.'
      });
    }

    if (Date.now() > otpData.expiresAt) {
      delete req.session.profileOTP;
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please request a new one.'
      });
    }

    if (otpData.attempts >= 3) {
      delete req.session.profileOTP;
      return res.status(400).json({
        success: false,
        message: 'Too many attempts. Please try again.'
      });
    }

    if (otp !== otpData.otp || email !== otpData.email) {
      otpData.attempts++;
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Mark email as verified in session instead of deleting OTP data
    req.session.profileOTP = {
      ...otpData,
      verified: true
    };

    console.log('OTP verification successful. Updated session:', req.session.profileOTP);

    return res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Verify profile OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify code'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { username, email, phone } = req.body;
    const userId = req.session.user._id;

    console.log('Update Profile Request:', { username, email, phone, userId });

    // Validate input
    if (!username || !email) {
      console.log('Validation failed: Missing username or email');
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log('Validation failed: Invalid email format');
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Phone validation (optional)
    if (phone && !/^[0-9]{10,15}$/.test(phone)) {
      console.log('Validation failed: Invalid phone format');
      return res.status(400).json({
        success: false,
        message: 'Phone number must be between 10 and 15 digits'
      });
    }

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found with ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Current user data:', {
      currentUsername: user.username,
      currentEmail: user.email,
      currentPhone: user.phone
    });

    // If email is being changed, verify OTP session exists and is verified
    if (email !== user.email) {
      console.log('Email change detected. Checking OTP verification...');
      const otpData = req.session.profileOTP;
      console.log('OTP Data:', otpData);
      
      if (!otpData || !otpData.verified || otpData.email !== email) {
        console.log('OTP verification failed or missing');
        return res.status(400).json({
          success: false,
          message: 'Email change requires verification'
        });
      }
      console.log('OTP verification confirmed');
      // Only delete OTP data after confirming verification
      delete req.session.profileOTP;
    }

    // Check if email is already in use by another user
    const existingUser = await User.findOne({ 
      email: email,
      _id: { $ne: userId }
    });

    if (existingUser) {
      console.log('Email already in use by another user');
      return res.status(400).json({
        success: false,
        message: 'Email is already in use by another account'
      });
    }

    // Update user
    user.username = username;
    user.email = email;
    user.phone = phone || '';  // Set empty string if phone is not provided
    await user.save();

    console.log('User updated successfully:', {
      newUsername: user.username,
      newEmail: user.email,
      newPhone: user.phone
    });

    // Update session with all user data
    req.session.user = {
      ...req.session.user,
      username: user.username,
      email: user.email,
      phone: user.phone,
      _id: user._id,
      role: user.role,
      isVerified: user.isVerified,
      isBlocked: user.isBlocked,
      status: user.status,
      wallet: user.wallet
    };

    // Save session explicitly to ensure it's updated
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
    });

    // Verify session was updated
    console.log('Updated session data:', req.session.user);

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        username: user.username,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Generate invoice
export const generateInvoice = async (req, res) => {
  let browser;
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
    const userId = req.session.user._id || req.session.user.id;
    if (order.user._id.toString() !== userId.toString()) {
      req.flash('error', 'You are not authorized to view this invoice');
      return res.redirect('/profile/orders');
    }

    // Check if at least one item is delivered or completed
    const hasDeliveredItems = order.items.some(item => 
      item.status === 'Delivered' || item.status === 'Completed'
    );

    if (!hasDeliveredItems) {
      req.flash('error', 'Invoice is only available for orders with delivered items');
      return res.redirect('/profile/orders');
    }

    // Launch a new browser instance
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create a new page
    const page = await browser.newPage();

    // Render the invoice template
    const htmlContent = await ejs.renderFile('views/user/invoice.ejs', { order });

    // Set content to the page
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    // Close the browser
    await browser.close();

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderID}.pdf`);
    
    // Send the PDF
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating invoice:', error);
    if (browser) {
      await browser.close();
    }
    req.flash('error', 'Failed to generate invoice');
    return res.redirect('/profile/orders');
  }
};

// Get profile data
const getProfileData = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update session with latest user data
    req.session.user = {
      ...req.session.user,
      username: user.username,
      email: user.email,
      phone: user.phone,
      _id: user._id,
      role: user.role,
      isVerified: user.isVerified,
      isBlocked: user.isBlocked,
      status: user.status,
      wallet: user.wallet
    };

    // Save session explicitly
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.json({
      success: true,
      user: {
        username: user.username,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Error fetching profile data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile data'
    });
  }
};

// Handle payment failure
export const handlePaymentFailure = async (req, res) => {
  try {
    const { orderID, razorpayOrderId, error } = req.body;
    const userId = req.session.user._id;

    console.log('Handling failed payment:', { orderID, razorpayOrderId, error });

    if (!orderID) {
      throw new Error('Order ID is required');
    }

    // First check if order already exists
    let order = await Order.findOne({ 
      orderID: orderID,
      user: userId 
    });

    if (!order) {
      console.log('Order not found, creating new order for failed payment');
      
      // Get pending order data from session
      const pendingOrder = req.session.pendingOrder;
      if (!pendingOrder || pendingOrder.orderID !== orderID) {
        console.log('No pending order found in session:', {
          hasPendingOrder: !!pendingOrder,
          pendingOrderID: pendingOrder?.orderID,
          requestedOrderID: orderID
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid order data'
        });
      }

      // Create new order with failed status
      order = new Order({
        orderID: pendingOrder.orderID,
        user: pendingOrder.userId,
        items: pendingOrder.items,
        totalAmount: pendingOrder.totalAmount,
        shippingAddress: pendingOrder.shippingAddress,
        paymentMethod: 'razorpay',
        status: 'payment-failed',
        paymentStatus: 'failed',
        cancelReason: error || 'Payment failed',
        paymentDetails: {
          razorpayOrderId: razorpayOrderId
        }
      });

      await order.save();
      console.log('Created new order for failed payment:', order.orderID);
    } else {
      // Update existing order status
      order.status = 'payment-failed';
      order.paymentStatus = 'failed';
      order.cancelReason = error || 'Payment failed';
      await order.save();
      console.log('Updated existing order status:', order.orderID);
    }

    // Restore product stock and clear cart
    await handleOrderCleanup(userId, req.session);

    res.json({
      success: true,
      message: 'Payment failure handled successfully',
      orderId: order.orderID
    });
  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle payment failure',
      error: error.message
    });
  }
};

// Handle Razorpay order cancellation
export const cancelRazorpayOrder = async (req, res) => {
  try {
    const { orderID, razorpayOrderId } = req.body;
    const userId = req.session.user._id;

    console.log('[Debug] Cancelling Razorpay order:', { orderID, razorpayOrderId });

    if (!orderID) {
      throw new Error('Order ID is required');
    }

    // First check if we have pending order data in session
    let orderData = req.session.pendingOrder;
    console.log('[Debug] Session data for cancelled order:', {
      hasPendingOrder: !!orderData,
      sessionOrderID: orderData?.orderID,
      requestedOrderID: orderID,
      sessionData: orderData
    });

    // If no session data, try to find existing order
    if (!orderData || orderData.orderID !== orderID) {
      const existingOrder = await Order.findOne({ 
        $or: [
          { orderID: orderID, user: userId },
          { 'paymentDetails.razorpayOrderId': razorpayOrderId, user: userId }
        ]
      });

      if (existingOrder) {
        orderData = {
          orderID: existingOrder.orderID,
          items: existingOrder.items,
          totalAmount: existingOrder.totalAmount,
          shippingAddress: existingOrder.shippingAddress,
          userId: userId,
          razorpayOrderId: razorpayOrderId
        };
      } else {
        // If no existing order and no session data, get user's default address
        const defaultAddress = await Address.findOne({ 
          userId: userId,
          isDefault: true 
        });

        if (!defaultAddress) {
          return res.status(400).json({
            success: false,
            message: 'No shipping address found. Please add a shipping address and try again.'
          });
        }

        // Get cart data for minimal order
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        const orderItems = cart?.items || [];
        const orderAmount = cart?.items.reduce((total, item) => 
          total + (item.product.price * item.quantity), 0
        ) || 0;

        orderData = {
          orderID: `ORD-${Date.now()}-${nanoid(8).toUpperCase()}`,
          items: orderItems,
          totalAmount: orderAmount,
          shippingAddress: {
            fullName: defaultAddress.fullName,
            phone: defaultAddress.phone,
            address: defaultAddress.addressLine1,
            city: defaultAddress.city,
            state: defaultAddress.state,
            postalCode: defaultAddress.zipCode,
            country: defaultAddress.country
          },
          userId: userId,
          razorpayOrderId: razorpayOrderId
        };
      }
    }

    // If we have order data (either from session or database), create/update the order
    if (orderData) {
      let order = await Order.findOne({ 
        $or: [
          { orderID: orderData.orderID },
          { 'paymentDetails.razorpayOrderId': orderData.razorpayOrderId }
        ]
      });

      if (!order) {
        console.log('[Debug] Creating new order for cancelled payment');
        order = new Order({
          orderID: orderData.orderID,
          user: userId,
          items: orderData.items || [],
          totalAmount: orderData.totalAmount || 0,
          shippingAddress: orderData.shippingAddress,
          paymentMethod: 'razorpay',
          status: 'payment-failed',
          paymentStatus: 'failed',
          cancelReason: 'Payment cancelled by user',
          paymentDetails: {
            razorpayOrderId: razorpayOrderId || orderData.razorpayOrderId
          }
        });
      } else {
        console.log('[Debug] Updating existing order status:', order.orderID);
        order.status = 'payment-failed';
        order.paymentStatus = 'failed';
        order.cancelReason = 'Payment cancelled by user';
        order.paymentDetails = order.paymentDetails || {};
        order.paymentDetails.razorpayOrderId = razorpayOrderId || orderData.razorpayOrderId;
      }

      await order.save();
      console.log('[Debug] Saved order:', order.orderID);

      // Try to cancel the Razorpay order
      try {
        if (razorpayOrderId) {
          const razorpayOrder = await razorpay.orders.fetch(razorpayOrderId);
          if (razorpayOrder.status !== 'paid') {
            await razorpay.orders.edit(razorpayOrderId, {
              status: 'cancelled'
            });
            console.log('[Debug] Razorpay order cancelled successfully:', razorpayOrderId);
          }
        }
      } catch (razorpayError) {
        console.error('[Debug] Error cancelling Razorpay order:', razorpayError);
        // We continue even if Razorpay cancellation fails
      }

      // Keep the order data in session for retry
      req.session.pendingOrder = {
        ...orderData,
        orderID: order.orderID, // Use the saved order ID
        razorpayOrderId: razorpayOrderId || orderData.razorpayOrderId
      };

      await new Promise((resolve) => req.session.save(resolve));
      console.log('[Debug] Updated session with order data:', req.session.pendingOrder);

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        orderId: order.orderID
      });
    } else {
      console.error('[Debug] No order data found for cancellation');
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
  } catch (error) {
    console.error('[Debug] Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
};

// Helper function for cleanup tasks
async function handleOrderCleanup(userId, session) {
  // Restore product stock
  if (session?.pendingOrder?.items) {
    for (const item of session.pendingOrder.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const sizeObj = product.sizes.find(s => Number(s.size) === Number(item.size));
        if (sizeObj) {
          sizeObj.quantity += item.quantity;
          await product.save();
          console.log(`Restored stock for product ${product._id} size ${item.size}: +${item.quantity}`);
        }
      }
    }
  }

  // Clear the cart
  const cart = await Cart.findOne({ user: userId });
  if (cart) {
    cart.items = [];
    cart.subtotal = 0;
    await cart.save();
    console.log('Cleared cart for user:', userId);
  }

  // Clear the pending order from session
  if (session && session.pendingOrder) {
    session.pendingOrder = null;
    await new Promise((resolve, reject) => {
      session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          reject(err);
        } else {
          console.log('Cleared pending order from session');
          resolve();
        }
      });
    });
  }
}

// Handle order success page
export const getOrderSuccess = async (req, res) => {
  try {
    // Try to find by _id first, then by orderID if not found
    let order = await Order.findById(req.params.id);
    if (!order) {
      order = await Order.findOne({ orderID: req.params.id });
    }
    
    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/profile/orders');
    }

    res.render('user/order-success', {
      order: {
        orderID: order.orderID,
        createdAt: order.createdAt,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    req.flash('error', 'Failed to load order details');
    res.redirect('/profile/orders');
  }
};

// Handle order failure page
export const getOrderFailure = async (req, res) => {
  try {
    console.log('Looking up failed order with ID:', req.params.id);
    
    let order;
    const error = req.query.error;
    
    // First try to find by orderID (string)
    order = await Order.findOne({ orderID: req.params.id });
    
    // If not found by orderID, try _id as fallback (if it's a valid ObjectId)
    if (!order && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(req.params.id);
    }

    // If still no order found but we have an error message, show the error
    // This handles cases where the order creation failed but we still want to show an error
    if (!order && error) {
      console.log('Order not found but error present:', error);
      return res.render('user/order-failed', {
        orderId: req.params.id,
        error: error
      });
    }

    // If no order and no error, show generic message
    if (!order) {
      console.log('Order not found and no error message:', req.params.id);
      return res.render('user/order-failed', {
        orderId: req.params.id,
        error: 'Order not found or has been removed'
      });
    }

    console.log('Found failed order:', {
      orderID: order.orderID,
      status: order.status,
      paymentStatus: order.paymentStatus,
      cancelReason: order.cancelReason
    });

    // Use error message in this priority: query param > order.cancelReason > default message
    const displayError = error || order.cancelReason || 'An error occurred while processing your order';

    res.render('user/order-failed', {
      orderId: order.orderID || req.params.id, // Fallback to passed ID if no order
      error: displayError
    });
  } catch (error) {
    console.error('Error fetching failed order:', error);
    res.render('user/order-failed', {
      orderId: req.params.id,
      error: 'Failed to load order details'
    });
  }
};

// Create Razorpay order
const createOrder = async (req, res) => {
  try {
    const { addressId } = req.body;
    const userId = req.session.user._id;

    // Get checkout data from session
    const checkoutData = req.session.checkoutData;
    if (!checkoutData) {
      return res.status(400).json({
        success: false,
        message: 'Checkout data not found. Please try again.'
      });
    }

    // Verify the amounts
    const originalAmount = checkoutData.originalSubtotal;
    const discountAmount = checkoutData.totalDiscount;
    const finalAmount = originalAmount - discountAmount;

    // Double check that the amounts match
    if (finalAmount !== checkoutData.finalAmount) {
      console.error('Amount mismatch:', {
        calculated: finalAmount,
        stored: checkoutData.finalAmount
      });
      return res.status(400).json({
        success: false,
        message: 'Amount verification failed'
      });
    }

    // Create unique order ID
    const orderID = `ORD-${Date.now()}-${nanoid(6)}`;
    
    // Convert final amount to paise
    const amountInPaise = Math.round(finalAmount * 100);

    console.log('Creating Razorpay order:', {
      originalAmount,
      discountAmount,
      finalAmount,
      amountInPaise
    });

    // Create Razorpay order with the discounted amount
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: orderID,
      payment_capture: 1,
      notes: {
        originalAmount,
        discountAmount,
        finalAmount
      }
    });

    // Store complete order data in session
    req.session.pendingOrder = {
      orderID,
      razorpayOrderId: razorpayOrder.id,
      totalAmount: finalAmount,
      originalAmount,
      discountAmount,
      items: checkoutData.items,
      shippingAddress: await Address.findById(addressId),
      userId
    };

    // Save session explicitly
    await new Promise(resolve => req.session.save(resolve));

    // Log the final data being sent
    console.log('Order created with amounts:', {
      originalAmount,
      discountAmount,
      finalAmount,
      amountInPaise,
      razorpayOrderId: razorpayOrder.id
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      orderID,
      summary: {
        original: originalAmount,
        discount: discountAmount,
        final: finalAmount
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    });
  }
};

export {
  signUpPage,
  getLogin,
  getForgotPassword,
  postSignup,
  verifyOTP,
  resendOTP,
  postLogin,
  postForgotPassword,
  resetPassword,
  liveSearch,
  getCart,
  getProfile,
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
  requestReturn,
  updateProfile,
  sendProfileOTP,
  verifyProfileOTP,
  getProfileData,
  createOrder
};

