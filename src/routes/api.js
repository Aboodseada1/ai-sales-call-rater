const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateApiKey, validateAdminKey } = require('../middleware/auth');
const { 
  rateAudio, 
  getRatings, 
  getRatingById, 
  deleteRating, 
  getStats,
  cleanupOldRatings,
  getStorageStats,
  upload 
} = require('../controllers/ratingController');

const router = express.Router();

// Rate limiter for POST /api/v1/rate
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per window
  message: {
    success: false,
    error: 'Too many rating requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// All API routes require API key
router.use(validateApiKey);

// POST /api/v1/rate - Upload and rate audio
router.post('/rate', rateLimiter, upload.single('audio'), rateAudio);

// GET /api/v1/stats - Get statistics
router.get('/stats', getStats);

// GET /api/v1/storage - Get storage statistics
router.get('/storage', getStorageStats);

// GET /api/v1/ratings - List ratings
router.get('/ratings', getRatings);

// DELETE /api/v1/ratings/cleanup - Clean up old ratings (MUST be before /:id)
router.delete('/ratings/cleanup', cleanupOldRatings);

// GET /api/v1/ratings/:id - Get single rating
router.get('/ratings/:id', getRatingById);

// DELETE /api/v1/ratings/:id - Delete rating
router.delete('/ratings/:id', deleteRating);

module.exports = router;
