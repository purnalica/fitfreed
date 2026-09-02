use std::{
    ffi::OsString,
    fs, io,
    path::{Path, PathBuf},
    process::Command,
};

use semver::Version;
use thiserror::Error;

const DPKG_PATH: &str = "/usr/bin/dpkg";
const DPKG_QUERY_PATH: &str = "/usr/bin/dpkg-query";
const PKEXEC_PATH: &str = "/usr/bin/pkexec";
const PACKAGE_NAME: &str = "fitfreed";
const PACKAGE_ARCHITECTURE: &str = "amd64";
const INSTALLED_EXECUTABLE_PATH: &str = "/usr/bin/fitfreed";
const INSTALLED_DESKTOP_ENTRY_PATH: &str = "/usr/share/applications/FitFreed.desktop";
const PREDECESSOR_PACKAGE_RELATIVE_PATH: &str = "previous/package.deb";
const MAX_COMMAND_OUTPUT_BYTES: usize = 64 * 1024;

#[derive(Debug, Error)]
pub enum LinuxUpdateRecoveryError {
    #[error("the Linux package manager is unavailable")]
    PackageManagerUnavailable,
    #[error("the installed Linux package identity is invalid")]
    InvalidPackageIdentity,
    #[error("the predecessor Debian package is invalid")]
    InvalidPredecessorPackage,
    #[error("the native Debian rollback failed")]
    NativeRollbackFailed,
    #[error("the Linux process identity is invalid")]
    InvalidProcessIdentity,
    #[error("Linux update recovery input/output failure: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinuxNativePackageIdentity {
    version: String,
}

impl LinuxNativePackageIdentity {
    pub fn name(&self) -> &str {
        PACKAGE_NAME
    }

    pub fn version(&self) -> &str {
        &self.version
    }

    pub fn architecture(&self) -> &str {
        PACKAGE_ARCHITECTURE
    }

    pub fn executable_path(&self) -> &Path {
        Path::new(INSTALLED_EXECUTABLE_PATH)
    }

    pub fn desktop_entry_path(&self) -> &Path {
        Path::new(INSTALLED_DESKTOP_ENTRY_PATH)
    }

    #[cfg(test)]
    pub(crate) fn for_test(version: &str) -> Self {
        Self {
            version: version.to_owned(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinuxRecoveryProcessIdentity {
    process_id: u32,
    boot_id: String,
    start_time_clock_ticks: u64,
    executable_path: PathBuf,
}

impl LinuxRecoveryProcessIdentity {
    pub fn process_id(&self) -> u32 {
        self.process_id
    }

    pub fn boot_id(&self) -> &str {
        &self.boot_id
    }

    pub fn start_time_clock_ticks(&self) -> u64 {
        self.start_time_clock_ticks
    }

    pub fn executable_path(&self) -> &Path {
        &self.executable_path
    }

    #[cfg(test)]
    pub(crate) fn for_test(process_id: u32, boot_id: &str, start_time_clock_ticks: u64) -> Self {
        Self {
            process_id,
            boot_id: boot_id.to_owned(),
            start_time_clock_ticks,
            executable_path: PathBuf::from(INSTALLED_EXECUTABLE_PATH),
        }
    }
}

struct NativeCommandOutput {
    success: bool,
    stdout: Vec<u8>,
}

trait NativeCommandPort {
    fn run(
        &self,
        executable: &Path,
        arguments: &[OsString],
    ) -> Result<NativeCommandOutput, io::Error>;
}

struct SystemNativeCommand;

impl NativeCommandPort for SystemNativeCommand {
    fn run(
        &self,
        executable: &Path,
        arguments: &[OsString],
    ) -> Result<NativeCommandOutput, io::Error> {
        let output = Command::new(executable).args(arguments).output()?;
        Ok(NativeCommandOutput {
            success: output.status.success(),
            stdout: output.stdout,
        })
    }
}

trait LinuxProcPort {
    fn boot_id(&self) -> Result<Vec<u8>, io::Error>;
    fn process_stat(&self, process_id: u32) -> Result<Vec<u8>, io::Error>;
    fn process_executable(&self, process_id: u32) -> Result<PathBuf, io::Error>;
}

struct SystemLinuxProc;

impl LinuxProcPort for SystemLinuxProc {
    fn boot_id(&self) -> Result<Vec<u8>, io::Error> {
        fs::read("/proc/sys/kernel/random/boot_id")
    }

    fn process_stat(&self, process_id: u32) -> Result<Vec<u8>, io::Error> {
        fs::read(format!("/proc/{process_id}/stat"))
    }

    fn process_executable(&self, process_id: u32) -> Result<PathBuf, io::Error> {
        fs::read_link(format!("/proc/{process_id}/exe"))
    }
}

pub fn query_linux_native_package_identity(
) -> Result<LinuxNativePackageIdentity, LinuxUpdateRecoveryError> {
    let identity = query_linux_native_package_identity_with(&SystemNativeCommand)?;
    validate_native_installation_files(
        Path::new(INSTALLED_EXECUTABLE_PATH),
        Path::new(INSTALLED_DESKTOP_ENTRY_PATH),
    )?;
    Ok(identity)
}

pub fn reinstall_linux_predecessor_package(
    attempt_directory: &Path,
) -> Result<LinuxNativePackageIdentity, LinuxUpdateRecoveryError> {
    let identity =
        reinstall_linux_predecessor_package_with(&SystemNativeCommand, attempt_directory)?;
    validate_native_installation_files(
        Path::new(INSTALLED_EXECUTABLE_PATH),
        Path::new(INSTALLED_DESKTOP_ENTRY_PATH),
    )?;
    Ok(identity)
}

pub fn observe_linux_recovery_process(
    process_id: u32,
) -> Result<LinuxRecoveryProcessIdentity, LinuxUpdateRecoveryError> {
    observe_linux_recovery_process_with(&SystemLinuxProc, process_id)
}

pub fn linux_recovery_process_is_running(expected: &LinuxRecoveryProcessIdentity) -> bool {
    observe_linux_recovery_process(expected.process_id()).is_ok_and(|actual| actual == *expected)
}

fn query_linux_native_package_identity_with(
    command: &impl NativeCommandPort,
) -> Result<LinuxNativePackageIdentity, LinuxUpdateRecoveryError> {
    let identity_output = run_package_manager_command(
        command,
        Path::new(DPKG_QUERY_PATH),
        &[
            OsString::from("--show"),
            OsString::from(
                "--showformat=${binary:Package}\\n${Version}\\n${Architecture}\\n${Status}\\n",
            ),
            OsString::from(PACKAGE_NAME),
        ],
    )?;
    let identity = parse_dpkg_identity(&identity_output)?;
    let files_output = run_package_manager_command(
        command,
        Path::new(DPKG_QUERY_PATH),
        &[OsString::from("--listfiles"), OsString::from(PACKAGE_NAME)],
    )?;
    validate_owned_paths(&files_output)?;
    Ok(identity)
}

fn reinstall_linux_predecessor_package_with(
    command: &impl NativeCommandPort,
    attempt_directory: &Path,
) -> Result<LinuxNativePackageIdentity, LinuxUpdateRecoveryError> {
    if !attempt_directory.is_absolute() {
        return Err(LinuxUpdateRecoveryError::InvalidPredecessorPackage);
    }
    let attempt_directory = attempt_directory.canonicalize()?;
    let package_path = attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH);
    let metadata = fs::symlink_metadata(&package_path)
        .map_err(|_| LinuxUpdateRecoveryError::InvalidPredecessorPackage)?;
    if !metadata.file_type().is_file()
        || metadata.len() == 0
        || package_path.canonicalize()? != package_path
    {
        return Err(LinuxUpdateRecoveryError::InvalidPredecessorPackage);
    }
    let output = command
        .run(
            Path::new(PKEXEC_PATH),
            &[
                OsString::from(DPKG_PATH),
                OsString::from("--install"),
                package_path.into_os_string(),
            ],
        )
        .map_err(|_| LinuxUpdateRecoveryError::PackageManagerUnavailable)?;
    if !output.success {
        return Err(LinuxUpdateRecoveryError::NativeRollbackFailed);
    }
    query_linux_native_package_identity_with(command)
}

fn run_package_manager_command(
    command: &impl NativeCommandPort,
    executable: &Path,
    arguments: &[OsString],
) -> Result<Vec<u8>, LinuxUpdateRecoveryError> {
    let output = command
        .run(executable, arguments)
        .map_err(|_| LinuxUpdateRecoveryError::PackageManagerUnavailable)?;
    if !output.success || output.stdout.is_empty() || output.stdout.len() > MAX_COMMAND_OUTPUT_BYTES
    {
        return Err(LinuxUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(output.stdout)
}

fn parse_dpkg_identity(
    output: &[u8],
) -> Result<LinuxNativePackageIdentity, LinuxUpdateRecoveryError> {
    let text = std::str::from_utf8(output)
        .map_err(|_| LinuxUpdateRecoveryError::InvalidPackageIdentity)?;
    if text.contains('\r') || !text.ends_with('\n') {
        return Err(LinuxUpdateRecoveryError::InvalidPackageIdentity);
    }
    let lines = text
        .strip_suffix('\n')
        .unwrap_or(text)
        .split('\n')
        .collect::<Vec<_>>();
    if lines.len() != 4
        || lines[0] != PACKAGE_NAME
        || Version::parse(lines[1]).is_err()
        || lines[2] != PACKAGE_ARCHITECTURE
        || lines[3] != "install ok installed"
    {
        return Err(LinuxUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(LinuxNativePackageIdentity {
        version: lines[1].to_owned(),
    })
}

fn validate_owned_paths(output: &[u8]) -> Result<(), LinuxUpdateRecoveryError> {
    let text = std::str::from_utf8(output)
        .map_err(|_| LinuxUpdateRecoveryError::InvalidPackageIdentity)?;
    if text.contains('\r') || !text.ends_with('\n') {
        return Err(LinuxUpdateRecoveryError::InvalidPackageIdentity);
    }
    let paths = text.lines().collect::<Vec<_>>();
    if !paths.contains(&INSTALLED_EXECUTABLE_PATH) || !paths.contains(&INSTALLED_DESKTOP_ENTRY_PATH)
    {
        return Err(LinuxUpdateRecoveryError::InvalidPackageIdentity);
    }
    Ok(())
}

fn validate_installed_file(path: &Path, executable: bool) -> Result<(), LinuxUpdateRecoveryError> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| LinuxUpdateRecoveryError::InvalidPackageIdentity)?;
    if !metadata.file_type().is_file() || path.canonicalize()? != path {
        return Err(LinuxUpdateRecoveryError::InvalidPackageIdentity);
    }
    #[cfg(unix)]
    if executable {
        use std::os::unix::fs::PermissionsExt;

        if metadata.permissions().mode() & 0o111 == 0 {
            return Err(LinuxUpdateRecoveryError::InvalidPackageIdentity);
        }
    }
    Ok(())
}

fn validate_native_installation_files(
    executable_path: &Path,
    desktop_entry_path: &Path,
) -> Result<(), LinuxUpdateRecoveryError> {
    validate_installed_file(executable_path, true)?;
    validate_installed_file(desktop_entry_path, false)
}

fn observe_linux_recovery_process_with(
    proc: &impl LinuxProcPort,
    process_id: u32,
) -> Result<LinuxRecoveryProcessIdentity, LinuxUpdateRecoveryError> {
    if process_id <= 1 {
        return Err(LinuxUpdateRecoveryError::InvalidProcessIdentity);
    }
    let boot_id = parse_boot_id(&proc.boot_id()?)?;
    let start_time_clock_ticks = parse_process_start_time(&proc.process_stat(process_id)?)?;
    let executable_path = proc.process_executable(process_id)?;
    if executable_path != Path::new(INSTALLED_EXECUTABLE_PATH) {
        return Err(LinuxUpdateRecoveryError::InvalidProcessIdentity);
    }
    Ok(LinuxRecoveryProcessIdentity {
        process_id,
        boot_id,
        start_time_clock_ticks,
        executable_path,
    })
}

fn parse_boot_id(value: &[u8]) -> Result<String, LinuxUpdateRecoveryError> {
    let text =
        std::str::from_utf8(value).map_err(|_| LinuxUpdateRecoveryError::InvalidProcessIdentity)?;
    let candidate = text
        .strip_suffix('\n')
        .ok_or(LinuxUpdateRecoveryError::InvalidProcessIdentity)?;
    if candidate.len() != 36
        || !candidate
            .bytes()
            .enumerate()
            .all(|(index, byte)| match index {
                8 | 13 | 18 | 23 => byte == b'-',
                _ => byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte),
            })
    {
        return Err(LinuxUpdateRecoveryError::InvalidProcessIdentity);
    }
    Ok(candidate.to_owned())
}

fn parse_process_start_time(value: &[u8]) -> Result<u64, LinuxUpdateRecoveryError> {
    let text =
        std::str::from_utf8(value).map_err(|_| LinuxUpdateRecoveryError::InvalidProcessIdentity)?;
    if text.contains('\r') || !text.ends_with('\n') {
        return Err(LinuxUpdateRecoveryError::InvalidProcessIdentity);
    }
    let close = text
        .strip_suffix('\n')
        .unwrap_or(text)
        .rfind(") ")
        .ok_or(LinuxUpdateRecoveryError::InvalidProcessIdentity)?;
    text[close + 2..]
        .split_ascii_whitespace()
        .nth(19)
        .ok_or(LinuxUpdateRecoveryError::InvalidProcessIdentity)?
        .parse::<u64>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or(LinuxUpdateRecoveryError::InvalidProcessIdentity)
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, collections::VecDeque, ffi::OsStr};

    #[cfg(unix)]
    use std::os::unix::{fs::symlink, fs::PermissionsExt};

    use tempfile::TempDir;

    use super::*;

    struct ExpectedCommand {
        executable: PathBuf,
        arguments: Vec<OsString>,
        output: NativeCommandOutput,
    }

    struct SyntheticCommand {
        expected: RefCell<VecDeque<ExpectedCommand>>,
    }

    impl SyntheticCommand {
        fn new(expected: Vec<ExpectedCommand>) -> Self {
            Self {
                expected: RefCell::new(expected.into()),
            }
        }

        fn assert_exhausted(&self) {
            assert!(self.expected.borrow().is_empty());
        }
    }

    impl NativeCommandPort for SyntheticCommand {
        fn run(
            &self,
            executable: &Path,
            arguments: &[OsString],
        ) -> Result<NativeCommandOutput, io::Error> {
            let expected = self
                .expected
                .borrow_mut()
                .pop_front()
                .expect("expected command");
            assert_eq!(executable, expected.executable);
            assert_eq!(arguments, expected.arguments);
            Ok(expected.output)
        }
    }

    struct SyntheticProc {
        boot_id: Vec<u8>,
        stat: Vec<u8>,
        executable: PathBuf,
    }

    impl LinuxProcPort for SyntheticProc {
        fn boot_id(&self) -> Result<Vec<u8>, io::Error> {
            Ok(self.boot_id.clone())
        }

        fn process_stat(&self, _process_id: u32) -> Result<Vec<u8>, io::Error> {
            Ok(self.stat.clone())
        }

        fn process_executable(&self, _process_id: u32) -> Result<PathBuf, io::Error> {
            Ok(self.executable.clone())
        }
    }

    fn successful_output(stdout: impl Into<Vec<u8>>) -> NativeCommandOutput {
        NativeCommandOutput {
            success: true,
            stdout: stdout.into(),
        }
    }

    fn query_commands() -> Vec<ExpectedCommand> {
        vec![
            ExpectedCommand {
                executable: PathBuf::from(DPKG_QUERY_PATH),
                arguments: vec![
                    OsString::from("--show"),
                    OsString::from(
                        "--showformat=${binary:Package}\\n${Version}\\n${Architecture}\\n${Status}\\n",
                    ),
                    OsString::from(PACKAGE_NAME),
                ],
                output: successful_output(b"fitfreed\n0.1.0\namd64\ninstall ok installed\n".to_vec()),
            },
            ExpectedCommand {
                executable: PathBuf::from(DPKG_QUERY_PATH),
                arguments: vec![OsString::from("--listfiles"), OsString::from(PACKAGE_NAME)],
                output: successful_output(
                    b"/.\n/usr/bin/fitfreed\n/usr/share/applications/FitFreed.desktop\n".to_vec(),
                ),
            },
        ]
    }

    #[test]
    fn derives_the_installed_identity_from_fixed_dpkg_queries() {
        let command = SyntheticCommand::new(query_commands());

        let identity =
            query_linux_native_package_identity_with(&command).expect("installed package identity");

        assert_eq!(identity.name(), "fitfreed");
        assert_eq!(identity.version(), "0.1.0");
        assert_eq!(identity.architecture(), "amd64");
        assert_eq!(identity.executable_path(), Path::new("/usr/bin/fitfreed"));
        assert_eq!(
            identity.desktop_entry_path(),
            Path::new("/usr/share/applications/FitFreed.desktop")
        );
        command.assert_exhausted();
    }

    #[test]
    fn rejects_uninstalled_cross_package_and_incomplete_native_identity() {
        for value in [
            b"another\n0.1.0\namd64\ninstall ok installed\n".as_slice(),
            b"fitfreed\n0.1.0\narm64\ninstall ok installed\n".as_slice(),
            b"fitfreed\n0.1.0\namd64\ndeinstall ok config-files\n".as_slice(),
            b"fitfreed\nnot-semver\namd64\ninstall ok installed\n".as_slice(),
        ] {
            assert!(matches!(
                parse_dpkg_identity(value),
                Err(LinuxUpdateRecoveryError::InvalidPackageIdentity)
            ));
        }
        assert!(matches!(
            validate_owned_paths(b"/usr/bin/fitfreed\n"),
            Err(LinuxUpdateRecoveryError::InvalidPackageIdentity)
        ));
    }

    #[test]
    fn invokes_only_the_fixed_native_rollback_command_and_revalidates_identity() {
        let directory = TempDir::new().expect("temporary directory");
        let attempt_directory = directory.path().join("attempt");
        let package_path = attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH);
        fs::create_dir_all(package_path.parent().expect("package parent"))
            .expect("package directory");
        fs::write(&package_path, "synthetic Debian package").expect("predecessor package");
        let canonical_package_path = package_path.canonicalize().expect("canonical package path");
        let mut commands = vec![ExpectedCommand {
            executable: PathBuf::from(PKEXEC_PATH),
            arguments: vec![
                OsString::from(DPKG_PATH),
                OsString::from("--install"),
                canonical_package_path.into_os_string(),
            ],
            output: successful_output(Vec::new()),
        }];
        commands.extend(query_commands());
        let command = SyntheticCommand::new(commands);

        let identity = reinstall_linux_predecessor_package_with(&command, &attempt_directory)
            .expect("native predecessor reinstall");

        assert_eq!(identity.version(), "0.1.0");
        command.assert_exhausted();
    }

    #[cfg(unix)]
    #[test]
    fn requires_regular_installed_files_and_an_executable_application() {
        let directory = TempDir::new().expect("temporary directory");
        let canonical_directory = directory
            .path()
            .canonicalize()
            .expect("canonical directory");
        let executable = canonical_directory.join("fitfreed");
        let desktop_entry = canonical_directory.join("FitFreed.desktop");
        fs::write(&executable, "synthetic executable").expect("executable file");
        fs::write(&desktop_entry, "synthetic desktop entry").expect("desktop entry");
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o700))
            .expect("executable permissions");

        validate_native_installation_files(&executable, &desktop_entry)
            .expect("valid native files");

        fs::set_permissions(&executable, fs::Permissions::from_mode(0o600))
            .expect("non-executable permissions");
        assert!(matches!(
            validate_native_installation_files(&executable, &desktop_entry),
            Err(LinuxUpdateRecoveryError::InvalidPackageIdentity)
        ));

        fs::remove_file(&executable).expect("remove executable");
        let symlink_target = canonical_directory.join("outside");
        fs::write(&symlink_target, "synthetic target").expect("symlink target");
        symlink(&symlink_target, &executable).expect("symbolic executable");
        assert!(matches!(
            validate_native_installation_files(&executable, &desktop_entry),
            Err(LinuxUpdateRecoveryError::InvalidPackageIdentity)
        ));
    }

    #[test]
    fn binds_process_authority_to_boot_start_time_and_fixed_executable() {
        let proc = SyntheticProc {
            boot_id: b"12345678-1234-1234-1234-123456789abc\n".to_vec(),
            stat:
                b"42 (FitFreed worker) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 987654 20\n"
                    .to_vec(),
            executable: PathBuf::from(INSTALLED_EXECUTABLE_PATH),
        };

        let identity =
            observe_linux_recovery_process_with(&proc, 42).expect("Linux process identity");

        assert_eq!(identity.process_id(), 42);
        assert_eq!(identity.boot_id(), "12345678-1234-1234-1234-123456789abc");
        assert_eq!(identity.start_time_clock_ticks(), 987_654);
        assert_eq!(
            identity.executable_path(),
            Path::new(INSTALLED_EXECUTABLE_PATH)
        );
    }

    #[test]
    fn rejects_pid_only_authority_and_malformed_proc_evidence() {
        let mut proc = SyntheticProc {
            boot_id: b"12345678-1234-1234-1234-123456789abc\n".to_vec(),
            stat: b"42 (fitfreed) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 123 21\n"
                .to_vec(),
            executable: PathBuf::from("/tmp/fitfreed"),
        };
        assert!(matches!(
            observe_linux_recovery_process_with(&proc, 42),
            Err(LinuxUpdateRecoveryError::InvalidProcessIdentity)
        ));
        proc.executable = PathBuf::from(INSTALLED_EXECUTABLE_PATH);
        proc.boot_id = b"not-a-boot-id\n".to_vec();
        assert!(matches!(
            observe_linux_recovery_process_with(&proc, 42),
            Err(LinuxUpdateRecoveryError::InvalidProcessIdentity)
        ));
        proc.boot_id = b"12345678-1234-1234-1234-123456789abc\n".to_vec();
        proc.stat = b"42 malformed\n".to_vec();
        assert!(matches!(
            observe_linux_recovery_process_with(&proc, 42),
            Err(LinuxUpdateRecoveryError::InvalidProcessIdentity)
        ));
    }

    #[test]
    fn compares_every_process_identity_component() {
        let identity = LinuxRecoveryProcessIdentity {
            process_id: 42,
            boot_id: "12345678-1234-1234-1234-123456789abc".to_owned(),
            start_time_clock_ticks: 123,
            executable_path: PathBuf::from(INSTALLED_EXECUTABLE_PATH),
        };
        let mut reused = identity.clone();
        reused.start_time_clock_ticks += 1;

        assert_ne!(identity, reused);
    }

    #[test]
    fn keeps_native_command_paths_out_of_caller_control() {
        assert_eq!(Path::new(DPKG_QUERY_PATH), Path::new("/usr/bin/dpkg-query"));
        assert_eq!(Path::new(PKEXEC_PATH), Path::new("/usr/bin/pkexec"));
        assert_eq!(Path::new(DPKG_PATH), Path::new("/usr/bin/dpkg"));
        assert_eq!(OsStr::new(PACKAGE_NAME), OsStr::new("fitfreed"));
    }
}
