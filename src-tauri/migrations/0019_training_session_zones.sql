CREATE TABLE training_session_zone_assessment (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercises_present INTEGER NOT NULL CHECK (exercises_present IN (0, 1)),
    mapping_version TEXT NOT NULL CHECK (length(mapping_version) > 0),
    PRIMARY KEY (origin_id, session_id),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

CREATE TABLE training_exercise_zone_assessment (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    zones_present INTEGER NOT NULL CHECK (zones_present IN (0, 1)),
    unsupported_group_count INTEGER NOT NULL CHECK (unsupported_group_count >= 0),
    CHECK (zones_present = 1 OR unsupported_group_count = 0),
    PRIMARY KEY (origin_id, session_id, exercise_id),
    UNIQUE (origin_id, session_id, ordinal),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session_zone_assessment (origin_id, session_id),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise (origin_id, session_id, exercise_id)
);

CREATE TABLE training_zone_group (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    kind TEXT NOT NULL CHECK (kind IN ('heart-rate', 'speed', 'power')),
    unit TEXT NOT NULL CHECK (unit IN ('beats-per-minute', 'kilometers-per-hour', 'watts')),
    zones_present INTEGER NOT NULL CHECK (zones_present IN (0, 1)),
    CHECK (
        (kind = 'heart-rate' AND unit = 'beats-per-minute')
        OR (kind = 'speed' AND unit = 'kilometers-per-hour')
        OR (kind = 'power' AND unit = 'watts')
    ),
    PRIMARY KEY (origin_id, session_id, exercise_id, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise_zone_assessment (origin_id, session_id, exercise_id)
);

CREATE TABLE training_zone (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    group_ordinal INTEGER NOT NULL CHECK (group_ordinal >= 0),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    lower_limit REAL NOT NULL CHECK (lower_limit >= 0),
    higher_limit REAL NOT NULL CHECK (higher_limit >= lower_limit),
    time_in_zone_milliseconds INTEGER CHECK (time_in_zone_milliseconds >= 0),
    distance_meters REAL CHECK (distance_meters >= 0),
    muscle_load REAL CHECK (muscle_load >= 0),
    PRIMARY KEY (origin_id, session_id, exercise_id, group_ordinal, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id, group_ordinal)
        REFERENCES training_zone_group (origin_id, session_id, exercise_id, ordinal)
);

CREATE INDEX training_exercise_zone_session_order
    ON training_exercise_zone_assessment (origin_id, session_id, ordinal);

CREATE INDEX training_zone_group_exercise_order
    ON training_zone_group (origin_id, session_id, exercise_id, ordinal);

CREATE INDEX training_zone_group_zone_order
    ON training_zone (origin_id, session_id, exercise_id, group_ordinal, ordinal);

CREATE TRIGGER training_session_zone_discovery_revision_insert
AFTER INSERT ON training_session_zone_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_zone_discovery_revision_update
AFTER UPDATE ON training_session_zone_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_zone_discovery_revision_delete
AFTER DELETE ON training_session_zone_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
