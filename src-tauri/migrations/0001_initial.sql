CREATE TABLE daily_activity (
    origin_id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    step_count INTEGER CHECK (step_count IS NULL OR step_count >= 0),
    provenance_sha256 TEXT NOT NULL CHECK (length(provenance_sha256) = 64),
    PRIMARY KEY (origin_id, local_date)
);

CREATE TABLE activity_conflict (
    id INTEGER PRIMARY KEY,
    origin_id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    existing_step_count INTEGER CHECK (
        existing_step_count IS NULL OR existing_step_count >= 0
    ),
    incoming_step_count INTEGER CHECK (
        incoming_step_count IS NULL OR incoming_step_count >= 0
    ),
    package_sha256 TEXT NOT NULL CHECK (length(package_sha256) = 64)
);

CREATE TABLE import_operation (
    id INTEGER PRIMARY KEY,
    package_sha256 TEXT NOT NULL CHECK (length(package_sha256) = 64),
    completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
    exact_repeat INTEGER NOT NULL CHECK (exact_repeat IN (0, 1)),
    recognized_artifacts INTEGER NOT NULL CHECK (recognized_artifacts >= 0),
    new_observations INTEGER NOT NULL CHECK (new_observations >= 0),
    equivalent_observations INTEGER NOT NULL CHECK (equivalent_observations >= 0),
    enriched_observations INTEGER NOT NULL CHECK (enriched_observations >= 0),
    preserved_observations INTEGER NOT NULL CHECK (preserved_observations >= 0),
    conflicts INTEGER NOT NULL CHECK (conflicts >= 0)
);

CREATE INDEX import_operation_package_sha256
    ON import_operation (package_sha256, completed);
