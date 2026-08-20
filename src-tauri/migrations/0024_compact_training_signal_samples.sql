DROP INDEX training_signal_sample_series_order;
DROP INDEX training_signal_sample_gap_order;
DROP INDEX training_signal_series_exercise_order;

ALTER TABLE training_signal_sample
RENAME TO training_signal_sample_v23;

ALTER TABLE training_signal_series
RENAME TO training_signal_series_v23;

CREATE TABLE training_signal_series (
    series_id INTEGER PRIMARY KEY CHECK (series_id > 0),
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
    UNIQUE (origin_id, session_id, exercise_id, role, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise_signal_assessment (origin_id, session_id, exercise_id)
);

CREATE TABLE training_signal_sample (
    series_id INTEGER NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    value REAL,
    PRIMARY KEY (series_id, ordinal),
    FOREIGN KEY (series_id) REFERENCES training_signal_series (series_id) ON DELETE CASCADE
) WITHOUT ROWID;

INSERT INTO training_signal_series (
    origin_id, session_id, exercise_id, role, ordinal, kind, unit,
    interval_milliseconds, sample_count, available_sample_count
)
SELECT origin_id, session_id, exercise_id, role, ordinal, kind, unit,
       interval_milliseconds, sample_count, available_sample_count
FROM training_signal_series_v23
ORDER BY origin_id, session_id, exercise_id, role, ordinal;

INSERT INTO training_signal_sample (series_id, ordinal, value)
SELECT current.series_id, sample.ordinal, sample.value
FROM training_signal_sample_v23 AS sample
JOIN training_signal_series AS current
  ON current.origin_id = sample.origin_id
 AND current.session_id = sample.session_id
 AND current.exercise_id = sample.exercise_id
 AND current.role = sample.role
 AND current.ordinal = sample.series_ordinal
ORDER BY current.series_id, sample.ordinal;

DROP TABLE training_signal_sample_v23;
DROP TABLE training_signal_series_v23;

CREATE INDEX training_signal_sample_gap_order
    ON training_signal_sample (series_id, ordinal)
    WHERE value IS NULL;

CREATE TABLE library_maintenance (
    task TEXT PRIMARY KEY CHECK (task IN ('compact-signal-storage'))
) WITHOUT ROWID;

INSERT INTO library_maintenance (task) VALUES ('compact-signal-storage');
