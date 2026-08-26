CREATE TABLE training_session_sport_evidence (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    source_provider TEXT NOT NULL CHECK (
        length(source_provider) BETWEEN 1 AND 128
        AND source_provider = trim(source_provider)
    ),
    source_sport_code TEXT NOT NULL CHECK (
        length(source_sport_code) BETWEEN 1 AND 256
        AND source_sport_code = trim(source_sport_code)
    ),
    canonical_family_suggestion TEXT CHECK (
        canonical_family_suggestion IS NULL
        OR canonical_family_suggestion IN (
            'running', 'cycling', 'swimming', 'walking', 'hiking', 'strength',
            'mobility', 'racket-sport', 'team-sport', 'winter-sport',
            'water-sport', 'other'
        )
    ),
    localized_names_json TEXT NOT NULL CHECK (
        json_valid(localized_names_json)
        AND json_type(localized_names_json) = 'object'
    ),
    catalogue_revision TEXT NOT NULL CHECK (
        length(catalogue_revision) BETWEEN 1 AND 256
        AND catalogue_revision = trim(catalogue_revision)
    ),
    retrieved_at_utc TEXT NOT NULL CHECK (
        length(retrieved_at_utc) BETWEEN 20 AND 64
        AND retrieved_at_utc = trim(retrieved_at_utc)
        AND substr(retrieved_at_utc, -1) = 'Z'
    ),
    mapping_version TEXT NOT NULL CHECK (
        length(mapping_version) BETWEEN 1 AND 256
        AND mapping_version = trim(mapping_version)
    ),
    evidence_ref TEXT NOT NULL CHECK (
        length(evidence_ref) = 79
        AND substr(evidence_ref, 1, 15) = 'sport-evidence-'
        AND substr(evidence_ref, 16) NOT GLOB '*[^0-9a-f]*'
    ),
    PRIMARY KEY (origin_id, session_id, source_provider, source_sport_code, mapping_version),
    UNIQUE (evidence_ref),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id) ON DELETE CASCADE
);

CREATE INDEX training_session_sport_evidence_lookup
    ON training_session_sport_evidence (origin_id, session_id, source_provider);

CREATE TABLE training_session_sport_evidence_source (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    source_provider TEXT NOT NULL,
    source_sport_code TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
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
    source_started_at_local TEXT NOT NULL CHECK (
        length(source_started_at_local) BETWEEN 19 AND 64
        AND source_started_at_local = trim(source_started_at_local)
    ),
    source_export_version TEXT NOT NULL CHECK (
        length(source_export_version) BETWEEN 1 AND 64
        AND source_export_version = trim(source_export_version)
    ),
    import_operation_id INTEGER NOT NULL,
    PRIMARY KEY (
        origin_id, session_id, source_provider, source_sport_code, mapping_version,
        source_artifact_sha256, source_record_locator
    ),
    FOREIGN KEY (
        origin_id, session_id, source_provider, source_sport_code, mapping_version
    ) REFERENCES training_session_sport_evidence (
        origin_id, session_id, source_provider, source_sport_code, mapping_version
    ) ON DELETE CASCADE,
    FOREIGN KEY (import_operation_id)
        REFERENCES import_operation (id)
);

CREATE TRIGGER training_discovery_session_sport_evidence_insert
AFTER INSERT ON training_session_sport_evidence
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_session_sport_evidence_update
AFTER UPDATE ON training_session_sport_evidence
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_session_sport_evidence_delete
AFTER DELETE ON training_session_sport_evidence
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
