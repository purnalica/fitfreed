CREATE TABLE planned_training_revision (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL CHECK (revision >= 0)
);

INSERT INTO planned_training_revision (id, revision) VALUES (1, 0);

CREATE TABLE planned_training_target (
    origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    target_id TEXT NOT NULL CHECK (
        length(target_id) = 79
        AND substr(target_id, 1, 15) = 'planned-target-'
        AND substr(target_id, 16) NOT GLOB '*[^0-9a-f]*'
    ),
    source_provider TEXT NOT NULL CHECK (
        length(source_provider) BETWEEN 1 AND 128
        AND source_provider = trim(source_provider)
    ),
    source_kind TEXT NOT NULL CHECK (source_kind IN ('scheduled', 'favorite-template')),
    source_identity TEXT NOT NULL CHECK (
        length(source_identity) BETWEEN 1 AND 256
        AND source_identity = trim(source_identity)
    ),
    current_evidence_revision TEXT NOT NULL CHECK (
        length(current_evidence_revision) = 81
        AND substr(current_evidence_revision, 1, 17) = 'planned-evidence-'
        AND substr(current_evidence_revision, 18) NOT GLOB '*[^0-9a-f]*'
    ),
    current_mapping_version TEXT NOT NULL CHECK (
        length(current_mapping_version) BETWEEN 1 AND 256
        AND current_mapping_version = trim(current_mapping_version)
    ),
    reconciliation_state TEXT NOT NULL CHECK (reconciliation_state IN ('current', 'conflicted')),
    first_seen_import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    last_seen_import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    PRIMARY KEY (origin_id, target_id),
    UNIQUE (origin_id, source_provider, source_kind, source_identity),
    FOREIGN KEY (
        origin_id, target_id, current_evidence_revision, current_mapping_version
    ) REFERENCES planned_training_target_revision (
        origin_id, target_id, evidence_revision, mapping_version
    ) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE planned_training_target_revision (
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL CHECK (
        length(evidence_revision) = 81
        AND substr(evidence_revision, 1, 17) = 'planned-evidence-'
        AND substr(evidence_revision, 18) NOT GLOB '*[^0-9a-f]*'
    ),
    mapping_version TEXT NOT NULL CHECK (
        length(mapping_version) BETWEEN 1 AND 256
        AND mapping_version = trim(mapping_version)
    ),
    target_kind TEXT NOT NULL CHECK (target_kind IN ('scheduled', 'favorite-template')),
    scheduled_at_local TEXT,
    completion_state TEXT CHECK (completion_state IN ('pending', 'completed')),
    name TEXT NOT NULL CHECK (
        length(name) BETWEEN 1 AND 160
    ),
    description TEXT CHECK (description IS NULL OR length(description) <= 2000),
    editability TEXT NOT NULL CHECK (editability IN ('editable', 'non-editable', 'unspecified')),
    exercises_present INTEGER NOT NULL CHECK (exercises_present IN (0, 1)),
    mapping_state TEXT NOT NULL CHECK (mapping_state IN ('complete', 'partial')),
    unmapped_field_count INTEGER NOT NULL CHECK (unmapped_field_count >= 0),
    source_export_version TEXT NOT NULL CHECK (
        length(source_export_version) BETWEEN 1 AND 64
        AND source_export_version = trim(source_export_version)
    ),
    PRIMARY KEY (origin_id, target_id, evidence_revision, mapping_version),
    FOREIGN KEY (origin_id, target_id)
        REFERENCES planned_training_target (origin_id, target_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CHECK (
        (target_kind = 'scheduled' AND scheduled_at_local IS NOT NULL AND completion_state IS NOT NULL)
        OR
        (target_kind = 'favorite-template' AND scheduled_at_local IS NULL AND completion_state IS NULL)
    ),
    CHECK (
        (mapping_state = 'complete' AND unmapped_field_count = 0)
        OR
        (mapping_state = 'partial' AND unmapped_field_count > 0)
    )
);

CREATE TABLE planned_training_exercise (
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    exercise_id TEXT NOT NULL CHECK (
        length(exercise_id) = 81
        AND substr(exercise_id, 1, 17) = 'planned-exercise-'
        AND substr(exercise_id, 18) NOT GLOB '*[^0-9a-f]*'
    ),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    exercise_kind TEXT NOT NULL CHECK (
        exercise_kind IN ('open', 'phased', 'volume', 'strength', 'unmapped')
    ),
    duration_goal_milliseconds INTEGER CHECK (
        duration_goal_milliseconds IS NULL OR duration_goal_milliseconds > 0
    ),
    distance_goal_meters REAL CHECK (distance_goal_meters IS NULL OR distance_goal_meters > 0),
    sport_state TEXT NOT NULL CHECK (sport_state IN ('unavailable', 'unmapped', 'recognized')),
    canonical_family_suggestion TEXT CHECK (
        canonical_family_suggestion IS NULL
        OR canonical_family_suggestion IN (
            'running', 'cycling', 'swimming', 'walking', 'hiking', 'strength',
            'mobility', 'racket-sport', 'team-sport', 'winter-sport',
            'water-sport', 'other'
        )
    ),
    localized_names_json TEXT CHECK (
        localized_names_json IS NULL
        OR (json_valid(localized_names_json) AND json_type(localized_names_json) = 'object')
    ),
    catalogue_revision TEXT,
    catalogue_retrieved_at_utc TEXT,
    sport_mapping_version TEXT,
    sport_evidence_ref TEXT CHECK (
        sport_evidence_ref IS NULL
        OR (
            length(sport_evidence_ref) = 79
            AND substr(sport_evidence_ref, 1, 15) = 'sport-evidence-'
            AND substr(sport_evidence_ref, 16) NOT GLOB '*[^0-9a-f]*'
        )
    ),
    phases_present INTEGER NOT NULL CHECK (phases_present IN (0, 1)),
    PRIMARY KEY (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id
    ),
    UNIQUE (origin_id, target_id, evidence_revision, mapping_version, ordinal),
    FOREIGN KEY (origin_id, target_id, evidence_revision, mapping_version)
        REFERENCES planned_training_target_revision (
            origin_id, target_id, evidence_revision, mapping_version
        ) ON DELETE CASCADE,
    CHECK (
        (
            sport_state = 'recognized'
            AND localized_names_json IS NOT NULL
            AND catalogue_revision IS NOT NULL
            AND catalogue_retrieved_at_utc IS NOT NULL
            AND sport_mapping_version IS NOT NULL
            AND sport_evidence_ref IS NOT NULL
        )
        OR
        (
            sport_state IN ('unavailable', 'unmapped')
            AND canonical_family_suggestion IS NULL
            AND localized_names_json IS NULL
            AND catalogue_revision IS NULL
            AND catalogue_retrieved_at_utc IS NULL
            AND sport_mapping_version IS NULL
            AND sport_evidence_ref IS NULL
        )
    )
);

CREATE TABLE planned_training_phase (
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    phase_id TEXT NOT NULL CHECK (
        length(phase_id) = 78
        AND substr(phase_id, 1, 14) = 'planned-phase-'
        AND substr(phase_id, 15) NOT GLOB '*[^0-9a-f]*'
    ),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    goal_kind TEXT NOT NULL CHECK (goal_kind IN ('duration', 'distance', 'unmapped')),
    duration_goal_milliseconds INTEGER CHECK (
        duration_goal_milliseconds IS NULL OR duration_goal_milliseconds > 0
    ),
    distance_goal_meters REAL CHECK (distance_goal_meters IS NULL OR distance_goal_meters > 0),
    intensity_kind TEXT NOT NULL CHECK (intensity_kind IN ('none', 'zone-range', 'unmapped')),
    intensity_metric TEXT CHECK (intensity_metric IN ('heart-rate', 'speed', 'power')),
    lower_zone INTEGER CHECK (lower_zone BETWEEN 1 AND 5),
    upper_zone INTEGER CHECK (upper_zone BETWEEN 1 AND 5),
    transition_id TEXT NOT NULL CHECK (
        length(transition_id) = 83
        AND substr(transition_id, 1, 19) = 'planned-transition-'
        AND substr(transition_id, 20) NOT GLOB '*[^0-9a-f]*'
    ),
    change_kind TEXT NOT NULL CHECK (change_kind IN ('manual', 'automatic', 'unmapped')),
    repeat_id TEXT CHECK (
        repeat_id IS NULL
        OR (
            length(repeat_id) = 79
            AND substr(repeat_id, 1, 15) = 'planned-repeat-'
            AND substr(repeat_id, 16) NOT GLOB '*[^0-9a-f]*'
        )
    ),
    return_to_phase_ordinal INTEGER CHECK (return_to_phase_ordinal >= 0),
    total_iterations INTEGER CHECK (total_iterations BETWEEN 2 AND 100),
    PRIMARY KEY (origin_id, target_id, evidence_revision, mapping_version, exercise_id, phase_id),
    UNIQUE (origin_id, target_id, evidence_revision, mapping_version, exercise_id, ordinal),
    FOREIGN KEY (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id
    ) REFERENCES planned_training_exercise (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id
    ) ON DELETE CASCADE,
    CHECK (
        (goal_kind = 'duration' AND duration_goal_milliseconds IS NOT NULL AND distance_goal_meters IS NULL)
        OR (goal_kind = 'distance' AND duration_goal_milliseconds IS NULL AND distance_goal_meters IS NOT NULL)
        OR (goal_kind = 'unmapped' AND duration_goal_milliseconds IS NULL AND distance_goal_meters IS NULL)
    ),
    CHECK (
        (intensity_kind = 'zone-range' AND intensity_metric IS NOT NULL
            AND lower_zone IS NOT NULL AND upper_zone IS NOT NULL AND lower_zone <= upper_zone)
        OR (intensity_kind IN ('none', 'unmapped') AND intensity_metric IS NULL
            AND lower_zone IS NULL AND upper_zone IS NULL)
    ),
    CHECK (
        (repeat_id IS NULL AND return_to_phase_ordinal IS NULL AND total_iterations IS NULL)
        OR (repeat_id IS NOT NULL AND return_to_phase_ordinal IS NOT NULL AND total_iterations IS NOT NULL)
    )
);

CREATE TABLE planned_training_unmapped_field (
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    source_field_locator TEXT NOT NULL CHECK (
        length(source_field_locator) BETWEEN 1 AND 2048
        AND source_field_locator = trim(source_field_locator)
    ),
    PRIMARY KEY (origin_id, target_id, evidence_revision, mapping_version, ordinal),
    UNIQUE (origin_id, target_id, evidence_revision, mapping_version, source_field_locator),
    FOREIGN KEY (origin_id, target_id, evidence_revision, mapping_version)
        REFERENCES planned_training_target_revision (
            origin_id, target_id, evidence_revision, mapping_version
        ) ON DELETE CASCADE
);

CREATE TABLE planned_training_source_sport_evidence (
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    source_provider TEXT NOT NULL,
    source_sport_code TEXT NOT NULL CHECK (
        length(source_sport_code) BETWEEN 1 AND 128
        AND source_sport_code = trim(source_sport_code)
    ),
    source_record_locator TEXT NOT NULL CHECK (
        length(source_record_locator) BETWEEN 1 AND 256
        AND source_record_locator = trim(source_record_locator)
    ),
    PRIMARY KEY (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id, source_provider
    ),
    FOREIGN KEY (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id
    ) REFERENCES planned_training_exercise (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id
    ) ON DELETE CASCADE
);

CREATE TABLE planned_training_target_provenance (
    id INTEGER PRIMARY KEY,
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    source_provider TEXT NOT NULL,
    source_adapter_version TEXT NOT NULL,
    source_identity TEXT NOT NULL,
    source_artifact_locator TEXT NOT NULL CHECK (
        length(source_artifact_locator) BETWEEN 1 AND 2048
        AND source_artifact_locator = trim(source_artifact_locator)
    ),
    source_artifact_sha256 TEXT NOT NULL CHECK (
        length(source_artifact_sha256) = 64
        AND source_artifact_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    source_record_locator TEXT NOT NULL CHECK (
        length(source_record_locator) BETWEEN 1 AND 256
        AND source_record_locator = trim(source_record_locator)
    ),
    source_export_version TEXT NOT NULL,
    reconciliation_decision TEXT NOT NULL CHECK (
        reconciliation_decision IN ('create', 'equivalent', 'enrich', 'amend', 'preserve', 'conflict')
    ),
    contributes_to_visible_state INTEGER NOT NULL CHECK (contributes_to_visible_state IN (0, 1)),
    FOREIGN KEY (origin_id, target_id, evidence_revision, mapping_version)
        REFERENCES planned_training_target_revision (
            origin_id, target_id, evidence_revision, mapping_version
        ),
    UNIQUE (
        import_operation_id, origin_id, target_id, evidence_revision, mapping_version,
        source_artifact_sha256, source_record_locator
    )
);

CREATE TABLE planned_training_conflict (
    id INTEGER PRIMARY KEY,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    existing_evidence_revision TEXT NOT NULL,
    existing_mapping_version TEXT NOT NULL,
    incoming_evidence_revision TEXT NOT NULL,
    incoming_mapping_version TEXT NOT NULL,
    source_artifact_locator TEXT NOT NULL,
    FOREIGN KEY (
        origin_id, target_id, existing_evidence_revision, existing_mapping_version
    ) REFERENCES planned_training_target_revision (
        origin_id, target_id, evidence_revision, mapping_version
    ),
    FOREIGN KEY (
        origin_id, target_id, incoming_evidence_revision, incoming_mapping_version
    ) REFERENCES planned_training_target_revision (
        origin_id, target_id, evidence_revision, mapping_version
    )
);

CREATE TABLE planned_training_favorite_snapshot (
    origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    snapshot_ref TEXT NOT NULL CHECK (
        length(snapshot_ref) = 82
        AND substr(snapshot_ref, 1, 18) = 'favorite-snapshot-'
        AND substr(snapshot_ref, 19) NOT GLOB '*[^0-9a-f]*'
    ),
    source_provider TEXT NOT NULL,
    source_adapter_version TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    source_artifact_locator TEXT NOT NULL,
    source_artifact_sha256 TEXT NOT NULL CHECK (
        length(source_artifact_sha256) = 64
        AND source_artifact_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    PRIMARY KEY (origin_id, snapshot_ref)
);

CREATE TABLE planned_training_favorite_snapshot_membership (
    origin_id TEXT NOT NULL,
    snapshot_ref TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    PRIMARY KEY (origin_id, snapshot_ref, ordinal),
    UNIQUE (origin_id, snapshot_ref, target_id),
    FOREIGN KEY (origin_id, snapshot_ref)
        REFERENCES planned_training_favorite_snapshot (origin_id, snapshot_ref) ON DELETE CASCADE,
    FOREIGN KEY (origin_id, target_id, evidence_revision, mapping_version)
        REFERENCES planned_training_target_revision (
            origin_id, target_id, evidence_revision, mapping_version
        )
);

CREATE INDEX planned_training_target_current
    ON planned_training_target (origin_id, source_kind, reconciliation_state, target_id);

CREATE INDEX planned_training_revision_chronology
    ON planned_training_target_revision (origin_id, scheduled_at_local, target_id);

CREATE INDEX planned_training_provenance_target
    ON planned_training_target_provenance (origin_id, target_id, import_operation_id);

CREATE INDEX planned_training_favorite_snapshot_recent
    ON planned_training_favorite_snapshot (origin_id, import_operation_id DESC);

CREATE TRIGGER planned_training_target_revision_insert
AFTER INSERT ON planned_training_target
BEGIN
    UPDATE planned_training_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER planned_training_target_revision_update
AFTER UPDATE OF current_evidence_revision, current_mapping_version, reconciliation_state
ON planned_training_target
BEGIN
    UPDATE planned_training_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER planned_training_target_revision_delete
AFTER DELETE ON planned_training_target
BEGIN
    UPDATE planned_training_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER planned_training_favorite_snapshot_revision_insert
AFTER INSERT ON planned_training_favorite_snapshot
BEGIN
    UPDATE planned_training_revision SET revision = revision + 1 WHERE id = 1;
END;
