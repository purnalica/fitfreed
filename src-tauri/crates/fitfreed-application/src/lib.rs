use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use thiserror::Error;

use fitfreed_domain::{DailyActivity, ImportOutcome, ImportReport};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalePreference {
    EnUs,
    EsEs,
}

impl LocalePreference {
    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"en-US" => Some(Self::EnUs),
            b"es-ES" => Some(Self::EsEs),
            _ => None,
        }
    }

    pub const fn code(self) -> &'static str {
        match self {
            Self::EnUs => "en-US",
            Self::EsEs => "es-ES",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportPhase {
    Fingerprinting,
    Validating,
    Importing,
    Committing,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportProgress {
    pub phase: ImportPhase,
    pub completed_artifacts: usize,
    pub total_artifacts: Option<usize>,
    pub completed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub cancellable: bool,
}

impl ImportProgress {
    pub fn phase(phase: ImportPhase) -> Self {
        Self {
            phase,
            completed_artifacts: 0,
            total_artifacts: None,
            completed_bytes: 0,
            total_bytes: None,
            cancellable: !matches!(
                phase,
                ImportPhase::Committing | ImportPhase::Completed | ImportPhase::Cancelled
            ),
        }
    }

    pub fn fingerprinting(completed_bytes: u64, total_bytes: u64) -> Self {
        Self {
            completed_bytes,
            total_bytes: Some(total_bytes),
            ..Self::phase(ImportPhase::Fingerprinting)
        }
    }

    pub fn artifacts(phase: ImportPhase, completed: usize, total: usize) -> Self {
        Self {
            completed_artifacts: completed,
            total_artifacts: Some(total),
            ..Self::phase(phase)
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ImportPhaseTimings {
    pub fingerprint_milliseconds: f64,
    pub database_setup_milliseconds: f64,
    pub repeat_lookup_milliseconds: f64,
    pub archive_validation_milliseconds: f64,
    pub read_decode_map_milliseconds: f64,
    pub reconciliation_milliseconds: f64,
    pub transaction_control_milliseconds: f64,
    pub total_milliseconds: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProfiledImport {
    pub report: ImportReport,
    pub timings: ImportPhaseTimings,
}

pub trait ArchiveImportPort {
    fn import_archive(
        &self,
        archive_path: &Path,
        cancellation: &AtomicBool,
        on_progress: &mut dyn FnMut(ImportProgress),
    ) -> Result<ImportReport, String>;
}

pub trait ActivityLibraryPort {
    fn query_activity(&self) -> Result<Vec<DailyActivity>, String>;
}

pub trait ImportOutcomeLibraryPort {
    fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String>;
}

pub trait LocalePreferencePort {
    fn load_locale(&self) -> Result<Option<LocalePreference>, String>;
    fn save_locale(&self, locale: LocalePreference) -> Result<(), String>;
}

#[derive(Debug, Error)]
pub enum ApplicationError {
    #[error("another import is already active")]
    ImportAlreadyActive,
    #[error("import coordination failed: {0}")]
    Coordination(String),
    #[error("{0}")]
    Import(String),
    #[error("library query failed: {0}")]
    Query(String),
    #[error("import outcome query failed: {0}")]
    OutcomeQuery(String),
    #[error("locale preference query failed: {0}")]
    PreferenceQuery(String),
    #[error("locale preference update failed: {0}")]
    PreferenceUpdate(String),
}

#[derive(Clone, Default)]
pub struct ImportCoordinator {
    active_cancellation: Arc<Mutex<Option<Arc<AtomicBool>>>>,
}

impl ImportCoordinator {
    fn begin(&self) -> Result<Arc<AtomicBool>, ApplicationError> {
        let mut active = self
            .active_cancellation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if active.is_some() {
            return Err(ApplicationError::ImportAlreadyActive);
        }
        let cancellation = Arc::new(AtomicBool::new(false));
        *active = Some(Arc::clone(&cancellation));
        Ok(cancellation)
    }

    pub fn cancel(&self) -> Result<bool, ApplicationError> {
        let active = self
            .active_cancellation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if let Some(cancellation) = active.as_ref() {
            cancellation.store(true, Ordering::Relaxed);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn finish(&self, cancellation: &Arc<AtomicBool>) -> Result<(), ApplicationError> {
        let mut active = self
            .active_cancellation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if active
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, cancellation))
        {
            *active = None;
        }
        Ok(())
    }
}

pub fn import_archive(
    port: &dyn ArchiveImportPort,
    coordinator: &ImportCoordinator,
    archive_path: &Path,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<ImportReport, ApplicationError> {
    let cancellation = coordinator.begin()?;
    let result = port
        .import_archive(archive_path, &cancellation, on_progress)
        .map_err(ApplicationError::Import);
    coordinator.finish(&cancellation)?;
    result
}

pub fn query_activity(
    port: &dyn ActivityLibraryPort,
) -> Result<Vec<DailyActivity>, ApplicationError> {
    port.query_activity().map_err(ApplicationError::Query)
}

pub fn query_latest_import_outcome(
    port: &dyn ImportOutcomeLibraryPort,
) -> Result<Option<ImportOutcome>, ApplicationError> {
    port.latest_import_outcome()
        .map_err(ApplicationError::OutcomeQuery)
}

pub fn load_locale_preference(
    port: &dyn LocalePreferencePort,
) -> Result<Option<LocalePreference>, ApplicationError> {
    port.load_locale()
        .map_err(ApplicationError::PreferenceQuery)
}

pub fn save_locale_preference(
    port: &dyn LocalePreferencePort,
    locale: LocalePreference,
) -> Result<(), ApplicationError> {
    port.save_locale(locale)
        .map_err(ApplicationError::PreferenceUpdate)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct ControlledImportPort;

    struct ControlledOutcomePort;

    struct ControlledLocalePort;

    impl ArchiveImportPort for ControlledImportPort {
        fn import_archive(
            &self,
            _archive_path: &Path,
            cancellation: &AtomicBool,
            _on_progress: &mut dyn FnMut(ImportProgress),
        ) -> Result<ImportReport, String> {
            assert!(!cancellation.load(Ordering::Relaxed));
            Ok(ImportReport::assessed())
        }
    }

    impl ImportOutcomeLibraryPort for ControlledOutcomePort {
        fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String> {
            Ok(None)
        }
    }

    impl LocalePreferencePort for ControlledLocalePort {
        fn load_locale(&self) -> Result<Option<LocalePreference>, String> {
            Ok(Some(LocalePreference::EsEs))
        }

        fn save_locale(&self, locale: LocalePreference) -> Result<(), String> {
            assert_eq!(locale, LocalePreference::EnUs);
            Ok(())
        }
    }

    #[test]
    fn coordinates_one_import_and_releases_the_slot_after_execution() {
        let coordinator = ImportCoordinator::default();
        let mut progress = |_| {};

        import_archive(
            &ControlledImportPort,
            &coordinator,
            Path::new("synthetic.zip"),
            &mut progress,
        )
        .expect("first import");

        assert!(!coordinator.cancel().expect("no active import"));
        import_archive(
            &ControlledImportPort,
            &coordinator,
            Path::new("synthetic.zip"),
            &mut progress,
        )
        .expect("subsequent import");
    }

    #[test]
    fn queries_the_latest_outcome_through_a_dedicated_read_port() {
        assert_eq!(
            query_latest_import_outcome(&ControlledOutcomePort).expect("outcome query"),
            None
        );
    }

    #[test]
    fn loads_and_updates_a_validated_locale_through_the_preference_port() {
        assert_eq!(
            LocalePreference::from_code("es-ES"),
            Some(LocalePreference::EsEs)
        );
        assert_eq!(LocalePreference::from_code("es"), None);
        assert_eq!(
            load_locale_preference(&ControlledLocalePort).expect("locale query"),
            Some(LocalePreference::EsEs)
        );
        save_locale_preference(&ControlledLocalePort, LocalePreference::EnUs)
            .expect("locale update");
    }
}
