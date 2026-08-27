use std::sync::LazyLock;

use regex::Regex;

static ISO_DURATION_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^P(?:(?<days>[0-9]+)D)?(?:T(?:(?<hours>[0-9]+)H)?(?:(?<minutes>[0-9]+)M)?(?:(?<seconds>[0-9]+)(?:\.(?<fraction>[0-9]{1,9}))?S)?)?$",
    )
    .expect("valid ISO duration pattern")
});

pub(super) fn parse_iso_duration_milliseconds(value: &str) -> Result<i64, String> {
    if value.ends_with('T') {
        return Err("has an empty time component".to_owned());
    }
    let captures = ISO_DURATION_PATTERN
        .captures(value)
        .ok_or_else(|| "is not a supported ISO 8601 duration".to_owned())?;
    let component = |name: &str| -> Result<i64, String> {
        captures.name(name).map_or(Ok(0), |matched| {
            matched
                .as_str()
                .parse::<i64>()
                .map_err(|error| format!("is too large: {error}"))
        })
    };
    if ["days", "hours", "minutes", "seconds"]
        .iter()
        .all(|name| captures.name(name).is_none())
    {
        return Err("has no duration component".to_owned());
    }
    let days = component("days")?;
    let hours = component("hours")?;
    let minutes = component("minutes")?;
    let seconds = component("seconds")?;
    let whole_seconds = days
        .checked_mul(86_400)
        .and_then(|value| {
            hours
                .checked_mul(3_600)
                .and_then(|part| value.checked_add(part))
        })
        .and_then(|value| {
            minutes
                .checked_mul(60)
                .and_then(|part| value.checked_add(part))
        })
        .and_then(|value| value.checked_add(seconds))
        .ok_or_else(|| "overflows".to_owned())?;
    let fraction_milliseconds = captures.name("fraction").map_or(Ok(0_i64), |matched| {
        let fraction = matched.as_str();
        if fraction.len() > 3 && !fraction[3..].bytes().all(|digit| digit == b'0') {
            return Err("is not representable in whole milliseconds".to_owned());
        }
        let prefix = &fraction[..fraction.len().min(3)];
        let parsed = prefix
            .parse::<i64>()
            .map_err(|error| format!("has an invalid fraction: {error}"))?;
        Ok(parsed * 10_i64.pow((3 - prefix.len()) as u32))
    })?;
    whole_seconds
        .checked_mul(1_000)
        .and_then(|value| value.checked_add(fraction_milliseconds))
        .ok_or_else(|| "overflows".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_exact_whole_millisecond_iso_durations() {
        assert_eq!(
            parse_iso_duration_milliseconds("P1DT2H3M4.125S"),
            Ok(93_784_125)
        );
        assert_eq!(parse_iso_duration_milliseconds("PT0.001S"), Ok(1));
        assert_eq!(parse_iso_duration_milliseconds("PT1.001000S"), Ok(1_001));
    }

    #[test]
    fn rejects_absent_unsupported_oversized_or_submillisecond_values() {
        for value in [
            "P",
            "PT",
            "one minute",
            "PT0.0001S",
            "P999999999999999999999D",
        ] {
            assert!(parse_iso_duration_milliseconds(value).is_err(), "{value}");
        }
    }
}
