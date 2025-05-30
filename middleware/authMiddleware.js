import User from '../models/userModel.js';

// Middleware to check if user is authenticated
export const isAuthenticated = async (req, res, next) => {
  try {
    if (req.session.user) {
      // Check if user is blocked
      const user = await User.findById(req.session.user._id);
      if (user && user.isBlocked) {
        // Destroy the session and clear cookies
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
          res.clearCookie('connect.sid');
          req.flash('error', 'Your account has been blocked. Please contact support for assistance.');
          return res.redirect('/login');
        });
        return;
      }
      return next();
    }
    // Store the original URL for redirection after login
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('/login');
  }
};

// Middleware to check if user is not authenticated
export const isNotAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/home');
};

// Middleware to check if user is admin
export const isAdmin = (req, res, next) => {
  // Skip check for admin login page and logout
  if (req.path === '/admin/login' || req.path === '/admin/logout') {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    return next();
  }

  if (req.session.admin) {
    // Add admin data to locals for views
    res.locals.admin = req.session.admin;
    return next();
  }

  // For API requests
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Admin session expired' 
    });
  }

  // Store return URL and redirect to login
  req.session.returnTo = req.originalUrl;
  res.redirect('/admin/login');
};

// Authentication middleware
export const requireAuth = (req, res, next) => {
  // Set cache control headers for all responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  if (!req.session.user) {
    // Store the original URL to redirect after login
    req.session.returnTo = req.originalUrl;
    
    // Clear any existing session data
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
    });
    
    // Clear session cookie
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    return res.redirect('/login');
  }
  
  next();
};

function noCache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

function sessionCheck(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/home');
  }
  next();
}

export { sessionCheck, noCache, redirectIfLoggedIn }; 