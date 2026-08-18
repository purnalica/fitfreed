CREATE TABLE exploration_workspace (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workspace_version INTEGER NOT NULL CHECK (workspace_version = 1),
    destination TEXT NOT NULL CHECK (
        destination IN ('activity', 'training', 'sleep', 'recovery', 'longitudinal')
    ),
    updated_at_utc TEXT NOT NULL
);
