import express from 'express';
import passport from 'passport';
import { isAuthenticated, isNotAuthenticated } from '../middleware/authMiddleware.js';
import { sessionCheck } from '../middleware/sessionMiddleware.js';
import User from '../models/userModel.js';

const router = express.Router();

// Auth status route - must be defined before other routes
router.get('/auth/status', (req, res) => {
  console.log('Session Check - Current session:', {
    hasSession: !!req.session,
    userData: req.user || req.session?.user,
    path: req.path
  });

  res.json({
    authenticated: !!(req.user || req.session?.user),
    user: req.user || req.session?.user || null
  });
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
  passport.authenticate('google', {
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    const returnTo = req.session.returnTo || '/home';
    delete req.session.returnTo;
    res.redirect(returnTo);
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
