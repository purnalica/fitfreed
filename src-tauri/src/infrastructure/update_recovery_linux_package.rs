use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
};

use semver::Version;
use sha2::{Digest, Sha256};
use thiserror::Error;

use super::local_file::{sync_directory, PrivateStagingFile};

const DPKG_DEB_PATH: &str = "/usr/bin/dpkg-deb";
const PACKAGE_NAME: &str = "fitfreed";
const PACKAGE_ARCHITECTURE: &str = "amd64";
const PREDECESSOR_PACKAGE_RELATIVE_PATH: &str = "previous/package.deb";
const CANDIDATE_PACKAGE_RELATIVE_PATH: &str = "candidate/package.deb";
const RUNNABLE_PREDECESSOR_RELATIVE_PATH: &str = "previous/runnable";
const EXECUTABLE_RELATIVE_PATH: &str = "usr/bin/fitfreed";
const DESKTOP_ENTRY_RELATIVE_PATH: &str = "usr/share/applications/FitFreed.desktop";
const MAX_PACKAGE_BYTES: u64 = 1_073_741_824;
const MAX_CONTROL_OUTPUT_BYTES: usize = 16 * 1024;
const MAX_TREE_ENTRIES: usize = 65_536;
const MAX_EXPANDED_TREE_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const MAX_RELATIVE_PATH_BYTES: usize = 4096;

static STAGING_DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Error)]
pub enum LinuxRecoveryPackageError {
    #[error("the Linux recovery package expectation is invalid")]
    InvalidExpectation,
    #[error("the Linux recovery package bytes are invalid")]
    InvalidPackage,
    #[error("the Linux recovery package identity is invalid")]
    InvalidPackageIdentity,
    #[error("the Linux runnable predecessor is invalid")]
    InvalidRunnablePredecessor,
    #[error("the Debian package tool is unavailable")]
    PackageToolUnavailable,
    #[error("the Debian package tool rejected the package")]
    PackageToolFailed,
    #[error("Linux recovery package input/output failure: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinuxRecoveryPackageExpectation {
    version: String,
    size_bytes: u64,
    sha256: String,
}

impl LinuxRecoveryPackageExpectation {
    pub fn try_new(
        version: String,
        size_bytes: u64,
        sha256: String,
    ) -> Result<Self, LinuxRecoveryPackageError> {
        if Version::parse(&version).is_err()
            || size_bytes == 0
            || size_bytes > MAX_PACKAGE_BYTES
            || !valid_sha256(&sha256)
        {
            return Err(LinuxRecoveryPackageError::InvalidExpectation);
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
pub struct PreparedLinuxRecoveryPackages {
    predecessor_package_path: PathBuf,
    candidate_package_path: PathBuf,
    runnable_predecessor_path: PathBuf,
    runnable_tree_sha256: String,
}

impl PreparedLinuxRecoveryPackages {
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

trait DebianPackagePort {
    fn inspect(&self, package_path: &Path) -> Result<Vec<u8>, LinuxRecoveryPackageError>;
    fn extract(
        &self,
        package_path: &Path,
        destination: &Path,
    ) -> Result<(), LinuxRecoveryPackageError>;
}

struct CommandOutput {
    success: bool,
    stdout: Vec<u8>,
}

trait CommandPort {
    fn run(
        &self,
        executable: &Path,
        arguments: &[&std::ffi::OsStr],
        capture_stdout: bool,
    ) -> Result<CommandOutput, io::Error>;
}

struct SystemCommand;

impl CommandPort for SystemCommand {
    fn run(
        &self,
        executable: &Path,
        arguments: &[&std::ffi::OsStr],
        capture_stdout: bool,
    ) -> Result<CommandOutput, io::Error> {
        let mut command = Command::new(executable);
        command
            .args(arguments)
            .stdin(Stdio::null())
            .stderr(Stdio::null());
        if capture_stdout {
            command.stdout(Stdio::piped());
        } else {
            command.stdout(Stdio::null());
        }
        let output = command.output()?;
        Ok(CommandOutput {
            success: output.status.success(),
            stdout: output.stdout,
        })
    }
}

struct SystemDebianPackage;

impl DebianPackagePort for SystemDebianPackage {
    fn inspect(&self, package_path: &Path) -> Result<Vec<u8>, LinuxRecoveryPackageError> {
        inspect_debian_package_with(&SystemCommand, package_path)
    }

    fn extract(
        &self,
        package_path: &Path,
        destination: &Path,
    ) -> Result<(), LinuxRecoveryPackageError> {
        extract_debian_package_with(&SystemCommand, package_path, destination)
    }
}

fn inspect_debian_package_with(
    command: &impl CommandPort,
    package_path: &Path,
) -> Result<Vec<u8>, LinuxRecoveryPackageError> {
    let output = command
        .run(
            Path::new(DPKG_DEB_PATH),
            &[
                std::ffi::OsStr::new("--show"),
                std::ffi::OsStr::new("--showformat=${Package}\\n${Version}\\n${Architecture}\\n"),
                package_path.as_os_str(),
            ],
            true,
        )
        .map_err(|_| LinuxRecoveryPackageError::PackageToolUnavailable)?;
    if !output.success || output.stdout.is_empty() || output.stdout.len() > MAX_CONTROL_OUTPUT_BYTES
    {
        return Err(LinuxRecoveryPackageError::PackageToolFailed);
    }
    Ok(output.stdout)
}

fn extract_debian_package_with(
    command: &impl CommandPort,
    package_path: &Path,
    destination: &Path,
) -> Result<(), LinuxRecoveryPackageError> {
    let output = command
        .run(
            Path::new(DPKG_DEB_PATH),
            &[
                std::ffi::OsStr::new("--extract"),
                package_path.as_os_str(),
                destination.as_os_str(),
            ],
            false,
        )
        .map_err(|_| LinuxRecoveryPackageError::PackageToolUnavailable)?;
    if !output.success || !output.stdout.is_empty() {
        return Err(LinuxRecoveryPackageError::PackageToolFailed);
    }
    Ok(())
}

pub fn prepare_linux_recovery_packages(
    attempt_directory: &Path,
    predecessor_bytes: &[u8],
    predecessor: &LinuxRecoveryPackageExpectation,
    candidate_bytes: &[u8],
    candidate: &LinuxRecoveryPackageExpectation,
) -> Result<PreparedLinuxRecoveryPackages, LinuxRecoveryPackageError> {
    prepare_linux_recovery_packages_with(
        &SystemDebianPackage,
        attempt_directory,
        predecessor_bytes,
        predecessor,
        candidate_bytes,
        candidate,
    )
}

pub fn verify_linux_recovery_packages(
    attempt_directory: &Path,
    predecessor: &LinuxRecoveryPackageExpectation,
    candidate: &LinuxRecoveryPackageExpectation,
    runnable_tree_sha256: &str,
) -> Result<PreparedLinuxRecoveryPackages, LinuxRecoveryPackageError> {
    verify_linux_recovery_packages_with(
        &SystemDebianPackage,
        attempt_directory,
        predecessor,
        candidate,
        runnable_tree_sha256,
    )
}

fn prepare_linux_recovery_packages_with(
    package_port: &impl DebianPackagePort,
    attempt_directory: &Path,
    predecessor_bytes: &[u8],
    predecessor: &LinuxRecoveryPackageExpectation,
    candidate_bytes: &[u8],
    candidate: &LinuxRecoveryPackageExpectation,
) -> Result<PreparedLinuxRecoveryPackages, LinuxRecoveryPackageError> {
    validate_version_order(predecessor, candidate)?;
    validate_package_bytes(predecessor_bytes, predecessor)?;
    validate_package_bytes(candidate_bytes, candidate)?;
    let attempt_directory = validate_attempt_directory(attempt_directory)?;
    let mut assets = PreparedAssetGuard::new(&attempt_directory);
    assets.create_directories()?;

    let predecessor_package_path = attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH);
    let candidate_package_path = attempt_directory.join(CANDIDATE_PACKAGE_RELATIVE_PATH);
    write_private_package(&predecessor_package_path, predecessor_bytes)?;
    write_private_package(&candidate_package_path, candidate_bytes)?;
    validate_preserved_package(package_port, &predecessor_package_path, predecessor)?;
    validate_preserved_package(package_port, &candidate_package_path, candidate)?;

    let runnable_predecessor_path = attempt_directory.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH);
    let staging = StagingDirectory::new(
        runnable_predecessor_path
            .parent()
            .ok_or(LinuxRecoveryPackageError::InvalidRunnablePredecessor)?,
    )?;
    package_port.extract(&predecessor_package_path, staging.path())?;
    let prepared_tree_sha256 = runnable_tree_sha256(staging.path())?;
    sync_tree(staging.path())?;
    staging.persist_noclobber(&runnable_predecessor_path)?;
    let reopened_tree_sha256 = runnable_tree_sha256(&runnable_predecessor_path)?;
    if reopened_tree_sha256 != prepared_tree_sha256 {
        return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
    }
    validate_preserved_package(package_port, &predecessor_package_path, predecessor)?;
    validate_preserved_package(package_port, &candidate_package_path, candidate)?;

    assets.disarm();
    Ok(PreparedLinuxRecoveryPackages {
        predecessor_package_path,
        candidate_package_path,
        runnable_predecessor_path,
        runnable_tree_sha256: prepared_tree_sha256,
    })
}

fn verify_linux_recovery_packages_with(
    package_port: &impl DebianPackagePort,
    attempt_directory: &Path,
    predecessor: &LinuxRecoveryPackageExpectation,
    candidate: &LinuxRecoveryPackageExpectation,
    expected_runnable_tree_sha256: &str,
) -> Result<PreparedLinuxRecoveryPackages, LinuxRecoveryPackageError> {
    validate_version_order(predecessor, candidate)?;
    if !valid_sha256(expected_runnable_tree_sha256) {
        return Err(LinuxRecoveryPackageError::InvalidExpectation);
    }
    let attempt_directory = validate_attempt_directory(attempt_directory)?;
    let predecessor_package_path = attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH);
    let candidate_package_path = attempt_directory.join(CANDIDATE_PACKAGE_RELATIVE_PATH);
    let runnable_predecessor_path = attempt_directory.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH);
    validate_preserved_package(package_port, &predecessor_package_path, predecessor)?;
    validate_preserved_package(package_port, &candidate_package_path, candidate)?;
    let runnable_tree_sha256 = runnable_tree_sha256(&runnable_predecessor_path)?;
    if runnable_tree_sha256 != expected_runnable_tree_sha256 {
        return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
    }
    Ok(PreparedLinuxRecoveryPackages {
        predecessor_package_path,
        candidate_package_path,
        runnable_predecessor_path,
        runnable_tree_sha256,
    })
}

fn validate_version_order(
    predecessor: &LinuxRecoveryPackageExpectation,
    candidate: &LinuxRecoveryPackageExpectation,
) -> Result<(), LinuxRecoveryPackageError> {
    let predecessor_version = Version::parse(predecessor.version())
        .map_err(|_| LinuxRecoveryPackageError::InvalidExpectation)?;
    let candidate_version = Version::parse(candidate.version())
        .map_err(|_| LinuxRecoveryPackageError::InvalidExpectation)?;
    if candidate_version <= predecessor_version {
        return Err(LinuxRecoveryPackageError::InvalidExpectation);
    }
    Ok(())
}

fn validate_attempt_directory(
    attempt_directory: &Path,
) -> Result<PathBuf, LinuxRecoveryPackageError> {
    if !attempt_directory.is_absolute() {
        return Err(LinuxRecoveryPackageError::InvalidExpectation);
    }
    let metadata = fs::symlink_metadata(attempt_directory)?;
    if !metadata.file_type().is_dir() {
        return Err(LinuxRecoveryPackageError::InvalidExpectation);
    }
    let canonical = attempt_directory.canonicalize()?;
    if canonical != attempt_directory {
        return Err(LinuxRecoveryPackageError::InvalidExpectation);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        if metadata.uid() != unsafe { libc::geteuid() }
            || metadata.permissions().mode() & 0o077 != 0
        {
            return Err(LinuxRecoveryPackageError::InvalidExpectation);
        }
    }
    Ok(canonical)
}

fn validate_package_bytes(
    bytes: &[u8],
    expectation: &LinuxRecoveryPackageExpectation,
) -> Result<(), LinuxRecoveryPackageError> {
    if u64::try_from(bytes.len()).ok() != Some(expectation.size_bytes())
        || lower_hex(&Sha256::digest(bytes)) != expectation.sha256()
    {
        return Err(LinuxRecoveryPackageError::InvalidPackage);
    }
    Ok(())
}

fn write_private_package(
    destination: &Path,
    bytes: &[u8],
) -> Result<(), LinuxRecoveryPackageError> {
    let parent = destination
        .parent()
        .ok_or(LinuxRecoveryPackageError::InvalidPackage)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-recovery-package", ".tmp")?;
    staging.file_mut()?.write_all(bytes)?;
    staging.sync_and_close()?;
    staging.persist_noclobber(destination)?;
    Ok(())
}

fn validate_preserved_package(
    package_port: &impl DebianPackagePort,
    path: &Path,
    expectation: &LinuxRecoveryPackageExpectation,
) -> Result<(), LinuxRecoveryPackageError> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| LinuxRecoveryPackageError::InvalidPackage)?;
    if !metadata.file_type().is_file()
        || metadata.len() != expectation.size_bytes()
        || path.canonicalize()? != path
        || file_sha256(path, metadata.len())? != expectation.sha256()
    {
        return Err(LinuxRecoveryPackageError::InvalidPackage);
    }
    validate_package_identity(&package_port.inspect(path)?, expectation.version())
}

fn validate_package_identity(
    output: &[u8],
    expected_version: &str,
) -> Result<(), LinuxRecoveryPackageError> {
    let text = std::str::from_utf8(output)
        .map_err(|_| LinuxRecoveryPackageError::InvalidPackageIdentity)?;
    if text.contains('\r') || !text.ends_with('\n') {
        return Err(LinuxRecoveryPackageError::InvalidPackageIdentity);
    }
    let fields = text.lines().collect::<Vec<_>>();
    if fields.len() != 3
        || fields[0] != PACKAGE_NAME
        || fields[1] != expected_version
        || fields[2] != PACKAGE_ARCHITECTURE
    {
        return Err(LinuxRecoveryPackageError::InvalidPackageIdentity);
    }
    Ok(())
}

fn runnable_tree_sha256(root: &Path) -> Result<String, LinuxRecoveryPackageError> {
    let entries = collect_tree_entries(root)?;
    let mut digest = Sha256::new();
    for entry in entries {
        let metadata = fs::symlink_metadata(&entry.absolute_path)?;
        digest.update([entry.kind]);
        digest.update(
            u64::try_from(entry.relative_path.len())
                .map_err(|_| LinuxRecoveryPackageError::InvalidRunnablePredecessor)?
                .to_be_bytes(),
        );
        digest.update(entry.relative_path.as_bytes());
        digest.update(entry_mode(&metadata, entry.kind).to_be_bytes());
        match entry.kind {
            b'F' => {
                digest.update(metadata.len().to_be_bytes());
                digest.update(file_digest_bytes(&entry.absolute_path, metadata.len())?);
            }
            b'L' => {
                let target = fs::read_link(&entry.absolute_path)?;
                validate_symlink_target(root, &entry.absolute_path, &target)?;
                let target = target
                    .to_str()
                    .filter(|value| value.len() <= MAX_RELATIVE_PATH_BYTES)
                    .ok_or(LinuxRecoveryPackageError::InvalidRunnablePredecessor)?;
                digest.update(
                    u64::try_from(target.len())
                        .map_err(|_| LinuxRecoveryPackageError::InvalidRunnablePredecessor)?
                        .to_be_bytes(),
                );
                digest.update(target.as_bytes());
            }
            b'D' => {}
            _ => return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor),
        }
    }
    validate_required_runnable_files(root)?;
    Ok(lower_hex(&digest.finalize()))
}

struct TreeEntry {
    relative_path: String,
    absolute_path: PathBuf,
    kind: u8,
}

fn collect_tree_entries(root: &Path) -> Result<Vec<TreeEntry>, LinuxRecoveryPackageError> {
    if !fs::symlink_metadata(root).is_ok_and(|metadata| metadata.file_type().is_dir()) {
        return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
    }
    let mut entries = Vec::new();
    let mut expanded_bytes = 0_u64;
    collect_tree_entries_inner(root, root, &mut entries, &mut expanded_bytes)?;
    entries.sort_by(|left, right| {
        left.relative_path
            .as_bytes()
            .cmp(right.relative_path.as_bytes())
    });
    Ok(entries)
}

fn collect_tree_entries_inner(
    root: &Path,
    directory: &Path,
    entries: &mut Vec<TreeEntry>,
    expanded_bytes: &mut u64,
) -> Result<(), LinuxRecoveryPackageError> {
    for entry in fs::read_dir(directory)? {
        if entries.len() >= MAX_TREE_ENTRIES {
            return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
        }
        let path = entry?.path();
        let metadata = fs::symlink_metadata(&path)?;
        let file_type = metadata.file_type();
        let kind = if file_type.is_dir() {
            b'D'
        } else if file_type.is_file() {
            *expanded_bytes = expanded_bytes
                .checked_add(metadata.len())
                .filter(|size| *size <= MAX_EXPANDED_TREE_BYTES)
                .ok_or(LinuxRecoveryPackageError::InvalidRunnablePredecessor)?;
            b'F'
        } else if file_type.is_symlink() {
            b'L'
        } else {
            return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
        };
        let relative_path = normalized_relative_path(root, &path)?;
        entries.push(TreeEntry {
            relative_path,
            absolute_path: path.clone(),
            kind,
        });
        if kind == b'D' {
            collect_tree_entries_inner(root, &path, entries, expanded_bytes)?;
        }
    }
    Ok(())
}

fn normalized_relative_path(root: &Path, path: &Path) -> Result<String, LinuxRecoveryPackageError> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| LinuxRecoveryPackageError::InvalidRunnablePredecessor)?;
    let mut parts = Vec::new();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
        };
        parts.push(
            part.to_str()
                .ok_or(LinuxRecoveryPackageError::InvalidRunnablePredecessor)?,
        );
    }
    let value = parts.join("/");
    if value.is_empty() || value.len() > MAX_RELATIVE_PATH_BYTES {
        return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
    }
    Ok(value)
}

fn validate_symlink_target(
    root: &Path,
    link_path: &Path,
    target: &Path,
) -> Result<(), LinuxRecoveryPackageError> {
    if target.as_os_str().is_empty() || target.is_absolute() {
        return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
    }
    let parent = link_path
        .parent()
        .ok_or(LinuxRecoveryPackageError::InvalidRunnablePredecessor)?
        .strip_prefix(root)
        .map_err(|_| LinuxRecoveryPackageError::InvalidRunnablePredecessor)?;
    let mut depth = parent
        .components()
        .filter(|component| matches!(component, Component::Normal(_)))
        .count();
    for component in target.components() {
        match component {
            Component::Normal(_) => depth += 1,
            Component::CurDir => {}
            Component::ParentDir if depth > 0 => depth -= 1,
            _ => return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor),
        }
    }
    Ok(())
}

fn validate_required_runnable_files(root: &Path) -> Result<(), LinuxRecoveryPackageError> {
    let executable = root.join(EXECUTABLE_RELATIVE_PATH);
    let desktop_entry = root.join(DESKTOP_ENTRY_RELATIVE_PATH);
    let executable_metadata = fs::symlink_metadata(&executable)
        .map_err(|_| LinuxRecoveryPackageError::InvalidRunnablePredecessor)?;
    let desktop_metadata = fs::symlink_metadata(&desktop_entry)
        .map_err(|_| LinuxRecoveryPackageError::InvalidRunnablePredecessor)?;
    if !executable_metadata.file_type().is_file() || !desktop_metadata.file_type().is_file() {
        return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        if executable_metadata.permissions().mode() & 0o111 == 0 {
            return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor);
        }
    }
    Ok(())
}

fn file_sha256(path: &Path, expected_size: u64) -> Result<String, LinuxRecoveryPackageError> {
    Ok(lower_hex(&file_digest_bytes(path, expected_size)?))
}

fn file_digest_bytes(
    path: &Path,
    expected_size: u64,
) -> Result<[u8; 32], LinuxRecoveryPackageError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    let mut file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || metadata.len() != expected_size {
        return Err(LinuxRecoveryPackageError::InvalidPackage);
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
                    .map_err(|_| LinuxRecoveryPackageError::InvalidRunnablePredecessor)?,
            )
            .ok_or(LinuxRecoveryPackageError::InvalidRunnablePredecessor)?;
        digest.update(&buffer[..read]);
    }
    if total != expected_size {
        return Err(LinuxRecoveryPackageError::InvalidPackage);
    }
    Ok(digest.finalize().into())
}

#[cfg(unix)]
fn entry_mode(metadata: &fs::Metadata, kind: u8) -> u32 {
    use std::os::unix::fs::PermissionsExt;

    if kind == b'L' {
        0o777
    } else {
        metadata.permissions().mode() & 0o7777
    }
}

#[cfg(not(unix))]
fn entry_mode(_metadata: &fs::Metadata, _kind: u8) -> u32 {
    0
}

fn sync_tree(root: &Path) -> Result<(), LinuxRecoveryPackageError> {
    let entries = collect_tree_entries(root)?;
    for entry in &entries {
        if entry.kind == b'F' {
            File::open(&entry.absolute_path)?.sync_all()?;
        }
    }
    let mut directories = entries
        .iter()
        .filter(|entry| entry.kind == b'D')
        .map(|entry| entry.absolute_path.clone())
        .collect::<Vec<_>>();
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for directory in directories {
        sync_directory(&directory)?;
    }
    sync_directory(root)?;
    Ok(())
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

    fn create_directories(&mut self) -> Result<(), LinuxRecoveryPackageError> {
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
    fn new(parent: &Path) -> Result<Self, LinuxRecoveryPackageError> {
        for _ in 0..32 {
            let sequence = STAGING_DIRECTORY_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let path = parent.join(format!(
                ".runnable-staging-{}-{sequence}",
                std::process::id()
            ));
            match create_private_directory(&path) {
                Ok(()) => return Ok(Self { path, armed: true }),
                Err(LinuxRecoveryPackageError::Io(error))
                    if error.kind() == io::ErrorKind::AlreadyExists =>
                {
                    continue;
                }
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "could not allocate a unique recovery staging directory",
        )
        .into())
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn persist_noclobber(mut self, destination: &Path) -> Result<(), LinuxRecoveryPackageError> {
        match fs::symlink_metadata(destination) {
            Ok(_) => return Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        fs::rename(&self.path, destination)?;
        self.armed = false;
        sync_directory(
            destination
                .parent()
                .ok_or(LinuxRecoveryPackageError::InvalidRunnablePredecessor)?,
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

fn create_private_directory(path: &Path) -> Result<(), LinuxRecoveryPackageError> {
    fs::create_dir(path)?;
    let configured = (|| {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
        }
        sync_directory(
            path.parent()
                .ok_or(LinuxRecoveryPackageError::InvalidExpectation)?,
        )?;
        Ok(())
    })();
    if configured.is_err() {
        let _ = fs::remove_dir(path);
    }
    configured
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, collections::VecDeque, ffi::OsString};

    #[cfg(unix)]
    use std::os::unix::{fs::symlink, fs::PermissionsExt};

    use tempfile::TempDir;

    use super::*;

    struct ExpectedCommand {
        executable: PathBuf,
        arguments: Vec<OsString>,
        capture_stdout: bool,
        output: CommandOutput,
    }

    struct SyntheticCommand {
        expected: RefCell<VecDeque<ExpectedCommand>>,
    }

    impl CommandPort for SyntheticCommand {
        fn run(
            &self,
            executable: &Path,
            arguments: &[&std::ffi::OsStr],
            capture_stdout: bool,
        ) -> Result<CommandOutput, io::Error> {
            let expected = self
                .expected
                .borrow_mut()
                .pop_front()
                .expect("expected command");
            assert_eq!(executable, expected.executable);
            assert_eq!(
                arguments,
                expected
                    .arguments
                    .iter()
                    .map(OsString::as_os_str)
                    .collect::<Vec<_>>()
            );
            assert_eq!(capture_stdout, expected.capture_stdout);
            Ok(expected.output)
        }
    }

    enum Extraction {
        Valid,
        EscapingLink,
        MissingExecutable,
    }

    struct SyntheticDebianPackage {
        inspections: RefCell<VecDeque<Vec<u8>>>,
        extraction: Extraction,
        inspected_paths: RefCell<Vec<PathBuf>>,
        extracted: RefCell<Vec<(PathBuf, PathBuf)>>,
    }

    impl SyntheticDebianPackage {
        fn valid(source_version: &str, target_version: &str) -> Self {
            Self {
                inspections: RefCell::new(
                    [
                        source_version,
                        target_version,
                        source_version,
                        target_version,
                    ]
                    .into_iter()
                    .map(|version| format!("fitfreed\n{version}\namd64\n").into_bytes())
                    .collect(),
                ),
                extraction: Extraction::Valid,
                inspected_paths: RefCell::new(Vec::new()),
                extracted: RefCell::new(Vec::new()),
            }
        }

        fn assert_exhausted(&self) {
            assert!(self.inspections.borrow().is_empty());
        }
    }

    impl DebianPackagePort for SyntheticDebianPackage {
        fn inspect(&self, package_path: &Path) -> Result<Vec<u8>, LinuxRecoveryPackageError> {
            self.inspected_paths
                .borrow_mut()
                .push(package_path.to_path_buf());
            self.inspections
                .borrow_mut()
                .pop_front()
                .ok_or(LinuxRecoveryPackageError::PackageToolFailed)
        }

        fn extract(
            &self,
            package_path: &Path,
            destination: &Path,
        ) -> Result<(), LinuxRecoveryPackageError> {
            self.extracted
                .borrow_mut()
                .push((package_path.to_path_buf(), destination.to_path_buf()));
            fs::create_dir_all(destination.join("usr/bin"))?;
            fs::create_dir_all(destination.join("usr/share/applications"))?;
            if !matches!(self.extraction, Extraction::MissingExecutable) {
                let executable = destination.join(EXECUTABLE_RELATIVE_PATH);
                fs::write(&executable, "synthetic runnable predecessor")?;
                #[cfg(unix)]
                fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))?;
            }
            fs::write(
                destination.join(DESKTOP_ENTRY_RELATIVE_PATH),
                "[Desktop Entry]\nName=FitFreed\n",
            )?;
            #[cfg(unix)]
            if matches!(self.extraction, Extraction::EscapingLink) {
                symlink("../../../../outside", destination.join("usr/bin/escape"))?;
            }
            Ok(())
        }
    }

    struct Harness {
        _directory: TempDir,
        attempt_directory: PathBuf,
        predecessor_bytes: Vec<u8>,
        candidate_bytes: Vec<u8>,
        predecessor: LinuxRecoveryPackageExpectation,
        candidate: LinuxRecoveryPackageExpectation,
    }

    impl Harness {
        fn new() -> Self {
            let directory = TempDir::new().expect("temporary directory");
            let attempt_directory = directory
                .path()
                .canonicalize()
                .expect("canonical temporary directory")
                .join("attempt");
            fs::create_dir(&attempt_directory).expect("attempt directory");
            #[cfg(unix)]
            fs::set_permissions(&attempt_directory, fs::Permissions::from_mode(0o700))
                .expect("private attempt directory");
            let predecessor_bytes = b"synthetic predecessor Debian package".to_vec();
            let candidate_bytes = b"synthetic candidate Debian package".to_vec();
            let predecessor = expectation("0.1.0", &predecessor_bytes);
            let candidate = expectation("0.2.0", &candidate_bytes);
            Self {
                _directory: directory,
                attempt_directory,
                predecessor_bytes,
                candidate_bytes,
                predecessor,
                candidate,
            }
        }
    }

    fn expectation(version: &str, bytes: &[u8]) -> LinuxRecoveryPackageExpectation {
        LinuxRecoveryPackageExpectation::try_new(
            version.to_owned(),
            u64::try_from(bytes.len()).expect("package size"),
            lower_hex(&Sha256::digest(bytes)),
        )
        .expect("package expectation")
    }

    #[test]
    fn invokes_only_the_fixed_debian_inspection_and_extraction_commands() {
        let package_path = PathBuf::from("/private/recovery/previous/package.deb");
        let destination = PathBuf::from("/private/recovery/previous/runnable-staging");
        let command = SyntheticCommand {
            expected: RefCell::new(
                [
                    ExpectedCommand {
                        executable: PathBuf::from(DPKG_DEB_PATH),
                        arguments: vec![
                            OsString::from("--show"),
                            OsString::from(
                                "--showformat=${Package}\\n${Version}\\n${Architecture}\\n",
                            ),
                            package_path.clone().into_os_string(),
                        ],
                        capture_stdout: true,
                        output: CommandOutput {
                            success: true,
                            stdout: b"fitfreed\n0.1.0\namd64\n".to_vec(),
                        },
                    },
                    ExpectedCommand {
                        executable: PathBuf::from(DPKG_DEB_PATH),
                        arguments: vec![
                            OsString::from("--extract"),
                            package_path.clone().into_os_string(),
                            destination.clone().into_os_string(),
                        ],
                        capture_stdout: false,
                        output: CommandOutput {
                            success: true,
                            stdout: Vec::new(),
                        },
                    },
                ]
                .into_iter()
                .collect(),
            ),
        };

        assert_eq!(
            inspect_debian_package_with(&command, &package_path).expect("Debian package identity"),
            b"fitfreed\n0.1.0\namd64\n"
        );
        extract_debian_package_with(&command, &package_path, &destination)
            .expect("Debian package extraction");
        assert!(command.expected.borrow().is_empty());
    }

    #[test]
    fn preserves_reopens_and_extracts_both_exact_packages() {
        let harness = Harness::new();
        let package_port = SyntheticDebianPackage::valid("0.1.0", "0.2.0");

        let prepared = prepare_linux_recovery_packages_with(
            &package_port,
            &harness.attempt_directory,
            &harness.predecessor_bytes,
            &harness.predecessor,
            &harness.candidate_bytes,
            &harness.candidate,
        )
        .expect("prepared Linux packages");

        assert_eq!(
            prepared.predecessor_package_path(),
            harness
                .attempt_directory
                .join(PREDECESSOR_PACKAGE_RELATIVE_PATH)
        );
        assert_eq!(
            prepared.candidate_package_path(),
            harness
                .attempt_directory
                .join(CANDIDATE_PACKAGE_RELATIVE_PATH)
        );
        assert_eq!(
            prepared.runnable_predecessor_path(),
            harness
                .attempt_directory
                .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
        );
        assert!(valid_sha256(prepared.runnable_tree_sha256()));
        assert_eq!(
            fs::read(prepared.predecessor_package_path()).expect("predecessor bytes"),
            harness.predecessor_bytes
        );
        assert_eq!(
            fs::read(prepared.candidate_package_path()).expect("candidate bytes"),
            harness.candidate_bytes
        );
        assert_eq!(package_port.extracted.borrow().len(), 1);
        package_port.assert_exhausted();
    }

    #[test]
    fn rejects_untrusted_bytes_and_version_direction_before_writing() {
        let harness = Harness::new();
        let package_port = SyntheticDebianPackage::valid("0.1.0", "0.2.0");
        let reversed = expectation("0.0.9", &harness.candidate_bytes);

        assert!(matches!(
            prepare_linux_recovery_packages_with(
                &package_port,
                &harness.attempt_directory,
                b"changed bytes",
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(LinuxRecoveryPackageError::InvalidPackage)
        ));
        assert!(matches!(
            prepare_linux_recovery_packages_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_bytes,
                &harness.predecessor,
                &harness.candidate_bytes,
                &reversed,
            ),
            Err(LinuxRecoveryPackageError::InvalidExpectation)
        ));
        assert!(!harness.attempt_directory.join("previous").exists());
        assert!(!harness.attempt_directory.join("candidate").exists());
        assert!(package_port.inspected_paths.borrow().is_empty());
    }

    #[test]
    fn rejects_control_identity_drift_and_removes_partial_assets() {
        let harness = Harness::new();
        let package_port = SyntheticDebianPackage {
            inspections: RefCell::new([b"another\n0.1.0\namd64\n".to_vec()].into_iter().collect()),
            extraction: Extraction::Valid,
            inspected_paths: RefCell::new(Vec::new()),
            extracted: RefCell::new(Vec::new()),
        };

        assert!(matches!(
            prepare_linux_recovery_packages_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_bytes,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(LinuxRecoveryPackageError::InvalidPackageIdentity)
        ));
        assert!(!harness.attempt_directory.join("previous").exists());
        assert!(!harness.attempt_directory.join("candidate").exists());
    }

    #[test]
    fn preserves_preexisting_attempt_content_when_preparation_cannot_start() {
        for existing_name in ["previous", "candidate"] {
            let harness = Harness::new();
            let existing = harness.attempt_directory.join(existing_name);
            fs::create_dir(&existing).expect("preexisting directory");
            fs::write(existing.join("retained"), "unrelated evidence")
                .expect("preexisting evidence");
            let package_port = SyntheticDebianPackage::valid("0.1.0", "0.2.0");

            assert!(prepare_linux_recovery_packages_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_bytes,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            )
            .is_err());
            assert_eq!(
                fs::read_to_string(existing.join("retained")).expect("retained evidence"),
                "unrelated evidence"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn rejects_an_escaping_runnable_link_without_retaining_assets() {
        let harness = Harness::new();
        let mut package_port = SyntheticDebianPackage::valid("0.1.0", "0.2.0");
        package_port.extraction = Extraction::EscapingLink;

        assert!(matches!(
            prepare_linux_recovery_packages_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_bytes,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor)
        ));
        assert!(!harness.attempt_directory.join("previous").exists());
        assert!(!harness.attempt_directory.join("candidate").exists());
    }

    #[test]
    fn rejects_a_runnable_image_without_the_application() {
        let harness = Harness::new();
        let mut package_port = SyntheticDebianPackage::valid("0.1.0", "0.2.0");
        package_port.extraction = Extraction::MissingExecutable;

        assert!(matches!(
            prepare_linux_recovery_packages_with(
                &package_port,
                &harness.attempt_directory,
                &harness.predecessor_bytes,
                &harness.predecessor,
                &harness.candidate_bytes,
                &harness.candidate,
            ),
            Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor)
        ));
    }

    #[test]
    fn detects_package_and_runnable_mutation_when_reopening() {
        let harness = Harness::new();
        let package_port = SyntheticDebianPackage::valid("0.1.0", "0.2.0");
        let prepared = prepare_linux_recovery_packages_with(
            &package_port,
            &harness.attempt_directory,
            &harness.predecessor_bytes,
            &harness.predecessor,
            &harness.candidate_bytes,
            &harness.candidate,
        )
        .expect("prepared Linux packages");

        fs::write(prepared.candidate_package_path(), "mutated package").expect("mutated candidate");
        let verifier = SyntheticDebianPackage::valid("0.1.0", "0.2.0");
        assert!(matches!(
            verify_linux_recovery_packages_with(
                &verifier,
                &harness.attempt_directory,
                &harness.predecessor,
                &harness.candidate,
                prepared.runnable_tree_sha256(),
            ),
            Err(LinuxRecoveryPackageError::InvalidPackage)
        ));

        fs::write(prepared.candidate_package_path(), &harness.candidate_bytes)
            .expect("restored candidate bytes");
        fs::write(
            prepared
                .runnable_predecessor_path()
                .join(EXECUTABLE_RELATIVE_PATH),
            "mutated runnable",
        )
        .expect("mutated runnable");
        let verifier = SyntheticDebianPackage::valid("0.1.0", "0.2.0");
        assert!(matches!(
            verify_linux_recovery_packages_with(
                &verifier,
                &harness.attempt_directory,
                &harness.predecessor,
                &harness.candidate,
                prepared.runnable_tree_sha256(),
            ),
            Err(LinuxRecoveryPackageError::InvalidRunnablePredecessor)
        ));
    }

    #[test]
    fn gives_identical_trees_one_deterministic_digest() {
        let first = TempDir::new().expect("first tree");
        let second = TempDir::new().expect("second tree");
        create_test_runnable(first.path(), false);
        create_test_runnable(second.path(), true);

        assert_eq!(
            runnable_tree_sha256(first.path()).expect("first digest"),
            runnable_tree_sha256(second.path()).expect("second digest")
        );
    }

    fn create_test_runnable(root: &Path, reverse: bool) {
        let paths = if reverse {
            [DESKTOP_ENTRY_RELATIVE_PATH, EXECUTABLE_RELATIVE_PATH]
        } else {
            [EXECUTABLE_RELATIVE_PATH, DESKTOP_ENTRY_RELATIVE_PATH]
        };
        for path in paths {
            let file = root.join(path);
            fs::create_dir_all(file.parent().expect("file parent")).expect("tree directory");
            fs::write(&file, path).expect("tree file");
            #[cfg(unix)]
            if path == EXECUTABLE_RELATIVE_PATH {
                fs::set_permissions(&file, fs::Permissions::from_mode(0o755))
                    .expect("executable permissions");
            }
        }
    }
}
