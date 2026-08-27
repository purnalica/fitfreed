CREATE TABLE planned_training_phase_v33 (
    origin_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence_revision TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    phase_id TEXT NOT NULL CHECK (
        length(phase_id) = 78
        AND substr(phase_id, 1, 14) = 'planned-phase-'
        AND substr(phase_id, 15) NOT GLOB '*[^0-9a-f]*'
    ),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    name TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 120),
    goal_kind TEXT NOT NULL CHECK (goal_kind IN ('duration', 'distance', 'unmapped')),
    duration_goal_milliseconds INTEGER CHECK (
        duration_goal_milliseconds IS NULL OR duration_goal_milliseconds > 0
    ),
    distance_goal_meters REAL CHECK (distance_goal_meters IS NULL OR distance_goal_meters > 0),
    intensity_kind TEXT NOT NULL CHECK (intensity_kind IN ('none', 'zone-range', 'unmapped')),
    intensity_metric TEXT CHECK (intensity_metric IN ('heart-rate', 'speed', 'power')),
    lower_zone INTEGER CHECK (lower_zone BETWEEN 1 AND 5),
    upper_zone INTEGER CHECK (upper_zone BETWEEN 1 AND 5),
    transition_id TEXT NOT NULL CHECK (
        length(transition_id) = 83
        AND substr(transition_id, 1, 19) = 'planned-transition-'
        AND substr(transition_id, 20) NOT GLOB '*[^0-9a-f]*'
    ),
    change_kind TEXT NOT NULL CHECK (change_kind IN ('manual', 'automatic', 'unmapped')),
    repeat_id TEXT CHECK (
        repeat_id IS NULL
        OR (
            length(repeat_id) = 79
            AND substr(repeat_id, 1, 15) = 'planned-repeat-'
            AND substr(repeat_id, 16) NOT GLOB '*[^0-9a-f]*'
        )
    ),
    return_to_phase_ordinal INTEGER CHECK (return_to_phase_ordinal >= 0),
    total_iterations INTEGER CHECK (total_iterations BETWEEN 2 AND 100),
    PRIMARY KEY (origin_id, target_id, evidence_revision, mapping_version, exercise_id, phase_id),
    UNIQUE (origin_id, target_id, evidence_revision, mapping_version, exercise_id, ordinal),
    FOREIGN KEY (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id
    ) REFERENCES planned_training_exercise (
        origin_id, target_id, evidence_revision, mapping_version, exercise_id
    ) ON DELETE CASCADE,
    CHECK (
        (goal_kind = 'duration' AND duration_goal_milliseconds IS NOT NULL AND distance_goal_meters IS NULL)
        OR (goal_kind = 'distance' AND duration_goal_milliseconds IS NULL AND distance_goal_meters IS NOT NULL)
        OR (goal_kind = 'unmapped' AND duration_goal_milliseconds IS NULL AND distance_goal_meters IS NULL)
    ),
    CHECK (
        (intensity_kind = 'zone-range' AND intensity_metric IS NOT NULL
            AND lower_zone IS NOT NULL AND upper_zone IS NOT NULL AND lower_zone <= upper_zone)
        OR (intensity_kind IN ('none', 'unmapped') AND intensity_metric IS NULL
            AND lower_zone IS NULL AND upper_zone IS NULL)
    ),
    CHECK (
        (repeat_id IS NULL AND return_to_phase_ordinal IS NULL AND total_iterations IS NULL)
        OR (repeat_id IS NOT NULL AND return_to_phase_ordinal IS NOT NULL AND total_iterations IS NOT NULL)
    )
);

INSERT INTO planned_training_phase_v33 (
    origin_id, target_id, evidence_revision, mapping_version, exercise_id,
    phase_id, ordinal, name, goal_kind, duration_goal_milliseconds,
    distance_goal_meters, intensity_kind, intensity_metric, lower_zone, upper_zone,
    transition_id, change_kind, repeat_id, return_to_phase_ordinal, total_iterations
)
SELECT
    origin_id, target_id, evidence_revision, mapping_version, exercise_id,
    phase_id, ordinal, name, goal_kind, duration_goal_milliseconds,
    distance_goal_meters, intensity_kind, intensity_metric, lower_zone, upper_zone,
    transition_id, change_kind, repeat_id, return_to_phase_ordinal, total_iterations
FROM planned_training_phase;

DROP TABLE planned_training_phase;
ALTER TABLE planned_training_phase_v33 RENAME TO planned_training_phase;
