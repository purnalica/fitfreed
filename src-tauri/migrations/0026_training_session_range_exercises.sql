DROP INDEX training_session_range_owner_order;

ALTER TABLE training_session_range
RENAME TO training_session_range_v25;

CREATE TABLE training_session_range (
    range_id TEXT PRIMARY KEY CHECK (
        length(range_id) = 70
        AND substr(range_id, 1, 6) = 'range-'
        AND substr(range_id, 7) NOT GLOB '*[^0-9a-f]*'
    ),
    origin_id TEXT NOT NULL CHECK (length(origin_id) > 0),
    session_id TEXT NOT NULL CHECK (length(session_id) > 0),
    exercise_id TEXT CHECK (exercise_id IS NULL OR length(exercise_id) > 0),
    coordinate_scope TEXT NOT NULL CHECK (
        coordinate_scope IN ('exercise-elapsed', 'legacy-session-elapsed')
    ),
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
    CHECK (ended_at_elapsed_milliseconds > started_at_elapsed_milliseconds),
    CHECK (
        (
            coordinate_scope = 'exercise-elapsed'
            AND exercise_id IS NOT NULL
        )
        OR (
            coordinate_scope = 'legacy-session-elapsed'
            AND exercise_id IS NULL
            AND state = 'review-required'
        )
    )
);

INSERT INTO training_session_range (
    range_id, origin_id, session_id, exercise_id, coordinate_scope, title,
    started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
    evidence_revision, authorship, state, revision,
    created_at_utc, updated_at_utc
)
SELECT range_id, origin_id, session_id, NULL, 'legacy-session-elapsed', title,
       started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
       evidence_revision, authorship, 'review-required', revision,
       created_at_utc, updated_at_utc
FROM training_session_range_v25;

DROP TABLE training_session_range_v25;

CREATE INDEX training_session_range_owner_order
    ON training_session_range (
        origin_id, session_id, coordinate_scope, exercise_id,
        started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds, range_id
    );
