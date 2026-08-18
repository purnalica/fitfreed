ALTER TABLE locale_preference RENAME TO application_preference;

ALTER TABLE application_preference
ADD COLUMN preference_version INTEGER NOT NULL DEFAULT 1
CHECK (preference_version = 1);

ALTER TABLE application_preference
ADD COLUMN appearance TEXT NOT NULL DEFAULT 'system'
CHECK (appearance IN ('system', 'light', 'dark'));

ALTER TABLE application_preference
ADD COLUMN content_zoom_percent INTEGER NOT NULL DEFAULT 100
CHECK (content_zoom_percent BETWEEN 100 AND 200);
