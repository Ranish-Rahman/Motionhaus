// Render admin login page
import User from '../../models/userModel.js';
import Admin from '../../models/adminModel.js';
import Category from '../../models/categoryModel.js';
import Product from '../../models/ProductModel.js';
import Order from '../../models/Order.js';
import path from 'path';
import Session from '../../models/sessionModel.js';
import mongoose from 'mongoose';

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
      return res.redirect('/admin/dashboard');
    }
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

    const products = await Product.find({ isDeleted: false })
      .populate('category')
      .sort({ createdAt: -1 });

    res.render('admin/products', {
      title: 'Products',
      products,
      admin: req.session.admin,
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

// Get orders page
export const getOrders = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    const orders = await Order.find()
      .populate('user')
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.render('admin/orders', {
      title: 'Orders',
      orders,
      admin: req.session.admin,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load orders'
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