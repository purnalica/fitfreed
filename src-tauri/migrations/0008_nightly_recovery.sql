CREATE TABLE nightly_recovery (
    origin_id TEXT NOT NULL REFERENCES observation_origin (id),
    recovery_date TEXT NOT NULL,
    beat_to_beat_interval_milliseconds INTEGER NOT NULL CHECK (
        beat_to_beat_interval_milliseconds > 0
    ),
    heart_rate_variability_rmssd_milliseconds INTEGER CHECK (
        heart_rate_variability_rmssd_milliseconds >= 0
    ),
    breathing_interval_milliseconds INTEGER NOT NULL CHECK (
        breathing_interval_milliseconds > 0
    ),
    assessment_scheme TEXT,
    autonomic_charge REAL CHECK (
        autonomic_charge >= -10 AND autonomic_charge <= 10
    ),
    autonomic_status INTEGER CHECK (
        autonomic_status >= 1 AND autonomic_status <= 5
    ),
    overall_status INTEGER CHECK (
        overall_status >= 1 AND overall_status <= 6
    ),
    overall_sublevel INTEGER,
    baseline_scheme TEXT,
    baseline_mean_beat_to_beat_interval_milliseconds INTEGER CHECK (
        baseline_mean_beat_to_beat_interval_milliseconds > 0
    ),
    baseline_standard_deviation_beat_to_beat_interval_milliseconds INTEGER CHECK (
        baseline_standard_deviation_beat_to_beat_interval_milliseconds >= 0
    ),
    baseline_mean_heart_rate_variability_rmssd_milliseconds INTEGER CHECK (
        baseline_mean_heart_rate_variability_rmssd_milliseconds >= 0
    ),
    baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds INTEGER CHECK (
        baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds >= 0
    ),
    baseline_mean_breathing_interval_milliseconds INTEGER CHECK (
        baseline_mean_breathing_interval_milliseconds > 0
    ),
    baseline_standard_deviation_breathing_interval_milliseconds INTEGER CHECK (
        baseline_standard_deviation_breathing_interval_milliseconds >= 0
    ),
    guidance_scheme TEXT,
    exercise_guidance TEXT,
    sleep_guidance TEXT,
    vitality_guidance TEXT,
    CHECK (
        (
            assessment_scheme IS NULL
            AND autonomic_charge IS NULL
            AND autonomic_status IS NULL
            AND overall_status IS NULL
            AND overall_sublevel IS NULL
        ) OR (
            assessment_scheme IS NOT NULL
            AND length(trim(assessment_scheme)) > 0
            AND autonomic_charge IS NOT NULL
            AND autonomic_status IS NOT NULL
            AND overall_status IS NOT NULL
            AND overall_sublevel IS NOT NULL
        )
    ),
    CHECK (
        (
            baseline_scheme IS NULL
            AND baseline_mean_beat_to_beat_interval_milliseconds IS NULL
            AND baseline_standard_deviation_beat_to_beat_interval_milliseconds IS NULL
            AND baseline_mean_heart_rate_variability_rmssd_milliseconds IS NULL
            AND baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds IS NULL
            AND baseline_mean_breathing_interval_milliseconds IS NULL
            AND baseline_standard_deviation_breathing_interval_milliseconds IS NULL
        ) OR (
            baseline_scheme IS NOT NULL
            AND length(trim(baseline_scheme)) > 0
            AND baseline_mean_beat_to_beat_interval_milliseconds IS NOT NULL
            AND baseline_standard_deviation_beat_to_beat_interval_milliseconds IS NOT NULL
            AND baseline_mean_breathing_interval_milliseconds IS NOT NULL
            AND baseline_standard_deviation_breathing_interval_milliseconds IS NOT NULL
            AND (
                (
                    baseline_mean_heart_rate_variability_rmssd_milliseconds IS NULL
                    AND baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds IS NULL
                ) OR (
                    baseline_mean_heart_rate_variability_rmssd_milliseconds IS NOT NULL
                    AND baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds IS NOT NULL
                )
            )
        )
    ),
    CHECK (
        (
            guidance_scheme IS NULL
            AND exercise_guidance IS NULL
            AND sleep_guidance IS NULL
            AND vitality_guidance IS NULL
        ) OR (
            guidance_scheme IS NOT NULL
            AND length(trim(guidance_scheme)) > 0
            AND exercise_guidance IS NOT NULL
            AND length(trim(exercise_guidance)) > 0
            AND length(exercise_guidance) <= 4096
            AND sleep_guidance IS NOT NULL
            AND length(trim(sleep_guidance)) > 0
            AND length(sleep_guidance) <= 4096
            AND vitality_guidance IS NOT NULL
            AND length(trim(vitality_guidance)) > 0
            AND length(vitality_guidance) <= 4096
        )
    ),
    PRIMARY KEY (origin_id, recovery_date)
);

CREATE INDEX nightly_recovery_date_origin
    ON nightly_recovery (recovery_date, origin_id);

CREATE TABLE nightly_recovery_provenance (
    id INTEGER PRIMARY KEY,
    origin_id TEXT NOT NULL,
    recovery_date TEXT NOT NULL,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    artifact_locator TEXT NOT NULL,
    source_record_locator TEXT NOT NULL,
    source_artifact_sha256 TEXT NOT NULL CHECK (
        length(source_artifact_sha256) = 64
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
    FOREIGN KEY (origin_id, recovery_date)
        REFERENCES nightly_recovery (origin_id, recovery_date)
);

CREATE INDEX nightly_recovery_provenance_observation
    ON nightly_recovery_provenance (
        origin_id,
        recovery_date,
        import_operation_id
    );

CREATE TABLE nightly_recovery_conflict (
    id INTEGER PRIMARY KEY,
    import_operation_id INTEGER NOT NULL REFERENCES import_operation (id),
    origin_id TEXT NOT NULL,
    recovery_date TEXT NOT NULL,
    artifact_locator TEXT NOT NULL,
    source_record_locator TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    FOREIGN KEY (origin_id, recovery_date)
        REFERENCES nightly_recovery (origin_id, recovery_date)
);

CREATE INDEX nightly_recovery_conflict_operation
    ON nightly_recovery_conflict (import_operation_id);
