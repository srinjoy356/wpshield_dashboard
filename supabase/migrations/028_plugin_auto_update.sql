-- Add auto_update_plugins to companies
ALTER TABLE companies
ADD COLUMN auto_update_plugins BOOLEAN DEFAULT FALSE;
