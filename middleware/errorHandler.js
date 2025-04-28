// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // Handle API errors (like fetch errors)
  if (err.name === 'FetchError') {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable'
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'development' 
    ? err.message 
    : 'An unexpected error occurred';

  // Check if the request expects JSON
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // For non-JSON requests, render error page
  res.status(statusCode).render('error', {
    title: 'Error',
    message,
    statusCode,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Custom error class for API errors
export class APIError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

// Custom error class for validation errors
export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// Custom error class for authentication errors
export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

// Custom error class for authorization errors
export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

// Custom error class for not found errors
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
} 