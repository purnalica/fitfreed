use std::{
    fs::{self, DirBuilder, File, OpenOptions},
    io,
    path::Path,
};

use super::local_file::sync_directory;

#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};
#[cfg(windows)]
use std::{
    mem::size_of,
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
    thread,
    time::Duration,
};

pub(crate) fn prepare_private_library_path(path: &Path) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "library path has no parent"))?;
    let parent_was_missing = !path_exists_without_following_links(parent)?;
    create_application_data_directory(parent)?;
    let parent_metadata = fs::symlink_metadata(parent)?;
    if is_reparse_point(&parent_metadata) || !parent_metadata.is_dir() {
        return Err(invalid_boundary("library parent is not a real directory"));
    }
    let directory_permissions_changed = prepare_private_directory(parent, &parent_metadata)?;

    let existing_library = existing_library_metadata(path)?;
    if let Some(metadata) = &existing_library {
        validate_library_metadata(metadata)?;
    }
    let file = open_library_file(path)?;
    let metadata = file.metadata()?;
    validate_library_metadata(&metadata)?;
    validate_library_handle(&file)?;
    let file_permissions_changed = set_private_file_permissions(&file, &metadata)?;
    let library_was_created = existing_library.is_none();
    if library_was_created || file_permissions_changed {
        file.sync_all()?;
    }
    if parent_was_missing || directory_permissions_changed || library_was_created {
        sync_directory(parent)?;
    }
    Ok(())
}

fn path_exists_without_following_links(path: &Path) -> io::Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

fn create_application_data_directory(path: &Path) -> io::Result<()> {
    let mut builder = DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    builder.mode(0o700);
    builder.create(path)
}

fn existing_library_metadata(path: &Path) -> io::Result<Option<fs::Metadata>> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if is_reparse_point(&metadata) || !metadata.is_file() {
                return Err(invalid_boundary("library is not a real regular file"));
            }
            Ok(Some(metadata))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

fn open_library_file(path: &Path) -> io::Result<File> {
    #[cfg(windows)]
    return open_windows_file_with_retry(|| {
        use windows_sys::Win32::Storage::FileSystem::{
            FILE_FLAG_OPEN_REPARSE_POINT, FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_SHARE_READ,
            FILE_SHARE_WRITE, WRITE_DAC,
        };

        let mut options = OpenOptions::new();
        options
            .read(true)
            .write(true)
            .create(true)
            .access_mode(FILE_GENERIC_READ | FILE_GENERIC_WRITE | WRITE_DAC)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
        options.open(path)
    });

    #[cfg(not(windows))]
    {
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true);
        #[cfg(unix)]
        options
            .mode(0o600)
            .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW);
        options.open(path)
    }
}

fn validate_library_metadata(metadata: &fs::Metadata) -> io::Result<()> {
    if is_reparse_point(metadata) || !metadata.is_file() {
        return Err(invalid_boundary("library is not a regular file"));
    }
    #[cfg(unix)]
    validate_owner(metadata, "library")?;
    #[cfg(unix)]
    if metadata.nlink() != 1 {
        return Err(invalid_boundary("library must have exactly one link"));
    }
    Ok(())
}

#[cfg(windows)]
fn validate_library_handle(file: &File) -> io::Result<()> {
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };

    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    let result =
        unsafe { GetFileInformationByHandle(file.as_raw_handle().cast(), &mut information) };
    if result == 0 {
        return Err(io::Error::last_os_error());
    }
    if information.nNumberOfLinks != 1 {
        return Err(invalid_boundary("library must have exactly one link"));
    }
    Ok(())
}

#[cfg(not(windows))]
fn validate_library_handle(_file: &File) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn validate_owner(metadata: &fs::Metadata, description: &str) -> io::Result<()> {
    if metadata.uid() != unsafe { libc::geteuid() } {
        return Err(invalid_boundary(&format!(
            "{description} is not owned by the current user"
        )));
    }
    Ok(())
}

#[cfg(unix)]
fn prepare_private_directory(path: &Path, metadata: &fs::Metadata) -> io::Result<bool> {
    validate_owner(metadata, "library parent")?;
    if metadata.permissions().mode() & 0o777 != 0o700 {
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
        return Ok(true);
    }
    Ok(false)
}

#[cfg(windows)]
fn prepare_private_directory(path: &Path, _metadata: &fs::Metadata) -> io::Result<bool> {
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, READ_CONTROL, WRITE_DAC,
    };

    let directory = open_windows_file_with_retry(|| {
        let mut options = OpenOptions::new();
        options
            .read(true)
            .access_mode(READ_CONTROL | WRITE_DAC)
            .share_mode(0)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT);
        options.open(path)
    })?;
    let metadata = directory.metadata()?;
    if is_reparse_point(&metadata) || !metadata.is_dir() {
        return Err(invalid_boundary("library parent is not a real directory"));
    }
    ensure_private_windows_acl(&directory, true, "library parent")
}

#[cfg(not(any(unix, windows)))]
fn prepare_private_directory(_path: &Path, _metadata: &fs::Metadata) -> io::Result<bool> {
    Ok(false)
}

#[cfg(unix)]
fn set_private_file_permissions(file: &File, metadata: &fs::Metadata) -> io::Result<bool> {
    if metadata.permissions().mode() & 0o777 != 0o600 {
        file.set_permissions(fs::Permissions::from_mode(0o600))?;
        return Ok(true);
    }
    Ok(false)
}

#[cfg(windows)]
fn set_private_file_permissions(file: &File, _metadata: &fs::Metadata) -> io::Result<bool> {
    ensure_private_windows_acl(file, false, "library")
}

#[cfg(not(any(unix, windows)))]
fn set_private_file_permissions(_file: &File, _metadata: &fs::Metadata) -> io::Result<bool> {
    Ok(false)
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(windows)]
fn open_windows_file_with_retry(mut open: impl FnMut() -> io::Result<File>) -> io::Result<File> {
    const RETRY_DELAYS: [Duration; 4] = [
        Duration::from_millis(10),
        Duration::from_millis(20),
        Duration::from_millis(40),
        Duration::from_millis(80),
    ];

    for delay in RETRY_DELAYS {
        match open() {
            Ok(file) => return Ok(file),
            Err(error) if is_transient_windows_file_denial(&error) => thread::sleep(delay),
            Err(error) => return Err(error),
        }
    }
    open()
}

#[cfg(windows)]
fn is_transient_windows_file_denial(error: &io::Error) -> bool {
    matches!(error.raw_os_error(), Some(5) | Some(32) | Some(33))
}

#[cfg(windows)]
struct WindowsSecurityIdentities {
    token_owner: Vec<usize>,
    token_user: Vec<usize>,
    local_system: Vec<usize>,
    administrators: Vec<usize>,
}

#[cfg(windows)]
impl WindowsSecurityIdentities {
    fn current() -> io::Result<Self> {
        use windows_sys::Win32::{
            Foundation::HANDLE,
            Security::{
                CreateWellKnownSid, GetTokenInformation, TokenOwner, TokenUser,
                WinBuiltinAdministratorsSid, WinLocalSystemSid, SECURITY_MAX_SID_SIZE, TOKEN_OWNER,
                TOKEN_QUERY, TOKEN_USER,
            },
            System::Threading::{GetCurrentProcess, OpenProcessToken},
        };

        let mut token: HANDLE = std::ptr::null_mut();
        if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let token = WindowsHandle(token);
        let token_information = |class, minimum_size| -> io::Result<Vec<usize>> {
            let mut bytes = 0_u32;
            unsafe {
                GetTokenInformation(token.0, class, std::ptr::null_mut(), 0, &mut bytes);
            }
            if bytes < minimum_size {
                return Err(io::Error::last_os_error());
            }
            let mut buffer = aligned_windows_buffer(bytes);
            if unsafe {
                GetTokenInformation(
                    token.0,
                    class,
                    buffer.as_mut_ptr().cast(),
                    bytes,
                    &mut bytes,
                )
            } == 0
            {
                return Err(io::Error::last_os_error());
            }
            Ok(buffer)
        };
        let token_user = token_information(
            TokenUser,
            u32::try_from(size_of::<TOKEN_USER>()).unwrap_or(u32::MAX),
        )?;
        let token_owner = token_information(
            TokenOwner,
            u32::try_from(size_of::<TOKEN_OWNER>()).unwrap_or(u32::MAX),
        )?;

        let well_known_sid = |kind| -> io::Result<Vec<usize>> {
            let mut size = SECURITY_MAX_SID_SIZE;
            let mut buffer = aligned_windows_buffer(size);
            if unsafe {
                CreateWellKnownSid(
                    kind,
                    std::ptr::null_mut(),
                    buffer.as_mut_ptr().cast(),
                    &mut size,
                )
            } == 0
            {
                return Err(io::Error::last_os_error());
            }
            Ok(buffer)
        };

        Ok(Self {
            token_owner,
            token_user,
            local_system: well_known_sid(WinLocalSystemSid)?,
            administrators: well_known_sid(WinBuiltinAdministratorsSid)?,
        })
    }

    fn user(&self) -> windows_sys::Win32::Security::PSID {
        use windows_sys::Win32::Security::TOKEN_USER;

        unsafe { (*(self.token_user.as_ptr().cast::<TOKEN_USER>())).User.Sid }
    }

    fn default_owner(&self) -> windows_sys::Win32::Security::PSID {
        use windows_sys::Win32::Security::TOKEN_OWNER;

        unsafe { (*(self.token_owner.as_ptr().cast::<TOKEN_OWNER>())).Owner }
    }

    fn local_system(&self) -> windows_sys::Win32::Security::PSID {
        self.local_system.as_ptr().cast_mut().cast()
    }

    fn administrators(&self) -> windows_sys::Win32::Security::PSID {
        self.administrators.as_ptr().cast_mut().cast()
    }
}

#[cfg(windows)]
fn aligned_windows_buffer(bytes: u32) -> Vec<usize> {
    let word_bytes = size_of::<usize>();
    vec![0; usize::try_from(bytes).unwrap_or(0).div_ceil(word_bytes)]
}

#[cfg(windows)]
struct WindowsHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
impl Drop for WindowsHandle {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;

        unsafe {
            CloseHandle(self.0);
        }
    }
}

#[cfg(windows)]
struct WindowsLocalAllocation(windows_sys::Win32::Foundation::HLOCAL);

#[cfg(windows)]
impl Drop for WindowsLocalAllocation {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::LocalFree;

        unsafe {
            LocalFree(self.0);
        }
    }
}

#[cfg(windows)]
fn ensure_private_windows_acl(file: &File, directory: bool, description: &str) -> io::Result<bool> {
    let identities = WindowsSecurityIdentities::current()?;
    if windows_acl_is_private(file, directory, &identities, description)? {
        return Ok(false);
    }
    set_private_windows_acl(file, directory, &identities)?;
    if !windows_acl_is_private(file, directory, &identities, description)? {
        return Err(invalid_boundary("private Windows ACL verification failed"));
    }
    Ok(true)
}

#[cfg(windows)]
fn windows_acl_is_private(
    file: &File,
    directory: bool,
    identities: &WindowsSecurityIdentities,
    description: &str,
) -> io::Result<bool> {
    use windows_sys::Win32::{
        Foundation::ERROR_SUCCESS,
        Security::{
            AclSizeInformation,
            Authorization::{GetSecurityInfo, SE_FILE_OBJECT},
            EqualSid, GetAce, GetAclInformation, GetSecurityDescriptorControl, ACCESS_ALLOWED_ACE,
            ACL, ACL_SIZE_INFORMATION, DACL_SECURITY_INFORMATION, NO_INHERITANCE,
            OWNER_SECURITY_INFORMATION, SE_DACL_PROTECTED, SUB_CONTAINERS_AND_OBJECTS_INHERIT,
        },
        Storage::FileSystem::FILE_ALL_ACCESS,
        System::SystemServices::ACCESS_ALLOWED_ACE_TYPE,
    };

    let mut owner = std::ptr::null_mut();
    let mut dacl: *mut ACL = std::ptr::null_mut();
    let mut descriptor = std::ptr::null_mut();
    let result = unsafe {
        GetSecurityInfo(
            file.as_raw_handle().cast(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner,
            std::ptr::null_mut(),
            &mut dacl,
            std::ptr::null_mut(),
            &mut descriptor,
        )
    };
    if result != ERROR_SUCCESS {
        return Err(io::Error::from_raw_os_error(result as i32));
    }
    let _descriptor = WindowsLocalAllocation(descriptor.cast());
    let owner_is_user = !owner.is_null() && unsafe { EqualSid(owner, identities.user()) } != 0;
    let owner_is_default =
        !owner.is_null() && unsafe { EqualSid(owner, identities.default_owner()) } != 0;
    match classify_windows_owner(owner_is_user, owner_is_default) {
        WindowsOwnerAdmission::CurrentUser => {}
        WindowsOwnerAdmission::CurrentTokenDefault => return Ok(false),
        WindowsOwnerAdmission::Foreign => {
            return Err(invalid_boundary(&format!(
                "{description} is not owned by the current user"
            )));
        }
    }
    if dacl.is_null() {
        return Ok(false);
    }

    let mut control = 0_u16;
    let mut revision = 0_u32;
    if unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) } == 0 {
        return Err(io::Error::last_os_error());
    }
    if control & SE_DACL_PROTECTED == 0 {
        return Ok(false);
    }

    let mut information = ACL_SIZE_INFORMATION::default();
    if unsafe {
        GetAclInformation(
            dacl,
            (&mut information as *mut ACL_SIZE_INFORMATION).cast(),
            u32::try_from(size_of::<ACL_SIZE_INFORMATION>()).unwrap_or(u32::MAX),
            AclSizeInformation,
        )
    } == 0
    {
        return Err(io::Error::last_os_error());
    }
    if information.AceCount != 3 {
        return Ok(false);
    }

    let expected_flags = if directory {
        SUB_CONTAINERS_AND_OBJECTS_INHERIT as u8
    } else {
        NO_INHERITANCE as u8
    };
    let mut seen = [false; 3];
    for index in 0..information.AceCount {
        let mut raw_ace = std::ptr::null_mut();
        if unsafe { GetAce(dacl, index, &mut raw_ace) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let ace = raw_ace.cast::<ACCESS_ALLOWED_ACE>();
        let header = unsafe { (*ace).Header };
        if header.AceType != ACCESS_ALLOWED_ACE_TYPE as u8
            || header.AceFlags != expected_flags
            || unsafe { (*ace).Mask } != FILE_ALL_ACCESS
        {
            return Ok(false);
        }
        let sid = unsafe { std::ptr::addr_of_mut!((*ace).SidStart).cast() };
        let identity = if unsafe { EqualSid(sid, identities.user()) } != 0 {
            0
        } else if unsafe { EqualSid(sid, identities.local_system()) } != 0 {
            1
        } else if unsafe { EqualSid(sid, identities.administrators()) } != 0 {
            2
        } else {
            return Ok(false);
        };
        if seen[identity] {
            return Ok(false);
        }
        seen[identity] = true;
    }
    Ok(seen == [true; 3])
}

#[cfg(windows)]
fn set_private_windows_acl(
    file: &File,
    directory: bool,
    identities: &WindowsSecurityIdentities,
) -> io::Result<()> {
    use windows_sys::Win32::{
        Foundation::ERROR_SUCCESS,
        Security::{
            Authorization::{
                SetEntriesInAclW, SetSecurityInfo, EXPLICIT_ACCESS_W, NO_MULTIPLE_TRUSTEE,
                SET_ACCESS, SE_FILE_OBJECT, TRUSTEE_IS_SID, TRUSTEE_IS_USER,
                TRUSTEE_IS_WELL_KNOWN_GROUP, TRUSTEE_TYPE, TRUSTEE_W,
            },
            ACL, DACL_SECURITY_INFORMATION, NO_INHERITANCE, PROTECTED_DACL_SECURITY_INFORMATION,
            PSID, SUB_CONTAINERS_AND_OBJECTS_INHERIT,
        },
        Storage::FileSystem::FILE_ALL_ACCESS,
    };

    let inheritance = if directory {
        SUB_CONTAINERS_AND_OBJECTS_INHERIT
    } else {
        NO_INHERITANCE
    };
    let entry = |sid: PSID, trustee_type: TRUSTEE_TYPE| EXPLICIT_ACCESS_W {
        grfAccessPermissions: FILE_ALL_ACCESS,
        grfAccessMode: SET_ACCESS,
        grfInheritance: inheritance,
        Trustee: TRUSTEE_W {
            pMultipleTrustee: std::ptr::null_mut(),
            MultipleTrusteeOperation: NO_MULTIPLE_TRUSTEE,
            TrusteeForm: TRUSTEE_IS_SID,
            TrusteeType: trustee_type,
            ptstrName: sid.cast(),
        },
    };
    let entries = [
        entry(identities.user(), TRUSTEE_IS_USER),
        entry(identities.local_system(), TRUSTEE_IS_USER),
        entry(identities.administrators(), TRUSTEE_IS_WELL_KNOWN_GROUP),
    ];
    let mut acl: *mut ACL = std::ptr::null_mut();
    let result = unsafe {
        SetEntriesInAclW(
            u32::try_from(entries.len()).unwrap_or(u32::MAX),
            entries.as_ptr(),
            std::ptr::null(),
            &mut acl,
        )
    };
    if result != ERROR_SUCCESS {
        return Err(io::Error::from_raw_os_error(result as i32));
    }
    let _acl = WindowsLocalAllocation(acl.cast());
    let result = unsafe {
        SetSecurityInfo(
            file.as_raw_handle().cast(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            acl,
            std::ptr::null(),
        )
    };
    if result != ERROR_SUCCESS {
        return Err(io::Error::from_raw_os_error(result as i32));
    }
    set_windows_owner_to_user(file, directory, identities)
}

#[cfg(windows)]
fn set_windows_owner_to_user(
    file: &File,
    directory: bool,
    identities: &WindowsSecurityIdentities,
) -> io::Result<()> {
    use windows_sys::Win32::{
        Foundation::{ERROR_SUCCESS, INVALID_HANDLE_VALUE},
        Security::{
            Authorization::{SetSecurityInfo, SE_FILE_OBJECT},
            OWNER_SECURITY_INFORMATION,
        },
        Storage::FileSystem::{
            ReOpenFile, FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_READ, FILE_SHARE_WRITE, WRITE_OWNER,
        },
    };

    let share_mode = if directory {
        0
    } else {
        FILE_SHARE_READ | FILE_SHARE_WRITE
    };
    let flags = if directory {
        FILE_FLAG_BACKUP_SEMANTICS
    } else {
        0
    };
    let owner_handle =
        unsafe { ReOpenFile(file.as_raw_handle().cast(), WRITE_OWNER, share_mode, flags) };
    if owner_handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    let owner_handle = WindowsHandle(owner_handle);
    let result = unsafe {
        SetSecurityInfo(
            owner_handle.0,
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION,
            identities.user(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if result != ERROR_SUCCESS {
        return Err(io::Error::from_raw_os_error(result as i32));
    }
    Ok(())
}

fn invalid_boundary(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(any(windows, test))]
#[derive(Debug, PartialEq, Eq)]
enum WindowsOwnerAdmission {
    CurrentUser,
    CurrentTokenDefault,
    Foreign,
}

#[cfg(any(windows, test))]
fn classify_windows_owner(owner_is_user: bool, owner_is_default: bool) -> WindowsOwnerAdmission {
    if owner_is_user {
        WindowsOwnerAdmission::CurrentUser
    } else if owner_is_default {
        WindowsOwnerAdmission::CurrentTokenDefault
    } else {
        WindowsOwnerAdmission::Foreign
    }
}

#[cfg(test)]
mod windows_owner_policy_tests {
    use super::{classify_windows_owner, WindowsOwnerAdmission};

    #[test]
    fn distinguishes_private_repairable_and_foreign_windows_owners() {
        assert_eq!(
            classify_windows_owner(true, false),
            WindowsOwnerAdmission::CurrentUser
        );
        assert_eq!(
            classify_windows_owner(false, true),
            WindowsOwnerAdmission::CurrentTokenDefault
        );
        assert_eq!(
            classify_windows_owner(true, true),
            WindowsOwnerAdmission::CurrentUser
        );
        assert_eq!(
            classify_windows_owner(false, false),
            WindowsOwnerAdmission::Foreign
        );
    }
}

#[cfg(all(test, unix))]
mod tests {
    use std::{
        fs::{self, hard_link, OpenOptions},
        io::Write,
        os::unix::fs::{symlink, MetadataExt, OpenOptionsExt, PermissionsExt},
    };

    use tempfile::tempdir;

    use super::prepare_private_library_path;

    #[test]
    fn creates_and_repairs_a_private_library_boundary_without_changing_content() {
        let root = tempdir().expect("temporary directory");
        let application_data = root.path().join("application-data");
        fs::create_dir(&application_data).expect("application data directory");
        fs::set_permissions(&application_data, fs::Permissions::from_mode(0o755))
            .expect("broad directory permissions");
        let library = application_data.join("fitfreed.sqlite");
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o644)
            .open(&library)
            .expect("broad library file");
        file.write_all(b"retained library bytes")
            .expect("library content");
        drop(file);

        prepare_private_library_path(&library).expect("private library boundary");
        prepare_private_library_path(&library).expect("idempotent private library boundary");

        assert_eq!(
            fs::read(&library).expect("retained library content"),
            b"retained library bytes"
        );
        assert_eq!(
            fs::metadata(&application_data)
                .expect("application data metadata")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        let metadata = fs::metadata(&library).expect("library metadata");
        assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
        assert_eq!(metadata.nlink(), 1);
    }

    #[test]
    fn creates_a_missing_private_directory_and_library_file() {
        let root = tempdir().expect("temporary directory");
        let application_data = root.path().join("missing-application-data");
        let library = application_data.join("fitfreed.sqlite");

        prepare_private_library_path(&library).expect("new private library boundary");

        assert!(library.is_file());
        assert_eq!(
            fs::metadata(application_data)
                .expect("application data metadata")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        assert_eq!(
            fs::metadata(library)
                .expect("library metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }

    #[test]
    fn rejects_symbolic_library_and_directory_boundaries_without_mutating_targets() {
        let root = tempdir().expect("temporary directory");
        let real_application_data = root.path().join("real-application-data");
        fs::create_dir(&real_application_data).expect("real application data directory");
        fs::set_permissions(&real_application_data, fs::Permissions::from_mode(0o755))
            .expect("real directory permissions");
        let linked_application_data = root.path().join("linked-application-data");
        symlink(&real_application_data, &linked_application_data)
            .expect("symbolic application data directory");

        assert!(
            prepare_private_library_path(&linked_application_data.join("fitfreed.sqlite")).is_err()
        );
        assert_eq!(
            fs::metadata(&real_application_data)
                .expect("unmodified directory metadata")
                .permissions()
                .mode()
                & 0o777,
            0o755
        );

        let private_application_data = root.path().join("private-application-data");
        fs::create_dir(&private_application_data).expect("private application data directory");
        let outside = root.path().join("outside.sqlite");
        fs::write(&outside, b"outside bytes").expect("outside file");
        fs::set_permissions(&outside, fs::Permissions::from_mode(0o644))
            .expect("outside permissions");
        symlink(&outside, private_application_data.join("fitfreed.sqlite"))
            .expect("symbolic library file");

        assert!(
            prepare_private_library_path(&private_application_data.join("fitfreed.sqlite"))
                .is_err()
        );
        assert_eq!(
            fs::read(&outside).expect("outside content"),
            b"outside bytes"
        );
        assert_eq!(
            fs::metadata(outside)
                .expect("outside metadata")
                .permissions()
                .mode()
                & 0o777,
            0o644
        );
    }

    #[test]
    fn rejects_a_multiply_linked_library_before_changing_its_permissions() {
        let root = tempdir().expect("temporary directory");
        let application_data = root.path().join("application-data");
        fs::create_dir(&application_data).expect("application data directory");
        let outside = root.path().join("outside.sqlite");
        fs::write(&outside, b"outside bytes").expect("outside file");
        fs::set_permissions(&outside, fs::Permissions::from_mode(0o644))
            .expect("outside permissions");
        hard_link(&outside, application_data.join("fitfreed.sqlite"))
            .expect("hard-linked library file");

        assert!(prepare_private_library_path(&application_data.join("fitfreed.sqlite")).is_err());
        let metadata = fs::metadata(outside).expect("outside metadata");
        assert_eq!(metadata.nlink(), 2);
        assert_eq!(metadata.permissions().mode() & 0o777, 0o644);
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use std::{
        env,
        fs::{self, hard_link, OpenOptions},
        io::Write,
        os::windows::{
            ffi::OsStrExt,
            fs::{symlink_file, MetadataExt, OpenOptionsExt},
        },
        thread,
        time::Duration,
    };

    use tempfile::tempdir;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    use super::prepare_private_library_path;

    #[test]
    fn creates_and_reopens_a_private_windows_library_without_changing_content() {
        let root = tempdir().expect("temporary directory");
        let application_data = root.path().join("application-data");
        let library = application_data.join("fitfreed.sqlite");

        prepare_private_library_path(&library).expect("new private Windows library boundary");
        fs::write(&library, b"retained library bytes").expect("library content");
        prepare_private_library_path(&library).expect("existing private Windows library boundary");

        assert_eq!(
            fs::read(library).expect("retained library content"),
            b"retained library bytes"
        );
    }

    #[test]
    fn rejects_a_multiply_linked_windows_library_without_changing_content() {
        let root = tempdir().expect("temporary directory");
        let application_data = root.path().join("application-data");
        fs::create_dir(&application_data).expect("application data directory");
        let outside = root.path().join("outside.sqlite");
        fs::write(&outside, b"outside bytes").expect("outside file");
        hard_link(&outside, application_data.join("fitfreed.sqlite"))
            .expect("hard-linked Windows library");

        assert!(prepare_private_library_path(&application_data.join("fitfreed.sqlite")).is_err());
        assert_eq!(
            fs::read(outside).expect("outside content"),
            b"outside bytes"
        );
    }

    #[test]
    fn recovers_from_transient_windows_file_denial() {
        let root = tempdir().expect("temporary directory");
        let library = root.path().join("application-data/fitfreed.sqlite");
        prepare_private_library_path(&library).expect("initial private Windows library");
        let locked = OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0)
            .open(&library)
            .expect("exclusive Windows library handle");
        let release = thread::spawn(move || {
            thread::sleep(Duration::from_millis(45));
            drop(locked);
        });

        prepare_private_library_path(&library).expect("transient denial retry");
        release.join().expect("lock release thread");
    }

    #[test]
    fn admits_validation_while_sqlite_has_the_library_open() {
        let root = tempdir().expect("temporary directory");
        let library = root.path().join("application-data/fitfreed.sqlite");
        prepare_private_library_path(&library).expect("initial private Windows library");
        let connection = rusqlite::Connection::open(&library).expect("open SQLite library");

        prepare_private_library_path(&library).expect("validation beside an open SQLite handle");

        drop(connection);
    }

    #[test]
    fn supports_long_unicode_windows_library_paths() {
        let root = tempdir().expect("temporary directory");
        let mut application_data = root.path().to_path_buf();
        for index in 0..5 {
            application_data.push(format!("history-{index}-{}", "漢字é".repeat(20)));
        }
        let library = application_data.join("fitfreed-δεδομένα.sqlite");
        assert!(library.as_os_str().encode_wide().count() > 260);

        prepare_private_library_path(&library).expect("long Unicode Windows library path");

        assert!(library.is_file());
    }

    #[test]
    #[ignore = "requires the junction prepared by the elevated Windows filesystem admission"]
    fn validates_windows_library_filesystem_boundaries() {
        let junction = env::var_os("FITFREED_WINDOWS_JUNCTION_TEST_PATH")
            .map(std::path::PathBuf::from)
            .expect("prepared Windows junction");
        let metadata = fs::symlink_metadata(&junction).expect("junction metadata");
        assert_ne!(metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT, 0);
        let target = junction
            .parent()
            .expect("junction parent")
            .join("junction-target");
        assert_eq!(
            fs::read(target.join("sentinel")).expect("junction target sentinel"),
            b"target must remain unchanged"
        );
        assert!(prepare_private_library_path(&junction.join("fitfreed.sqlite")).is_err());
        assert!(!target.join("fitfreed.sqlite").exists());

        let linked_parent = junction
            .parent()
            .expect("junction parent")
            .join("file-link-case");
        let bootstrap = linked_parent.join("bootstrap.sqlite");
        prepare_private_library_path(&bootstrap).expect("private link-test directory");
        fs::remove_file(bootstrap).expect("remove link-test bootstrap");
        let outside = junction
            .parent()
            .expect("junction parent")
            .join("outside.sqlite");
        let mut outside_file = fs::File::create(&outside).expect("outside Windows file");
        outside_file
            .write_all(b"outside bytes")
            .expect("outside content");
        drop(outside_file);
        let linked_library = linked_parent.join("fitfreed.sqlite");
        symlink_file(&outside, &linked_library).expect("Windows library symbolic link");

        assert!(prepare_private_library_path(&linked_library).is_err());
        assert_eq!(
            fs::read(outside).expect("outside content"),
            b"outside bytes"
        );
    }
}
