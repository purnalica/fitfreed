use std::{
    ffi::OsString,
    fs::{self, File, OpenOptions},
    io::{self, Read},
    path::{Path, PathBuf},
};

#[cfg(target_os = "windows")]
use std::process::Command;

use semver::Version;
use thiserror::Error;

pub(super) const PRODUCT_NAME: &str = "FitFreed";
const PUBLISHER: &str = "FitFreed contributors";
const HOMEPAGE: &str = "https://fitfreed.org/";
const APPLICATION_IDENTIFIER: &str = "org.fitfreed.desktop";
pub(super) const EXECUTABLE_NAME: &str = "fitfreed.exe";
pub(super) const UNINSTALLER_NAME: &str = "uninstall.exe";
#[cfg(target_os = "windows")]
const UNINSTALL_REGISTRY_SUBKEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Uninstall\FitFreed";
const PREDECESSOR_PACKAGE_RELATIVE_PATH: &str = "previous/package.exe";
const CANDIDATE_PACKAGE_RELATIVE_PATH: &str = "candidate/package.exe";
const INSTALLER_SILENT_ARGUMENT: &str = "/S";
const PROCESS_STOP_TIMEOUT_MILLISECONDS: u32 = 5_000;

#[derive(Debug, Error)]
pub enum WindowsUpdateRecoveryError {
    #[error("the Windows installation identity is invalid")]
    InvalidPackageIdentity,
    #[error("the predecessor NSIS package is invalid")]
    InvalidPredecessorPackage,
    #[error("the candidate NSIS package is invalid")]
    InvalidCandidatePackage,
    #[error("the native NSIS rollback failed")]
    NativeRollbackFailed,
    #[error("the native NSIS candidate installation failed")]
    NativeInstallationFailed,
    #[error("the Windows process identity is invalid")]
    InvalidProcessIdentity,
    #[error("the Windows process could not be stopped")]
    ProcessStopFailed,
    #[error("Windows update recovery input/output failure: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsNativePackageIdentity {
    version: String,
    install_directory: PathBuf,
    executable_path: PathBuf,
    uninstaller_path: PathBuf,
    application_data_directory: PathBuf,
}

impl WindowsNativePackageIdentity {
    pub fn version(&self) -> &str {
        &self.version
    }

    pub fn install_directory(&self) -> &Path {
        &self.install_directory
    }

    pub fn executable_path(&self) -> &Path {
        &self.executable_path
    }

    pub fn uninstaller_path(&self) -> &Path {
        &self.uninstaller_path
    }

    pub fn application_data_directory(&self) -> &Path {
        &self.application_data_directory
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsRecoveryProcessIdentity {
    process_id: u32,
    creation_time_filetime: u64,
    executable_path: PathBuf,
}

impl WindowsRecoveryProcessIdentity {
    pub fn process_id(&self) -> u32 {
        self.process_id
    }

    pub fn creation_time_filetime(&self) -> u64 {
        self.creation_time_filetime
    }

    pub fn executable_path(&self) -> &Path {
        &self.executable_path
    }

    #[cfg(test)]
    pub(crate) fn for_test(
        process_id: u32,
        creation_time_filetime: u64,
        executable_path: &Path,
    ) -> Self {
        Self {
            process_id,
            creation_time_filetime,
            executable_path: executable_path.to_owned(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WindowsInstallationPaths {
    install_directory: PathBuf,
    executable_path: PathBuf,
    uninstaller_path: PathBuf,
    application_data_directory: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WindowsRegistration {
    display_name: String,
    display_version: String,
    publisher: String,
    homepage: String,
    main_binary_name: String,
    install_location: PathBuf,
    uninstall_command: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WindowsProcessSnapshot {
    creation_time_filetime: u64,
    executable_path: PathBuf,
}

#[derive(Clone, Copy)]
enum RecoveryPackageRole {
    Predecessor,
    Candidate,
}

impl RecoveryPackageRole {
    fn relative_path(self) -> &'static str {
        match self {
            Self::Predecessor => PREDECESSOR_PACKAGE_RELATIVE_PATH,
            Self::Candidate => CANDIDATE_PACKAGE_RELATIVE_PATH,
        }
    }

    fn invalid_error(self) -> WindowsUpdateRecoveryError {
        match self {
            Self::Predecessor => WindowsUpdateRecoveryError::InvalidPredecessorPackage,
            Self::Candidate => WindowsUpdateRecoveryError::InvalidCandidatePackage,
        }
    }

    fn operation_error(self) -> WindowsUpdateRecoveryError {
        match self {
            Self::Predecessor => WindowsUpdateRecoveryError::NativeRollbackFailed,
            Self::Candidate => WindowsUpdateRecoveryError::NativeInstallationFailed,
        }
    }
}

trait WindowsInstallationPort {
    fn paths(&self) -> Result<WindowsInstallationPaths, io::Error>;
    fn registration(&self) -> Result<WindowsRegistration, io::Error>;
    fn run_installer(&self, package_path: &Path, arguments: &[OsString])
        -> Result<bool, io::Error>;
}

trait WindowsProcessPort {
    fn observe(&self, process_id: u32) -> Result<WindowsProcessSnapshot, io::Error>;
    fn terminate_if_matches(
        &self,
        expected: &WindowsRecoveryProcessIdentity,
        timeout_milliseconds: u32,
    ) -> Result<bool, io::Error>;
}

struct SystemWindowsInstallation;
struct SystemWindowsProcess;

#[cfg(target_os = "windows")]
impl WindowsInstallationPort for SystemWindowsInstallation {
    fn paths(&self) -> Result<WindowsInstallationPaths, io::Error> {
        system_installation_paths()
    }

    fn registration(&self) -> Result<WindowsRegistration, io::Error> {
        system_registration()
    }

    fn run_installer(
        &self,
        package_path: &Path,
        arguments: &[OsString],
    ) -> Result<bool, io::Error> {
        Ok(Command::new(package_path)
            .args(arguments)
            .status()?
            .success())
    }
}

#[cfg(not(target_os = "windows"))]
impl WindowsInstallationPort for SystemWindowsInstallation {
    fn paths(&self) -> Result<WindowsInstallationPaths, io::Error> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }

    fn registration(&self) -> Result<WindowsRegistration, io::Error> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }

    fn run_installer(
        &self,
        _package_path: &Path,
        _arguments: &[OsString],
    ) -> Result<bool, io::Error> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }
}

#[cfg(target_os = "windows")]
impl WindowsProcessPort for SystemWindowsProcess {
    fn observe(&self, process_id: u32) -> Result<WindowsProcessSnapshot, io::Error> {
        system_observe_process(process_id)
    }

    fn terminate_if_matches(
        &self,
        expected: &WindowsRecoveryProcessIdentity,
        timeout_milliseconds: u32,
    ) -> Result<bool, io::Error> {
        system_terminate_process_if_matches(expected, timeout_milliseconds)
    }
}

#[cfg(not(target_os = "windows"))]
impl WindowsProcessPort for SystemWindowsProcess {
    fn observe(&self, _process_id: u32) -> Result<WindowsProcessSnapshot, io::Error> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }

    fn terminate_if_matches(
        &self,
        _expected: &WindowsRecoveryProcessIdentity,
        _timeout_milliseconds: u32,
    ) -> Result<bool, io::Error> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }
}

pub fn query_windows_native_package_identity(
) -> Result<WindowsNativePackageIdentity, WindowsUpdateRecoveryError> {
    query_windows_native_package_identity_with(&SystemWindowsInstallation)
}

pub fn reinstall_windows_predecessor_package(
    attempt_directory: &Path,
    expected_version: &str,
) -> Result<WindowsNativePackageIdentity, WindowsUpdateRecoveryError> {
    install_windows_package_with(
        &SystemWindowsInstallation,
        attempt_directory,
        expected_version,
        RecoveryPackageRole::Predecessor,
    )
}

pub fn install_windows_candidate_package(
    attempt_directory: &Path,
    expected_version: &str,
) -> Result<WindowsNativePackageIdentity, WindowsUpdateRecoveryError> {
    install_windows_package_with(
        &SystemWindowsInstallation,
        attempt_directory,
        expected_version,
        RecoveryPackageRole::Candidate,
    )
}

pub fn resolve_windows_update_installation_path(
    executable_path: &Path,
) -> Result<PathBuf, WindowsUpdateRecoveryError> {
    let identity = query_windows_native_package_identity()?;
    if canonical_regular_file(executable_path)?
        != canonical_regular_file(identity.executable_path())?
    {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(identity.executable_path().to_owned())
}

pub(crate) fn verify_windows_native_installation_matches_runnable(
    attempt_directory: &Path,
    identity: &WindowsNativePackageIdentity,
) -> Result<(), WindowsUpdateRecoveryError> {
    let attempt_directory = canonical_directory(attempt_directory)?;
    let runnable_directory = canonical_directory(&attempt_directory.join("previous/runnable"))?;
    let runnable_executable = canonical_regular_file(&runnable_directory.join(EXECUTABLE_NAME))?;
    let runnable_uninstaller = canonical_regular_file(&runnable_directory.join(UNINSTALLER_NAME))?;
    let installed_executable = canonical_regular_file(identity.executable_path())?;
    let installed_uninstaller = canonical_regular_file(identity.uninstaller_path())?;
    if runnable_directory != attempt_directory.join("previous/runnable")
        || runnable_executable != runnable_directory.join(EXECUTABLE_NAME)
        || runnable_uninstaller != runnable_directory.join(UNINSTALLER_NAME)
        || installed_executable != identity.executable_path()
        || installed_uninstaller != identity.uninstaller_path()
        || !files_are_equal(&runnable_executable, &installed_executable)?
        || !files_are_equal(&runnable_uninstaller, &installed_uninstaller)?
    {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(())
}

pub fn observe_windows_recovery_process(
    process_id: u32,
    expected_executable_path: &Path,
) -> Result<WindowsRecoveryProcessIdentity, WindowsUpdateRecoveryError> {
    observe_windows_recovery_process_with(
        &SystemWindowsProcess,
        process_id,
        expected_executable_path,
    )
}

pub fn observe_windows_parent_process(
    expected_executable_path: &Path,
) -> Result<WindowsRecoveryProcessIdentity, WindowsUpdateRecoveryError> {
    observe_windows_parent_process_with(
        &SystemWindowsProcess,
        expected_executable_path,
        system_current_parent_process_id,
    )
}

pub fn windows_recovery_process_is_running(expected: &WindowsRecoveryProcessIdentity) -> bool {
    observe_windows_recovery_process_with(
        &SystemWindowsProcess,
        expected.process_id(),
        expected.executable_path(),
    )
    .is_ok_and(|actual| actual == *expected)
}

pub fn terminate_windows_recovery_process(
    expected: &WindowsRecoveryProcessIdentity,
) -> Result<(), WindowsUpdateRecoveryError> {
    terminate_windows_recovery_process_with(&SystemWindowsProcess, expected)
}

fn query_windows_native_package_identity_with(
    installation: &impl WindowsInstallationPort,
) -> Result<WindowsNativePackageIdentity, WindowsUpdateRecoveryError> {
    let paths = installation
        .paths()
        .map_err(|_| WindowsUpdateRecoveryError::InvalidPackageIdentity)?;
    let registration = installation
        .registration()
        .map_err(|_| WindowsUpdateRecoveryError::InvalidPackageIdentity)?;
    validate_windows_native_identity(&paths, &registration)
}

fn validate_windows_native_identity(
    paths: &WindowsInstallationPaths,
    registration: &WindowsRegistration,
) -> Result<WindowsNativePackageIdentity, WindowsUpdateRecoveryError> {
    if registration.display_name != PRODUCT_NAME
        || registration.publisher != PUBLISHER
        || registration.homepage != HOMEPAGE
        || registration.main_binary_name != EXECUTABLE_NAME
        || Version::parse(&registration.display_version).is_err()
    {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    let install_directory = canonical_directory(&paths.install_directory)?;
    let registered_install_directory = canonical_directory(&registration.install_location)?;
    let executable_path = canonical_regular_file(&paths.executable_path)?;
    let uninstaller_path = canonical_regular_file(&paths.uninstaller_path)?;
    let registered_uninstaller = canonical_regular_file(&registration.uninstall_command)?;
    if install_directory != registered_install_directory
        || executable_path != canonical_regular_file(&install_directory.join(EXECUTABLE_NAME))?
        || uninstaller_path != canonical_regular_file(&install_directory.join(UNINSTALLER_NAME))?
        || uninstaller_path != registered_uninstaller
        || !paths.application_data_directory.is_absolute()
    {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(WindowsNativePackageIdentity {
        version: registration.display_version.clone(),
        install_directory,
        executable_path,
        uninstaller_path,
        application_data_directory: paths.application_data_directory.clone(),
    })
}

fn install_windows_package_with(
    installation: &impl WindowsInstallationPort,
    attempt_directory: &Path,
    expected_version: &str,
    role: RecoveryPackageRole,
) -> Result<WindowsNativePackageIdentity, WindowsUpdateRecoveryError> {
    if Version::parse(expected_version).is_err() || !attempt_directory.is_absolute() {
        return Err(role.invalid_error());
    }
    let attempt_directory = attempt_directory
        .canonicalize()
        .map_err(|_| role.invalid_error())?;
    let package_path = attempt_directory.join(role.relative_path());
    let canonical_package =
        canonical_regular_file(&package_path).map_err(|_| role.invalid_error())?;
    if canonical_package != package_path || fs::metadata(&canonical_package)?.len() == 0 {
        return Err(role.invalid_error());
    }
    let success = installation
        .run_installer(
            &canonical_package,
            &[OsString::from(INSTALLER_SILENT_ARGUMENT)],
        )
        .map_err(|_| role.operation_error())?;
    if !success {
        return Err(role.operation_error());
    }
    let identity = query_windows_native_package_identity_with(installation)?;
    if identity.version() != expected_version {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(identity)
}

fn observe_windows_recovery_process_with(
    process: &impl WindowsProcessPort,
    process_id: u32,
    expected_executable_path: &Path,
) -> Result<WindowsRecoveryProcessIdentity, WindowsUpdateRecoveryError> {
    if process_id <= 1 || !expected_executable_path.is_absolute() {
        return Err(WindowsUpdateRecoveryError::InvalidProcessIdentity);
    }
    let expected_path = canonical_regular_file(expected_executable_path)
        .map_err(|_| WindowsUpdateRecoveryError::InvalidProcessIdentity)?;
    let snapshot = process
        .observe(process_id)
        .map_err(|_| WindowsUpdateRecoveryError::InvalidProcessIdentity)?;
    let actual_path = canonical_regular_file(&snapshot.executable_path)
        .map_err(|_| WindowsUpdateRecoveryError::InvalidProcessIdentity)?;
    if snapshot.creation_time_filetime == 0 || actual_path != expected_path {
        return Err(WindowsUpdateRecoveryError::InvalidProcessIdentity);
    }
    Ok(WindowsRecoveryProcessIdentity {
        process_id,
        creation_time_filetime: snapshot.creation_time_filetime,
        executable_path: actual_path,
    })
}

fn observe_windows_parent_process_with(
    process: &impl WindowsProcessPort,
    expected_executable_path: &Path,
    parent_process_id: impl FnOnce() -> Result<u32, io::Error>,
) -> Result<WindowsRecoveryProcessIdentity, WindowsUpdateRecoveryError> {
    let process_id =
        parent_process_id().map_err(|_| WindowsUpdateRecoveryError::InvalidProcessIdentity)?;
    observe_windows_recovery_process_with(process, process_id, expected_executable_path)
}

fn terminate_windows_recovery_process_with(
    process: &impl WindowsProcessPort,
    expected: &WindowsRecoveryProcessIdentity,
) -> Result<(), WindowsUpdateRecoveryError> {
    if expected.process_id() <= 1
        || expected.creation_time_filetime() == 0
        || !expected.executable_path().is_absolute()
    {
        return Err(WindowsUpdateRecoveryError::InvalidProcessIdentity);
    }
    match process.terminate_if_matches(expected, PROCESS_STOP_TIMEOUT_MILLISECONDS) {
        Ok(true) => Ok(()),
        Ok(false) => Err(WindowsUpdateRecoveryError::InvalidProcessIdentity),
        Err(_) => Err(WindowsUpdateRecoveryError::ProcessStopFailed),
    }
}

fn canonical_directory(path: &Path) -> Result<PathBuf, WindowsUpdateRecoveryError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| WindowsUpdateRecoveryError::InvalidPackageIdentity)?;
    if !metadata.file_type().is_dir() || is_reparse_point(&metadata) {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    path.canonicalize()
        .map_err(|_| WindowsUpdateRecoveryError::InvalidPackageIdentity)
}

fn canonical_regular_file(path: &Path) -> Result<PathBuf, WindowsUpdateRecoveryError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| WindowsUpdateRecoveryError::InvalidPackageIdentity)?;
    if !metadata.file_type().is_file() || is_reparse_point(&metadata) {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    path.canonicalize()
        .map_err(|_| WindowsUpdateRecoveryError::InvalidPackageIdentity)
}

fn files_are_equal(left: &Path, right: &Path) -> Result<bool, WindowsUpdateRecoveryError> {
    let mut left = open_regular_file_no_follow(left)?;
    let mut right = open_regular_file_no_follow(right)?;
    if left.metadata()?.len() != right.metadata()?.len() {
        return Ok(false);
    }
    let mut left_buffer = [0_u8; 64 * 1024];
    let mut right_buffer = [0_u8; 64 * 1024];
    loop {
        let left_read = left.read(&mut left_buffer)?;
        let right_read = right.read(&mut right_buffer)?;
        if left_read != right_read || left_buffer[..left_read] != right_buffer[..right_read] {
            return Ok(false);
        }
        if left_read == 0 {
            return Ok(true);
        }
    }
}

fn open_regular_file_no_follow(path: &Path) -> Result<File, WindowsUpdateRecoveryError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;

        use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;

        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || is_reparse_point(&metadata) {
        return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(file)
}

#[cfg(target_os = "windows")]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(target_os = "windows"))]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(target_os = "windows")]
fn system_installation_paths() -> Result<WindowsInstallationPaths, io::Error> {
    use windows_sys::Win32::UI::Shell::{FOLDERID_LocalAppData, FOLDERID_RoamingAppData};

    let install_directory = known_folder_path(&FOLDERID_LocalAppData)?.join(PRODUCT_NAME);
    Ok(WindowsInstallationPaths {
        executable_path: install_directory.join(EXECUTABLE_NAME),
        uninstaller_path: install_directory.join(UNINSTALLER_NAME),
        application_data_directory: known_folder_path(&FOLDERID_RoamingAppData)?
            .join(APPLICATION_IDENTIFIER),
        install_directory,
    })
}

#[cfg(target_os = "windows")]
fn known_folder_path(folder: *const windows_sys::core::GUID) -> Result<PathBuf, io::Error> {
    use std::os::windows::ffi::OsStringExt;

    use windows_sys::Win32::{System::Com::CoTaskMemFree, UI::Shell::SHGetKnownFolderPath};

    let mut value = std::ptr::null_mut();
    let result = unsafe { SHGetKnownFolderPath(folder, 0, std::ptr::null_mut(), &mut value) };
    if result < 0 || value.is_null() {
        return Err(io::Error::from_raw_os_error(result));
    }
    let length = unsafe {
        let mut length = 0;
        while *value.add(length) != 0 {
            length += 1;
        }
        length
    };
    let path = PathBuf::from(OsString::from_wide(unsafe {
        std::slice::from_raw_parts(value, length)
    }));
    unsafe { CoTaskMemFree(value.cast()) };
    Ok(path)
}

#[cfg(target_os = "windows")]
fn system_registration() -> Result<WindowsRegistration, io::Error> {
    let install_location = read_registry_path("InstallLocation")?;
    let uninstall_command = read_registry_path("UninstallString")?;
    Ok(WindowsRegistration {
        display_name: read_registry_string("DisplayName")?,
        display_version: read_registry_string("DisplayVersion")?,
        publisher: read_registry_string("Publisher")?,
        homepage: read_registry_string("URLInfoAbout")?,
        main_binary_name: read_registry_string("MainBinaryName")?,
        install_location,
        uninstall_command,
    })
}

#[cfg(target_os = "windows")]
fn read_registry_string(value_name: &str) -> Result<String, io::Error> {
    String::from_utf16(&read_registry_utf16(value_name)?)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid registry text"))
}

#[cfg(target_os = "windows")]
fn read_registry_path(value_name: &str) -> Result<PathBuf, io::Error> {
    use std::os::windows::ffi::OsStringExt;

    let mut value = read_registry_utf16(value_name)?;
    if value.first() == Some(&(b'"' as u16)) || value.last() == Some(&(b'"' as u16)) {
        if value.len() < 2
            || value.first() != Some(&(b'"' as u16))
            || value.last() != Some(&(b'"' as u16))
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "invalid quoted registry path",
            ));
        }
        value.remove(0);
        value.pop();
    }
    if value.is_empty() || value.contains(&(b'"' as u16)) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid registry path",
        ));
    }
    Ok(PathBuf::from(OsString::from_wide(&value)))
}

#[cfg(target_os = "windows")]
fn read_registry_utf16(value_name: &str) -> Result<Vec<u16>, io::Error> {
    use windows_sys::Win32::{
        Foundation::ERROR_SUCCESS,
        System::Registry::{RegGetValueW, HKEY_CURRENT_USER, REG_VALUE_TYPE, RRF_RT_REG_SZ},
    };

    let subkey = wide_null(UNINSTALL_REGISTRY_SUBKEY);
    let value_name = wide_null(value_name);
    let mut byte_length = 0_u32;
    let first = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            value_name.as_ptr(),
            RRF_RT_REG_SZ,
            std::ptr::null_mut::<REG_VALUE_TYPE>(),
            std::ptr::null_mut(),
            &mut byte_length,
        )
    };
    if first != ERROR_SUCCESS || byte_length < 2 || byte_length % 2 != 0 {
        return Err(io::Error::from_raw_os_error(first as i32));
    }
    let mut buffer = vec![0_u16; byte_length as usize / 2];
    let second = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            value_name.as_ptr(),
            RRF_RT_REG_SZ,
            std::ptr::null_mut::<REG_VALUE_TYPE>(),
            buffer.as_mut_ptr().cast(),
            &mut byte_length,
        )
    };
    if second != ERROR_SUCCESS {
        return Err(io::Error::from_raw_os_error(second as i32));
    }
    if byte_length < 2 || byte_length % 2 != 0 || byte_length as usize > buffer.len() * 2 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid registry string length",
        ));
    }
    buffer.truncate(byte_length as usize / 2);
    if buffer.last() != Some(&0) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "unterminated registry string",
        ));
    }
    buffer.pop();
    Ok(buffer)
}

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    std::ffi::OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(target_os = "windows")]
fn system_observe_process(process_id: u32) -> Result<WindowsProcessSnapshot, io::Error> {
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};

    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
    let handle = OwnedHandle::new(handle)?;
    process_snapshot(handle.raw())
}

#[cfg(target_os = "windows")]
fn system_current_parent_process_id() -> Result<u32, io::Error> {
    use windows_sys::Win32::{
        Foundation::{GetLastError, ERROR_NO_MORE_FILES, INVALID_HANDLE_VALUE},
        System::{
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            Threading::GetCurrentProcessId,
        },
    };

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    let snapshot = OwnedHandle::new(snapshot)?;
    let current_process_id = unsafe { GetCurrentProcessId() };
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    if unsafe { Process32FirstW(snapshot.raw(), &mut entry) } == 0 {
        return Err(io::Error::last_os_error());
    }
    loop {
        if entry.th32ProcessID == current_process_id {
            if entry.th32ParentProcessID <= 1 {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "invalid parent process",
                ));
            }
            return Ok(entry.th32ParentProcessID);
        }
        if unsafe { Process32NextW(snapshot.raw(), &mut entry) } == 0 {
            let error = unsafe { GetLastError() };
            return if error == ERROR_NO_MORE_FILES {
                Err(io::Error::new(
                    io::ErrorKind::NotFound,
                    "parent process was not found",
                ))
            } else {
                Err(io::Error::from_raw_os_error(error as i32))
            };
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn system_current_parent_process_id() -> Result<u32, io::Error> {
    Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
}

#[cfg(target_os = "windows")]
fn system_terminate_process_if_matches(
    expected: &WindowsRecoveryProcessIdentity,
    timeout_milliseconds: u32,
) -> Result<bool, io::Error> {
    use windows_sys::Win32::{
        Foundation::{WAIT_OBJECT_0, WAIT_TIMEOUT},
        System::Threading::{
            OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION,
            PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
        },
    };

    let access = PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE | PROCESS_SYNCHRONIZE;
    let handle = unsafe { OpenProcess(access, 0, expected.process_id()) };
    let handle = OwnedHandle::new(handle)?;
    let snapshot = process_snapshot(handle.raw())?;
    let actual_path = canonical_regular_file(&snapshot.executable_path)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid process path"))?;
    if snapshot.creation_time_filetime != expected.creation_time_filetime()
        || actual_path != expected.executable_path()
    {
        return Ok(false);
    }
    if unsafe { TerminateProcess(handle.raw(), 1) } == 0 {
        return Err(io::Error::last_os_error());
    }
    match unsafe { WaitForSingleObject(handle.raw(), timeout_milliseconds) } {
        WAIT_OBJECT_0 => Ok(true),
        WAIT_TIMEOUT => Err(io::Error::new(
            io::ErrorKind::TimedOut,
            "process stop timed out",
        )),
        _ => Err(io::Error::last_os_error()),
    }
}

#[cfg(target_os = "windows")]
fn process_snapshot(
    handle: windows_sys::Win32::Foundation::HANDLE,
) -> Result<WindowsProcessSnapshot, io::Error> {
    use std::os::windows::ffi::OsStringExt;

    use windows_sys::Win32::{
        Foundation::FILETIME,
        System::Threading::{GetProcessTimes, QueryFullProcessImageNameW},
    };

    let mut creation = FILETIME::default();
    let mut exit = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    if unsafe { GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let mut path = vec![0_u16; 32_768];
    let mut length = path.len() as u32;
    if unsafe { QueryFullProcessImageNameW(handle, 0, path.as_mut_ptr(), &mut length) } == 0
        || length == 0
    {
        return Err(io::Error::last_os_error());
    }
    path.truncate(length as usize);
    Ok(WindowsProcessSnapshot {
        creation_time_filetime: ((creation.dwHighDateTime as u64) << 32)
            | creation.dwLowDateTime as u64,
        executable_path: PathBuf::from(OsString::from_wide(&path)),
    })
}

#[cfg(target_os = "windows")]
struct OwnedHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(target_os = "windows")]
impl OwnedHandle {
    fn new(handle: windows_sys::Win32::Foundation::HANDLE) -> Result<Self, io::Error> {
        if handle.is_null() {
            Err(io::Error::last_os_error())
        } else {
            Ok(Self(handle))
        }
    }

    fn raw(&self) -> windows_sys::Win32::Foundation::HANDLE {
        self.0
    }
}

#[cfg(target_os = "windows")]
impl Drop for OwnedHandle {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;

        unsafe { CloseHandle(self.0) };
    }
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, collections::VecDeque};

    use tempfile::TempDir;

    use super::*;

    struct ExpectedInstaller {
        package_path: PathBuf,
        arguments: Vec<OsString>,
        result: Result<bool, io::Error>,
    }

    struct SyntheticInstallation {
        paths: WindowsInstallationPaths,
        registration: WindowsRegistration,
        installers: RefCell<VecDeque<ExpectedInstaller>>,
    }

    impl WindowsInstallationPort for SyntheticInstallation {
        fn paths(&self) -> Result<WindowsInstallationPaths, io::Error> {
            Ok(self.paths.clone())
        }

        fn registration(&self) -> Result<WindowsRegistration, io::Error> {
            Ok(self.registration.clone())
        }

        fn run_installer(
            &self,
            package_path: &Path,
            arguments: &[OsString],
        ) -> Result<bool, io::Error> {
            let expected = self
                .installers
                .borrow_mut()
                .pop_front()
                .expect("expected installer invocation");
            assert_eq!(package_path, expected.package_path);
            assert_eq!(arguments, expected.arguments);
            expected.result
        }
    }

    struct SyntheticProcess {
        snapshots: RefCell<VecDeque<WindowsProcessSnapshot>>,
        expected_termination: RefCell<Option<(WindowsRecoveryProcessIdentity, u32, bool)>>,
    }

    impl WindowsProcessPort for SyntheticProcess {
        fn observe(&self, _process_id: u32) -> Result<WindowsProcessSnapshot, io::Error> {
            self.snapshots
                .borrow_mut()
                .pop_front()
                .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "process absent"))
        }

        fn terminate_if_matches(
            &self,
            expected: &WindowsRecoveryProcessIdentity,
            timeout_milliseconds: u32,
        ) -> Result<bool, io::Error> {
            let (expected_identity, expected_timeout, result) = self
                .expected_termination
                .borrow_mut()
                .take()
                .expect("expected process termination");
            assert_eq!(expected, &expected_identity);
            assert_eq!(timeout_milliseconds, expected_timeout);
            Ok(result)
        }
    }

    fn synthetic_installation(root: &Path, version: &str) -> SyntheticInstallation {
        let install_directory = root.join(PRODUCT_NAME);
        fs::create_dir_all(&install_directory).expect("installation directory");
        let executable_path = install_directory.join(EXECUTABLE_NAME);
        let uninstaller_path = install_directory.join(UNINSTALLER_NAME);
        fs::write(&executable_path, b"synthetic application").expect("application executable");
        fs::write(&uninstaller_path, b"synthetic uninstaller").expect("uninstaller executable");
        let application_data_directory = root.join(APPLICATION_IDENTIFIER);
        let paths = WindowsInstallationPaths {
            install_directory: install_directory.clone(),
            executable_path: executable_path.clone(),
            uninstaller_path: uninstaller_path.clone(),
            application_data_directory,
        };
        let registration = WindowsRegistration {
            display_name: PRODUCT_NAME.to_owned(),
            display_version: version.to_owned(),
            publisher: PUBLISHER.to_owned(),
            homepage: HOMEPAGE.to_owned(),
            main_binary_name: EXECUTABLE_NAME.to_owned(),
            install_location: install_directory,
            uninstall_command: uninstaller_path,
        };
        SyntheticInstallation {
            paths,
            registration,
            installers: RefCell::new(VecDeque::new()),
        }
    }

    #[test]
    fn derives_the_current_user_nsis_identity_from_fixed_native_evidence() {
        let directory = TempDir::new().expect("temporary directory");
        let installation = synthetic_installation(directory.path(), "0.1.0");

        let identity = query_windows_native_package_identity_with(&installation)
            .expect("Windows package identity");

        assert_eq!(identity.version(), "0.1.0");
        assert_eq!(
            identity.install_directory(),
            installation.paths.install_directory.canonicalize().unwrap()
        );
        assert_eq!(
            identity.executable_path(),
            installation.paths.executable_path.canonicalize().unwrap()
        );
        assert_eq!(
            identity.uninstaller_path(),
            installation.paths.uninstaller_path.canonicalize().unwrap()
        );
        assert_eq!(
            identity.application_data_directory(),
            installation.paths.application_data_directory
        );
    }

    #[test]
    fn rejects_cross_product_malformed_and_redirected_native_identity() {
        let directory = TempDir::new().expect("temporary directory");
        let mut installation = synthetic_installation(directory.path(), "0.1.0");
        for mutation in 0..7 {
            let original = installation.registration.clone();
            match mutation {
                0 => installation.registration.display_name = "Another product".to_owned(),
                1 => installation.registration.display_version = "not-semver".to_owned(),
                2 => installation.registration.publisher = "Another publisher".to_owned(),
                3 => installation.registration.homepage = "https://example.invalid/".to_owned(),
                4 => installation.registration.main_binary_name = "another.exe".to_owned(),
                5 => installation.registration.install_location = directory.path().to_owned(),
                _ => {
                    installation.registration.uninstall_command =
                        installation.paths.executable_path.clone()
                }
            }
            assert!(matches!(
                query_windows_native_package_identity_with(&installation),
                Err(WindowsUpdateRecoveryError::InvalidPackageIdentity)
            ));
            installation.registration = original;
        }
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symbolic_native_files() {
        use std::os::unix::fs::symlink;

        let directory = TempDir::new().expect("temporary directory");
        let installation = synthetic_installation(directory.path(), "0.1.0");
        let target = directory.path().join("outside.exe");
        fs::write(&target, b"outside").expect("outside executable");
        fs::remove_file(&installation.paths.executable_path).expect("remove executable");
        symlink(&target, &installation.paths.executable_path).expect("symbolic executable");

        assert!(matches!(
            query_windows_native_package_identity_with(&installation),
            Err(WindowsUpdateRecoveryError::InvalidPackageIdentity)
        ));
    }

    #[test]
    fn invokes_only_the_preserved_nsis_package_silently_and_revalidates_version() {
        let directory = TempDir::new().expect("temporary directory");
        let attempt_directory = directory.path().join("attempt");
        let package_path = attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH);
        fs::create_dir_all(package_path.parent().expect("package parent"))
            .expect("package directory");
        fs::write(&package_path, b"synthetic NSIS package").expect("NSIS package");
        let installation = synthetic_installation(directory.path(), "0.1.0");
        installation
            .installers
            .borrow_mut()
            .push_back(ExpectedInstaller {
                package_path: package_path.canonicalize().expect("canonical package"),
                arguments: vec![OsString::from(INSTALLER_SILENT_ARGUMENT)],
                result: Ok(true),
            });

        let identity = install_windows_package_with(
            &installation,
            &attempt_directory,
            "0.1.0",
            RecoveryPackageRole::Predecessor,
        )
        .expect("predecessor installation");

        assert_eq!(identity.version(), "0.1.0");
        assert!(installation.installers.borrow().is_empty());
    }

    #[test]
    fn requires_installed_critical_files_to_match_the_preserved_windows_image() {
        let directory = TempDir::new().expect("temporary directory");
        let installation = synthetic_installation(directory.path(), "0.1.0");
        let identity = query_windows_native_package_identity_with(&installation)
            .expect("Windows package identity");
        let attempt_directory = directory.path().join("attempt");
        let runnable_directory = attempt_directory.join("previous/runnable");
        fs::create_dir_all(&runnable_directory).expect("runnable predecessor");
        fs::copy(
            identity.executable_path(),
            runnable_directory.join(EXECUTABLE_NAME),
        )
        .expect("preserved executable");
        fs::copy(
            identity.uninstaller_path(),
            runnable_directory.join(UNINSTALLER_NAME),
        )
        .expect("preserved uninstaller");

        verify_windows_native_installation_matches_runnable(&attempt_directory, &identity)
            .expect("matching runnable image");

        for path in [identity.executable_path(), identity.uninstaller_path()] {
            let original = fs::read(path).expect("installed critical file");
            fs::write(path, b"changed installed file").expect("changed critical file");
            assert!(matches!(
                verify_windows_native_installation_matches_runnable(&attempt_directory, &identity,),
                Err(WindowsUpdateRecoveryError::InvalidPackageIdentity)
            ));
            fs::write(path, original).expect("restored critical file");
        }
    }

    #[test]
    fn distinguishes_invalid_packages_installer_failures_and_wrong_resulting_versions() {
        let directory = TempDir::new().expect("temporary directory");
        let attempt_directory = directory.path().join("attempt");
        fs::create_dir_all(&attempt_directory).expect("attempt directory");
        let installation = synthetic_installation(directory.path(), "0.1.0");
        assert!(matches!(
            install_windows_package_with(
                &installation,
                &attempt_directory,
                "0.2.0",
                RecoveryPackageRole::Candidate,
            ),
            Err(WindowsUpdateRecoveryError::InvalidCandidatePackage)
        ));

        let package_path = attempt_directory.join(CANDIDATE_PACKAGE_RELATIVE_PATH);
        fs::create_dir_all(package_path.parent().expect("package parent"))
            .expect("package directory");
        fs::write(&package_path, b"synthetic NSIS package").expect("NSIS package");
        installation
            .installers
            .borrow_mut()
            .push_back(ExpectedInstaller {
                package_path: package_path.canonicalize().expect("canonical package"),
                arguments: vec![OsString::from(INSTALLER_SILENT_ARGUMENT)],
                result: Ok(false),
            });
        assert!(matches!(
            install_windows_package_with(
                &installation,
                &attempt_directory,
                "0.2.0",
                RecoveryPackageRole::Candidate,
            ),
            Err(WindowsUpdateRecoveryError::NativeInstallationFailed)
        ));

        installation
            .installers
            .borrow_mut()
            .push_back(ExpectedInstaller {
                package_path: package_path.canonicalize().expect("canonical package"),
                arguments: vec![OsString::from(INSTALLER_SILENT_ARGUMENT)],
                result: Ok(true),
            });
        assert!(matches!(
            install_windows_package_with(
                &installation,
                &attempt_directory,
                "0.2.0",
                RecoveryPackageRole::Candidate,
            ),
            Err(WindowsUpdateRecoveryError::InvalidPackageIdentity)
        ));
    }

    #[test]
    fn binds_process_authority_to_creation_time_and_canonical_executable() {
        let directory = TempDir::new().expect("temporary directory");
        let executable = directory.path().join(EXECUTABLE_NAME);
        fs::write(&executable, b"synthetic executable").expect("executable");
        let process = SyntheticProcess {
            snapshots: RefCell::new(VecDeque::from([WindowsProcessSnapshot {
                creation_time_filetime: 132_537_600_000_000_000,
                executable_path: executable.clone(),
            }])),
            expected_termination: RefCell::new(None),
        };

        let identity = observe_windows_recovery_process_with(&process, 42, &executable)
            .expect("Windows process identity");

        assert_eq!(identity.process_id(), 42);
        assert_eq!(identity.creation_time_filetime(), 132_537_600_000_000_000);
        assert_eq!(
            identity.executable_path(),
            executable.canonicalize().unwrap()
        );
    }

    #[test]
    fn binds_parent_authority_to_more_than_a_parent_process_identifier() {
        let directory = TempDir::new().expect("temporary directory");
        let executable = directory.path().join(EXECUTABLE_NAME);
        fs::write(&executable, b"synthetic executable").expect("executable");
        let process = SyntheticProcess {
            snapshots: RefCell::new(VecDeque::from([WindowsProcessSnapshot {
                creation_time_filetime: 132_537_600_000_000_000,
                executable_path: executable.clone(),
            }])),
            expected_termination: RefCell::new(None),
        };

        let identity = observe_windows_parent_process_with(&process, &executable, || Ok(42))
            .expect("parent process identity");

        assert_eq!(identity.process_id(), 42);
        assert_eq!(identity.creation_time_filetime(), 132_537_600_000_000_000);
        assert_eq!(
            identity.executable_path(),
            executable.canonicalize().unwrap()
        );
    }

    #[test]
    fn rejects_pid_only_authority_and_changed_executable_paths() {
        let directory = TempDir::new().expect("temporary directory");
        let expected = directory.path().join(EXECUTABLE_NAME);
        let changed = directory.path().join("changed.exe");
        fs::write(&expected, b"expected").expect("expected executable");
        fs::write(&changed, b"changed").expect("changed executable");
        let process = SyntheticProcess {
            snapshots: RefCell::new(VecDeque::from([
                WindowsProcessSnapshot {
                    creation_time_filetime: 0,
                    executable_path: expected.clone(),
                },
                WindowsProcessSnapshot {
                    creation_time_filetime: 12,
                    executable_path: changed,
                },
            ])),
            expected_termination: RefCell::new(None),
        };

        for _ in 0..2 {
            assert!(matches!(
                observe_windows_recovery_process_with(&process, 42, &expected),
                Err(WindowsUpdateRecoveryError::InvalidProcessIdentity)
            ));
        }
    }

    #[test]
    fn terminates_only_a_complete_matching_process_identity() {
        let directory = TempDir::new().expect("temporary directory");
        let executable = directory.path().join(EXECUTABLE_NAME);
        fs::write(&executable, b"synthetic executable").expect("executable");
        let identity = WindowsRecoveryProcessIdentity::for_test(
            42,
            132_537_600_000_000_000,
            &executable.canonicalize().unwrap(),
        );
        let process = SyntheticProcess {
            snapshots: RefCell::new(VecDeque::new()),
            expected_termination: RefCell::new(Some((
                identity.clone(),
                PROCESS_STOP_TIMEOUT_MILLISECONDS,
                true,
            ))),
        };

        terminate_windows_recovery_process_with(&process, &identity)
            .expect("matching process stopped");
    }

    #[test]
    fn refuses_to_terminate_a_reused_process_identifier() {
        let directory = TempDir::new().expect("temporary directory");
        let executable = directory.path().join(EXECUTABLE_NAME);
        fs::write(&executable, b"synthetic executable").expect("executable");
        let identity = WindowsRecoveryProcessIdentity::for_test(
            42,
            132_537_600_000_000_000,
            &executable.canonicalize().unwrap(),
        );
        let process = SyntheticProcess {
            snapshots: RefCell::new(VecDeque::new()),
            expected_termination: RefCell::new(Some((
                identity.clone(),
                PROCESS_STOP_TIMEOUT_MILLISECONDS,
                false,
            ))),
        };

        assert!(matches!(
            terminate_windows_recovery_process_with(&process, &identity),
            Err(WindowsUpdateRecoveryError::InvalidProcessIdentity)
        ));
    }
}
