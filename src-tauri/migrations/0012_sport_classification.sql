CREATE TABLE sport_classification (
    origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    source_sport_ref TEXT NOT NULL CHECK (length(source_sport_ref) > 0),
    classification_state TEXT NOT NULL CHECK (
        classification_state IN ('unknown', 'classified')
    ),
    canonical_family TEXT CHECK (
        canonical_family IS NULL OR canonical_family IN (
            'running', 'cycling', 'swimming', 'walking', 'hiking', 'strength',
            'mobility', 'racket-sport', 'team-sport', 'winter-sport',
            'water-sport', 'other'
        )
    ),
    display_label TEXT CHECK (
        display_label IS NULL
        OR (
            length(trim(display_label)) BETWEEN 1 AND 80
            AND display_label = trim(display_label)
        )
    ),
    authorship TEXT NOT NULL CHECK (authorship = 'user'),
    revision INTEGER NOT NULL CHECK (revision > 0),
    updated_at_utc TEXT NOT NULL,
    CHECK (
        (classification_state = 'unknown'
            AND canonical_family IS NULL
            AND display_label IS NULL)
        OR
        (classification_state = 'classified'
            AND (canonical_family IS NOT NULL OR display_label IS NOT NULL))
    ),
    PRIMARY KEY (origin_id, source_sport_ref)
);

CREATE INDEX training_session_origin_sport_start
    ON training_session (origin_id, sport_ref, started_at_local, session_id);
