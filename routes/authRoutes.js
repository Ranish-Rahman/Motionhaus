import express from 'express';
import passport from 'passport';
import { isAuthenticated, isNotAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Auth status route - must be defined before other routes
router.get('/auth/status', (req, res) => {
  try {
    console.log('Auth status check - Session:', req.session);
    console.log('Auth status check - User:', req.user);
    res.json({ 
      isAuthenticated: req.isAuthenticated(),
      user: req.user ? {
        id: req.user._id,
        email: req.user.email,
        username: req.user.username
      } : null
    });
  } catch (error) {
    console.error('Error in status route:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking authentication status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Google authentication routes
router.get('/auth/google',
  (req, res, next) => {
    console.log('Initiating Google OAuth');
    // Store the original URL and signup flag in the session
    req.session.returnTo = req.query.returnTo || '/home';
    req.session.isSignup = req.query.signup === 'true';
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account',
    failureFlash: true
  })
);

// Google callback route
router.get('/auth/google/callback',
  (req, res, next) => {
    console.log('Google OAuth callback received');
    console.log('Query params:', req.query);
    console.log('Session:', req.session);
    next();
  },
  (req, res, next) => {
    passport.authenticate('google', { 
      failureRedirect: '/login',
      failureFlash: true
    }, (err, user, info) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.redirect('/login?error=auth_failed');
      }
      
      // If this is a signup flow and user exists, redirect to signup with error
      if (req.session.isSignup && user) {
        console.log('User already exists during signup');
        return res.redirect('/signup?error=user_exists');
      }
      
      // If this is a login flow and no user exists, redirect to signup
      if (!req.session.isSignup && !user) {
        console.log('No user found during login');
        return res.redirect('/signup?error=no_user');
      }
      
      // Set user in session
      req.session.user = {
        id: user._id,
        username: user.username,
        email: user.email
      };
      
      // Update last login time
      user.lastLogin = new Date();
      user.save();
      
      console.log('User logged in successfully:', user.email);
      const returnTo = req.session.returnTo || '/home';
      delete req.session.returnTo;
      delete req.session.isSignup;
      
      // Save session and redirect
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          return res.redirect('/login?error=session_error');
        }
        return res.redirect(returnTo);
      });
    })(req, res, next);
  }
);

// Error handling middleware for auth routes
router.use((err, req, res, next) => {
  console.error('Auth route error:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    session: req.session
  });
  
  // Send error response
  res.status(500).json({
    success: false,
    message: 'Authentication error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Logout route
router.post('/logout', (req, res) => {
  console.log('Logout initiated');
  console.log('Session before logout:', req.session);
  
  // Clear any existing session data
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ success: false, message: 'Error logging out' });
    }
    
    // Clear the session cookie
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    console.log('Session destroyed successfully');
    res.json({ success: true });
  });
});

export default router;
