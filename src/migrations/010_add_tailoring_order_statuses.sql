-- Add tailoring-specific production statuses used by the mobile app.
-- Safe to run more than once.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cutting';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'stitching';
