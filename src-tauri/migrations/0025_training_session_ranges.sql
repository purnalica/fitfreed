CREATE TABLE training_session_range (
    range_id TEXT PRIMARY KEY CHECK (
        length(range_id) = 70
        AND substr(range_id, 1, 6) = 'range-'
        AND substr(range_id, 7) NOT GLOB '*[^0-9a-f]*'
    ),
    origin_id TEXT NOT NULL CHECK (length(origin_id) > 0),
    session_id TEXT NOT NULL CHECK (length(session_id) > 0),
    title TEXT NOT NULL CHECK (
        length(title) BETWEEN 1 AND 80
        AND title = trim(title)
    ),
    started_at_elapsed_milliseconds INTEGER NOT NULL CHECK (
        started_at_elapsed_milliseconds >= 0
    ),
    ended_at_elapsed_milliseconds INTEGER NOT NULL,
    evidence_revision TEXT NOT NULL CHECK (
        length(evidence_revision) = 79
        AND substr(evidence_revision, 1, 15) = 'range-evidence-'
        AND substr(evidence_revision, 16) NOT GLOB '*[^0-9a-f]*'
    ),
    authorship TEXT NOT NULL CHECK (authorship = 'user'),
    state TEXT NOT NULL CHECK (state IN ('current', 'review-required')),
    revision INTEGER NOT NULL CHECK (revision > 0),
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    CHECK (ended_at_elapsed_milliseconds > started_at_elapsed_milliseconds)
);

CREATE INDEX training_session_range_owner_order
    ON training_session_range (
        origin_id, session_id, started_at_elapsed_milliseconds,
        ended_at_elapsed_milliseconds, range_id
    );
