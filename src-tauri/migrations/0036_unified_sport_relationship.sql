CREATE TABLE unified_sport_relationship (
    relationship_ref TEXT PRIMARY KEY CHECK (
        length(relationship_ref) = 78
        AND substr(relationship_ref, 1, 14) = 'unified:sport-'
        AND substr(relationship_ref, 15) NOT GLOB '*[^0-9a-f]*'
    ),
    primary_session_filter_ref TEXT NOT NULL CHECK (
        length(primary_session_filter_ref) = 70
        AND substr(primary_session_filter_ref, 1, 6) = 'sport-'
        AND substr(primary_session_filter_ref, 7) NOT GLOB '*[^0-9a-f]*'
    ),
    authorship TEXT NOT NULL CHECK (authorship = 'user'),
    revision INTEGER NOT NULL CHECK (revision > 0),
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE unified_sport_relationship_member (
    relationship_ref TEXT NOT NULL REFERENCES unified_sport_relationship (relationship_ref)
        ON DELETE CASCADE,
    session_filter_ref TEXT NOT NULL UNIQUE CHECK (
        length(session_filter_ref) = 70
        AND substr(session_filter_ref, 1, 6) = 'sport-'
        AND substr(session_filter_ref, 7) NOT GLOB '*[^0-9a-f]*'
    ),
    PRIMARY KEY (relationship_ref, session_filter_ref)
);

CREATE TRIGGER unified_sport_relationship_discovery_insert
AFTER INSERT ON unified_sport_relationship
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_discovery_update
AFTER UPDATE ON unified_sport_relationship
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_discovery_delete
AFTER DELETE ON unified_sport_relationship
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_member_discovery_insert
AFTER INSERT ON unified_sport_relationship_member
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_member_discovery_update
AFTER UPDATE ON unified_sport_relationship_member
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_member_discovery_delete
AFTER DELETE ON unified_sport_relationship_member
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
