CREATE TABLE report_definition (
    report_ref TEXT PRIMARY KEY CHECK (
        length(report_ref) = 71
        AND substr(report_ref, 1, 7) = 'report-'
        AND substr(report_ref, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    title TEXT NOT NULL CHECK (
        length(title) BETWEEN 1 AND 120
        AND title = trim(title)
    ),
    locale TEXT NOT NULL CHECK (locale IN ('en-US', 'es-ES')),
    source_snapshot_ref TEXT NOT NULL CHECK (
        length(source_snapshot_ref) = 82
        AND substr(source_snapshot_ref, 1, 18) = 'training-snapshot-'
        AND substr(source_snapshot_ref, 19) NOT GLOB '*[^0-9a-f]*'
    ),
    origin_kind TEXT NOT NULL CHECK (origin_kind = 'session'),
    origin_session_ref TEXT NOT NULL CHECK (
        length(origin_session_ref) = 72
        AND substr(origin_session_ref, 1, 8) = 'session-'
        AND substr(origin_session_ref, 9) NOT GLOB '*[^0-9a-f]*'
    ),
    provenance_policy TEXT NOT NULL CHECK (provenance_policy = 'current-attribution'),
    authorship TEXT NOT NULL CHECK (authorship = 'user'),
    definition_version INTEGER NOT NULL CHECK (definition_version = 1),
    revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9223372036854775807),
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE report_block (
    report_ref TEXT NOT NULL REFERENCES report_definition (report_ref) ON DELETE CASCADE,
    block_ref TEXT NOT NULL UNIQUE CHECK (
        length(block_ref) = 77
        AND substr(block_ref, 1, 13) = 'report-block-'
        AND substr(block_ref, 14) NOT GLOB '*[^0-9a-f]*'
    ),
    ordinal INTEGER NOT NULL CHECK (ordinal IN (0, 1)),
    kind TEXT NOT NULL CHECK (kind IN ('session-evidence', 'narrative')),
    session_ref TEXT CHECK (
        session_ref IS NULL OR (
            length(session_ref) = 72
            AND substr(session_ref, 1, 8) = 'session-'
            AND substr(session_ref, 9) NOT GLOB '*[^0-9a-f]*'
        )
    ),
    include_physiological_context INTEGER CHECK (
        include_physiological_context IS NULL
        OR include_physiological_context IN (0, 1)
    ),
    narrative_body TEXT CHECK (
        narrative_body IS NULL OR (
            length(narrative_body) BETWEEN 1 AND 10000
            AND narrative_body = trim(narrative_body)
        )
    ),
    PRIMARY KEY (report_ref, ordinal),
    CHECK (
        (
            ordinal = 0
            AND kind = 'session-evidence'
            AND session_ref IS NOT NULL
            AND include_physiological_context IS NOT NULL
            AND narrative_body IS NULL
        ) OR (
            ordinal = 1
            AND kind = 'narrative'
            AND session_ref IS NULL
            AND include_physiological_context IS NULL
            AND narrative_body IS NOT NULL
        )
    )
);

CREATE INDEX report_definition_recent
    ON report_definition (updated_at_utc DESC, report_ref ASC);
