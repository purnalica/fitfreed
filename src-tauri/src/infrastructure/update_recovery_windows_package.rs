use std::{
    cmp::Reverse,
    collections::BTreeSet,
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
    process,
    sync::atomic::{AtomicU64, Ordering},
};

#[cfg(target_os = "windows")]
use std::ffi::OsStr;

use semver::Version;
use sha2::{Digest, Sha256};
use thiserror::Error;

#[cfg(target_os = "windows")]
use super::query_windows_native_package_identity;
use super::{
    local_file::{sync_directory, PrivateStagingFile},
    update_recovery_windows::{EXECUTABLE_NAME, PRODUCT_NAME, UNINSTALLER_NAME},
};

const PREDECESSOR_PACKAGE_RELATIVE_PATH: &str = "previous/package.exe";
const CANDIDATE_PACKAGE_RELATIVE_PATH: &str = "candidate/package.exe";
const RUNNABLE_PREDECESSOR_RELATIVE_PATH: &str = "previous/runnable";
const MAX_PACKAGE_BYTES: u64 = 1_073_741_824;
#[cfg(target_os = "windows")]
const MAX_VERSION_INFO_BYTES: u32 = 16 * 1024 * 1024;
const MAX_TREE_ENTRIES: usize = 65_536;
const MAX_EXPANDED_TREE_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const MAX_RELATIVE_PATH_BYTES: usize = 4096;

static STAGING_DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Error)]
pub enum WindowsRecoveryPackageError {
    #[error("the Windows recovery package expectation is invalid")]
    InvalidExpectation,
    #[error("the Windows recovery package bytes are invalid")]
    InvalidPackage,
    #[error("the Windows recovery package identity is invalid")]
    InvalidPackageIdentity,
    #[error("the Windows runnable predecessor is invalid")]
    InvalidRunnablePredecessor,
    #[error("Windows recovery package input/output failure: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsRecoveryPackageExpectation {
    version: String,
    size_bytes: u64,
    sha256: String,
}

impl WindowsRecoveryPackageExpectation {
    pub fn try_new(
        version: String,
        size_bytes: u64,
        sha256: String,
    ) -> Result<Self, WindowsRecoveryPackageError> {
        if Version::parse(&version).is_err()
            || size_bytes == 0
            || size_bytes > MAX_PACKAGE_BYTES
            || !valid_sha256(&sha256)
        {
            return Err(WindowsRecoveryPackageError::InvalidExpectation);
        }
        Ok(Self {
            version,
            size_bytes,
            sha256,
        })
    }

    pub fn version(&self) -> &str {
        &self.version
    }

    pub fn size_bytes(&self) -> u64 {
        self.size_bytes
    }

    pub fn sha256(&self) -> &str {
        &self.sha256
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedWindowsRecoveryPackages {
    predecessor_package_path: PathBuf,
    candidate_package_path: PathBuf,
    runnable_predecessor_path: PathBuf,
    runnable_tree_sha256: String,
}

impl PreparedWindowsRecoveryPackages {
    pub fn predecessor_package_path(&self) -> &Path {
        &self.predecessor_package_path
    }

    pub fn candidate_package_path(&self) -> &Path {
        &self.candidate_package_path
    }

    pub fn runnable_predecessor_path(&self) -> &Path {
        &self.runnable_predecessor_path
    }

    pub fn runnable_tree_sha256(&self) -> &str {
        &self.runnable_tree_sha256
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WindowsBinaryIdentity {
    product_name: String,
    file_description: String,
    file_version: String,
    product_version: String,
    architecture: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WindowsInstalledPackage {
    version: String,
    install_directory: PathBuf,
}

trait WindowsRecoveryPackagePort {
    fn inspect_binary(&self, path: &Path) -> Result<WindowsBinaryIdentity, io::Error>;
    fn installed_package(&self) -> Result<WindowsInstalledPackage, io::Error>;
}

struct SystemWindowsRecoveryPackage;

#[cfg(target_os = "windows")]
impl WindowsRecoveryPackagePort for SystemWindowsRecoveryPackage {
    fn inspect_binary(&self, path: &Path) -> Result<WindowsBinaryIdentity, io::Error> {
        system_inspect_binary(path)
    }

    fn installed_package(&self) -> Result<WindowsInstalledPackage, io::Error> {
        let identity = query_windows_native_package_identity()
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid installation"))?;
        Ok(WindowsInstalledPackage {
            version: identity.version().to_owned(),
            install_directory: identity.install_directory().to_owned(),
        })
    }
}

#[cfg(not(target_os = "windows"))]
impl WindowsRecoveryPackagePort for SystemWindowsRecoveryPackage {
    fn inspect_binary(&self, _path: &Path) -> Result<WindowsBinaryIdentity, io::Error> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }

    fn installed_package(&self) -> Result<WindowsInstalledPackage, io::Error> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }
}

pub fn prepare_windows_recovery_packages_from_path(
    attempt_directory: &Path,
    predecessor_source: &Path,
    predecessor: &WindowsRecoveryPackageExpectation,
    candidate_bytes: &[u8],
    candidate: &WindowsRecoveryPackageExpectation,
) -> Result<PreparedWindowsRecoveryPackages, WindowsRecoveryPackageError> {
    prepare_windows_recovery_packages_from_path_with(
        &SystemWindowsRecoveryPackage,
        attempt_directory,
        predecessor_source,
        predecessor,
        candidate_bytes,
        candidate,
    )
}

pub fn verify_windows_recovery_packages(
    attempt_directory: &Path,
    predecessor: &WindowsRecoveryPackageExpectation,
    candidate: &WindowsRecoveryPackageExpectation,
    runnable_tree_sha256: &str,
) -> Result<PreparedWindowsRecoveryPackages, WindowsRecoveryPackageError> {
    verify_windows_recovery_packages_with(
        &SystemWindowsRecoveryPackage,
        attempt_directory,
        predecessor,
        candidate,
        runnable_tree_sha256,
    )
}

fn prepare_windows_recovery_packages_from_path_with(
    package_port: &impl WindowsRecoveryPackagePort,
    attempt_directory: &Path,
    predecessor_source: &Path,
    predecessor: &WindowsRecoveryPackageExpectation,
    candidate_bytes: &[u8],
    candidate: &WindowsRecoveryPackageExpectation,
) -> Result<PreparedWindowsRecoveryPackages, WindowsRecoveryPackageError> {
    validate_version_order(predecessor, candidate)?;
    validate_package_file(predecessor_source, predecessor)?;
    validate_binary_identity(package_port, predecessor_source, predecessor.version())?;
    validate_package_bytes(candidate_bytes, candidate)?;

    let attempt_directory = validate_attempt_directory(attempt_directory)?;
    let installed = package_port
        .installed_package()
        .map_err(|_| WindowsRecoveryPackageError::InvalidPackageIdentity)?;
    if installed.version != predecessor.version() {
        return Err(WindowsRecoveryPackageError::InvalidPackageIdentity);
    }
    let installed_directory = validate_installed_directory(&installed.install_directory)?;

    let mut assets = PreparedAssetGuard::new(&attempt_directory);
    assets.create_directories()?;
    let predecessor_package_path = attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH);
    let candidate_package_path = attempt_directory.join(CANDIDATE_PACKAGE_RELATIVE_PATH);
    copy_private_package(predecessor_source, &predecessor_package_path, predecessor)?;
    write_private_package(&candidate_package_path, candidate_bytes)?;
    validate_package_pair(
        package_port,
        &predecessor_package_path,
        predecessor,
        &candidate_package_path,
        candidate,
    )?;

    let runnable_predecessor_path = attempt_directory.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH);
    let staging = StagingDirectory::new(
        runnable_predecessor_path
            .parent()
            .ok_or(WindowsRecoveryPackageError::InvalidRunnablePredecessor)?,
    )?;
    copy_runnable_tree(&installed_directory, staging.path())?;
    let prepared_tree_sha256 =
        validate_runnable_tree(package_port, staging.path(), predecessor.version())?;
    sync_tree(staging.path())?;
    staging.persist_noclobber(&runnable_predecessor_path)?;
    let reopened_tree_sha256 = validate_runnable_tree(
        package_port,
        &runnable_predecessor_path,
        predecessor.version(),
    )?;
    if reopened_tree_sha256 != prepared_tree_sha256 {
        return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
    }
    validate_package_pair(
        package_port,
        &predecessor_package_path,
        predecessor,
        &candidate_package_path,
        candidate,
    )?;

    assets.disarm();
    Ok(PreparedWindowsRecoveryPackages {
        predecessor_package_path,
        candidate_package_path,
        runnable_predecessor_path,
        runnable_tree_sha256: prepared_tree_sha256,
    })
}

fn verify_windows_recovery_packages_with(
    package_port: &impl WindowsRecoveryPackagePort,
    attempt_directory: &Path,
    predecessor: &WindowsRecoveryPackageExpectation,
    candidate: &WindowsRecoveryPackageExpectation,
    expected_runnable_tree_sha256: &str,
) -> Result<PreparedWindowsRecoveryPackages, WindowsRecoveryPackageError> {
    validate_version_order(predecessor, candidate)?;
    if !valid_sha256(expected_runnable_tree_sha256) {
        return Err(WindowsRecoveryPackageError::InvalidExpectation);
    }
    let attempt_directory = validate_attempt_directory(attempt_directory)?;
    let predecessor_package_path = attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH);
    let candidate_package_path = attempt_directory.join(CANDIDATE_PACKAGE_RELATIVE_PATH);
    let runnable_predecessor_path = attempt_directory.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH);
    validate_package_pair(
        package_port,
        &predecessor_package_path,
        predecessor,
        &candidate_package_path,
        candidate,
    )?;
    let runnable_tree_sha256 = validate_runnable_tree(
        package_port,
        &runnable_predecessor_path,
        predecessor.version(),
    )?;
    if runnable_tree_sha256 != expected_runnable_tree_sha256 {
        return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
    }
    Ok(PreparedWindowsRecoveryPackages {
        predecessor_package_path,
        candidate_package_path,
        runnable_predecessor_path,
        runnable_tree_sha256,
    })
}

fn validate_version_order(
    predecessor: &WindowsRecoveryPackageExpectation,
    candidate: &WindowsRecoveryPackageExpectation,
) -> Result<(), WindowsRecoveryPackageError> {
    let predecessor_version = Version::parse(predecessor.version())
        .map_err(|_| WindowsRecoveryPackageError::InvalidExpectation)?;
    let candidate_version = Version::parse(candidate.version())
        .map_err(|_| WindowsRecoveryPackageError::InvalidExpectation)?;
    if candidate_version <= predecessor_version {
        return Err(WindowsRecoveryPackageError::InvalidExpectation);
    }
    Ok(())
}

fn validate_attempt_directory(
    attempt_directory: &Path,
) -> Result<PathBuf, WindowsRecoveryPackageError> {
    if !attempt_directory.is_absolute() {
        return Err(WindowsRecoveryPackageError::InvalidExpectation);
    }
    let metadata = fs::symlink_metadata(attempt_directory)?;
    if !metadata.file_type().is_dir() || is_reparse_point(&metadata) {
        return Err(WindowsRecoveryPackageError::InvalidExpectation);
    }
    let canonical = attempt_directory.canonicalize()?;
    if canonical != attempt_directory {
        return Err(WindowsRecoveryPackageError::InvalidExpectation);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        if metadata.uid() != unsafe { libc::geteuid() }
            || metadata.permissions().mode() & 0o077 != 0
        {
            return Err(WindowsRecoveryPackageError::InvalidExpectation);
        }
    }
    Ok(canonical)
}

fn validate_installed_directory(path: &Path) -> Result<PathBuf, WindowsRecoveryPackageError> {
    if !path.is_absolute() {
        return Err(WindowsRecoveryPackageError::InvalidPackageIdentity);
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| WindowsRecoveryPackageError::InvalidPackageIdentity)?;
    if !metadata.file_type().is_dir() || is_reparse_point(&metadata) {
        return Err(WindowsRecoveryPackageError::InvalidPackageIdentity);
    }
    let canonical = path
        .canonicalize()
        .map_err(|_| WindowsRecoveryPackageError::InvalidPackageIdentity)?;
    if canonical != path {
        return Err(WindowsRecoveryPackageError::InvalidPackageIdentity);
    }
    Ok(canonical)
}

fn validate_package_bytes(
    bytes: &[u8],
    expectation: &WindowsRecoveryPackageExpectation,
) -> Result<(), WindowsRecoveryPackageError> {
    if u64::try_from(bytes.len()).ok() != Some(expectation.size_bytes())
        || lower_hex(&Sha256::digest(bytes)) != expectation.sha256()
    {
        return Err(WindowsRecoveryPackageError::InvalidPackage);
    }
    Ok(())
}

fn validate_package_pair(
    package_port: &impl WindowsRecoveryPackagePort,
    predecessor_path: &Path,
    predecessor: &WindowsRecoveryPackageExpectation,
    candidate_path: &Path,
    candidate: &WindowsRecoveryPackageExpectation,
) -> Result<(), WindowsRecoveryPackageError> {
    validate_package_file(predecessor_path, predecessor)?;
    validate_package_file(candidate_path, candidate)?;
    validate_binary_identity(package_port, predecessor_path, predecessor.version())?;
    validate_binary_identity(package_port, candidate_path, candidate.version())
}

fn validate_package_file(
    path: &Path,
    expectation: &WindowsRecoveryPackageExpectation,
) -> Result<(), WindowsRecoveryPackageError> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| WindowsRecoveryPackageError::InvalidPackage)?;
    if !metadata.file_type().is_file()
        || is_reparse_point(&metadata)
        || metadata.len() != expectation.size_bytes()
        || path.canonicalize()? != path
        || file_sha256(path, metadata.len())? != expectation.sha256()
    {
        return Err(WindowsRecoveryPackageError::InvalidPackage);
    }
    Ok(())
}

fn validate_binary_identity(
    package_port: &impl WindowsRecoveryPackagePort,
    path: &Path,
    expected_version: &str,
) -> Result<(), WindowsRecoveryPackageError> {
    let identity = package_port
        .inspect_binary(path)
        .map_err(|_| WindowsRecoveryPackageError::InvalidPackageIdentity)?;
    if identity.product_name != PRODUCT_NAME
        || identity.file_description != PRODUCT_NAME
        || identity.file_version != expected_version
        || identity.product_version != expected_version
        || identity.architecture != "x86_64"
    {
        return Err(WindowsRecoveryPackageError::InvalidPackageIdentity);
    }
    Ok(())
}

fn write_private_package(
    destination: &Path,
    bytes: &[u8],
) -> Result<(), WindowsRecoveryPackageError> {
    let parent = destination
        .parent()
        .ok_or(WindowsRecoveryPackageError::InvalidPackage)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-windows-recovery-package", ".tmp")?;
    staging.file_mut()?.write_all(bytes)?;
    staging.sync_and_close()?;
    staging.persist_noclobber(destination)?;
    Ok(())
}

fn copy_private_package(
    source: &Path,
    destination: &Path,
    expectation: &WindowsRecoveryPackageExpectation,
) -> Result<(), WindowsRecoveryPackageError> {
    let mut source_file = open_regular_file(source)?;
    if source_file.metadata()?.len() != expectation.size_bytes() {
        return Err(WindowsRecoveryPackageError::InvalidPackage);
    }
    let parent = destination
        .parent()
        .ok_or(WindowsRecoveryPackageError::InvalidPackage)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-windows-recovery-package", ".tmp")?;
    let copied = io::copy(&mut source_file, staging.file_mut()?)?;
    if copied != expectation.size_bytes() {
        return Err(WindowsRecoveryPackageError::InvalidPackage);
    }
    staging.sync_and_close()?;
    staging.persist_noclobber(destination)?;
    validate_package_file(destination, expectation)
}

#[derive(Debug)]
struct TreeEntry {
    relative_path: PathBuf,
    normalized_path: String,
    absolute_path: PathBuf,
    kind: u8,
}

fn copy_runnable_tree(
    source: &Path,
    destination: &Path,
) -> Result<(), WindowsRecoveryPackageError> {
    let entries = collect_tree_entries(source)?;
    for entry in entries {
        let destination_path = destination.join(&entry.relative_path);
        match entry.kind {
            b'D' => create_private_directory(&destination_path)?,
            b'F' => copy_regular_file(&entry.absolute_path, &destination_path)?,
            _ => return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor),
        }
    }
    Ok(())
}

fn validate_runnable_tree(
    package_port: &impl WindowsRecoveryPackagePort,
    root: &Path,
    expected_version: &str,
) -> Result<String, WindowsRecoveryPackageError> {
    let digest = runnable_tree_sha256(root)?;
    let executable = root.join(EXECUTABLE_NAME);
    let uninstaller = root.join(UNINSTALLER_NAME);
    for required in [&executable, &uninstaller] {
        let metadata = fs::symlink_metadata(required)
            .map_err(|_| WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
        if !metadata.file_type().is_file() || is_reparse_point(&metadata) {
            return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
        }
    }
    validate_binary_identity(package_port, &executable, expected_version)
        .map_err(|_| WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
    Ok(digest)
}

fn runnable_tree_sha256(root: &Path) -> Result<String, WindowsRecoveryPackageError> {
    let entries = collect_tree_entries(root)?;
    let mut digest = Sha256::new();
    for entry in entries {
        let metadata = fs::symlink_metadata(&entry.absolute_path)?;
        digest.update([entry.kind]);
        digest.update(
            u64::try_from(entry.normalized_path.len())
                .map_err(|_| WindowsRecoveryPackageError::InvalidRunnablePredecessor)?
                .to_be_bytes(),
        );
        digest.update(entry.normalized_path.as_bytes());
        if entry.kind == b'F' {
            digest.update(metadata.len().to_be_bytes());
            digest.update(file_digest_bytes(&entry.absolute_path, metadata.len())?);
        }
    }
    Ok(lower_hex(&digest.finalize()))
}

fn collect_tree_entries(root: &Path) -> Result<Vec<TreeEntry>, WindowsRecoveryPackageError> {
    let metadata = fs::symlink_metadata(root)
        .map_err(|_| WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
    if !metadata.file_type().is_dir() || is_reparse_point(&metadata) {
        return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
    }
    let mut entries = Vec::new();
    let mut expanded_bytes = 0_u64;
    collect_tree_entries_inner(root, root, &mut entries, &mut expanded_bytes)?;
    entries.sort_by(|left, right| {
        left.normalized_path
            .as_bytes()
            .cmp(right.normalized_path.as_bytes())
    });
    let mut folded_paths = BTreeSet::new();
    if entries
        .iter()
        .any(|entry| !folded_paths.insert(entry.normalized_path.to_ascii_lowercase()))
    {
        return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
    }
    Ok(entries)
}

fn collect_tree_entries_inner(
    root: &Path,
    directory: &Path,
    entries: &mut Vec<TreeEntry>,
    expanded_bytes: &mut u64,
) -> Result<(), WindowsRecoveryPackageError> {
    for entry in fs::read_dir(directory)? {
        if entries.len() >= MAX_TREE_ENTRIES {
            return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
        }
        let path = entry?.path();
        let metadata = fs::symlink_metadata(&path)?;
        let file_type = metadata.file_type();
        if is_reparse_point(&metadata) {
            return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
        }
        let kind = if file_type.is_dir() {
            b'D'
        } else if file_type.is_file() {
            *expanded_bytes = expanded_bytes
                .checked_add(metadata.len())
                .filter(|size| *size <= MAX_EXPANDED_TREE_BYTES)
                .ok_or(WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
            b'F'
        } else {
            return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
        };
        let (relative_path, normalized_path) = normalized_relative_path(root, &path)?;
        entries.push(TreeEntry {
            relative_path,
            normalized_path,
            absolute_path: path.clone(),
            kind,
        });
        if kind == b'D' {
            collect_tree_entries_inner(root, &path, entries, expanded_bytes)?;
        }
    }
    Ok(())
}

fn normalized_relative_path(
    root: &Path,
    path: &Path,
) -> Result<(PathBuf, String), WindowsRecoveryPackageError> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
    let mut parts = Vec::new();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
        };
        let part = part
            .to_str()
            .filter(|part| valid_windows_path_component(part))
            .ok_or(WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
        parts.push(part);
    }
    let normalized = parts.join("/");
    if normalized.is_empty() || normalized.len() > MAX_RELATIVE_PATH_BYTES {
        return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
    }
    Ok((relative.to_owned(), normalized))
}

fn valid_windows_path_component(value: &str) -> bool {
    if value.is_empty()
        || value.ends_with(' ')
        || value.ends_with('.')
        || value.chars().any(|character| {
            character <= '\u{1f}'
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '|' | '?' | '*' | '/' | '\\'
                )
        })
    {
        return false;
    }
    let stem = value
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    !matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        && !(stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

fn copy_regular_file(source: &Path, destination: &Path) -> Result<(), WindowsRecoveryPackageError> {
    let mut source_file = open_regular_file(source)
        .map_err(|_| WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
    let source_length = source_file.metadata()?.len();
    let mut options = OpenOptions::new();
    options.read(true).write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.mode(0o600);
    }
    let mut destination_file = options.open(destination)?;
    let copied = io::copy(&mut source_file, &mut destination_file)?;
    if copied != source_length {
        return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor);
    }
    destination_file.sync_all()?;
    Ok(())
}

fn open_regular_file(path: &Path) -> Result<File, io::Error> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;

        use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;

        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || is_reparse_point(&metadata) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "not a regular file",
        ));
    }
    Ok(file)
}

fn file_sha256(path: &Path, expected_size: u64) -> Result<String, WindowsRecoveryPackageError> {
    Ok(lower_hex(&file_digest_bytes(path, expected_size)?))
}

fn file_digest_bytes(
    path: &Path,
    expected_size: u64,
) -> Result<[u8; 32], WindowsRecoveryPackageError> {
    let mut file = open_regular_file(path)?;
    if file.metadata()?.len() != expected_size {
        return Err(WindowsRecoveryPackageError::InvalidPackage);
    }
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut total = 0_u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(
                u64::try_from(read)
                    .map_err(|_| WindowsRecoveryPackageError::InvalidRunnablePredecessor)?,
            )
            .ok_or(WindowsRecoveryPackageError::InvalidRunnablePredecessor)?;
        digest.update(&buffer[..read]);
    }
    if total != expected_size {
        return Err(WindowsRecoveryPackageError::InvalidPackage);
    }
    Ok(digest.finalize().into())
}

fn sync_tree(root: &Path) -> Result<(), WindowsRecoveryPackageError> {
    let entries = collect_tree_entries(root)?;
    for entry in &entries {
        if entry.kind == b'F' {
            open_regular_file(&entry.absolute_path)?.sync_all()?;
        }
    }
    let mut directories = entries
        .iter()
        .filter(|entry| entry.kind == b'D')
        .map(|entry| entry.absolute_path.clone())
        .collect::<Vec<_>>();
    directories.sort_by_key(|path| Reverse(path.components().count()));
    for directory in directories {
        sync_directory(&directory)?;
    }
    sync_directory(root)?;
    Ok(())
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

struct PreparedAssetGuard {
    previous_directory: PathBuf,
    candidate_directory: PathBuf,
    previous_created: bool,
    candidate_created: bool,
    armed: bool,
}

impl PreparedAssetGuard {
    fn new(attempt_directory: &Path) -> Self {
        Self {
            previous_directory: attempt_directory.join("previous"),
            candidate_directory: attempt_directory.join("candidate"),
            previous_created: false,
            candidate_created: false,
            armed: true,
        }
    }

    fn create_directories(&mut self) -> Result<(), WindowsRecoveryPackageError> {
        create_private_directory(&self.previous_directory)?;
        self.previous_created = true;
        create_private_directory(&self.candidate_directory)?;
        self.candidate_created = true;
        Ok(())
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for PreparedAssetGuard {
    fn drop(&mut self) {
        if self.armed {
            if self.candidate_created {
                let _ = fs::remove_dir_all(&self.candidate_directory);
            }
            if self.previous_created {
                let _ = fs::remove_dir_all(&self.previous_directory);
            }
        }
    }
}

struct StagingDirectory {
    path: PathBuf,
    armed: bool,
}

impl StagingDirectory {
    fn new(parent: &Path) -> Result<Self, WindowsRecoveryPackageError> {
        for _ in 0..32 {
            let sequence = STAGING_DIRECTORY_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let path = parent.join(format!(
                ".windows-runnable-staging-{}-{sequence}",
                process::id()
            ));
            match create_private_directory(&path) {
                Ok(()) => return Ok(Self { path, armed: true }),
                Err(WindowsRecoveryPackageError::Io(error))
                    if error.kind() == io::ErrorKind::AlreadyExists =>
                {
                    continue;
                }
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "could not allocate a unique Windows recovery staging directory",
        )
        .into())
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn persist_noclobber(mut self, destination: &Path) -> Result<(), WindowsRecoveryPackageError> {
        match fs::symlink_metadata(destination) {
            Ok(_) => return Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        fs::rename(&self.path, destination)?;
        self.armed = false;
        sync_directory(
            destination
                .parent()
                .ok_or(WindowsRecoveryPackageError::InvalidRunnablePredecessor)?,
        )?;
        Ok(())
    }
}

impl Drop for StagingDirectory {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

fn create_private_directory(path: &Path) -> Result<(), WindowsRecoveryPackageError> {
    fs::create_dir(path)?;
    let configured = (|| {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
        }
        sync_directory(
            path.parent()
                .ok_or(WindowsRecoveryPackageError::InvalidExpectation)?,
        )?;
        Ok(())
    })();
    if configured.is_err() {
        let _ = fs::remove_dir(path);
    }
    configured
}

#[cfg(target_os = "windows")]
fn system_inspect_binary(path: &Path) -> Result<WindowsBinaryIdentity, io::Error> {
    let canonical = path.canonicalize()?;
    if canonical != path {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "binary path is not canonical",
        ));
    }
    let architecture = inspect_pe_architecture(path)?;
    let mut identity = inspect_version_strings(path)?;
    identity.architecture = architecture;
    Ok(identity)
}

#[cfg(target_os = "windows")]
fn inspect_pe_architecture(path: &Path) -> Result<String, io::Error> {
    use std::io::{Seek, SeekFrom};

    let mut file = open_regular_file(path)?;
    let mut header = [0_u8; 64];
    file.read_exact(&mut header)?;
    if &header[0..2] != b"MZ" {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "missing DOS header",
        ));
    }
    let offset = u32::from_le_bytes(
        header[0x3c..0x40]
            .try_into()
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid PE header offset"))?,
    );
    if offset < 64 || u64::from(offset) > file.metadata()?.len().saturating_sub(6) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid PE header offset",
        ));
    }
    file.seek(SeekFrom::Start(u64::from(offset)))?;
    let mut signature_and_machine = [0_u8; 6];
    file.read_exact(&mut signature_and_machine)?;
    if &signature_and_machine[0..4] != b"PE\0\0"
        || u16::from_le_bytes([signature_and_machine[4], signature_and_machine[5]]) != 0x8664
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "binary is not x86-64 PE",
        ));
    }
    Ok("x86_64".to_owned())
}

#[cfg(target_os = "windows")]
fn inspect_version_strings(path: &Path) -> Result<WindowsBinaryIdentity, io::Error> {
    use std::{iter, os::windows::ffi::OsStrExt};

    use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW};

    let path = path
        .as_os_str()
        .encode_wide()
        .chain(iter::once(0))
        .collect::<Vec<_>>();
    let mut unused = 0_u32;
    let byte_length = unsafe { GetFileVersionInfoSizeW(path.as_ptr(), &mut unused) };
    if byte_length == 0 || byte_length > MAX_VERSION_INFO_BYTES {
        return Err(io::Error::last_os_error());
    }
    let mut buffer = vec![0_u32; (byte_length as usize).div_ceil(4)];
    if unsafe { GetFileVersionInfoW(path.as_ptr(), 0, byte_length, buffer.as_mut_ptr().cast()) }
        == 0
    {
        return Err(io::Error::last_os_error());
    }
    let translations = query_version_translations(&buffer)?;
    let mut result = None;
    for (language, code_page) in translations {
        let base = format!(r"\StringFileInfo\{language:04x}{code_page:04x}");
        let current = WindowsBinaryIdentity {
            product_name: query_version_string(&buffer, &format!(r"{base}\ProductName"))?,
            file_description: query_version_string(&buffer, &format!(r"{base}\FileDescription"))?,
            file_version: query_version_string(&buffer, &format!(r"{base}\FileVersion"))?,
            product_version: query_version_string(&buffer, &format!(r"{base}\ProductVersion"))?,
            architecture: String::new(),
        };
        if result.as_ref().is_some_and(|existing| existing != &current) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "ambiguous binary version identity",
            ));
        }
        result = Some(current);
    }
    result.ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing version identity"))
}

#[cfg(target_os = "windows")]
fn query_version_translations(buffer: &[u32]) -> Result<Vec<(u16, u16)>, io::Error> {
    use std::{ptr, slice};

    use windows_sys::Win32::Storage::FileSystem::VerQueryValueW;

    let key = wide_null(r"\VarFileInfo\Translation");
    let mut value = ptr::null_mut();
    let mut byte_length = 0_u32;
    if unsafe {
        VerQueryValueW(
            buffer.as_ptr().cast(),
            key.as_ptr(),
            &mut value,
            &mut byte_length,
        )
    } == 0
        || value.is_null()
        || byte_length == 0
        || byte_length % 4 != 0
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid version translations",
        ));
    }
    let words = unsafe {
        slice::from_raw_parts(
            value.cast::<u16>(),
            usize::try_from(byte_length / 2)
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "translation overflow"))?,
        )
    };
    Ok(words
        .chunks_exact(2)
        .map(|pair| (pair[0], pair[1]))
        .collect())
}

#[cfg(target_os = "windows")]
fn query_version_string(buffer: &[u32], key: &str) -> Result<String, io::Error> {
    use std::{ptr, slice};

    use windows_sys::Win32::Storage::FileSystem::VerQueryValueW;

    let key = wide_null(key);
    let mut value = ptr::null_mut();
    let mut character_length = 0_u32;
    if unsafe {
        VerQueryValueW(
            buffer.as_ptr().cast(),
            key.as_ptr(),
            &mut value,
            &mut character_length,
        )
    } == 0
        || value.is_null()
        || character_length < 2
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "missing version string",
        ));
    }
    let mut words = unsafe {
        slice::from_raw_parts(
            value.cast::<u16>(),
            usize::try_from(character_length)
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "version overflow"))?,
        )
    };
    if words.last() == Some(&0) {
        words = &words[..words.len() - 1];
    }
    if words.is_empty() || words.contains(&0) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid version string",
        ));
    }
    String::from_utf16(words)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid version UTF-16"))
}

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    use std::{iter, os::windows::ffi::OsStrExt};

    OsStr::new(value)
        .encode_wide()
        .chain(iter::once(0))
        .collect()
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn lower_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, collections::VecDeque};

    #[cfg(unix)]
    use std::os::unix::fs::symlink;

    use tempfile::TempDir;

    use super::*;

    struct SyntheticWindowsPackage {
        identities: RefCell<VecDeque<WindowsBinaryIdentity>>,
        installed: WindowsInstalledPackage,
        inspected_paths: RefCell<Vec<PathBuf>>,
    }

    impl SyntheticWindowsPackage {
        fn valid(install_directory: &Path, predecessor: &str, candidate: &str) -> Self {
            Self {
                identities: RefCell::new(VecDeque::from([
                    identity(predecessor),
                    identity(predecessor),
                    identity(candidate),
                    identity(predecessor),
                    identity(predecessor),
                    identity(predecessor),
                    identity(candidate),
                ])),
                installed: WindowsInstalledPackage {
                    version: predecessor.to_owned(),
                    install_directory: install_directory.to_owned(),
                },
                inspected_paths: RefCell::new(Vec::new()),
            }
        }

        fn valid_for_verification(predecessor: &str, candidate: &str) -> Self {
            Self {
                identities: RefCell::new(VecDeque::from([
                    identity(predecessor),
                    identity(candidate),
                    identity(predecessor),
                ])),
                installed: WindowsInstalledPackage {
                    version: predecessor.to_owned(),
                    install_directory: PathBuf::new(),
                },
                inspected_paths: RefCell::new(Vec::new()),
            }
        }
    }

    impl WindowsRecoveryPackagePort for SyntheticWindowsPackage {
        fn inspect_binary(&self, path: &Path) -> Result<WindowsBinaryIdentity, io::Error> {
            self.inspected_paths.borrow_mut().push(path.to_owned());
            self.identities
                .borrow_mut()
                .pop_front()
                .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "unexpected binary"))
        }

        fn installed_package(&self) -> Result<WindowsInstalledPackage, io::Error> {
            Ok(self.installed.clone())
        }
    }

    struct Harness {
        _directory: TempDir,
        attempt_directory: PathBuf,
        predecessor_source: PathBuf,
        install_directory: PathBuf,
        predecessor_bytes: Vec<u8>,
        candidate_bytes: Vec<u8>,
        predecessor: WindowsRecoveryPackageExpectation,
        candidate: WindowsRecoveryPackageExpectation,
    }

    impl Harness {
        fn new() -> Self {
            let directory = TempDir::new().expect("temporary directory");
            let root = directory.path().canonicalize().expect("canonical root");
            let attempt_directory = root.join("attempt");
            let install_directory = root.join("installed");
            fs::create_dir(&attempt_directory).expect("attempt directory");
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;

                fs::set_permissions(&attempt_directory, fs::Permissions::from_mode(0o700))
                    .expect("private attempt directory");
            }
            fs::create_dir(&install_directory).expect("installation directory");
            fs::write(
                install_directory.join(EXECUTABLE_NAME),
                b"synthetic installed executable",
            )
            .expect("installed executable");
            fs::write(
                install_directory.join(UNINSTALLER_NAME),
                b"synthetic installed uninstaller",
            )
            .expect("installed uninstaller");
            let resources = install_directory.join("resources");
            fs::create_dir(&resources).expect("resources directory");
            fs::write(resources.join("locale.dat"), b"synthetic locale")
                .expect("installed resource");
            let predecessor_bytes = b"synthetic predecessor NSIS package".to_vec();
            let candidate_bytes = b"synthetic candidate NSIS package".to_vec();
            let predecessor_source = root.join("authenticated-predecessor.exe");
            fs::write(&predecessor_source, &predecessor_bytes).expect("predecessor source");
            let predecessor = expectation("0.1.0", &predecessor_bytes);
            let candidate = expectation("0.2.0", &candidate_bytes);
            Self {
                _directory: directory,
                attempt_directory,
                predecessor_source,
                install_directory,
                predecessor_bytes,
                candidate_bytes,
                predecessor,
                candidate,
            }
        }

        fn package_port(&self) -> SyntheticWindowsPackage {
            SyntheticWindowsPackage::valid(&self.install_directory, "0.1.0", "0.2.0")
        }
    }

    fn identity(version: &str) -> WindowsBinaryIdentity {
        WindowsBinaryIdentity {
            product_name: PRODUCT_NAME.to_owned(),
            file_description: PRODUCT_NAME.to_owned(),
            file_version: version.to_owned(),
            product_version: version.to_owned(),
            architecture: "x86_64".to_owned(),
        }
    }

    fn expectation(version: &str, bytes: &[u8]) -> WindowsRecoveryPackageExpectation {
        WindowsRecoveryPackageExpectation::try_new(
            version.to_owned(),
            u64::try_from(bytes.len()).expect("package size"),
            lower_hex(&Sha256::digest(bytes)),
        )
        .expect("package expectation")
    }

    #[test]
    fn preserves_reopens_and_copies_the_complete_installed_predecessor() {
        let harness = Harness::new();
        let package_port = harness.package_port();

        let prepared = prepare_windows_recovery_packages_from_path_with(
            &package_port,
            &harness.attempt_directory,
            &harness.predecessor_source,
            &harness.predecessor,
            &harness.candidate_bytes,
            &harness.candidate,
        )
        .expect("prepared Windows packages");

        assert_eq!(
            fs::read(prepared.predecessor_package_path()).expect("predecessor bytes"),
            harness.predecessor_bytes
        );
        assert_eq!(
            fs::read(prepared.candidate_package_path()).expect("candidate bytes"),
            harness.candidate_bytes
        );
        assert_eq!(
            fs::read(
                prepared
                    .runnable_predecessor_path()
                    .join("resources/locale.dat")
            )
            .expect("copied resource"),
            b"synthetic locale"
        );
        assert!(valid_sha256(prepared.runnable_tree_sha256()));
        assert!(package_port.identities.borrow().is_empty());
    }

    #[test]
    fn rejects_package_drift_version_regression_and_installed_version_mismatch() {
        let harness = Harness::new();
        let package_port = harness.package_port();
        fs::write(&harness.predecessor_source, b"changed predecessor").expect("changed package");
        assert!(matches!(
            prepare_windows_recovery_packages_from_path_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_source,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(WindowsRecoveryPackageError::InvalidPackage)
        ));

        let harness = Harness::new();
        let same_version = expectation("0.1.0", &harness.candidate_bytes);
        assert!(matches!(
            prepare_windows_recovery_packages_from_path_with(
                &harness.package_port(),
                &harness.attempt_directory,
                &harness.predecessor_source,
                &harness.predecessor,
                &harness.candidate_bytes,
                &same_version,
            ),
            Err(WindowsRecoveryPackageError::InvalidExpectation)
        ));

        let mut package_port = harness.package_port();
        package_port.installed.version = "0.0.9".to_owned();
        assert!(matches!(
            prepare_windows_recovery_packages_from_path_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_source,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(WindowsRecoveryPackageError::InvalidPackageIdentity)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_redirected_installed_tree_without_retaining_partial_assets() {
        let harness = Harness::new();
        let outside = harness
            .install_directory
            .parent()
            .expect("installation parent")
            .join("outside.dat");
        fs::write(&outside, b"outside").expect("outside file");
        symlink(&outside, harness.install_directory.join("redirected.dat"))
            .expect("redirected file");

        assert!(matches!(
            prepare_windows_recovery_packages_from_path_with(
                &harness.package_port(),
                &harness.attempt_directory,
                &harness.predecessor_source,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor)
        ));
        assert!(!harness.attempt_directory.join("previous").exists());
        assert!(!harness.attempt_directory.join("candidate").exists());
    }

    #[test]
    fn detects_preserved_package_and_runnable_mutation_when_reopening() {
        let harness = Harness::new();
        let package_port = harness.package_port();
        let prepared = prepare_windows_recovery_packages_from_path_with(
            &package_port,
            &harness.attempt_directory,
            &harness.predecessor_source,
            &harness.predecessor,
            &harness.candidate_bytes,
            &harness.candidate,
        )
        .expect("prepared Windows packages");

        fs::write(prepared.candidate_package_path(), b"changed candidate")
            .expect("mutated candidate");
        assert!(matches!(
            verify_windows_recovery_packages_with(
                &SyntheticWindowsPackage::valid_for_verification("0.1.0", "0.2.0"),
                &harness.attempt_directory,
                &harness.predecessor,
                &harness.candidate,
                prepared.runnable_tree_sha256(),
            ),
            Err(WindowsRecoveryPackageError::InvalidPackage)
        ));

        let harness = Harness::new();
        let prepared = prepare_windows_recovery_packages_from_path_with(
            &harness.package_port(),
            &harness.attempt_directory,
            &harness.predecessor_source,
            &harness.predecessor,
            &harness.candidate_bytes,
            &harness.candidate,
        )
        .expect("prepared Windows packages");
        fs::write(
            prepared
                .runnable_predecessor_path()
                .join("resources/locale.dat"),
            b"changed resource",
        )
        .expect("mutated runnable resource");
        assert!(matches!(
            verify_windows_recovery_packages_with(
                &SyntheticWindowsPackage::valid_for_verification("0.1.0", "0.2.0"),
                &harness.attempt_directory,
                &harness.predecessor,
                &harness.candidate,
                prepared.runnable_tree_sha256(),
            ),
            Err(WindowsRecoveryPackageError::InvalidRunnablePredecessor)
        ));
    }

    #[test]
    fn reopens_one_complete_unchanged_package_pair_and_runnable_tree() {
        let harness = Harness::new();
        let prepared = prepare_windows_recovery_packages_from_path_with(
            &harness.package_port(),
            &harness.attempt_directory,
            &harness.predecessor_source,
            &harness.predecessor,
            &harness.candidate_bytes,
            &harness.candidate,
        )
        .expect("prepared Windows packages");
        let verification = SyntheticWindowsPackage::valid_for_verification("0.1.0", "0.2.0");

        let reopened = verify_windows_recovery_packages_with(
            &verification,
            &harness.attempt_directory,
            &harness.predecessor,
            &harness.candidate,
            prepared.runnable_tree_sha256(),
        )
        .expect("reopened Windows packages");

        assert_eq!(reopened, prepared);
        assert!(verification.identities.borrow().is_empty());
    }

    #[test]
    fn rejects_cross_product_binary_identity_before_creating_recovery_assets() {
        let harness = Harness::new();
        let package_port = harness.package_port();
        package_port
            .identities
            .borrow_mut()
            .front_mut()
            .expect("predecessor identity")
            .product_name = "Another product".to_owned();

        assert!(matches!(
            prepare_windows_recovery_packages_from_path_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_source,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(WindowsRecoveryPackageError::InvalidPackageIdentity)
        ));
        assert!(!harness.attempt_directory.join("previous").exists());
        assert!(!harness.attempt_directory.join("candidate").exists());
    }

    #[test]
    fn windows_tree_digest_is_deterministic_and_rejects_unsafe_names() {
        let first = TempDir::new().expect("first directory");
        let second = TempDir::new().expect("second directory");
        for root in [first.path(), second.path()] {
            fs::create_dir(root.join("resources")).expect("resources directory");
            fs::write(root.join(EXECUTABLE_NAME), b"application").expect("application");
            fs::write(root.join(UNINSTALLER_NAME), b"uninstaller").expect("uninstaller");
            fs::write(root.join("resources/locale.dat"), b"locale").expect("locale");
        }
        assert_eq!(
            runnable_tree_sha256(first.path()).expect("first digest"),
            runnable_tree_sha256(second.path()).expect("second digest")
        );
        for invalid in [
            "CON",
            "aux.txt",
            "file. ",
            "stream:name",
            "question?",
            "sub\\file",
            "sub/file",
        ] {
            assert!(!valid_windows_path_component(invalid), "{invalid}");
        }
    }
}
