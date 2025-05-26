// Import modules
import express from 'express';
import session from 'express-session';
import nocache from 'nocache';
import connectDB from './models/mongodb.js';
import passport from './config/passport.js';
import flash from 'connect-flash';
import { isAuthenticated, isNotAuthenticated } from './middleware/authMiddleware.js';
import cors from 'cors';
import MongoStore from 'connect-mongo';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/admin/adminRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';

// Suppress deprecation warnings
process.removeAllListeners('warning');

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(nocache());
app.use(flash());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretcode',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 24 hours
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  },
  name: 'sessionId',
  rolling: true
}));

// Add no-cache middleware for all routes
app.use(nocache());

// Add security headers middleware
app.use((req, res, next) => {
  // Prevent caching of all responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', '*');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
});

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Set view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Static files
app.use(express.static('public'));

// 1. Auth routes (login, signup) - no session required
app.use('/', authRoutes);

// 2. User routes - mount at root for non-profile routes
app.use('/', userRoutes);

// 3. Admin routes
app.use('/admin', adminRoutes);

// 4. Category routes
app.use('/categories', categoryRoutes);

// 5. Product routes
app.use('/products', productRoutes);

// 6. Wishlist routes
app.use('/wishlist', wishlistRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: '404 Not Found',
    message: 'The page you are looking for does not exist.',
    statusCode: 404
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 2002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
