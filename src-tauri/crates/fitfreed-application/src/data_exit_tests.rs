use std::{
    path::Path,
    sync::atomic::{AtomicUsize, Ordering},
};

use super::{
    export_planned_training_data, NormalizedDataExportCancellation, NormalizedDataExportError,
    NormalizedDataExportPort, NormalizedDataExportPortError, NormalizedDataExportReceipt,
    NormalizedDataExportRequest,
};

struct RecordingExportPort {
    calls: AtomicUsize,
    outcome: Result<NormalizedDataExportReceipt, NormalizedDataExportPortError>,
}

impl NormalizedDataExportPort for RecordingExportPort {
    fn export_planned_training(
        &self,
        destination: &Path,
        cancellation: &NormalizedDataExportCancellation,
    ) -> Result<NormalizedDataExportReceipt, NormalizedDataExportPortError> {
        assert_eq!(destination, Path::new("/synthetic/planned-training.json"));
        assert!(!cancellation.is_cancelled());
        self.calls.fetch_add(1, Ordering::Relaxed);
        self.outcome.clone()
    }
}

#[test]
fn authorizes_one_planned_training_export_through_the_output_port() {
    let expected = NormalizedDataExportReceipt {
        byte_count: 1_024,
        sha256: "a".repeat(64),
        library_revision: 7,
        target_count: 3,
        target_revision_count: 4,
        favorite_snapshot_count: 2,
    };
    let port = RecordingExportPort {
        calls: AtomicUsize::new(0),
        outcome: Ok(expected.clone()),
    };

    let receipt = export_planned_training_data(
        &port,
        NormalizedDataExportRequest {
            destination: "/synthetic/planned-training.json".into(),
        },
        &NormalizedDataExportCancellation::new(),
    )
    .expect("authorized normalized export");

    assert_eq!(receipt, expected);
    assert_eq!(port.calls.load(Ordering::Relaxed), 1);
}

#[test]
fn rejects_pre_cancelled_export_before_invoking_the_output_port() {
    let port = RecordingExportPort {
        calls: AtomicUsize::new(0),
        outcome: Err(NormalizedDataExportPortError::Failure(
            "must not be observed".to_owned(),
        )),
    };
    let cancellation = NormalizedDataExportCancellation::new();
    cancellation.cancel();

    let outcome = export_planned_training_data(
        &port,
        NormalizedDataExportRequest {
            destination: "/synthetic/planned-training.json".into(),
        },
        &cancellation,
    );

    assert_eq!(outcome, Err(NormalizedDataExportError::Cancelled));
    assert_eq!(port.calls.load(Ordering::Relaxed), 0);
}

#[test]
fn preserves_cancelled_and_failed_adapter_outcomes() {
    for (port_error, expected) in [
        (
            NormalizedDataExportPortError::Cancelled,
            NormalizedDataExportError::Cancelled,
        ),
        (
            NormalizedDataExportPortError::Failure("closed destination".to_owned()),
            NormalizedDataExportError::Failure("closed destination".to_owned()),
        ),
    ] {
        let port = RecordingExportPort {
            calls: AtomicUsize::new(0),
            outcome: Err(port_error),
        };

        let outcome = export_planned_training_data(
            &port,
            NormalizedDataExportRequest {
                destination: "/synthetic/planned-training.json".into(),
            },
            &NormalizedDataExportCancellation::new(),
        );

        assert_eq!(outcome, Err(expected));
        assert_eq!(port.calls.load(Ordering::Relaxed), 1);
    }
}
