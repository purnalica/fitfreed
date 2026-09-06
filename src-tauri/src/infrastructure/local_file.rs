use std::{
    fs::{self, File, OpenOptions},
    io,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static TEMPORARY_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub(crate) struct PrivateStagingFile {
    path: PathBuf,
    file: Option<File>,
    armed: bool,
}

impl PrivateStagingFile {
    pub(crate) fn new(parent: &Path, prefix: &str, suffix: &str) -> io::Result<Self> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(io::Error::other)?
            .as_nanos();
        for _ in 0..32 {
            let sequence = TEMPORARY_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let path = parent.join(format!(
                ".{prefix}-{}-{timestamp}-{sequence}{suffix}",
                std::process::id()
            ));
            let mut options = OpenOptions::new();
            options.read(true).write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;

                options.mode(0o600);
            }
            match options.open(&path) {
                Ok(file) => {
                    return Ok(Self {
                        path,
                        file: Some(file),
                        armed: true,
                    });
                }
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "could not allocate a unique private staging file",
        ))
    }

    pub(crate) fn path(&self) -> &Path {
        &self.path
    }

    pub(crate) fn file_mut(&mut self) -> io::Result<&mut File> {
        self.file
            .as_mut()
            .ok_or_else(|| io::Error::other("private staging file is already closed"))
    }

    pub(crate) fn sync_and_close(&mut self) -> io::Result<()> {
        let file = self
            .file
            .take()
            .ok_or_else(|| io::Error::other("private staging file is already closed"))?;
        file.sync_all()
    }

    pub(crate) fn persist_replace(mut self, destination: &Path) -> io::Result<()> {
        self.ensure_closed()?;
        fs::rename(&self.path, destination)?;
        self.armed = false;
        sync_directory(
            destination
                .parent()
                .ok_or_else(|| io::Error::other("destination has no parent directory"))?,
        )
    }

    pub(crate) fn persist_noclobber(mut self, destination: &Path) -> io::Result<()> {
        self.ensure_closed()?;
        fs::hard_link(&self.path, destination)?;
        if fs::remove_file(&self.path).is_ok() {
            self.armed = false;
        }
        sync_directory(
            destination
                .parent()
                .ok_or_else(|| io::Error::other("destination has no parent directory"))?,
        )
    }

    fn ensure_closed(&mut self) -> io::Result<()> {
        if self.file.is_some() {
            self.sync_and_close()?;
        }
        Ok(())
    }
}

impl Drop for PrivateStagingFile {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_file(&self.path);
        }
    }
}

#[cfg(not(windows))]
pub(crate) fn sync_directory(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}

#[cfg(windows)]
pub(crate) fn sync_directory(_path: &Path) -> io::Result<()> {
    Ok(())
}

pub(crate) fn sync_regular_file(path: &Path) -> io::Result<()> {
    let mut options = OpenOptions::new();
    options.read(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::{MetadataExt, OpenOptionsExt};

        use windows_sys::Win32::Storage::FileSystem::{
            FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_OPEN_REPARSE_POINT,
        };

        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
        let file = options.open(path)?;
        let metadata = file.metadata()?;
        if !metadata.file_type().is_file()
            || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "file synchronization target is not a regular file",
            ));
        }
        return file.sync_all();
    }
    #[cfg(not(windows))]
    {
        let file = options.open(path)?;
        if !file.metadata()?.file_type().is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "file synchronization target is not a regular file",
            ));
        }
        file.sync_all()
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn replaces_only_after_a_closed_staging_file_is_complete() {
        let directory = tempdir().expect("temporary directory");
        let destination = directory.path().join("state.json");
        fs::write(&destination, "previous").expect("previous state");
        let mut staging = PrivateStagingFile::new(directory.path(), "state", ".json")
            .expect("private staging file");
        staging
            .file_mut()
            .expect("open staging file")
            .write_all(b"replacement")
            .expect("replacement state");

        staging
            .persist_replace(&destination)
            .expect("promoted replacement");

        assert_eq!(
            fs::read_to_string(destination).expect("persisted state"),
            "replacement"
        );
    }

    #[test]
    fn refuses_to_replace_an_existing_noclobber_destination() {
        let directory = tempdir().expect("temporary directory");
        let destination = directory.path().join("active");
        fs::write(&destination, "existing").expect("existing active state");
        let mut staging =
            PrivateStagingFile::new(directory.path(), "active", "").expect("private staging file");
        staging
            .file_mut()
            .expect("open staging file")
            .write_all(b"candidate")
            .expect("candidate active state");

        assert_eq!(
            staging
                .persist_noclobber(&destination)
                .expect_err("no-clobber destination")
                .kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(
            fs::read_to_string(destination).expect("preserved active state"),
            "existing"
        );
    }

    #[test]
    fn synchronizes_a_closed_regular_file_with_write_access() {
        let directory = tempdir().expect("temporary directory");
        let path = directory.path().join("durable.dat");
        fs::write(&path, "durable bytes").expect("regular file");

        sync_regular_file(&path).expect("synchronized regular file");

        assert_eq!(
            fs::read_to_string(path).expect("synchronized bytes"),
            "durable bytes"
        );
    }

    #[cfg(unix)]
    #[test]
    fn refuses_to_synchronize_through_a_symbolic_link() {
        use std::os::unix::fs::symlink;

        let directory = tempdir().expect("temporary directory");
        let target = directory.path().join("target.dat");
        let link = directory.path().join("link.dat");
        fs::write(&target, "outside bytes").expect("target file");
        symlink(&target, &link).expect("symbolic link");

        assert!(sync_regular_file(&link).is_err());
        assert_eq!(
            fs::read_to_string(target).expect("unchanged target bytes"),
            "outside bytes"
        );
    }
}
