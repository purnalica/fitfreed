use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

use thiserror::Error;

pub const PLANNED_TRAINING_EXPORT_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizedDataExportRequest {
    pub destination: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizedDataExportReceipt {
    pub byte_count: u64,
    pub sha256: String,
    pub library_revision: u64,
    pub target_count: u64,
    pub target_revision_count: u64,
    pub favorite_snapshot_count: u64,
}

#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum NormalizedDataExportPortError {
    #[error("normalized data export was cancelled")]
    Cancelled,
    #[error("normalized data export failed: {0}")]
    Failure(String),
}

pub trait NormalizedDataExportPort {
    fn export_planned_training(
        &self,
        destination: &Path,
        cancellation: &NormalizedDataExportCancellation,
    ) -> Result<NormalizedDataExportReceipt, NormalizedDataExportPortError>;
}

#[derive(Debug, Default)]
pub struct NormalizedDataExportCancellation {
    cancelled: AtomicBool,
}

impl NormalizedDataExportCancellation {
    pub const fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }
}

pub fn export_planned_training_data(
    port: &dyn NormalizedDataExportPort,
    request: NormalizedDataExportRequest,
    cancellation: &NormalizedDataExportCancellation,
) -> Result<NormalizedDataExportReceipt, NormalizedDataExportError> {
    if cancellation.is_cancelled() {
        return Err(NormalizedDataExportError::Cancelled);
    }
    port.export_planned_training(&request.destination, cancellation)
        .map_err(|error| match error {
            NormalizedDataExportPortError::Cancelled => NormalizedDataExportError::Cancelled,
            NormalizedDataExportPortError::Failure(message) => {
                NormalizedDataExportError::Failure(message)
            }
        })
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum NormalizedDataExportError {
    #[error("normalized data export was cancelled")]
    Cancelled,
    #[error("normalized data export failed: {0}")]
    Failure(String),
}
