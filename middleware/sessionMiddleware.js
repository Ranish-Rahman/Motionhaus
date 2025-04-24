import User from '../models/userModel.js';

// Comprehensive session checking middleware
export const sessionCheck = async (req, res, next) => {
  // Always set these headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // For public routes (login, signup), redirect if already logged in
  if (req.path === '/login' || req.path === '/signup') {
    if (req.session.user) {
      return res.redirect('/home');
    }
    return next();
  }

  // For protected routes, check session
  if (!req.session.user) {
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
    
    // Store the original URL for redirection after login
    req.session.returnTo = req.originalUrl;
    
    return res.redirect('/login');
  }

  // Verify user exists and is not blocked
  try {
    const user = await User.findById(req.session.user.id);
    if (!user || user.isBlocked) {
      // Clear session if user is blocked or not found
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
    }

    // Add user data to response locals for EJS templates
    res.locals.user = req.session.user;
    next();
  } catch (error) {
    console.error('Error checking user status:', error);
    return res.redirect('/login');
  }
};

// Middleware to prevent caching of protected pages
export const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Middleware to check if user is already logged in (for login/signup pages)
export const redirectIfLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/home');
  }
  next();
}; 