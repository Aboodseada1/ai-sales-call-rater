const pool = require('../db/pool');
const { upload, deleteAudioFile, getFileInfo } = require('../services/audioService');
const { rateAudioWithRetry, cleanupOldFiles, getUploadDirSize } = require('../services/aiService');

/**
 * POST /api/v1/rate
 * Upload audio file and rate it
 */
async function rateAudio(req, res) {
  const startTime = Date.now();
  let recordId = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    const fileInfo = getFileInfo(req.file);
    
    // Create initial record in database
    const insertResult = await pool.query(
      `INSERT INTO ratings (audio_original_name, audio_path, audio_format, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [fileInfo.originalName, fileInfo.path, fileInfo.format]
    );
    
    recordId = insertResult.rows[0].id;
    console.log(`[${new Date().toISOString()}] Created rating record: ${recordId}`);
    
    // Rate audio with AI (Gemini processes audio directly)
    const ratingResult = await rateAudioWithRetry(fileInfo.path, fileInfo.format);
    
    const elapsed = Date.now() - startTime;
    
    if (ratingResult.success) {
      const rating = ratingResult.rating;
      
      await pool.query(
        `UPDATE ratings SET 
          status = 'rated',
          overall_score = $1,
          transcription = $2,
          criteria = $3,
          summary = $4,
          strengths = $5,
          weaknesses = $6,
          recommendation = $7,
          model_used = $8,
          rating_raw = $9
         WHERE id = $10`,
        [
          rating.overall_score,
          rating.transcription || '',
          JSON.stringify(rating.criteria),
          rating.summary,
          JSON.stringify(rating.strengths),
          JSON.stringify(rating.weaknesses),
          rating.recommendation,
          ratingResult.model,
          rating.raw,
          recordId
        ]
      );
      
      // Fetch complete record
      const result = await pool.query('SELECT * FROM ratings WHERE id = $1', [recordId]);
      
      console.log(`[${new Date().toISOString()}] Rating completed: ${recordId} - Score: ${rating.overall_score} - ${elapsed}ms`);
      
      return res.json({
        success: true,
        data: result.rows[0]
      });
    } else {
      // Rating failed
      await pool.query(
        `UPDATE ratings SET status = 'rating_failed', rating_raw = $1 WHERE id = $2`,
        [ratingResult.error, recordId]
      );
      
      console.error(`[${new Date().toISOString()}] Rating failed: ${recordId} - ${ratingResult.error}`);
      
      return res.status(500).json({
        success: false,
        error: ratingResult.error || 'Failed to rate audio',
        id: recordId
      });
    }
  } catch (error) {
    console.error('Rate audio error:', error);
    
    // Update record as failed if we have an ID
    if (recordId) {
      await pool.query(
        `UPDATE ratings SET status = 'rating_failed', rating_raw = $1 WHERE id = $2`,
        [error.message, recordId]
      );
    }
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/v1/ratings
 * List all ratings with optional filters
 */
async function getRatings(req, res) {
  try {
    const { status, min_score, recommendation, limit = 20, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM ratings WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (min_score) {
      query += ` AND overall_score >= $${paramIndex++}`;
      params.push(parseFloat(min_score));
    }
    
    if (recommendation) {
      query += ` AND recommendation = $${paramIndex++}`;
      params.push(recommendation);
    }
    
    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Add pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        results: result.rows
      }
    });
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/v1/ratings/:id
 * Get single rating by ID
 */
async function getRatingById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM ratings WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rating not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get rating error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * DELETE /api/v1/ratings/:id
 * Delete a rating and its audio file
 */
async function deleteRating(req, res) {
  try {
    const { id } = req.params;
    
    // Get the record first
    const result = await pool.query('SELECT * FROM ratings WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rating not found'
      });
    }
    
    const rating = result.rows[0];
    
    // Delete audio file from disk
    if (rating.audio_path) {
      await deleteAudioFile(rating.audio_path);
    }
    
    // Delete from database
    await pool.query('DELETE FROM ratings WHERE id = $1', [id]);
    
    res.json({
      success: true,
      data: { message: 'Rating deleted successfully' }
    });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/v1/stats
 * Get aggregate statistics
 */
async function getStats(req, res) {
  try {
    const result = await pool.query('SELECT * FROM rating_stats');
    
    const stats = result.rows[0];
    
    res.json({
      success: true,
      data: {
        total: parseInt(stats.total) || 0,
        avg_score: parseFloat(stats.avg_score) || 0,
        by_recommendation: {
          highly_recommended: parseInt(stats.highly_recommended) || 0,
          recommended: parseInt(stats.recommended) || 0,
          neutral: parseInt(stats.neutral) || 0,
          not_recommended: parseInt(stats.not_recommended) || 0
        },
        by_status: {
          pending: parseInt(stats.pending_count) || 0,
          rated: parseInt(stats.rated_count) || 0,
          rating_failed: parseInt(stats.failed_count) || 0
        }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * DELETE /api/v1/ratings/cleanup
 * Delete old ratings and audio files (admin only)
 * Query params: days (default: 7)
 */
async function cleanupOldRatings(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Get ratings to delete
    const { rows } = await pool.query(
      'SELECT id, audio_path FROM ratings WHERE created_at < $1',
      [cutoffDate]
    );
    
    let deletedFiles = 0;
    let deletedRecords = 0;
    
    // Delete audio files
    for (const row of rows) {
      if (row.audio_path) {
        const deleted = deleteAudioFile(row.audio_path);
        if (deleted) deletedFiles++;
      }
    }
    
    // Delete database records
    const deleteResult = await pool.query(
      'DELETE FROM ratings WHERE created_at < $1',
      [cutoffDate]
    );
    deletedRecords = deleteResult.rowCount;
    
    console.log(`[Cleanup] Deleted ${deletedRecords} records and ${deletedFiles} files older than ${days} days`);
    
    res.json({
      success: true,
      data: {
        deleted_records: deletedRecords,
        deleted_files: deletedFiles,
        cutoff_date: cutoffDate.toISOString(),
        days_old: days
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/v1/storage
 * Get storage statistics
 */
async function getStorageStats(req, res) {
  try {
    const uploadStats = getUploadDirSize();
    
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM ratings WHERE audio_path IS NOT NULL'
    );
    
    res.json({
      success: true,
      data: {
        uploads: uploadStats,
        ratings_with_audio: parseInt(rows[0].count) || 0
      }
    });
  } catch (error) {
    console.error('Storage stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  rateAudio,
  getRatings,
  getRatingById,
  deleteRating,
  getStats,
  cleanupOldRatings,
  getStorageStats,
  upload
};
