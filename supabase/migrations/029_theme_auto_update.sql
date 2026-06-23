-- Add auto_update_themes to companies

ALTER TABLE companies
ADD COLUMN auto_update_themes BOOLEAN DEFAULT FALSE;
