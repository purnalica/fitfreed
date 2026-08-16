CREATE TABLE sleep_period (
    origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    sleep_date TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    span_milliseconds INTEGER NOT NULL CHECK (span_milliseconds >= 0),
    asleep_milliseconds INTEGER NOT NULL CHECK (asleep_milliseconds >= 0),
    interruption_milliseconds INTEGER NOT NULL CHECK (interruption_milliseconds >= 0),
    long_interruption_milliseconds INTEGER NOT NULL CHECK (
        long_interruption_milliseconds >= 0
    ),
    short_interruption_milliseconds INTEGER NOT NULL CHECK (
        short_interruption_milliseconds >= 0
    ),
    interruption_count INTEGER NOT NULL CHECK (interruption_count >= 0),
    long_interruption_count INTEGER NOT NULL CHECK (long_interruption_count >= 0),
    short_interruption_count INTEGER NOT NULL CHECK (short_interruption_count >= 0),
    efficiency_percent REAL NOT NULL CHECK (
        efficiency_percent >= 0 AND efficiency_percent <= 100
    ),
    continuity_index REAL NOT NULL CHECK (
        continuity_index >= 0 AND continuity_index <= 5
    ),
    continuity_class INTEGER NOT NULL CHECK (
        continuity_class >= 0 AND continuity_class <= 5
    ),
    sleep_goal_milliseconds INTEGER CHECK (sleep_goal_milliseconds >= 0),
    self_reported_rating INTEGER CHECK (
        self_reported_rating >= 1 AND self_reported_rating <= 5
    ),
    cycle_count INTEGER CHECK (cycle_count >= 0),
    recording_ended_by_power_loss INTEGER CHECK (
        recording_ended_by_power_loss IN (0, 1)
    ),
    phase_wake_milliseconds INTEGER CHECK (phase_wake_milliseconds >= 0),
    phase_rem_milliseconds INTEGER CHECK (phase_rem_milliseconds >= 0),
    phase_light_milliseconds INTEGER CHECK (phase_light_milliseconds >= 0),
    phase_deep_milliseconds INTEGER CHECK (phase_deep_milliseconds >= 0),
    phase_unrecognized_milliseconds INTEGER CHECK (
        phase_unrecognized_milliseconds >= 0
    ),
    stage_timeline_available INTEGER NOT NULL CHECK (
        stage_timeline_available IN (0, 1)
    ),
    score_overall REAL CHECK (score_overall >= 1 AND score_overall <= 100),
    score_own_target_duration REAL CHECK (
        score_own_target_duration >= 1 AND score_own_target_duration <= 100
    ),
    score_recommended_duration REAL CHECK (
        score_recommended_duration >= 1 AND score_recommended_duration <= 100
    ),
    score_continuity REAL CHECK (score_continuity >= 1 AND score_continuity <= 100),
    score_efficiency REAL CHECK (score_efficiency >= 1 AND score_efficiency <= 100),
    score_rem REAL CHECK (score_rem >= 1 AND score_rem <= 100),
    score_deep REAL CHECK (score_deep >= 1 AND score_deep <= 100),
    score_long_interruptions REAL CHECK (
        score_long_interruptions >= 1 AND score_long_interruptions <= 100
    ),
    score_duration REAL CHECK (score_duration >= 1 AND score_duration <= 100),
    score_solidity REAL CHECK (score_solidity >= 1 AND score_solidity <= 100),
    score_regeneration REAL CHECK (
        score_regeneration >= 1 AND score_regeneration <= 100
    ),
    score_relative_rating INTEGER CHECK (
        score_relative_rating >= 1 AND score_relative_rating <= 5
    ),
    CHECK (asleep_milliseconds + interruption_milliseconds = span_milliseconds),
    CHECK (
        long_interruption_milliseconds + short_interruption_milliseconds
        = interruption_milliseconds
    ),
    CHECK (long_interruption_count + short_interruption_count = interruption_count),
    CHECK (
        (
            phase_wake_milliseconds IS NULL
            AND phase_rem_milliseconds IS NULL
            AND phase_light_milliseconds IS NULL
            AND phase_deep_milliseconds IS NULL
            AND phase_unrecognized_milliseconds IS NULL
        ) OR (
            phase_wake_milliseconds IS NOT NULL
            AND phase_rem_milliseconds IS NOT NULL
            AND phase_light_milliseconds IS NOT NULL
            AND phase_deep_milliseconds IS NOT NULL
            AND phase_unrecognized_milliseconds IS NOT NULL
            AND phase_wake_milliseconds + phase_rem_milliseconds
                + phase_light_milliseconds + phase_deep_milliseconds
                + phase_unrecognized_milliseconds = span_milliseconds
            AND phase_rem_milliseconds + phase_light_milliseconds
                + phase_deep_milliseconds + phase_unrecognized_milliseconds
                = asleep_milliseconds
        )
    ),
    CHECK (
        (
            score_overall IS NULL
            AND score_own_target_duration IS NULL
            AND score_recommended_duration IS NULL
            AND score_continuity IS NULL
            AND score_efficiency IS NULL
            AND score_rem IS NULL
            AND score_deep IS NULL
            AND score_long_interruptions IS NULL
            AND score_duration IS NULL
            AND score_solidity IS NULL
            AND score_regeneration IS NULL
            AND score_relative_rating IS NULL
        ) OR (
            score_overall IS NOT NULL
            AND score_own_target_duration IS NOT NULL
            AND score_recommended_duration IS NOT NULL
            AND score_continuity IS NOT NULL
            AND score_efficiency IS NOT NULL
            AND score_rem IS NOT NULL
            AND score_deep IS NOT NULL
            AND score_long_interruptions IS NOT NULL
            AND score_duration IS NOT NULL
            AND score_solidity IS NOT NULL
            AND score_regeneration IS NOT NULL
        )
    ),
    PRIMARY KEY (origin_id, sleep_date)
);

CREATE INDEX sleep_period_date_origin
    ON sleep_period (sleep_date, origin_id);

CREATE TABLE sleep_stage_transition (
    origin_id TEXT NOT NULL,
    sleep_date TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    offset_milliseconds INTEGER NOT NULL CHECK (offset_milliseconds >= 0),
    stage TEXT NOT NULL CHECK (
        stage IN ('wake', 'rem', 'light', 'deep', 'unrecognized')
    ),
    PRIMARY KEY (origin_id, sleep_date, position),
    FOREIGN KEY (origin_id, sleep_date)
        REFERENCES sleep_period (origin_id, sleep_date) ON DELETE CASCADE
);

CREATE TABLE sleep_period_provenance (
    id INTEGER PRIMARY KEY,
    origin_id TEXT NOT NULL,
    sleep_date TEXT NOT NULL,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    result_artifact_locator TEXT NOT NULL,
    result_artifact_sha256 TEXT NOT NULL CHECK (
        length(result_artifact_sha256) = 64
    ),
    score_artifact_locator TEXT,
    score_artifact_sha256 TEXT CHECK (
        score_artifact_sha256 IS NULL OR length(score_artifact_sha256) = 64
    ),
    source_provider TEXT NOT NULL,
    source_adapter_version TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    reconciliation_decision TEXT NOT NULL CHECK (
        reconciliation_decision IN (
            'create', 'equivalent', 'enrich', 'preserve', 'conflict'
        )
    ),
    contributes_to_visible_state INTEGER NOT NULL CHECK (
        contributes_to_visible_state IN (0, 1)
    ),
    CHECK (
        (score_artifact_locator IS NULL) = (score_artifact_sha256 IS NULL)
    ),
    FOREIGN KEY (origin_id, sleep_date)
        REFERENCES sleep_period (origin_id, sleep_date)
);

CREATE INDEX sleep_period_provenance_observation
    ON sleep_period_provenance (origin_id, sleep_date, import_operation_id);

CREATE TABLE sleep_period_conflict (
    id INTEGER PRIMARY KEY,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    origin_id TEXT NOT NULL,
    sleep_date TEXT NOT NULL,
    result_artifact_locator TEXT NOT NULL,
    score_artifact_locator TEXT,
    mapping_version TEXT NOT NULL,
    FOREIGN KEY (origin_id, sleep_date)
        REFERENCES sleep_period (origin_id, sleep_date)
);

CREATE INDEX sleep_period_conflict_operation
    ON sleep_period_conflict (import_operation_id);
