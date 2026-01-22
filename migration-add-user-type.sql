-- Migration: Add user_type column to profiles table
-- Date: 2024
-- Description: Adds user_type field for feature access control (demo, basic, premium)

-- Add user_type column with default value 'demo'
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'demo' 
CHECK (user_type IN ('demo', 'basic', 'premium'));

-- Update existing records to have 'demo' as user_type if NULL
UPDATE profiles 
SET user_type = 'demo' 
WHERE user_type IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN profiles.user_type IS 'User subscription tier: demo (free trial), basic (standard features), premium (full access)';
