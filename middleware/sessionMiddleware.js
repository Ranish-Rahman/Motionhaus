import User from '../models/userModel.js';

// Comprehensive session checking middleware
export const sessionCheck = async (req, res, next) => {
  // Set strong cache control headers for all responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', '*');
  
  // Skip session check for OTP verification routes
  if (req.path === '/verify-otp' || req.path === '/resend-otp') {
    return next();
  }
  
  // For public routes (login, signup), redirect if already logged in
  if (req.path === '/login' || req.path === '/signup') {
    if (req.session.user) {
      return res.redirect('/home');
    }
    return next();
  }

  // For admin routes
  if (req.path.startsWith('/admin')) {
    // Allow access to admin login page without admin session
    if (req.path === '/admin/login') {
      return next();
    }

    // Check admin session for other admin routes
    if (!req.session.admin) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/admin/login');
    }
    return next();
  }

  // Special handling for product detail routes
  if (req.path.match(/^\/products?\/[a-zA-Z0-9]+$/)) {
    if (!req.session.user) {
      const returnTo = req.originalUrl;
      
      // Clear session cookie with all necessary options
      res.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0
      });
      
      // Clear any existing session data
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        // Force a hard redirect to prevent browser caching
        res.writeHead(303, {
          'Location': `/login?returnTo=${encodeURIComponent(returnTo)}`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end();
      });
      return;
    }
  }

  // For protected user routes
  if (!req.session.user) {
    const returnTo = req.originalUrl;
    
    // Clear session cookie with all necessary options
    res.clearCookie('sessionId', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0
    });
    
    // Clear any existing session data
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      // Force a hard redirect to prevent browser caching
      res.writeHead(303, {
        'Location': `/login?returnTo=${encodeURIComponent(returnTo)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end();
    });
    return;
  }

  // Verify user exists and is not blocked
  try {
    const user = await User.findById(req.session.user.id);
    if (!user || user.isBlocked) {
      const returnTo = req.originalUrl;
      
      // Clear session cookie
      res.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0
      });
      
      // Clear session data
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        // Force a hard redirect to prevent browser caching
        res.writeHead(303, {
          'Location': `/login?returnTo=${encodeURIComponent(returnTo)}`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end();
      });
      return;
    }

    // Add user data to response locals for EJS templates
    res.locals.user = req.session.user;
    next();
  } catch (error) {
    console.error('Error checking user status:', error);
    const returnTo = req.originalUrl;
    
    // Clear session cookie
    res.clearCookie('sessionId', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0
    });
    
    // Clear session data
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      // Force a hard redirect to prevent browser caching
      res.writeHead(303, {
        'Location': `/login?returnTo=${encodeURIComponent(returnTo)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end();
    });
    return;
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

export const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}; 