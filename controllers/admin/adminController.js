// Render admin login page
import User from '../../models/userModel.js';
import Admin from '../../models/adminModel.js';
import Category from '../../models/categoryModel.js';
import Product from '../../models/ProductModel.js'; 
import path from 'path';
import Session from '../../models/sessionModel.js';
import mongoose from 'mongoose';
import Order from '../../models/orderModel.js';
import WalletTransaction from '../../models/walletTransactionModel.js';

export const getAdminLogin = (req, res) => {
  console.log('Admin login page requested');
  if (req.session.admin) {
    console.log('Admin already logged in, redirecting to dashboard');
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { 
    title: 'Admin Login',
    error: null 
  });
};

// Handle admin login
export const postAdminLogin = async (req, res) => {
  console.log('Login request received:', {
    body: req.body,
    headers: req.headers,
    session: req.session
  });

  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Get admin credentials from environment variables
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      console.log('Admin credentials verified');
      
      // Create admin session
      req.session.admin = {
        email: email,
        loggedIn: true,
        role: 'admin'
      };

      console.log('Admin session created:', req.session.admin);
      
      return res.json({ 
        success: true, 
        redirect: '/admin/dashboard' 
      });
    }

    console.log('Invalid credentials provided');
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid email or password' 
    });

  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred during login. Please try again.' 
    });
  }
};

// Render admin dashboard
export const customers = async (req, res) => {
  console.log('Admin dashboard requested');
  console.log('Session data:', req.session);
  console.log('Request headers:', req.headers);
  console.log('Request cookies:', req.cookies);

  try {
    // Check if admin is logged in
    if (!req.session.admin) {
      console.log('No admin session found, redirecting to login');
      return res.redirect('/admin/login');
    }

    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    } : {};

    // Fetch users with pagination, sorting, and search
    let users;
    try {
      console.log('Attempting to fetch users from database');
      const totalUsers = await User.countDocuments(searchQuery);
      users = await User.find(searchQuery, 'name email role status isBlocked createdAt')
        .sort({ createdAt: -1 }) // Sort by latest first
        .skip(skip)
        .limit(limit);
      
      console.log('Users fetched successfully:', users.length);
      
      // Update user status based on isBlocked
      users = users.map(user => ({
        ...user.toObject(),
        status: user.isBlocked ? 'blocked' : 'active'
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(totalUsers / limit);
      const pagination = {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      };
      
      // Render dashboard with proper data
      console.log('Rendering dashboard with users:', users.length);
      res.render('admin/customers', {
        title: 'Customers',
        users: users || [],
        admin: req.session.admin,
        path: req.path,
        pagination,
        search,
        totalUsers
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      console.error('Error details:', {
        name: dbError.name,
        message: dbError.message,
        stack: dbError.stack
      });
      return res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to fetch users from database'
      });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load dashboard'
    });
  }
};

// Handle admin logout
export const handleLogout = (req, res) => {
  console.log('Admin logout requested');
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      // Only send one response!
      return res.status(500).send('Logout failed');
    }
    res.clearCookie('sessionId'); // Adjust if your session cookie name is different
    console.log('Admin session destroyed');
    res.redirect('/admin/login');
  });
};

// Block a user
export const blockUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`Attempting to block user: ${userId}`);
    
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Update user status
    user.isBlocked = true;
    user.status = 'blocked';
    await user.save();
    console.log('User status updated to blocked');
    
    // Get sessions collection
    const sessionsCollection = mongoose.connection.collection('sessions');
    console.log('Accessing sessions collection');
    
    // Find all sessions
    const sessions = await sessionsCollection.find({}).toArray();
    console.log(`Found ${sessions.length} total sessions`);
    
    let deletedCount = 0;
    for (const session of sessions) {
      try {
        const sessionData = JSON.parse(session.session);
        console.log('Checking session:', session._id);
        console.log('Session data:', sessionData);
        
        // Check if this session belongs to the blocked user
        const isUserSession = 
          (sessionData.user && (sessionData.user.id === userId || sessionData.user._id === userId)) ||
          (sessionData.passport && sessionData.passport.user === userId);
        
        if (isUserSession) {
          // If it's an admin session with user data, just remove the user data
          if (sessionData.admin) {
            console.log('Found admin session with user data');
            delete sessionData.user;
            await sessionsCollection.updateOne(
              { _id: session._id },
              { $set: { session: JSON.stringify(sessionData) } }
            );
            console.log('Removed user data from admin session');
          } else {
            // If it's a regular user session, delete it
            await sessionsCollection.deleteOne({ _id: session._id });
            deletedCount++;
            console.log(`Deleted session for user ${userId}`);
          }
        }
      } catch (err) {
        console.error('Error processing session:', err);
        continue;
      }
    }
    
    console.log(`Processed sessions. Deleted: ${deletedCount}`);
    
    return res.json({ 
      success: true,
      message: `User blocked successfully. ${deletedCount} session(s) terminated.`
    });
  } catch (error) {
    console.error('Block user error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to block user',
      error: error.message
    });
  }
};

// Unblock a user
export const unblockUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`Attempting to unblock user: ${userId}`);
    
    // Find and update user in a single operation
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          isBlocked: false,
          status: 'active'
        }
      },
      { new: true }
    );

    if (!user) {
      console.log('User not found');
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    console.log('User status updated to active:', {
      userId: user._id,
      isBlocked: user.isBlocked,
      status: user.status
    });
    
    return res.json({ 
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to unblock user',
      error: error.message
    });
  }
};

// Dashboard controller
export const dashboard = async (req, res) => {
  try {
    // Check if admin is logged in
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    // Get statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isBlocked: false });
    const blockedUsers = await User.countDocuments({ isBlocked: true });
    const totalCategories = await Category.countDocuments();

    // Get recent activity (last 5 users)
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5);

    // Format recent activity
    const recentActivity = recentUsers.map(user => ({
      icon: 'person',
      title: `New user registered: ${user.name}`,
      time: new Date(user.createdAt).toLocaleString()
    }));

    // Render dashboard with data
    res.render('admin/dashboard', {
      title: 'Dashboard',
      admin: req.session.admin,
      path: req.path,
      stats: {
        totalUsers,
        activeUsers,
        blockedUsers,
        totalCategories
      },
      recentActivity
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load dashboard'
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Deleting user:', userId);

        // Find and delete the user
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            console.log('User not found:', userId);
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        console.log('User deleted successfully:', user);
        res.json({ 
            success: true, 
            message: 'User deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting user' 
        });
    }
};

// Get categories page
export const getCategories = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const categories = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render('admin/category', {
      title: 'Category Management',
      categories,
      search,
      path: '/admin/categories',
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      },
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error in getCategories:', error);
    res.render('error', { 
      title: 'Error',
      error: 'Failed to load categories'
    });
  }
};

// Get products page
export const getProducts = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    const showDeleted = req.query.showDeleted === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // Build query
    const query = showDeleted ? {} : { isDeleted: false };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Get total count and products
    const [products, total] = await Promise.all([
      Product.find(query)
      .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      startIndex: skip,
      endIndex: Math.min(skip + limit - 1, total - 1),
      totalItems: total
    };

    res.render('admin/products', {
      title: 'Products',
      products,
      admin: req.session.admin,
      path: '/admin/products',
      showDeleted,
      search,
      pagination,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load products'
    });
  }
};

//  orders page with pagination, search, and filtering
export const getOrders = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'newest';

    // Build query
    let query = {};
    if (search) {
      // First try to match the exact order ID
      try {
        const exactMatch = await Order.findById(search);
        if (exactMatch) {
          query = { _id: search };
        } else {
          // If no exact match, use regex search on other fields
          query.$or = [
            { 'user.name': { $regex: new RegExp(search, 'i') } },
            { 'user.email': { $regex: new RegExp(search, 'i') } },
            { 'items.product.name': { $regex: new RegExp(search, 'i') } }
          ];
        }
      } catch (err) {
        // If ID search fails, use regex search
        query.$or = [
          { 'user.name': { $regex: new RegExp(search, 'i') } },
          { 'user.email': { $regex: new RegExp(search, 'i') } },
          { 'items.product.name': { $regex: new RegExp(search, 'i') } }
        ];
      }
    }
    if (status) {
      query.status = status;
    }

    // Build sort
    let sort = {};
    switch(sortBy) {
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'amount_high':
        sort = { totalAmount: -1 };
        break;
      case 'amount_low':
        sort = { totalAmount: 1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Get total count and orders
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone')
        .populate('items.product', 'name')
        .select('+returnRequest')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ]);

    // Log orders with return requests
    console.log('Orders with return requests:', orders.map(order => ({
      orderId: order._id,
      status: order.status,
      returnRequest: order.returnRequest ? {
        status: order.returnRequest.status,
        reason: order.returnRequest.reason,
        requestedAt: order.returnRequest.requestedAt,
        processedAt: order.returnRequest.processedAt
      } : null
    })));

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1
    };

    // Format order dates
    orders.forEach(order => {
      order.formattedDate = new Date(order.orderDate).toLocaleDateString();
    });

    res.render('admin/adminOrders', {
      title: 'Orders',
      admin: req.session.admin,
      orders,
      pagination,
      search,
      status,
      sortBy,
      path: '/admin/orders',
      success: req.flash('success'),
      error: req.flash('error'),
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load orders',
      statusCode: 500
    });
  }
};

// Get single order details
export const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('shippingAddress')
      .populate('items.product', 'name price')
      .select('+returnRequest');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
};

// Process return request
export const processReturn = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { returnReason, returnAmount, refundMethod } = req.body;

    console.log('Processing return request:', { orderId, returnReason, returnAmount, refundMethod });

    const order = await Order.findById(orderId)
      .populate('user');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('Order details:', {
      orderId: order._id,
      totalAmount: order.totalAmount,
      status: order.status,
      returnRequest: order.returnRequest
    });

    // Use order.totalAmount if returnAmount is not provided
    const refundAmount = returnAmount || order.totalAmount || 0;

    // Validate return amount
    if (refundAmount > order.totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Return amount cannot exceed order total'
      });
    }

    // Update order status and payment status
    order.status = 'Returned';
    order.paymentStatus = 'refunded';
    order.cancelReason = returnReason;
    order.cancelledAt = new Date();
    await order.save();

    // Process refund based on method
    if (refundMethod === 'wallet') {
      // Add amount to user's wallet
      const user = await User.findById(order.user._id);
      user.walletBalance = (user.walletBalance || 0) + refundAmount;
      await user.save();
      console.log(`Added ${refundAmount} to user's wallet`);
    } else {
      // Process refund through original payment method
      console.log(`Processing refund of ₹${refundAmount} through original payment method`);
    }

    res.json({
      success: true,
      message: 'Return processed successfully',
      refundAmount
    });
  } catch (error) {
    console.error('Process return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process return'
    });
  }
};

// Get settings page
export const getSettings = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    res.render('admin/settings', {
      title: 'Settings',
      admin: req.session.admin,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load settings'
    });
  }
};

export const getReturnRequests = async (req, res) => {
    try {
        const orders = await Order.find({
            'returnRequest.status': { $ne: null }
        })
        .populate('user', 'name email')
        .sort({ 'returnRequest.requestedAt': -1 });

        res.render('admin/return-requests', { orders });
    } catch (error) {
        console.error('Error fetching return requests:', error);
        res.status(500).json({ success: false, message: 'Error fetching return requests' });
    }
};

export const updateReturnRequest = async (req, res) => {
    try {
        const { requestId, action } = req.params;
        const { response } = req.body;

        console.log('Updating return request:', { requestId, action, response });

        const order = await Order.findById(requestId);
        if (!order) {
            console.log('Order not found:', requestId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        console.log('Current order state:', {
            orderId: order._id,
            status: order.status,
            returnRequest: order.returnRequest
        });

        if (!order.returnRequest || order.returnRequest.status !== 'pending') {
            console.log('Invalid return request state:', order.returnRequest);
            return res.status(400).json({ success: false, message: 'Return request has already been processed' });
        }

        // Update return request
        order.returnRequest.status = action;
        order.returnRequest.adminResponse = response || '';
        order.returnRequest.processedAt = new Date();

        // Update order status based on return request action
        if (action === 'approved') {
            order.status = 'Returned';
            order.paymentStatus = 'refunded';
        } else if (action === 'denied') {
            order.status = 'Delivered';
        }

        // Save the updated order
        await order.save();

        console.log('Updated order state:', {
            orderId: order._id,
            status: order.status,
            returnRequest: order.returnRequest
        });

        // If approved, update user's wallet
        if (action === 'approved') {
            const user = await User.findById(order.user);
            if (user) {
                user.wallet = (user.wallet || 0) + order.totalAmount;
                await user.save();
                console.log(`Updated user wallet: Added ₹${order.totalAmount}`);
            }
        }

        res.status(200).json({ 
            success: true, 
            message: `Return request ${action} successfully`,
            order: {
                status: order.status,
                returnRequest: order.returnRequest
            }
        });
    } catch (error) {
        console.error('Error updating return request:', error);
        res.status(500).json({ success: false, message: 'Error updating return request' });
    }
};

export const processReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, adminResponse } = req.body;
    
    console.log('Processing return request:', { orderId, status, adminResponse });
    
    // First find the order to check its current state
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.returnRequest) {
      return res.status(400).json({ success: false, message: 'No return request found for this order' });
    }

    // Log the order before update
    console.log('Order before update:', {
      orderId: order._id,
      status: order.status,
      returnRequest: order.returnRequest
    });

    // Update the order with the new return request status
    order.returnRequest.status = status;
    order.returnRequest.adminResponse = adminResponse || '';
    order.returnRequest.processedAt = new Date();

    // If approved, update order status to Returned
    if (status === 'approved') {
      order.status = 'Returned';
      order.paymentStatus = 'refunded';
    } else if (status === 'denied') {
      // For denied returns, keep the order as Delivered
      order.status = 'Delivered';
    }
    
    // Save the updated order
    await order.save();

    // Log the updated order
    console.log('Order after update:', {
      orderId: order._id,
      status: order.status,
      returnRequest: {
        status: order.returnRequest.status,
        adminResponse: order.returnRequest.adminResponse,
        processedAt: order.returnRequest.processedAt
      }
    });

    // If approved, update user's wallet
    if (status === 'approved') {
      const user = await User.findById(order.user);
      if (user) {
        user.wallet = (user.wallet || 0) + order.totalAmount;
        await user.save();
        console.log(`Updated user wallet: Added ₹${order.totalAmount}`);
      }
    }
    
    return res.json({ 
      success: true, 
      message: 'Return request processed successfully',
      order: {
        _id: order._id,
        status: order.status,
        returnRequest: order.returnRequest
      }
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Process individual item return
export const processItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { returnAmount, refundMethod, adminResponse } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Find the specific item in the order
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    // Validate return amount
    const itemTotal = item.price * item.quantity;
    if (returnAmount > itemTotal) {
      return res.status(400).json({
        success: false,
        message: 'Return amount cannot exceed item total'
      });
    }

    // Create return request for the item
    item.returnRequest = {
      status: 'pending',
      amount: returnAmount,
      refundMethod,
      adminResponse,
      requestedAt: new Date()
    };

    await order.save();

    res.json({
      success: true,
      message: 'Return request created successfully',
      returnRequest: item.returnRequest
    });
  } catch (error) {
    console.error('Process item return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process item return'
    });
  }
};

// Approve individual item return
export const approveItemReturn = async (req, res) => {
  try {
    console.log('approveItemReturn called with:', {
      orderId: req.params.orderId,
      itemId: req.params.itemId,
      body: req.body
    });

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      console.log('Order not found:', req.params.orderId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.find(item => item._id.toString() === req.params.itemId);
    if (!item) {
      console.log('Item not found:', req.params.itemId);
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const returnRequest = item.returnRequest;
    if (!returnRequest || returnRequest.status !== 'pending') {
      console.log('No pending return request found for item:', req.params.itemId);
      return res.status(400).json({ success: false, message: 'No pending return request found' });
    }

    // Find the product and increment stock
    const product = await Product.findById(item.product);
    if (!product) {
      console.log('Product not found:', item.product);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Convert item.size to number for comparison
    const itemSize = Number(item.size);
    console.log('Looking for size:', itemSize, 'in product sizes:', product.sizes);

    const size = product.sizes.find(s => Number(s.size) === itemSize);
    if (!size) {
      console.log('Size not found:', itemSize);
      return res.status(404).json({ success: false, message: 'Size not found' });
    }

    console.log('Incrementing stock for product:', {
      productId: product._id,
      size: size.size,
      currentQuantity: size.quantity,
      incrementBy: item.quantity
    });

    size.quantity += item.quantity;
    await product.save();

    // Update return request status
    returnRequest.status = 'approved';
    returnRequest.processedAt = new Date();
    returnRequest.processedBy = req.session.admin._id;

    await order.save();
    console.log('Return request approved successfully');

    res.json({ 
      success: true, 
      message: 'Return request approved successfully',
      order: order
    });
  } catch (error) {
    console.error('Error in approveItemReturn:', error);
    res.status(500).json({ success: false, message: 'Error processing return request' });
  }
};

// Deny individual item return
export const denyItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Find the specific item in the order
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    if (!item.returnRequest || item.returnRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending return request found for this item'
      });
    }

    // Update return request status
    item.returnRequest.status = 'denied';
    item.returnRequest.adminResponse = reason;
    item.returnRequest.processedAt = new Date();

    await order.save();

    res.json({
      success: true,
      message: 'Return request denied successfully',
      returnRequest: item.returnRequest
    });
  } catch (error) {
    console.error('Deny item return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deny item return'
    });
  }
};

// Update status of an individual order item
export const updateOrderItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;

    // Log the request body for debugging
    console.log('Request body:', req.body);

    // Validate status field
    const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found' });
    }

    // Prevent status change if item is already cancelled
    if (item.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot change status of a cancelled item' });
    }

    item.status = status;
    await order.save();

    res.json({ success: true, message: 'Item status updated', item });
  } catch (error) {
    console.error('Update item status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update item status' });
  }
};