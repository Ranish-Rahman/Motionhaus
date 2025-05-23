import User from '../models/userModel.js';

// Comprehensive session checking middleware
export const sessionCheck = async (req, res, next) => {
  // Add debug logging
  console.log('Session Check - Current session:', {
    hasSession: !!req.session,
    userData: req.session?.user,
    path: req.path
  });

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
    if (req.session?.user) {
      console.log('Redirecting logged in user from public route to home');
      // Use 303 redirect to prevent caching
      return res.redirect(303, '/home');
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
    if (!req.session?.admin) {
      console.log('No admin session found, redirecting to admin login');
      req.session.returnTo = req.originalUrl;
      return res.redirect(303, '/admin/login');
    }
    return next();
  }

  // Special handling for product detail routes
  if (req.path.match(/^\/products?\/[a-zA-Z0-9]+$/)) {
    if (!req.session?.user) {
      console.log('No user session found for product route, redirecting to login');
      handleSessionCleanup(req, res, req.originalUrl);
      return;
    }
  }

  // For protected user routes
  if (!req.session?.user) {
    console.log('No user session found for protected route, redirecting to login');
    handleSessionCleanup(req, res, req.originalUrl);
    return;
  }

  // Verify user exists and is not blocked
  try {
    // Safely access user ID - check for both id and _id
    const userId = req.session?.user?.id || req.session?.user?._id;
    if (!userId) {
      console.log('Invalid user ID in session:', req.session?.user);
      handleSessionCleanup(req, res, req.originalUrl);
      return;
    }

    const user = await User.findById(userId);
    if (!user || user.isBlocked) {
      console.log('User not found or blocked, clearing session');
      handleSessionCleanup(req, res, req.originalUrl);
      return;
    }

    // Update session with fresh user data - ensure consistent ID field
    req.session.user = {
      id: user._id.toString(), // Store as id for consistency
      _id: user._id.toString(), // Keep _id for backward compatibility
      name: user.name,
      email: user.email,
      username: user.username
    };
    
    // Add user data to response locals for EJS templates
    res.locals.user = req.session.user;
    console.log('Session validated successfully for user:', user.email);
    next();
  } catch (error) {
    console.error('Error checking user status:', error);
    handleSessionCleanup(req, res, req.originalUrl);
    return;
  }
};

// Helper function to handle session cleanup and redirect
const handleSessionCleanup = (req, res, returnTo) => {
  // Clear session cookie with all necessary options
  res.clearCookie('sessionId', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0
  });
  
  // Clear session data
  if (req.session) {
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
  } else {
    // If no session exists, just redirect
    res.writeHead(303, {
      'Location': `/login?returnTo=${encodeURIComponent(returnTo)}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end();
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