ALTER TABLE training_discovery_workspace RENAME TO training_discovery_workspace_v2;

CREATE TABLE training_discovery_workspace (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workspace_version INTEGER NOT NULL CHECK (workspace_version IN (1, 2, 3)),
    snapshot_ref TEXT NOT NULL CHECK (
        length(snapshot_ref) = 82 AND snapshot_ref GLOB 'training-snapshot-[0-9a-f]*'
    ),
    from_date TEXT,
    through_date TEXT,
    sport_refs_json TEXT NOT NULL,
    required_measurements_json TEXT NOT NULL,
    text_filter TEXT,
    sort_code TEXT NOT NULL CHECK (
        sort_code IN ('started-desc', 'started-asc', 'duration-desc', 'distance-desc')
    ),
    page_offset INTEGER NOT NULL CHECK (page_offset >= 0 AND page_offset % 25 = 0),
    page_limit INTEGER NOT NULL CHECK (page_limit = 25),
    view_code TEXT NOT NULL CHECK (view_code IN ('chronology', 'calendar')),
    calendar_month TEXT,
    calendar_day TEXT,
    selected_session_refs_json TEXT NOT NULL,
    open_session_ref TEXT,
    updated_at_utc TEXT NOT NULL,
    CHECK (from_date IS NULL OR length(from_date) = 10),
    CHECK (through_date IS NULL OR length(through_date) = 10),
    CHECK (text_filter IS NULL OR length(text_filter) BETWEEN 1 AND 320),
    CHECK (
        (view_code = 'chronology' AND calendar_month IS NULL AND calendar_day IS NULL)
        OR (view_code = 'calendar' AND length(calendar_month) = 7
            AND (calendar_day IS NULL OR length(calendar_day) = 10))
    ),
    CHECK (open_session_ref IS NULL OR length(open_session_ref) = 72)
);

INSERT INTO training_discovery_workspace (
    id, workspace_version, snapshot_ref, from_date, through_date,
    sport_refs_json, required_measurements_json, text_filter, sort_code,
    page_offset, page_limit, view_code, calendar_month, calendar_day,
    selected_session_refs_json, open_session_ref, updated_at_utc
)
SELECT
    id, workspace_version, snapshot_ref, from_date, through_date,
    sport_refs_json, required_measurements_json, text_filter, sort_code,
    page_offset, page_limit, view_code, calendar_month, calendar_day,
    selected_session_refs_json, open_session_ref, updated_at_utc
FROM training_discovery_workspace_v2;

DROP TABLE training_discovery_workspace_v2;
