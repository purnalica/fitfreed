use std::{
    fs::{self, DirBuilder, File, OpenOptions},
    io,
    path::Path,
};

use super::local_file::sync_directory;

#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};

pub(crate) fn prepare_private_library_path(path: &Path) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "library path has no parent"))?;
    let parent_was_missing = !path_exists_without_following_links(parent)?;
    create_application_data_directory(parent)?;
    let parent_metadata = fs::symlink_metadata(parent)?;
    if parent_metadata.file_type().is_symlink() || !parent_metadata.is_dir() {
        return Err(invalid_boundary("library parent is not a real directory"));
    }
    validate_owner(&parent_metadata, "library parent")?;
    let directory_permissions_changed =
        set_private_directory_permissions(parent, &parent_metadata)?;

    let existing_library = existing_library_metadata(path)?;
    if let Some(metadata) = &existing_library {
        validate_library_metadata(metadata)?;
    }
    let file = open_library_file(path)?;
    let metadata = file.metadata()?;
    validate_library_metadata(&metadata)?;
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
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err(invalid_boundary("library is not a real regular file"));
            }
            Ok(Some(metadata))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

fn open_library_file(path: &Path) -> io::Result<File> {
    let mut options = OpenOptions::new();
    options.read(true).write(true).create(true);
    #[cfg(unix)]
    options
        .mode(0o600)
        .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW);
    options.open(path)
}

fn validate_library_metadata(metadata: &fs::Metadata) -> io::Result<()> {
    if !metadata.is_file() {
        return Err(invalid_boundary("library is not a regular file"));
    }
    validate_owner(metadata, "library")?;
    #[cfg(unix)]
    if metadata.nlink() != 1 {
        return Err(invalid_boundary("library must have exactly one link"));
    }
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

#[cfg(not(unix))]
fn validate_owner(_metadata: &fs::Metadata, _description: &str) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn set_private_directory_permissions(path: &Path, metadata: &fs::Metadata) -> io::Result<bool> {
    if metadata.permissions().mode() & 0o777 != 0o700 {
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
        return Ok(true);
    }
    Ok(false)
}

#[cfg(not(unix))]
fn set_private_directory_permissions(_path: &Path, _metadata: &fs::Metadata) -> io::Result<bool> {
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

#[cfg(not(unix))]
fn set_private_file_permissions(_file: &File, _metadata: &fs::Metadata) -> io::Result<bool> {
    Ok(false)
}

fn invalid_boundary(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
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
