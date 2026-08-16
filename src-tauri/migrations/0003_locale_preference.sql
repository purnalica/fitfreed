CREATE TABLE locale_preference (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    locale TEXT NOT NULL CHECK (locale IN ('en-US', 'es-ES')),
    updated_at_utc TEXT NOT NULL
);
