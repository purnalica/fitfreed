DROP INDEX training_session_provenance_observation;

ALTER TABLE training_session_provenance
RENAME TO training_session_provenance_v14;

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
            'create', 'equivalent', 'enrich', 'amend', 'preserve', 'conflict'
        )
    ),
    contributes_to_visible_state INTEGER NOT NULL CHECK (
        contributes_to_visible_state IN (0, 1)
    ),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

INSERT INTO training_session_provenance (
    id, origin_id, session_id, import_operation_id, artifact_locator,
    source_record_locator, source_artifact_sha256, source_provider,
    source_adapter_version, mapping_version, source_modified_at_utc,
    reconciliation_decision, contributes_to_visible_state
)
SELECT id, origin_id, session_id, import_operation_id, artifact_locator,
       source_record_locator, source_artifact_sha256, source_provider,
       source_adapter_version, mapping_version, source_modified_at_utc,
       reconciliation_decision, contributes_to_visible_state
FROM training_session_provenance_v14;

DROP TABLE training_session_provenance_v14;

CREATE INDEX training_session_provenance_observation
    ON training_session_provenance (
        origin_id, session_id, import_operation_id
    );

CREATE TABLE training_session_structure (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercises_present INTEGER NOT NULL CHECK (exercises_present IN (0, 1)),
    mapping_version TEXT NOT NULL CHECK (length(mapping_version) > 0),
    PRIMARY KEY (origin_id, session_id),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

CREATE TABLE training_exercise (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL CHECK (length(exercise_id) > 0),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    started_at_local TEXT NOT NULL,
    stopped_at_local TEXT NOT NULL,
    utc_offset_minutes INTEGER,
    duration_milliseconds INTEGER NOT NULL CHECK (duration_milliseconds >= 0),
    distance_meters REAL CHECK (distance_meters IS NULL OR distance_meters >= 0),
    energy_kilocalories INTEGER CHECK (
        energy_kilocalories IS NULL OR energy_kilocalories >= 0
    ),
    sport_ref TEXT CHECK (sport_ref IS NULL OR length(sport_ref) > 0),
    manual_laps_present INTEGER NOT NULL CHECK (manual_laps_present IN (0, 1)),
    automatic_laps_present INTEGER NOT NULL CHECK (automatic_laps_present IN (0, 1)),
    pauses_present INTEGER NOT NULL CHECK (pauses_present IN (0, 1)),
    PRIMARY KEY (origin_id, session_id, exercise_id),
    UNIQUE (origin_id, session_id, ordinal),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session_structure (origin_id, session_id)
);

CREATE TABLE training_lap (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('manual', 'automatic')),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    split_time_milliseconds INTEGER NOT NULL CHECK (split_time_milliseconds >= 0),
    duration_milliseconds INTEGER NOT NULL CHECK (duration_milliseconds >= 0),
    distance_meters REAL CHECK (distance_meters IS NULL OR distance_meters >= 0),
    PRIMARY KEY (origin_id, session_id, exercise_id, kind, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise (origin_id, session_id, exercise_id)
);

CREATE TABLE training_pause (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    started_at_local TEXT NOT NULL,
    ended_at_local TEXT NOT NULL,
    PRIMARY KEY (origin_id, session_id, exercise_id, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise (origin_id, session_id, exercise_id)
);

CREATE INDEX training_exercise_session_order
    ON training_exercise (origin_id, session_id, ordinal);

CREATE INDEX training_lap_exercise_order
    ON training_lap (origin_id, session_id, exercise_id, kind, ordinal);

CREATE INDEX training_pause_exercise_order
    ON training_pause (origin_id, session_id, exercise_id, ordinal);

CREATE TRIGGER training_session_structure_discovery_revision_insert
AFTER INSERT ON training_session_structure
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_structure_discovery_revision_update
AFTER UPDATE ON training_session_structure
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_structure_discovery_revision_delete
AFTER DELETE ON training_session_structure
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
