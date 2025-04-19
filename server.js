// Import modules
import express from 'express';
import session from 'express-session';
import nocache from 'nocache';
import connectDB from './models/mongodb.js';
import passport from './config/passport.js';
import flash from 'connect-flash';
import { isAuthenticated, isNotAuthenticated } from './middleware/authMiddleware.js';
import cors from 'cors';

// Import routes
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';

const app = express();
connectDB();

// View engine and static setup
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Middleware
app.use(nocache());
app.use(cors({
  origin: 'http://localhost:2002',
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretcode',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Flash middleware
app.use(flash());

// Global variables for flash messages
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// // Public/User Routes
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', productRoutes);

// Admin-only routes
app.use('/admin', adminRoutes);
app.use('/admin', categoryRoutes);

// Logout route
app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).json({ success: false, message: 'Error logging out' });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ success: false, message: 'Error logging out' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

// Google OAuth callback error handling
app.use((err, req, res, next) => {
  if (err.name === 'AuthenticationError') {
    console.error('Authentication Error:', err);
    return res.redirect('/login');
  }
  next(err);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Server start
const PORT = process.env.PORT || 2002;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
