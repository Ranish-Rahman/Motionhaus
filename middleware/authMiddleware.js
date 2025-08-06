import User from '../models/userModel.js';

// Middleware to check if user is authenticated
export const isAuthenticated = async (req, res, next) => {
  try {
    // Passport-compliant check
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      // Optionally, check if user is blocked
      if (req.user.isBlocked) {
        req.logout(() => {});
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
    // Fallback for legacy session-based users
    const sessionUser = req.session.user || req.session.userData;
    if (sessionUser && (sessionUser._id || sessionUser.id)) {
      // Optionally, check if user is blocked
      const user = await User.findById(sessionUser._id || sessionUser.id);
      if (user && user.isBlocked) {
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
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('/login');
  }
};


// Middleware to check if user is not authenticated
export const isNotAuthenticated = (req, res, next) => {
  const sessionUser = req.session.userData || req.session.user;
  if (!sessionUser || !(sessionUser._id || sessionUser.id)) {
    return next(); // user is NOT logged in
  }
  res.redirect('/home'); // user IS logged in
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Passport-compliant check
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  // Fallback for legacy session-based users
  const sessionUser = req.session.user || req.session.userData;
  if (sessionUser && (sessionUser._id || sessionUser.id)) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
  });
  res.clearCookie('connect.sid', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  return res.redirect('/login');
};

function noCache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

function sessionCheck(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  const sessionUser = req.session.user || req.session.userData;
  if (sessionUser && (sessionUser._id || sessionUser.id)) {
    return next();
  }
  res.redirect('/login');
}

function redirectIfLoggedIn(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return res.redirect('/home');
  }
  const sessionUser = req.session.user || req.session.userData;
  if (sessionUser && (sessionUser._id || sessionUser.id)) {
    return res.redirect('/home');
  }
  next();
}

export { sessionCheck, noCache, redirectIfLoggedIn }; 