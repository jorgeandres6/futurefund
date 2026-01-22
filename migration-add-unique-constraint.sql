-- Migration: Add unique constraint to funds table for UPSERT operations
-- This allows external applications to update application_status without conflicts

-- Add unique constraint on user_id and nombre_fondo
-- This prevents duplicate funds for the same user and enables UPSERT
ALTER TABLE funds 
ADD CONSTRAINT funds_user_fund_unique 
UNIQUE (user_id, nombre_fondo);

-- Create index for better performance on this constraint
CREATE INDEX IF NOT EXISTS idx_funds_user_nombre 
ON funds(user_id, nombre_fondo);
