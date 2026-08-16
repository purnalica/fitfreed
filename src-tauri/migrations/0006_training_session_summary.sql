ALTER TABLE import_operation
ADD COLUMN amended_observations INTEGER NOT NULL DEFAULT 0
CHECK (amended_observations >= 0);

CREATE TABLE training_session (
    origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    session_id TEXT NOT NULL CHECK (length(session_id) > 0),
    source_modified_at_utc TEXT NOT NULL,
    started_at_local TEXT NOT NULL,
    stopped_at_local TEXT NOT NULL,
    utc_offset_minutes INTEGER,
    duration_milliseconds INTEGER NOT NULL CHECK (duration_milliseconds >= 0),
    distance_meters REAL CHECK (distance_meters IS NULL OR distance_meters >= 0),
    energy_kilocalories INTEGER CHECK (
        energy_kilocalories IS NULL OR energy_kilocalories >= 0
    ),
    average_heart_rate_bpm INTEGER CHECK (
        average_heart_rate_bpm IS NULL OR average_heart_rate_bpm >= 0
    ),
    maximum_heart_rate_bpm INTEGER CHECK (
        maximum_heart_rate_bpm IS NULL OR maximum_heart_rate_bpm >= 0
    ),
    sport_ref TEXT CHECK (sport_ref IS NULL OR length(sport_ref) > 0),
    exercise_count INTEGER CHECK (exercise_count IS NULL OR exercise_count >= 0),
    CHECK (
        average_heart_rate_bpm IS NULL
        OR maximum_heart_rate_bpm IS NULL
        OR average_heart_rate_bpm <= maximum_heart_rate_bpm
    ),
    PRIMARY KEY (origin_id, session_id)
);

CREATE TABLE training_session_provenance (
    id INTEGER PRIMARY KEY,
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    artifact_locator TEXT NOT NULL,
    source_record_locator TEXT NOT NULL,
    source_artifact_sha256 TEXT NOT NULL CHECK (length(source_artifact_sha256) = 64),
    source_provider TEXT NOT NULL,
    source_adapter_version TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    source_modified_at_utc TEXT NOT NULL,
    reconciliation_decision TEXT NOT NULL CHECK (
        reconciliation_decision IN (
            'create', 'equivalent', 'amend', 'preserve', 'conflict'
        )
    ),
    contributes_to_visible_state INTEGER NOT NULL CHECK (
        contributes_to_visible_state IN (0, 1)
    ),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

CREATE TABLE training_session_conflict (
    id INTEGER PRIMARY KEY,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    existing_source_modified_at_utc TEXT NOT NULL,
    incoming_source_modified_at_utc TEXT NOT NULL,
    artifact_locator TEXT NOT NULL,
    source_record_locator TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

CREATE INDEX training_session_start_origin
    ON training_session (started_at_local, origin_id);

CREATE INDEX training_session_provenance_observation
    ON training_session_provenance (
        origin_id, session_id, import_operation_id
    );

CREATE INDEX training_session_conflict_operation
    ON training_session_conflict (import_operation_id);
