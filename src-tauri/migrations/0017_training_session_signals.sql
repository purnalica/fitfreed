CREATE TABLE training_session_signal_assessment (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercises_present INTEGER NOT NULL CHECK (exercises_present IN (0, 1)),
    mapping_version TEXT NOT NULL CHECK (length(mapping_version) > 0),
    PRIMARY KEY (origin_id, session_id),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

CREATE TABLE training_exercise_signal_assessment (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    signals_present INTEGER NOT NULL CHECK (signals_present IN (0, 1)),
    primary_present INTEGER NOT NULL CHECK (primary_present IN (0, 1)),
    transition_present INTEGER NOT NULL CHECK (transition_present IN (0, 1)),
    unsupported_primary_series_count INTEGER NOT NULL CHECK (unsupported_primary_series_count >= 0),
    unsupported_transition_series_count INTEGER NOT NULL CHECK (unsupported_transition_series_count >= 0),
    CHECK (
        signals_present = 1 OR (
            primary_present = 0
            AND transition_present = 0
            AND unsupported_primary_series_count = 0
            AND unsupported_transition_series_count = 0
        )
    ),
    PRIMARY KEY (origin_id, session_id, exercise_id),
    UNIQUE (origin_id, session_id, ordinal),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session_signal_assessment (origin_id, session_id),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise (origin_id, session_id, exercise_id)
);

CREATE TABLE training_signal_series (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('primary', 'transition')),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    kind TEXT NOT NULL CHECK (
        kind IN ('heart-rate', 'speed', 'distance', 'altitude', 'cadence', 'temperature', 'left-crank-power')
    ),
    unit TEXT NOT NULL CHECK (
        unit IN ('beats-per-minute', 'kilometers-per-hour', 'meters', 'rotations-per-minute', 'degrees-celsius', 'watts')
    ),
    interval_milliseconds INTEGER NOT NULL CHECK (interval_milliseconds > 0),
    sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
    available_sample_count INTEGER NOT NULL CHECK (
        available_sample_count >= 0 AND available_sample_count <= sample_count
    ),
    CHECK (
        (kind = 'heart-rate' AND unit = 'beats-per-minute')
        OR (kind = 'speed' AND unit = 'kilometers-per-hour')
        OR (kind IN ('distance', 'altitude') AND unit = 'meters')
        OR (kind = 'cadence' AND unit = 'rotations-per-minute')
        OR (kind = 'temperature' AND unit = 'degrees-celsius')
        OR (kind = 'left-crank-power' AND unit = 'watts')
    ),
    PRIMARY KEY (origin_id, session_id, exercise_id, role, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise_signal_assessment (origin_id, session_id, exercise_id)
);

CREATE TABLE training_signal_sample (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('primary', 'transition')),
    series_ordinal INTEGER NOT NULL CHECK (series_ordinal >= 0),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    value REAL,
    PRIMARY KEY (origin_id, session_id, exercise_id, role, series_ordinal, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id, role, series_ordinal)
        REFERENCES training_signal_series (origin_id, session_id, exercise_id, role, ordinal)
);

CREATE INDEX training_exercise_signal_session_order
    ON training_exercise_signal_assessment (origin_id, session_id, ordinal);

CREATE INDEX training_signal_series_exercise_order
    ON training_signal_series (origin_id, session_id, exercise_id, role, ordinal);

CREATE INDEX training_signal_sample_series_order
    ON training_signal_sample (
        origin_id, session_id, exercise_id, role, series_ordinal, ordinal
    );

CREATE INDEX training_signal_sample_gap_order
    ON training_signal_sample (
        origin_id, session_id, exercise_id, role, series_ordinal, ordinal
    )
    WHERE value IS NULL;

CREATE TRIGGER training_session_signal_discovery_revision_insert
AFTER INSERT ON training_session_signal_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_signal_discovery_revision_update
AFTER UPDATE ON training_session_signal_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_signal_discovery_revision_delete
AFTER DELETE ON training_session_signal_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
