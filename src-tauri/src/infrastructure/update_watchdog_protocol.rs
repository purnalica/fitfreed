use std::{
    fs::File,
    io::{self, BufRead, BufReader, Read, Write},
    sync::mpsc,
    thread,
    time::Duration,
};

use sha2::{Digest, Sha256};

pub const UPDATE_RECOVERY_WATCHDOG_ARGUMENT: &str = "--fitfreed-update-recovery-watchdog";
pub const UPDATE_RECOVERY_WATCHDOG_RESUME_ARGUMENT: &str =
    "--fitfreed-update-recovery-watchdog-resume";
pub const UPDATE_RECOVERY_CANDIDATE_ARGUMENT: &str = "--fitfreed-update-recovery-candidate";

pub(super) const WATCHDOG_READY_TIMEOUT: Duration = Duration::from_secs(10);
pub(super) const CANDIDATE_GO_TIMEOUT: Duration = Duration::from_secs(10);
pub(super) const WATCHDOG_READY_PREFIX: &str = "FITFREED-UPDATE-WATCHDOG-READY ";
pub(super) const CANDIDATE_GO_PREFIX: &str = "FITFREED-UPDATE-CANDIDATE-GO ";

pub(super) fn read_watchdog_readiness(
    reader: impl Read,
    expected_process_id: u32,
) -> io::Result<bool> {
    let mut line = String::new();
    BufReader::new(reader).take(128).read_line(&mut line)?;
    Ok(line == watchdog_readiness_record(expected_process_id))
}

pub(super) fn write_watchdog_readiness(writer: &mut impl Write) -> io::Result<()> {
    writer.write_all(watchdog_readiness_record(std::process::id()).as_bytes())?;
    writer.flush()
}

pub(super) fn await_candidate_go(
    recovery_id: &str,
    launch_nonce: &str,
    reader: impl Read + Send + 'static,
) -> Result<(), CandidateGoError> {
    let expected = candidate_go_record(recovery_id, launch_nonce);
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut line = String::new();
        let result = BufReader::new(reader)
            .take(256)
            .read_line(&mut line)
            .map(|_| line);
        let _ = sender.send(result);
    });
    match receiver.recv_timeout(CANDIDATE_GO_TIMEOUT) {
        Ok(Ok(line)) if line == expected => Ok(()),
        Ok(Err(error)) => Err(CandidateGoError::Io(error)),
        Ok(Ok(_)) => Err(CandidateGoError::InvalidRecord),
        Err(_) => Err(CandidateGoError::Timeout),
    }
}

pub(super) fn write_candidate_go(
    writer: &mut impl Write,
    recovery_id: &str,
    launch_nonce: &str,
) -> io::Result<()> {
    writer.write_all(candidate_go_record(recovery_id, launch_nonce).as_bytes())?;
    writer.flush()
}

pub(super) fn generate_launch_nonce() -> io::Result<String> {
    let mut entropy = [0_u8; 32];
    File::open("/dev/urandom")?.read_exact(&mut entropy)?;
    let mut digest = Sha256::new();
    digest.update(entropy);
    Ok(digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

#[derive(Debug)]
pub(super) enum CandidateGoError {
    Io(io::Error),
    InvalidRecord,
    Timeout,
}

fn watchdog_readiness_record(process_id: u32) -> String {
    format!("{WATCHDOG_READY_PREFIX}{process_id}\n")
}

fn candidate_go_record(recovery_id: &str, launch_nonce: &str) -> String {
    format!("{CANDIDATE_GO_PREFIX}{recovery_id} {launch_nonce}\n")
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::*;

    #[test]
    fn bounds_and_matches_the_exact_watchdog_readiness_record() {
        let process_id = 42_u32;

        assert!(read_watchdog_readiness(
            Cursor::new(format!("{WATCHDOG_READY_PREFIX}{process_id}\nignored")),
            process_id,
        )
        .expect("matching readiness"));
        assert!(!read_watchdog_readiness(
            Cursor::new(format!("{WATCHDOG_READY_PREFIX}43\n")),
            process_id,
        )
        .expect("mismatched readiness"));
        assert!(!read_watchdog_readiness(
            Cursor::new(format!(
                "{WATCHDOG_READY_PREFIX}{process_id}{}\n",
                "x".repeat(128)
            )),
            process_id,
        )
        .expect("bounded readiness"));
    }

    #[test]
    fn accepts_only_the_exact_candidate_go_record() {
        let recovery_id = "a".repeat(64);
        let launch_nonce = "b".repeat(64);

        await_candidate_go(
            &recovery_id,
            &launch_nonce,
            Cursor::new(candidate_go_record(&recovery_id, &launch_nonce)),
        )
        .expect("matching candidate signal");
        assert!(matches!(
            await_candidate_go(
                &recovery_id,
                &launch_nonce,
                Cursor::new(candidate_go_record(&recovery_id, &"c".repeat(64))),
            ),
            Err(CandidateGoError::InvalidRecord)
        ));
    }

    #[test]
    fn writes_exact_readiness_and_candidate_records() {
        let mut readiness = Vec::new();
        write_watchdog_readiness(&mut readiness).expect("readiness record");
        assert_eq!(
            readiness,
            watchdog_readiness_record(std::process::id()).as_bytes()
        );

        let recovery_id = "a".repeat(64);
        let launch_nonce = "b".repeat(64);
        let mut candidate = Vec::new();
        write_candidate_go(&mut candidate, &recovery_id, &launch_nonce).expect("candidate record");
        assert_eq!(
            candidate,
            candidate_go_record(&recovery_id, &launch_nonce).as_bytes()
        );
    }

    #[test]
    fn generates_a_lowercase_process_launch_nonce() {
        let nonce = generate_launch_nonce().expect("launch nonce");

        assert_eq!(nonce.len(), 64);
        assert!(nonce
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)));
    }
}
