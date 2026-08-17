CREATE TABLE update_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    trusted_sequence INTEGER CHECK (
        trusted_sequence IS NULL
        OR trusted_sequence BETWEEN 1 AND 9007199254740991
    ),
    trusted_payload_sha256 TEXT CHECK (
        trusted_payload_sha256 IS NULL
        OR (
            length(trusted_payload_sha256) = 64
            AND trusted_payload_sha256 NOT GLOB '*[^0-9a-f]*'
        )
    ),
    trusted_release_version TEXT CHECK (
        trusted_release_version IS NULL
        OR (
            length(trim(trusted_release_version)) > 0
            AND length(trusted_release_version) <= 255
        )
    ),
    dismissed_version TEXT CHECK (
        dismissed_version IS NULL
        OR (
            length(trim(dismissed_version)) > 0
            AND length(dismissed_version) <= 255
        )
    ),
    postponed_version TEXT CHECK (
        postponed_version IS NULL
        OR (
            length(trim(postponed_version)) > 0
            AND length(postponed_version) <= 255
        )
    ),
    postponed_until TEXT CHECK (
        postponed_until IS NULL
        OR (
            length(trim(postponed_until)) > 0
            AND length(postponed_until) <= 64
        )
    ),
    updated_at_utc TEXT NOT NULL,
    CHECK (
        (
            trusted_sequence IS NULL
            AND trusted_payload_sha256 IS NULL
            AND trusted_release_version IS NULL
        ) OR (
            trusted_sequence IS NOT NULL
            AND trusted_payload_sha256 IS NOT NULL
            AND trusted_release_version IS NOT NULL
        )
    ),
    CHECK (
        (postponed_version IS NULL AND postponed_until IS NULL)
        OR (postponed_version IS NOT NULL AND postponed_until IS NOT NULL)
    ),
    CHECK (dismissed_version IS NULL OR postponed_version IS NULL),
    CHECK (
        dismissed_version IS NULL
        OR dismissed_version = trusted_release_version
    ),
    CHECK (
        postponed_version IS NULL
        OR postponed_version = trusted_release_version
    )
);
