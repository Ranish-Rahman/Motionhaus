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
  if (req.session.admin) {
    return next();
  }
  res.redirect('/admin/login');
}; 