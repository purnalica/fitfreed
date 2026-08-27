ALTER TABLE import_operation
ADD COLUMN package_identity TEXT
CHECK (
    package_identity IS NULL
    OR package_identity IN (
        'expected-provider-export',
        'unsupported-provider-export',
        'unrecognized'
    )
);
