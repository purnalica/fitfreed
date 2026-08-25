CREATE TABLE provider_sport_catalogue_snapshot (
    source_provider TEXT NOT NULL CHECK (
        length(source_provider) BETWEEN 1 AND 128
        AND source_provider = trim(source_provider)
    ),
    catalogue_revision TEXT NOT NULL CHECK (
        length(catalogue_revision) BETWEEN 1 AND 256
        AND catalogue_revision = trim(catalogue_revision)
    ),
    mapping_version TEXT NOT NULL CHECK (
        length(mapping_version) BETWEEN 1 AND 256
        AND mapping_version = trim(mapping_version)
    ),
    retrieved_at_utc TEXT NOT NULL CHECK (
        length(retrieved_at_utc) BETWEEN 20 AND 64
        AND retrieved_at_utc = trim(retrieved_at_utc)
        AND substr(retrieved_at_utc, -1) = 'Z'
    ),
    provenance_uri TEXT NOT NULL CHECK (
        length(provenance_uri) BETWEEN 1 AND 2048
        AND provenance_uri = trim(provenance_uri)
    ),
    provenance_sha256 TEXT NOT NULL CHECK (
        length(provenance_sha256) = 64
        AND provenance_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    content_sha256 TEXT NOT NULL CHECK (
        length(content_sha256) = 64
        AND content_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    installed_at_utc TEXT NOT NULL,
    PRIMARY KEY (source_provider, catalogue_revision, mapping_version)
);

CREATE TABLE provider_sport_catalogue_entry (
    source_provider TEXT NOT NULL,
    catalogue_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    source_identifier TEXT NOT NULL CHECK (
        length(source_identifier) BETWEEN 1 AND 256
        AND source_identifier = trim(source_identifier)
    ),
    candidate_ordinal INTEGER NOT NULL CHECK (candidate_ordinal >= 0),
    provider_name_key TEXT NOT NULL CHECK (
        length(provider_name_key) BETWEEN 1 AND 256
        AND provider_name_key = trim(provider_name_key)
    ),
    localized_names_json TEXT NOT NULL CHECK (
        json_valid(localized_names_json)
        AND json_type(localized_names_json) = 'object'
    ),
    parent_identifier TEXT CHECK (
        parent_identifier IS NULL
        OR (
            length(parent_identifier) BETWEEN 1 AND 256
            AND parent_identifier = trim(parent_identifier)
        )
    ),
    canonical_family_suggestion TEXT CHECK (
        canonical_family_suggestion IS NULL
        OR canonical_family_suggestion IN (
            'running', 'cycling', 'swimming', 'walking', 'hiking', 'strength',
            'mobility', 'racket-sport', 'team-sport', 'winter-sport',
            'water-sport', 'other'
        )
    ),
    evidence_ref TEXT NOT NULL CHECK (
        length(evidence_ref) = 79
        AND substr(evidence_ref, 1, 15) = 'sport-evidence-'
        AND substr(evidence_ref, 16) NOT GLOB '*[^0-9a-f]*'
    ),
    PRIMARY KEY (
        source_provider, catalogue_revision, mapping_version,
        source_identifier, candidate_ordinal
    ),
    UNIQUE (evidence_ref),
    FOREIGN KEY (source_provider, catalogue_revision, mapping_version)
        REFERENCES provider_sport_catalogue_snapshot (
            source_provider, catalogue_revision, mapping_version
        ) ON DELETE CASCADE
);

CREATE INDEX provider_sport_catalogue_entry_lookup
    ON provider_sport_catalogue_entry (
        source_provider, source_identifier, catalogue_revision, mapping_version,
        candidate_ordinal
    );

CREATE TABLE provider_sport_catalogue_selection (
    source_provider TEXT PRIMARY KEY CHECK (
        length(source_provider) BETWEEN 1 AND 128
        AND source_provider = trim(source_provider)
    ),
    catalogue_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    selected_at_utc TEXT NOT NULL,
    FOREIGN KEY (source_provider, catalogue_revision, mapping_version)
        REFERENCES provider_sport_catalogue_snapshot (
            source_provider, catalogue_revision, mapping_version
        )
);

CREATE TRIGGER training_discovery_sport_catalogue_selection_insert
AFTER INSERT ON provider_sport_catalogue_selection
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_sport_catalogue_selection_update
AFTER UPDATE ON provider_sport_catalogue_selection
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER training_discovery_sport_catalogue_selection_delete
AFTER DELETE ON provider_sport_catalogue_selection
BEGIN
    UPDATE training_discovery_revision SET revision = revision + 1 WHERE id = 1;
END;
