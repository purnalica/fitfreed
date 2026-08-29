CREATE TABLE unified_sport_relationship_source_selector (
    relationship_ref TEXT NOT NULL REFERENCES unified_sport_relationship (relationship_ref)
        ON DELETE CASCADE,
    origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    source_sport_ref TEXT NOT NULL CHECK (length(source_sport_ref) > 0),
    primary_identity INTEGER NOT NULL CHECK (primary_identity IN (0, 1)),
    PRIMARY KEY (relationship_ref, origin_id, source_sport_ref),
    UNIQUE (origin_id, source_sport_ref)
);

CREATE TABLE unified_sport_relationship_member_selector (
    relationship_ref TEXT NOT NULL,
    session_filter_ref TEXT NOT NULL,
    origin_id TEXT NOT NULL,
    source_sport_ref TEXT NOT NULL,
    PRIMARY KEY (relationship_ref, session_filter_ref),
    FOREIGN KEY (relationship_ref, session_filter_ref)
        REFERENCES unified_sport_relationship_member (relationship_ref, session_filter_ref)
        ON DELETE CASCADE,
    FOREIGN KEY (relationship_ref, origin_id, source_sport_ref)
        REFERENCES unified_sport_relationship_source_selector (
            relationship_ref, origin_id, source_sport_ref
        ) ON DELETE CASCADE
);

CREATE TRIGGER unified_sport_relationship_source_selector_discovery_insert
AFTER INSERT ON unified_sport_relationship_source_selector
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_source_selector_discovery_update
AFTER UPDATE ON unified_sport_relationship_source_selector
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_source_selector_discovery_delete
AFTER DELETE ON unified_sport_relationship_source_selector
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_member_selector_discovery_insert
AFTER INSERT ON unified_sport_relationship_member_selector
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_member_selector_discovery_update
AFTER UPDATE ON unified_sport_relationship_member_selector
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER unified_sport_relationship_member_selector_discovery_delete
AFTER DELETE ON unified_sport_relationship_member_selector
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
