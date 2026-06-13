#!/usr/bin/env node
/**
 * RateFlow - Scheduled Cleanup Script
 * Run this via cron to clean up old audio files
 * 
 * Usage:
 *   node scripts/cleanup.js [days]
 * 
 * Example (clean files older than 7 days):
 *   node scripts/cleanup.js 7
 * 
 * Cron example (run daily at 2am):
 *   0 2 * * * cd /var/www/rate.scorpion.codes && node scripts/cleanup.js 7 >> /var/log/rateflow-cleanup.log 2>&1
 */

require('dotenv').config();
const path = require('path');

// Set upload directory
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const pool = require('../src/db/pool');
const { deleteAudioFile } = require('../src/services/audioService');
const { getUploadDirSize } = require('../src/services/aiService');

async function cleanup(days = 7) {
  console.log(`\n========================================`);
  console.log(`RateFlow Cleanup - ${new Date().toISOString()}`);
  console.log(`========================================`);
  console.log(`Cleaning up files older than ${days} days...\n`);
  
  try {
    // Get current storage stats
    const beforeStats = getUploadDirSize();
    console.log(`Before cleanup:`);
    console.log(`  Files: ${beforeStats.files}`);
    console.log(`  Size: ${beforeStats.sizeFormatted}`);
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    console.log(`\nCutoff date: ${cutoffDate.toISOString()}`);
    
    // Get ratings to delete
    const { rows } = await pool.query(
      'SELECT id, audio_path, audio_original_name, created_at FROM ratings WHERE created_at < $1',
      [cutoffDate]
    );
    
    console.log(`\nFound ${rows.length} old ratings to delete`);
    
    let deletedFiles = 0;
    let deletedRecords = 0;
    let errors = 0;
    
    // Delete audio files and records
    for (const row of rows) {
      try {
        if (row.audio_path) {
          const deleted = deleteAudioFile(row.audio_path);
          if (deleted) {
            deletedFiles++;
            console.log(`  Deleted file: ${row.audio_path}`);
          }
        }
      } catch (err) {
        console.error(`  Error deleting file ${row.audio_path}: ${err.message}`);
        errors++;
      }
    }
    
    // Delete database records
    const deleteResult = await pool.query(
      'DELETE FROM ratings WHERE created_at < $1',
      [cutoffDate]
    );
    deletedRecords = deleteResult.rowCount;
    
    // Get final storage stats
    const afterStats = getUploadDirSize();
    
    console.log(`\n----------------------------------------`);
    console.log(`Cleanup Summary:`);
    console.log(`  Records deleted: ${deletedRecords}`);
    console.log(`  Files deleted: ${deletedFiles}`);
    console.log(`  Errors: ${errors}`);
    console.log(`\nAfter cleanup:`);
    console.log(`  Files: ${afterStats.files}`);
    console.log(`  Size: ${afterStats.sizeFormatted}`);
    console.log(`  Space freed: ${formatBytes(beforeStats.size - afterStats.size)}`);
    console.log(`========================================\n`);
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\nCleanup failed:', error.message);
    console.error(error.stack);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get days from command line argument
const days = parseInt(process.argv[2]) || 7;

// Run cleanup
cleanup(days);
