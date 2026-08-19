CREATE TABLE report_definition_v22 (
    report_ref TEXT PRIMARY KEY CHECK (
        length(report_ref) = 71
        AND substr(report_ref, 1, 7) = 'report-'
        AND substr(report_ref, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120 AND title = trim(title)),
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
    definition_version INTEGER NOT NULL CHECK (definition_version IN (1, 2, 3)),
    revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9223372036854775807),
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE report_block_v22 (
    report_ref TEXT NOT NULL REFERENCES report_definition_v22 (report_ref) ON DELETE CASCADE,
    block_ref TEXT NOT NULL UNIQUE CHECK (
        length(block_ref) = 77
        AND substr(block_ref, 1, 13) = 'report-block-'
        AND substr(block_ref, 14) NOT GLOB '*[^0-9a-f]*'
    ),
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 31),
    kind TEXT NOT NULL CHECK (kind IN (
        'session-evidence', 'route', 'narrative', 'training-finding',
        'training-comparison', 'training-chart', 'training-exact-table', 'training-coverage'
    )),
    session_ref TEXT CHECK (
        session_ref IS NULL OR (
            length(session_ref) = 72
            AND substr(session_ref, 1, 8) = 'session-'
            AND substr(session_ref, 9) NOT GLOB '*[^0-9a-f]*'
        )
    ),
    include_physiological_context INTEGER CHECK (
        include_physiological_context IS NULL OR include_physiological_context IN (0, 1)
    ),
    route_ref TEXT CHECK (
        route_ref IS NULL OR (
            length(route_ref) = 70
            AND substr(route_ref, 1, 6) = 'route-'
            AND substr(route_ref, 7) NOT GLOB '*[^0-9a-f]*'
        )
    ),
    endpoint_redaction_meters INTEGER CHECK (
        endpoint_redaction_meters IS NULL OR endpoint_redaction_meters BETWEEN 0 AND 5000
    ),
    narrative_body TEXT CHECK (
        narrative_body IS NULL OR (
            length(narrative_body) BETWEEN 1 AND 10000
            AND narrative_body = trim(narrative_body)
        )
    ),
    question_kind TEXT CHECK (
        question_kind IS NULL OR question_kind = 'training-period-comparison'
    ),
    question_version INTEGER CHECK (question_version IS NULL OR question_version = 1),
    baseline_from TEXT,
    baseline_through TEXT,
    comparison_from TEXT,
    comparison_through TEXT,
    metric TEXT CHECK (
        metric IS NULL OR metric IN ('session-count', 'training-days', 'duration', 'distance', 'energy')
    ),
    PRIMARY KEY (report_ref, ordinal),
    CHECK (
        baseline_from IS NULL OR (
            length(baseline_from) = 10
            AND baseline_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(baseline_from) IS NOT NULL
            AND date(baseline_from) = baseline_from
        )
    ),
    CHECK (
        baseline_through IS NULL OR (
            length(baseline_through) = 10
            AND baseline_through GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(baseline_through) IS NOT NULL
            AND date(baseline_through) = baseline_through
        )
    ),
    CHECK (
        comparison_from IS NULL OR (
            length(comparison_from) = 10
            AND comparison_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(comparison_from) IS NOT NULL
            AND date(comparison_from) = comparison_from
        )
    ),
    CHECK (
        comparison_through IS NULL OR (
            length(comparison_through) = 10
            AND comparison_through GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(comparison_through) IS NOT NULL
            AND date(comparison_through) = comparison_through
        )
    ),
    CHECK (
        baseline_from IS NULL OR (
            julianday(baseline_through) - julianday(baseline_from) BETWEEN 0 AND 365
            AND julianday(comparison_through) - julianday(comparison_from) BETWEEN 0 AND 365
        )
    ),
    CHECK (
        (
            kind = 'session-evidence'
            AND session_ref IS NOT NULL
            AND include_physiological_context IS NOT NULL
            AND route_ref IS NULL AND endpoint_redaction_meters IS NULL
            AND narrative_body IS NULL AND question_kind IS NULL
            AND question_version IS NULL AND baseline_from IS NULL AND baseline_through IS NULL
            AND comparison_from IS NULL AND comparison_through IS NULL AND metric IS NULL
        ) OR (
            kind = 'route'
            AND session_ref IS NOT NULL
            AND include_physiological_context IS NULL
            AND route_ref IS NOT NULL AND endpoint_redaction_meters IS NOT NULL
            AND narrative_body IS NULL AND question_kind IS NULL
            AND question_version IS NULL AND baseline_from IS NULL AND baseline_through IS NULL
            AND comparison_from IS NULL AND comparison_through IS NULL AND metric IS NULL
        ) OR (
            kind = 'narrative'
            AND session_ref IS NULL AND include_physiological_context IS NULL
            AND route_ref IS NULL AND endpoint_redaction_meters IS NULL
            AND narrative_body IS NOT NULL AND question_kind IS NULL
            AND question_version IS NULL AND baseline_from IS NULL AND baseline_through IS NULL
            AND comparison_from IS NULL AND comparison_through IS NULL AND metric IS NULL
        ) OR (
            kind IN ('training-finding', 'training-chart')
            AND session_ref IS NULL AND include_physiological_context IS NULL
            AND route_ref IS NULL AND endpoint_redaction_meters IS NULL AND narrative_body IS NULL
            AND question_kind = 'training-period-comparison' AND question_version = 1
            AND baseline_from IS NOT NULL AND baseline_through IS NOT NULL
            AND comparison_from IS NOT NULL AND comparison_through IS NOT NULL
            AND metric IS NOT NULL
        ) OR (
            kind IN ('training-comparison', 'training-exact-table', 'training-coverage')
            AND session_ref IS NULL AND include_physiological_context IS NULL
            AND route_ref IS NULL AND endpoint_redaction_meters IS NULL AND narrative_body IS NULL
            AND question_kind = 'training-period-comparison' AND question_version = 1
            AND baseline_from IS NOT NULL AND baseline_through IS NOT NULL
            AND comparison_from IS NOT NULL AND comparison_through IS NOT NULL
            AND metric IS NULL
        )
    )
);

INSERT INTO report_definition_v22
SELECT * FROM report_definition;

INSERT INTO report_block_v22 (
    report_ref, block_ref, ordinal, kind, session_ref,
    include_physiological_context, route_ref, endpoint_redaction_meters, narrative_body
)
SELECT report_ref, block_ref, ordinal, kind, session_ref,
       include_physiological_context, route_ref, endpoint_redaction_meters, narrative_body
FROM report_block;

DROP TABLE report_block;
DROP TABLE report_definition;

ALTER TABLE report_definition_v22 RENAME TO report_definition;
ALTER TABLE report_block_v22 RENAME TO report_block;

CREATE INDEX report_definition_recent
    ON report_definition (updated_at_utc DESC, report_ref ASC);
