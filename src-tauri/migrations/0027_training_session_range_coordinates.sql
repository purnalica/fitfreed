DROP INDEX training_session_range_owner_order;

ALTER TABLE training_session_range
RENAME TO training_session_range_v26;

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
        coordinate_scope IN (
            'exercise-elapsed', 'route-elapsed', 'signal-elapsed',
            'legacy-session-elapsed'
        )
    ),
    coordinate_ref TEXT,
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
            AND coordinate_ref IS NULL
        )
        OR (
            coordinate_scope = 'route-elapsed'
            AND exercise_id IS NOT NULL
            AND coordinate_ref IS NOT NULL
            AND length(coordinate_ref) = 70
            AND substr(coordinate_ref, 1, 6) = 'route-'
            AND substr(coordinate_ref, 7) NOT GLOB '*[^0-9a-f]*'
        )
        OR (
            coordinate_scope = 'signal-elapsed'
            AND exercise_id IS NOT NULL
            AND coordinate_ref IS NOT NULL
            AND length(coordinate_ref) = 71
            AND substr(coordinate_ref, 1, 7) = 'signal-'
            AND substr(coordinate_ref, 8) NOT GLOB '*[^0-9a-f]*'
        )
        OR (
            coordinate_scope = 'legacy-session-elapsed'
            AND exercise_id IS NULL
            AND coordinate_ref IS NULL
            AND state = 'review-required'
        )
    )
);

INSERT INTO training_session_range (
    range_id, origin_id, session_id, exercise_id, coordinate_scope,
    coordinate_ref, title,
    started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
    evidence_revision, authorship, state, revision,
    created_at_utc, updated_at_utc
)
SELECT range_id, origin_id, session_id, exercise_id, coordinate_scope,
       NULL, title,
       started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
       evidence_revision, authorship, state, revision,
       created_at_utc, updated_at_utc
FROM training_session_range_v26;

DROP TABLE training_session_range_v26;

CREATE INDEX training_session_range_owner_order
    ON training_session_range (
        origin_id, session_id, coordinate_scope, coordinate_ref, exercise_id,
        started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds, range_id
    );
