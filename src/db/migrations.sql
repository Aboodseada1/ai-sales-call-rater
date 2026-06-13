-- Create the database if it doesn't exist (run this manually if needed)
-- CREATE DATABASE ratingdb;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_original_name VARCHAR(255) NOT NULL,
    audio_path VARCHAR(500) NOT NULL,
    audio_format VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    overall_score DECIMAL(3,1),
    transcription TEXT,
    criteria JSONB,
    summary TEXT,
    strengths JSONB,
    weaknesses JSONB,
    recommendation VARCHAR(50),
    model_used VARCHAR(100),
    rating_raw TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ratings_status ON ratings(status);
CREATE INDEX IF NOT EXISTS idx_ratings_recommendation ON ratings(recommendation);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at DESC);

-- Create a simplified view for dashboard stats
CREATE OR REPLACE VIEW rating_stats AS
SELECT 
    COUNT(*) as total,
    ROUND(AVG(overall_score)::numeric, 2) as avg_score,
    COUNT(*) FILTER (WHERE recommendation = 'Highly Recommended') as highly_recommended,
    COUNT(*) FILTER (WHERE recommendation = 'Recommended') as recommended,
    COUNT(*) FILTER (WHERE recommendation = 'Neutral') as neutral,
    COUNT(*) FILTER (WHERE recommendation = 'Not Recommended') as not_recommended,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'rated') as rated_count,
    COUNT(*) FILTER (WHERE status = 'rating_failed') as failed_count
FROM ratings;
