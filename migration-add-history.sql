-- Migration: Add history column to funds table
-- Description: Adds a JSONB column to store communication history and interactions
-- Date: 2026-02-11

-- Add history column to funds table
ALTER TABLE funds 
ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;

-- Add comment to the column
COMMENT ON COLUMN funds.history IS 'History of communications, emails, forms, and interactions with the fund';

-- Create an index on the history column for better query performance
CREATE INDEX IF NOT EXISTS idx_funds_history ON funds USING GIN (history);

-- Example of history entry structure:
-- {
--   "type": "email_sent" | "email_received" | "form_filled" | "note" | "call" | "meeting",
--   "date": "2026-02-11T10:30:00Z",
--   "description": "Email sent to fund manager",
--   "details": {
--     "from": "user@example.com",
--     "to": "fund@example.com",
--     "subject": "Application inquiry",
--     "body": "Email content...",
--     "notes": "Additional notes..."
--   }
-- }
