import User from '../models/userModel.js';

// Comprehensive session checking middleware
export const sessionCheck = async (req, res, next) => {
  // Add debug logging
  console.log('Session Check - Current session:', {
    hasSession: !!req.session,
    userData: req.user || req.session?.user,
    path: req.path
  });

  // Set strong cache control headers for all responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', '*');
  
  // Skip session check for admin routes - let admin middleware handle these
  if (req.path.startsWith('/admin')) {
    return next();
  }
  
  // Skip session check for OTP verification routes
  if (req.path === '/verify-otp' || req.path === '/resend-otp') {
    return next();
  }
  
  // For public routes (login, signup), redirect if already logged in
  if (req.path === '/login' || req.path === '/signup') {
    if (req.user || req.session?.user) {
      console.log('Redirecting logged in user from public route to home');
      return res.redirect('/home');
    }
    return next();
  }

  // For protected routes, check user session (Passport sets req.user)
  if (!req.user && !req.session?.user) {
    console.log('No user session found, redirecting to login');
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }

  next();
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
  if (req.user || req.session?.user) {
    return res.redirect('/home');
  }
  next();
};

export const isAuthenticated = (req, res, next) => {
  if (req.user || (req.session && req.session.user)) {
    return next();
  }
  res.redirect('/login');
}; 