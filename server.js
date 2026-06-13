require('dotenv').config();

const express = require('express');
const path = require('path');
const pool = require('./src/db/pool');

// Import routes
const apiRoutes = require('./src/routes/api');
const createPageRoutes = require('./src/routes/pages');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1); // Trust first proxy (for rate limiting behind Nginx)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'src/public')));

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${elapsed}ms)`);
  });
  next();
});

// API Routes
app.use('/api/v1', apiRoutes);

// Page Routes
createPageRoutes(app);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 15MB.'
    });
  }
  
  if (err.message && err.message.includes('Invalid file format')) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('Database connection successful');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Rating page: http://localhost:${PORT}/`);
      console.log(`Dashboard: http://localhost:${PORT}/dashboard?key=${process.env.ADMIN_KEY}`);
      console.log(`API Docs: http://localhost:${PORT}/docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});
