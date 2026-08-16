CREATE TABLE library_identity (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    correlation_key BLOB NOT NULL CHECK (length(correlation_key) = 32),
    created_at_utc TEXT NOT NULL
);

INSERT INTO library_identity (id, correlation_key, created_at_utc)
VALUES (
    1,
    randomblob(32),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

CREATE TABLE observation_origin (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    source_provider TEXT NOT NULL,
    correlation_state TEXT NOT NULL CHECK (
        correlation_state IN ('verified', 'legacy-unverified')
    ),
    created_at_utc TEXT NOT NULL
);

INSERT INTO observation_origin (
    id, source_provider, correlation_state, created_at_utc
)
SELECT
    activity.origin_id,
    COALESCE(
        (
            SELECT MIN(provenance.source_provider)
            FROM daily_activity_provenance provenance
            WHERE provenance.origin_id = activity.origin_id
        ),
        'polar-flow'
    ),
    'legacy-unverified',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
    SELECT DISTINCT origin_id
    FROM daily_activity
) activity;

CREATE TABLE source_subject_evidence (
    id INTEGER PRIMARY KEY,
    observation_origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    source_provider TEXT NOT NULL,
    evidence_kind TEXT NOT NULL,
    evidence_version TEXT NOT NULL,
    scoped_digest BLOB NOT NULL CHECK (length(scoped_digest) = 32),
    first_seen_import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    created_at_utc TEXT NOT NULL,
    UNIQUE (source_provider, evidence_kind, evidence_version, scoped_digest)
);

ALTER TABLE import_operation
ADD COLUMN observation_origin_id TEXT REFERENCES observation_origin (id);

UPDATE import_operation
SET observation_origin_id = (
    SELECT MIN(provenance.origin_id)
    FROM daily_activity_provenance provenance
    WHERE provenance.import_operation_id = import_operation.id
)
WHERE 1 = (
    SELECT COUNT(DISTINCT provenance.origin_id)
    FROM daily_activity_provenance provenance
    WHERE provenance.import_operation_id = import_operation.id
);

CREATE INDEX observation_origin_provider
    ON observation_origin (source_provider, correlation_state);

CREATE INDEX source_subject_evidence_lookup
    ON source_subject_evidence (
        source_provider, evidence_kind, evidence_version, scoped_digest
    );

CREATE INDEX source_subject_evidence_origin
    ON source_subject_evidence (observation_origin_id);
