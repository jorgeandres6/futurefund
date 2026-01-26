-- Migration: Create search_jobs table for background processing
-- This enables n8n automation and 24/7 search execution

-- Create enum for job status
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Create search_jobs table
CREATE TABLE IF NOT EXISTS search_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status job_status DEFAULT 'pending' NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_phase TEXT,
  error_message TEXT,
  funds_found INTEGER DEFAULT 0,
  funds_analyzed INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Configuration
  auto_analyze BOOLEAN DEFAULT false,
  profile_snapshot JSONB, -- Store user profile at time of job creation
  -- Results tracking
  result_summary JSONB -- Store summary of search results
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_search_jobs_user_id ON search_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status);
CREATE INDEX IF NOT EXISTS idx_search_jobs_created_at ON search_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE search_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for search_jobs
CREATE POLICY "Users can view their own jobs"
  ON search_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON search_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON search_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
  ON search_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_search_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_search_jobs_updated_at
  BEFORE UPDATE ON search_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_search_jobs_updated_at();

-- Add webhook_url column for n8n callbacks (optional)
ALTER TABLE search_jobs ADD COLUMN webhook_url TEXT;

-- Comments
COMMENT ON TABLE search_jobs IS 'Tracks background search and analysis jobs for n8n automation';
COMMENT ON COLUMN search_jobs.profile_snapshot IS 'User profile at job creation time for context';
COMMENT ON COLUMN search_jobs.result_summary IS 'JSON summary with phases completed and key metrics';
COMMENT ON COLUMN search_jobs.webhook_url IS 'Optional n8n webhook URL for progress callbacks';
