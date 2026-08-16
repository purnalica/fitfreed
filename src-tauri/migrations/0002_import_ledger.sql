DROP INDEX import_operation_package_sha256;

ALTER TABLE import_operation RENAME TO import_operation_v1;
ALTER TABLE daily_activity RENAME TO daily_activity_v1;
ALTER TABLE activity_conflict RENAME TO activity_conflict_v1;

CREATE TABLE import_operation (
    id INTEGER PRIMARY KEY,
    operation_ref TEXT NOT NULL UNIQUE,
    package_sha256 TEXT CHECK (
        package_sha256 IS NULL OR length(package_sha256) = 64
    ),
    state TEXT NOT NULL CHECK (
        state IN (
            'assessing', 'planned', 'staging', 'reconciling', 'committing',
            'recovering', 'completed', 'rejected', 'cancelled', 'failed'
        )
    ),
    source_provider TEXT NOT NULL,
    source_adapter_version TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    started_at_utc TEXT,
    updated_at_utc TEXT,
    completed_at_utc TEXT,
    exact_repeat INTEGER NOT NULL CHECK (exact_repeat IN (0, 1)),
    repeated_operation_id INTEGER REFERENCES import_operation (id),
    coverage_complete INTEGER NOT NULL CHECK (coverage_complete IN (0, 1)),
    total_artifacts INTEGER NOT NULL CHECK (total_artifacts >= 0),
    supported_artifacts INTEGER NOT NULL CHECK (supported_artifacts >= 0),
    unsupported_artifacts INTEGER NOT NULL CHECK (unsupported_artifacts >= 0),
    ignored_artifacts INTEGER NOT NULL CHECK (ignored_artifacts >= 0),
    unrecognized_artifacts INTEGER NOT NULL CHECK (unrecognized_artifacts >= 0),
    invalid_artifacts INTEGER NOT NULL CHECK (invalid_artifacts >= 0),
    recognized_artifacts INTEGER NOT NULL CHECK (recognized_artifacts >= 0),
    new_observations INTEGER NOT NULL CHECK (new_observations >= 0),
    equivalent_observations INTEGER NOT NULL CHECK (equivalent_observations >= 0),
    enriched_observations INTEGER NOT NULL CHECK (enriched_observations >= 0),
    preserved_observations INTEGER NOT NULL CHECK (preserved_observations >= 0),
    conflicts INTEGER NOT NULL CHECK (conflicts >= 0),
    canonical_history_changed INTEGER NOT NULL CHECK (canonical_history_changed IN (0, 1)),
    temporary_state_removed INTEGER NOT NULL CHECK (temporary_state_removed IN (0, 1)),
    terminal_code TEXT,
    recovery_note TEXT
);

CREATE TABLE daily_activity (
    origin_id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    step_count INTEGER CHECK (step_count IS NULL OR step_count >= 0),
    PRIMARY KEY (origin_id, local_date)
);

CREATE TABLE import_artifact_coverage (
    id INTEGER PRIMARY KEY,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    artifact_locator TEXT NOT NULL,
    artifact_family TEXT,
    classification TEXT NOT NULL CHECK (
        classification IN (
            'supported', 'unsupported', 'deliberately-ignored', 'unrecognized', 'invalid'
        )
    ),
    source_artifact_sha256 TEXT CHECK (
        source_artifact_sha256 IS NULL OR length(source_artifact_sha256) = 64
    ),
    reason_code TEXT NOT NULL,
    UNIQUE (import_operation_id, artifact_locator)
);

CREATE TABLE daily_activity_provenance (
    id INTEGER PRIMARY KEY,
    origin_id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    artifact_locator TEXT NOT NULL,
    source_record_locator TEXT NOT NULL,
    source_artifact_sha256 TEXT CHECK (
        source_artifact_sha256 IS NULL OR length(source_artifact_sha256) = 64
    ),
    source_provider TEXT NOT NULL,
    source_adapter_version TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    reconciliation_decision TEXT NOT NULL CHECK (
        reconciliation_decision IN (
            'create', 'equivalent', 'enrich', 'preserve', 'conflict',
            'unavailable-for-migrated-v1'
        )
    ),
    contributes_to_visible_state INTEGER NOT NULL CHECK (
        contributes_to_visible_state IN (0, 1)
    ),
    FOREIGN KEY (origin_id, local_date) REFERENCES daily_activity (origin_id, local_date)
);

CREATE TABLE activity_conflict (
    id INTEGER PRIMARY KEY,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    origin_id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    existing_step_count INTEGER CHECK (
        existing_step_count IS NULL OR existing_step_count >= 0
    ),
    incoming_step_count INTEGER CHECK (
        incoming_step_count IS NULL OR incoming_step_count >= 0
    ),
    artifact_locator TEXT NOT NULL,
    source_record_locator TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    FOREIGN KEY (origin_id, local_date) REFERENCES daily_activity (origin_id, local_date)
);

INSERT INTO import_operation (
    id, operation_ref, package_sha256, state, source_provider,
    source_adapter_version, mapping_version, started_at_utc, updated_at_utc,
    completed_at_utc, exact_repeat, repeated_operation_id, coverage_complete,
    total_artifacts, supported_artifacts, unsupported_artifacts, ignored_artifacts,
    unrecognized_artifacts, invalid_artifacts, recognized_artifacts,
    new_observations, equivalent_observations, enriched_observations,
    preserved_observations, conflicts, canonical_history_changed,
    temporary_state_removed, terminal_code, recovery_note
)
SELECT
    id,
    printf('legacy-v1-%016x', id),
    package_sha256,
    'completed',
    'polar-flow',
    'legacy-v1-unknown',
    'legacy-v1-unknown',
    NULL,
    NULL,
    NULL,
    exact_repeat,
    NULL,
    0,
    recognized_artifacts,
    recognized_artifacts,
    0,
    0,
    0,
    0,
    recognized_artifacts,
    new_observations,
    equivalent_observations,
    enriched_observations,
    preserved_observations,
    conflicts,
    CASE WHEN new_observations + enriched_observations > 0 THEN 1 ELSE 0 END,
    1,
    NULL,
    NULL
FROM import_operation_v1;

INSERT INTO daily_activity (origin_id, local_date, step_count)
SELECT origin_id, local_date, step_count
FROM daily_activity_v1;

INSERT INTO daily_activity_provenance (
    origin_id, local_date, import_operation_id, artifact_locator,
    source_record_locator, source_artifact_sha256, source_provider,
    source_adapter_version, mapping_version, reconciliation_decision,
    contributes_to_visible_state
)
SELECT
    activity.origin_id,
    activity.local_date,
    (
        SELECT MIN(operation.id)
        FROM import_operation_v1 operation
        WHERE operation.package_sha256 = activity.provenance_sha256
          AND operation.completed = 1
    ),
    'legacy-v1-unavailable',
    'legacy-v1-unavailable',
    NULL,
    'polar-flow',
    'legacy-v1-unknown',
    'legacy-v1-unknown',
    'unavailable-for-migrated-v1',
    1
FROM daily_activity_v1 activity;

INSERT INTO activity_conflict (
    id, import_operation_id, origin_id, local_date, existing_step_count,
    incoming_step_count, artifact_locator, source_record_locator, mapping_version
)
SELECT
    conflict.id,
    (
        SELECT MIN(operation.id)
        FROM import_operation_v1 operation
        WHERE operation.package_sha256 = conflict.package_sha256
          AND operation.completed = 1
    ),
    conflict.origin_id,
    conflict.local_date,
    conflict.existing_step_count,
    conflict.incoming_step_count,
    'legacy-v1-unavailable',
    'legacy-v1-unavailable',
    'legacy-v1-unknown'
FROM activity_conflict_v1 conflict;

DROP TABLE activity_conflict_v1;
DROP TABLE daily_activity_v1;
DROP TABLE import_operation_v1;

CREATE INDEX import_operation_completed_package
    ON import_operation (package_sha256, state, coverage_complete);

CREATE INDEX import_artifact_coverage_operation
    ON import_artifact_coverage (import_operation_id, classification);

CREATE INDEX daily_activity_provenance_observation
    ON daily_activity_provenance (origin_id, local_date, import_operation_id);

CREATE INDEX activity_conflict_operation
    ON activity_conflict (import_operation_id);
