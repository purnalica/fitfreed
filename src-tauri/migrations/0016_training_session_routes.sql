CREATE TABLE training_session_route_assessment (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercises_present INTEGER NOT NULL CHECK (exercises_present IN (0, 1)),
    mapping_version TEXT NOT NULL CHECK (length(mapping_version) > 0),
    PRIMARY KEY (origin_id, session_id),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session (origin_id, session_id)
);

CREATE TABLE training_exercise_route_assessment (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    routes_present INTEGER NOT NULL CHECK (routes_present IN (0, 1)),
    PRIMARY KEY (origin_id, session_id, exercise_id),
    UNIQUE (origin_id, session_id, ordinal),
    FOREIGN KEY (origin_id, session_id)
        REFERENCES training_session_route_assessment (origin_id, session_id),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise (origin_id, session_id, exercise_id)
);

CREATE TABLE training_route (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('primary', 'transition')),
    started_at_local TEXT NOT NULL,
    point_count INTEGER NOT NULL CHECK (point_count >= 0),
    altitude_point_count INTEGER NOT NULL CHECK (
        altitude_point_count >= 0 AND altitude_point_count <= point_count
    ),
    elapsed_point_count INTEGER NOT NULL CHECK (
        elapsed_point_count >= 0 AND elapsed_point_count <= point_count
    ),
    PRIMARY KEY (origin_id, session_id, exercise_id, kind),
    FOREIGN KEY (origin_id, session_id, exercise_id)
        REFERENCES training_exercise_route_assessment (origin_id, session_id, exercise_id)
);

CREATE TABLE training_route_point (
    origin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('primary', 'transition')),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    latitude_degrees REAL NOT NULL CHECK (
        latitude_degrees >= -90 AND latitude_degrees <= 90
    ),
    longitude_degrees REAL NOT NULL CHECK (
        longitude_degrees >= -180 AND longitude_degrees <= 180
    ),
    altitude_meters REAL,
    elapsed_milliseconds INTEGER CHECK (
        elapsed_milliseconds IS NULL OR elapsed_milliseconds >= 0
    ),
    PRIMARY KEY (origin_id, session_id, exercise_id, kind, ordinal),
    FOREIGN KEY (origin_id, session_id, exercise_id, kind)
        REFERENCES training_route (origin_id, session_id, exercise_id, kind)
);

CREATE INDEX training_exercise_route_session_order
    ON training_exercise_route_assessment (origin_id, session_id, ordinal);

CREATE INDEX training_route_point_route_order
    ON training_route_point (origin_id, session_id, exercise_id, kind, ordinal);

CREATE TRIGGER training_session_route_discovery_revision_insert
AFTER INSERT ON training_session_route_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_route_discovery_revision_update
AFTER UPDATE ON training_session_route_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_session_route_discovery_revision_delete
AFTER DELETE ON training_session_route_assessment
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
