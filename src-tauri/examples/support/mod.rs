#[cfg(unix)]
use std::mem::MaybeUninit;

#[cfg(target_os = "macos")]
const fn platform_resident_value_to_mib(value: u64) -> f64 {
    resident_value_to_mib(value, 1_024.0 * 1_024.0)
}

#[cfg(target_os = "linux")]
const fn platform_resident_value_to_mib(value: u64) -> f64 {
    resident_value_to_mib(value, 1_024.0)
}

const fn resident_value_to_mib(value: u64, units_per_mib: f64) -> f64 {
    value as f64 / units_per_mib
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn peak_resident_mib() -> f64 {
    let mut usage = MaybeUninit::<libc::rusage>::uninit();
    let result = unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) };
    assert_eq!(result, 0, "getrusage must succeed");
    let usage = unsafe { usage.assume_init() };
    platform_resident_value_to_mib(usage.ru_maxrss as u64)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub const fn peak_resident_mib() -> f64 {
    0.0
}

#[cfg(test)]
mod tests {
    use super::{peak_resident_mib, resident_value_to_mib};

    #[test]
    fn converts_each_supported_getrusage_unit_to_mebibytes() {
        assert_eq!(resident_value_to_mib(1_048_576, 1_024.0 * 1_024.0), 1.0);
        assert_eq!(resident_value_to_mib(1_024, 1_024.0), 1.0);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn reads_peak_resident_memory_on_supported_hosts() {
        assert!(peak_resident_mib() > 0.0);
    }
}
