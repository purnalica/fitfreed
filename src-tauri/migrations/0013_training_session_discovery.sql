CREATE TABLE training_discovery_revision (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9223372036854775806)
);

INSERT INTO training_discovery_revision (id, revision) VALUES (1, 1);

CREATE TRIGGER training_discovery_session_insert
AFTER INSERT ON training_session
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_session_update
AFTER UPDATE ON training_session
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_session_delete
AFTER DELETE ON training_session
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_classification_insert
AFTER INSERT ON sport_classification
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_classification_update
AFTER UPDATE ON sport_classification
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_classification_delete
AFTER DELETE ON sport_classification
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE INDEX training_session_duration_start_identity
    ON training_session (
        duration_milliseconds DESC, started_at_local DESC, origin_id, session_id
    );

CREATE INDEX training_session_distance_start_identity
    ON training_session (
        distance_meters DESC, started_at_local DESC, origin_id, session_id
    );
