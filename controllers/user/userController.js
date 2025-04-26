import bcrypt from 'bcrypt';
import User from '../../models/userModel.js';
import { sendOTPEmail, generateOTP } from '../../utils/otp.js';
import Product from '../../models/ProductModel.js';

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
const getCart = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('user/cart', {
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error')
  });
};

// Get wishlist page
const getWishlist = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('user/wishlist', {
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error')
  });
};

// Get profile page
const getProfile = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('user/profile', {
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error')
  });
};

// Get orders page
const getOrders = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('user/orders', {
    user: req.session.user,
    success: req.flash('success'),
    error: req.flash('error')
  });
};

// Get order details page
const getOrderDetails = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('user/order-details', {
    user: req.session.user,
    orderId: req.params.id,
    success: req.flash('success'),
    error: req.flash('error')
  });
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
  getOrderDetails
};

