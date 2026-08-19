CREATE TABLE segment_criterion (
    criterion_id TEXT PRIMARY KEY CHECK (
        length(criterion_id) = 74
        AND substr(criterion_id, 1, 10) = 'criterion-'
        AND substr(criterion_id, 11) NOT GLOB '*[^0-9a-f]*'
    ),
    title TEXT NOT NULL CHECK (
        length(title) BETWEEN 1 AND 80
        AND title = trim(title)
    ),
    criterion_kind TEXT NOT NULL CHECK (
        criterion_kind IN (
            'equal-elapsed-time', 'equal-distance', 'heart-rate-zone', 'manual-boundaries'
        )
    ),
    span_milliseconds INTEGER CHECK (span_milliseconds > 0),
    span_meters REAL CHECK (
        span_meters >= 0.001 AND span_meters < 9223372036854776
    ),
    minimum_beats_per_minute INTEGER CHECK (
        minimum_beats_per_minute BETWEEN 20 AND 300
    ),
    maximum_beats_per_minute INTEGER CHECK (
        maximum_beats_per_minute BETWEEN 20 AND 300
    ),
    authorship TEXT NOT NULL CHECK (authorship = 'user'),
    evaluation_version INTEGER NOT NULL CHECK (evaluation_version = 1),
    revision INTEGER NOT NULL CHECK (revision > 0),
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    CHECK (
        (
            criterion_kind = 'equal-elapsed-time'
            AND span_milliseconds IS NOT NULL
            AND span_meters IS NULL
            AND minimum_beats_per_minute IS NULL
            AND maximum_beats_per_minute IS NULL
        ) OR (
            criterion_kind = 'equal-distance'
            AND span_milliseconds IS NULL
            AND span_meters IS NOT NULL
            AND minimum_beats_per_minute IS NULL
            AND maximum_beats_per_minute IS NULL
        ) OR (
            criterion_kind = 'heart-rate-zone'
            AND span_milliseconds IS NULL
            AND span_meters IS NULL
            AND minimum_beats_per_minute IS NOT NULL
            AND maximum_beats_per_minute IS NOT NULL
            AND minimum_beats_per_minute <= maximum_beats_per_minute
        ) OR (
            criterion_kind = 'manual-boundaries'
            AND span_milliseconds IS NULL
            AND span_meters IS NULL
            AND minimum_beats_per_minute IS NULL
            AND maximum_beats_per_minute IS NULL
        )
    )
);

CREATE TABLE segment_criterion_manual_boundary (
    criterion_id TEXT NOT NULL REFERENCES segment_criterion (criterion_id),
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 98),
    elapsed_milliseconds INTEGER NOT NULL CHECK (elapsed_milliseconds > 0),
    PRIMARY KEY (criterion_id, ordinal),
    UNIQUE (criterion_id, elapsed_milliseconds)
);

CREATE TABLE training_exercise_segment_criterion (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL CHECK (length(exercise_id) > 0),
    criterion_id TEXT NOT NULL REFERENCES segment_criterion (criterion_id),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    applied_at_utc TEXT NOT NULL,
    PRIMARY KEY (origin_id, session_id, exercise_id, criterion_id),
    UNIQUE (origin_id, session_id, exercise_id, ordinal),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

CREATE INDEX segment_criterion_recent
    ON segment_criterion (updated_at_utc DESC, criterion_id);

CREATE INDEX training_exercise_segment_criterion_order
    ON training_exercise_segment_criterion (
        origin_id, session_id, exercise_id, ordinal
    );
