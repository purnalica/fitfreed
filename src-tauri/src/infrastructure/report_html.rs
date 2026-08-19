use std::{fs, io::Write, path::Path};

use fitfreed_application::{
    AuthorizedSessionReportExport, ReportExportCancellation, ReportExportPort,
    ReportExportPortError, ReportExportReceipt, ReportLimitation, TrainingSessionSport,
    TrainingSportState,
};
use fitfreed_domain::{ReportBlockContent, ReportLocale};

use super::local_file::PrivateStagingFile;

const EMBEDDED_STYLE: &str = "\
:root{color-scheme:light dark;font-family:system-ui,-apple-system,sans-serif;line-height:1.5}\
body{max-width:64rem;margin:0 auto;padding:2rem;color:#17211c;background:#f5f7f3}\
main{background:#fff;border:1px solid #cad3cc;border-radius:1rem;padding:clamp(1rem,4vw,3rem)}\
h1,h2{line-height:1.15}section{margin-block:2rem}dl{display:grid;grid-template-columns:minmax(10rem,1fr) 2fr;gap:.5rem 1rem}\
dt{font-weight:700}dd{margin:0}.narrative{white-space:pre-wrap}.attribution,.limitation{color:#425149}\
@media(max-width:40rem){body{padding:.5rem}main{border-radius:.5rem}dl{grid-template-columns:1fr}dd{margin-bottom:.75rem}}\
@media(prefers-color-scheme:dark){body{color:#e7eee9;background:#121713}main{background:#1b231d;border-color:#445047}.attribution,.limitation{color:#b8c5bc}}\
@media print{body{max-width:none;padding:0;background:#fff;color:#000}main{border:0;padding:0}}";

pub struct SelfContainedHtmlReportExporter;

impl ReportExportPort for SelfContainedHtmlReportExporter {
    fn export_report(
        &self,
        report: &AuthorizedSessionReportExport,
        destination: &Path,
        cancellation: &ReportExportCancellation,
    ) -> Result<ReportExportReceipt, ReportExportPortError> {
        ensure_active(cancellation)?;
        let parent = destination.parent().ok_or_else(|| {
            ReportExportPortError::Failure("report destination has no parent directory".to_owned())
        })?;
        if !parent.is_dir() {
            return Err(ReportExportPortError::Failure(
                "report destination parent is not a directory".to_owned(),
            ));
        }
        if let Ok(metadata) = fs::symlink_metadata(destination) {
            if !metadata.file_type().is_file() {
                return Err(ReportExportPortError::Failure(
                    "report destination is not a regular file".to_owned(),
                ));
            }
        }
        let html = render_report(report, cancellation)?;
        let byte_count = u64::try_from(html.len()).map_err(|_| {
            ReportExportPortError::Failure("rendered report is too large".to_owned())
        })?;
        let mut staging =
            PrivateStagingFile::new(parent, "fitfreed-report", ".html.part").map_err(file_error)?;
        staging
            .file_mut()
            .map_err(file_error)?
            .write_all(html.as_bytes())
            .map_err(file_error)?;
        staging.sync_and_close().map_err(file_error)?;
        ensure_active(cancellation)?;
        if let Err(error) = staging.persist_replace(destination) {
            let complete_output_is_present =
                fs::read(destination).is_ok_and(|contents| contents == html.as_bytes());
            if !complete_output_is_present {
                return Err(file_error(error));
            }
        }
        Ok(ReportExportReceipt { byte_count })
    }
}

fn render_report(
    report: &AuthorizedSessionReportExport,
    cancellation: &ReportExportCancellation,
) -> Result<String, ReportExportPortError> {
    ensure_active(cancellation)?;
    validate_evidence(report)?;
    let labels = Labels::for_locale(report.definition.locale());
    let narrative = match report.definition.blocks()[1].content() {
        ReportBlockContent::Narrative { body } => body,
        ReportBlockContent::SessionEvidence { .. } => {
            return Err(ReportExportPortError::Failure(
                "report narrative block is unavailable".to_owned(),
            ));
        }
    };
    let mut html = String::with_capacity(8_192 + narrative.len());
    html.push_str("<!doctype html><html lang=\"");
    html.push_str(report.definition.locale().code());
    html.push_str("\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>");
    push_escaped(&mut html, report.definition.title());
    html.push_str("</title><style>");
    html.push_str(EMBEDDED_STYLE);
    html.push_str("</style></head><body><main data-fitfreed-report-version=\"1\"><header><p class=\"attribution\">");
    html.push_str(labels.personal_report);
    html.push_str("</p><h1>");
    push_escaped(&mut html, report.definition.title());
    html.push_str("</h1><dl><dt>");
    html.push_str(labels.definition_version);
    html.push_str("</dt><dd><data value=\"");
    html.push_str(&report.definition.definition_version().to_string());
    html.push_str("\">");
    html.push_str(&report.definition.definition_version().to_string());
    html.push_str("</data></dd><dt>");
    html.push_str(labels.definition_revision);
    html.push_str("</dt><dd><data value=\"");
    html.push_str(&report.definition.revision().to_string());
    html.push_str("\">");
    html.push_str(&report.definition.revision().to_string());
    html.push_str("</data></dd><dt>");
    html.push_str(labels.source_revision);
    html.push_str("</dt><dd><code>");
    push_escaped(&mut html, &report.resolved_snapshot_ref);
    html.push_str("</code></dd><dt>");
    html.push_str(labels.locale);
    html.push_str("</dt><dd><code>");
    html.push_str(report.definition.locale().code());
    html.push_str("</code></dd><dt>");
    html.push_str(labels.units);
    html.push_str("</dt><dd><code>metric-v1</code></dd></dl></header>");

    ensure_active(cancellation)?;
    html.push_str("<section aria-labelledby=\"session-heading\"><h2 id=\"session-heading\">");
    html.push_str(labels.session_evidence);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.recorded_evidence);
    html.push_str("</p><dl><dt>");
    html.push_str(labels.started);
    html.push_str("</dt><dd><time>");
    push_escaped(&mut html, &report.session.started_at_local);
    html.push_str("</time></dd><dt>");
    html.push_str(labels.stopped);
    html.push_str("</dt><dd><time>");
    push_escaped(&mut html, &report.session.stopped_at_local);
    html.push_str("</time></dd>");
    if let Some(offset) = report.session.utc_offset_minutes {
        push_term(&mut html, labels.utc_offset, &format_utc_offset(offset));
    }
    push_data_term(
        &mut html,
        labels.duration,
        &report.session.duration_milliseconds.to_string(),
        &format_duration(report.session.duration_milliseconds, labels),
        Some("ms"),
    );
    if let Some(distance) = report.session.distance_meters {
        push_data_term(
            &mut html,
            labels.distance,
            &format_finite_number(distance),
            &format!(
                "{} {}",
                format_decimal(distance / 1_000.0, report.definition.locale()),
                labels.kilometres
            ),
            Some("m"),
        );
    }
    if let Some(energy) = report.session.energy_kilocalories {
        push_data_term(
            &mut html,
            labels.energy,
            &energy.to_string(),
            &format!("{energy} {}", labels.kilocalories),
            Some("kcal"),
        );
    }
    if report.include_physiological_context {
        if let Some(average) = report.session.average_heart_rate_bpm {
            push_data_term(
                &mut html,
                labels.average_heart_rate,
                &average.to_string(),
                &format!("{average} {}", labels.beats_per_minute),
                Some("bpm"),
            );
        }
        if let Some(maximum) = report.session.maximum_heart_rate_bpm {
            push_data_term(
                &mut html,
                labels.maximum_heart_rate,
                &maximum.to_string(),
                &format!("{maximum} {}", labels.beats_per_minute),
                Some("bpm"),
            );
        }
    }
    push_term(
        &mut html,
        labels.sport,
        &sport_label(&report.session.sport, labels),
    );
    if let Some(count) = report.session.exercise_count {
        push_data_term(
            &mut html,
            labels.exercises,
            &count.to_string(),
            &count.to_string(),
            None,
        );
    }
    html.push_str("</dl></section>");

    ensure_active(cancellation)?;
    html.push_str("<section aria-labelledby=\"narrative-heading\"><h2 id=\"narrative-heading\">");
    html.push_str(labels.interpretation);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.user_authored);
    html.push_str("</p><p class=\"narrative\">");
    push_escaped(&mut html, narrative);
    html.push_str("</p></section><section aria-labelledby=\"limitations-heading\"><h2 id=\"limitations-heading\">");
    html.push_str(labels.limitations);
    html.push_str("</h2>");
    if report.limitations.is_empty() {
        html.push_str("<p>");
        html.push_str(labels.no_known_limitations);
        html.push_str("</p>");
    } else {
        html.push_str("<ul>");
        for limitation in &report.limitations {
            html.push_str("<li class=\"limitation\" data-limitation=\"");
            html.push_str(limitation_code(*limitation));
            html.push_str("\">");
            html.push_str(limitation_label(*limitation, labels));
            html.push_str("</li>");
        }
        html.push_str("</ul>");
    }
    html.push_str("</section>");

    ensure_active(cancellation)?;
    html.push_str("<section aria-labelledby=\"provenance-heading\"><h2 id=\"provenance-heading\">");
    html.push_str(labels.provenance);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.current_attribution);
    html.push_str("</p><dl><dt>");
    html.push_str(labels.source);
    html.push_str("</dt><dd>");
    push_escaped(&mut html, source_label(report.provenance.provider.code()));
    html.push_str("</dd><dt>");
    html.push_str(labels.source_modified);
    html.push_str("</dt><dd><time datetime=\"");
    push_escaped_attribute(&mut html, &report.provenance.source_modified_at_utc);
    html.push_str("\">");
    push_escaped(&mut html, &report.provenance.source_modified_at_utc);
    html.push_str("</time></dd>");
    push_code_term(
        &mut html,
        labels.source_adapter,
        &report.provenance.source_adapter_version,
    );
    push_code_term(
        &mut html,
        labels.mapping,
        &report.provenance.mapping_version,
    );
    push_data_term(
        &mut html,
        labels.contributing_events,
        &report.provenance.contributing_event_count.to_string(),
        &report.provenance.contributing_event_count.to_string(),
        None,
    );
    push_data_term(
        &mut html,
        labels.non_contributing_events,
        &report.provenance.non_contributing_event_count.to_string(),
        &report.provenance.non_contributing_event_count.to_string(),
        None,
    );
    html.push_str("</dl></section></main></body></html>\n");
    Ok(html)
}

fn validate_evidence(report: &AuthorizedSessionReportExport) -> Result<(), ReportExportPortError> {
    let invalid_distance = report
        .session
        .distance_meters
        .is_some_and(|value| !value.is_finite() || value < 0.0);
    if report.session.duration_milliseconds < 0
        || invalid_distance
        || report
            .session
            .energy_kilocalories
            .is_some_and(|value| value < 0)
        || report
            .session
            .average_heart_rate_bpm
            .is_some_and(|value| value < 0)
        || report
            .session
            .maximum_heart_rate_bpm
            .is_some_and(|value| value < 0)
    {
        return Err(ReportExportPortError::Failure(
            "report evidence is outside the supported numeric domain".to_owned(),
        ));
    }
    Ok(())
}

fn ensure_active(cancellation: &ReportExportCancellation) -> Result<(), ReportExportPortError> {
    if cancellation.is_cancelled() {
        Err(ReportExportPortError::Cancelled)
    } else {
        Ok(())
    }
}

fn push_term(html: &mut String, label: &str, value: &str) {
    html.push_str("<dt>");
    html.push_str(label);
    html.push_str("</dt><dd>");
    push_escaped(html, value);
    html.push_str("</dd>");
}

fn push_code_term(html: &mut String, label: &str, value: &str) {
    html.push_str("<dt>");
    html.push_str(label);
    html.push_str("</dt><dd><code>");
    push_escaped(html, value);
    html.push_str("</code></dd>");
}

fn push_data_term(
    html: &mut String,
    label: &str,
    exact_value: &str,
    display_value: &str,
    unit: Option<&str>,
) {
    html.push_str("<dt>");
    html.push_str(label);
    html.push_str("</dt><dd><data value=\"");
    push_escaped_attribute(html, exact_value);
    if let Some(unit) = unit {
        html.push_str("\" data-unit=\"");
        push_escaped_attribute(html, unit);
    }
    html.push_str("\">");
    push_escaped(html, display_value);
    html.push_str("</data></dd>");
}

fn push_escaped(output: &mut String, value: &str) {
    for character in value.chars() {
        match character {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' => output.push_str("&quot;"),
            '\'' => output.push_str("&#39;"),
            _ => output.push(character),
        }
    }
}

fn push_escaped_attribute(output: &mut String, value: &str) {
    push_escaped(output, value);
}

fn format_finite_number(value: f64) -> String {
    let rendered = format!("{value:.6}");
    rendered
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_owned()
}

fn format_decimal(value: f64, locale: ReportLocale) -> String {
    let rendered = format!("{value:.3}");
    let rendered = rendered.trim_end_matches('0').trim_end_matches('.');
    match locale {
        ReportLocale::EnUs => rendered.to_owned(),
        ReportLocale::EsEs => rendered.replace('.', ","),
    }
}

fn format_duration(milliseconds: i64, labels: &Labels) -> String {
    let total_seconds = milliseconds / 1_000;
    let hours = total_seconds / 3_600;
    let minutes = total_seconds % 3_600 / 60;
    let seconds = total_seconds % 60;
    let mut parts = Vec::new();
    if hours > 0 {
        parts.push(format!("{hours} {}", labels.hours));
    }
    if minutes > 0 {
        parts.push(format!("{minutes} {}", labels.minutes));
    }
    if seconds > 0 || parts.is_empty() {
        parts.push(format!("{seconds} {}", labels.seconds));
    }
    parts.join(" ")
}

fn format_utc_offset(minutes: i32) -> String {
    let sign = if minutes < 0 { '-' } else { '+' };
    let absolute = minutes.unsigned_abs();
    format!("{sign}{:02}:{:02}", absolute / 60, absolute % 60)
}

fn sport_label(sport: &TrainingSessionSport, labels: &Labels) -> String {
    match sport.state {
        TrainingSportState::Classified => sport
            .classification
            .as_ref()
            .and_then(|classification| {
                classification
                    .display_label
                    .clone()
                    .or_else(|| classification.canonical_family.clone())
            })
            .unwrap_or_else(|| labels.sport_unavailable.to_owned()),
        TrainingSportState::Unknown => labels.sport_unclassified.to_owned(),
        TrainingSportState::Unavailable => labels.sport_unavailable.to_owned(),
    }
}

fn source_label(code: &str) -> &str {
    match code {
        "polar-flow" => "Polar Flow",
        other => other,
    }
}

fn limitation_code(limitation: ReportLimitation) -> &'static str {
    match limitation {
        ReportLimitation::DistanceUnavailable => "distance-unavailable",
        ReportLimitation::EnergyUnavailable => "energy-unavailable",
        ReportLimitation::HeartRateUnavailable => "heart-rate-unavailable",
        ReportLimitation::SportUnclassified => "sport-unclassified",
        ReportLimitation::SportUnavailable => "sport-unavailable",
    }
}

fn limitation_label(limitation: ReportLimitation, labels: &Labels) -> &'static str {
    match limitation {
        ReportLimitation::DistanceUnavailable => labels.distance_unavailable,
        ReportLimitation::EnergyUnavailable => labels.energy_unavailable,
        ReportLimitation::HeartRateUnavailable => labels.heart_rate_unavailable,
        ReportLimitation::SportUnclassified => labels.sport_unclassified_limitation,
        ReportLimitation::SportUnavailable => labels.sport_unavailable_limitation,
    }
}

fn file_error(error: std::io::Error) -> ReportExportPortError {
    ReportExportPortError::Failure(error.to_string())
}

struct Labels {
    personal_report: &'static str,
    definition_version: &'static str,
    definition_revision: &'static str,
    source_revision: &'static str,
    locale: &'static str,
    units: &'static str,
    session_evidence: &'static str,
    recorded_evidence: &'static str,
    started: &'static str,
    stopped: &'static str,
    utc_offset: &'static str,
    duration: &'static str,
    distance: &'static str,
    energy: &'static str,
    average_heart_rate: &'static str,
    maximum_heart_rate: &'static str,
    sport: &'static str,
    exercises: &'static str,
    interpretation: &'static str,
    user_authored: &'static str,
    limitations: &'static str,
    no_known_limitations: &'static str,
    provenance: &'static str,
    current_attribution: &'static str,
    source: &'static str,
    source_modified: &'static str,
    source_adapter: &'static str,
    mapping: &'static str,
    contributing_events: &'static str,
    non_contributing_events: &'static str,
    kilometres: &'static str,
    kilocalories: &'static str,
    beats_per_minute: &'static str,
    hours: &'static str,
    minutes: &'static str,
    seconds: &'static str,
    distance_unavailable: &'static str,
    energy_unavailable: &'static str,
    heart_rate_unavailable: &'static str,
    sport_unclassified: &'static str,
    sport_unavailable: &'static str,
    sport_unclassified_limitation: &'static str,
    sport_unavailable_limitation: &'static str,
}

impl Labels {
    fn for_locale(locale: ReportLocale) -> &'static Self {
        match locale {
            ReportLocale::EnUs => &EN_US,
            ReportLocale::EsEs => &ES_ES,
        }
    }
}

static EN_US: Labels = Labels {
    personal_report: "Personal evidence report",
    definition_version: "Definition version",
    definition_revision: "Definition revision",
    source_revision: "Source revision",
    locale: "Language",
    units: "Units policy",
    session_evidence: "Session evidence",
    recorded_evidence: "Recorded source evidence resolved by FitFreed",
    started: "Started",
    stopped: "Stopped",
    utc_offset: "UTC offset",
    duration: "Duration",
    distance: "Distance",
    energy: "Energy",
    average_heart_rate: "Average heart rate",
    maximum_heart_rate: "Maximum heart rate",
    sport: "Sport",
    exercises: "Exercises",
    interpretation: "My interpretation",
    user_authored: "User-authored text",
    limitations: "Coverage and limitations",
    no_known_limitations: "No known limitations affect this version-1 summary.",
    provenance: "Provenance",
    current_attribution: "Current contributing source attribution",
    source: "Source",
    source_modified: "Source revision time",
    source_adapter: "Source adapter",
    mapping: "Training mapping",
    contributing_events: "Contributing evidence events",
    non_contributing_events: "Non-contributing evidence events",
    kilometres: "km",
    kilocalories: "kcal",
    beats_per_minute: "bpm",
    hours: "h",
    minutes: "min",
    seconds: "s",
    distance_unavailable: "Distance was not available in the source evidence.",
    energy_unavailable: "Energy was not available in the source evidence.",
    heart_rate_unavailable: "Heart rate was not available in the source evidence.",
    sport_unclassified: "Unclassified sport",
    sport_unavailable: "Sport unavailable",
    sport_unclassified_limitation: "The recorded sport has not been classified by the user.",
    sport_unavailable_limitation: "The source did not provide a sport reference.",
};

static ES_ES: Labels = Labels {
    personal_report: "Informe personal de evidencias",
    definition_version: "Versión de la definición",
    definition_revision: "Revisión de la definición",
    source_revision: "Revisión de los datos",
    locale: "Idioma",
    units: "Política de unidades",
    session_evidence: "Evidencias de la sesión",
    recorded_evidence: "Evidencias registradas en el origen y resueltas por FitFreed",
    started: "Inicio",
    stopped: "Fin",
    utc_offset: "Desfase UTC",
    duration: "Duración",
    distance: "Distancia",
    energy: "Energía",
    average_heart_rate: "Frecuencia cardíaca media",
    maximum_heart_rate: "Frecuencia cardíaca máxima",
    sport: "Deporte",
    exercises: "Ejercicios",
    interpretation: "Mi interpretación",
    user_authored: "Texto escrito por el usuario",
    limitations: "Cobertura y limitaciones",
    no_known_limitations: "No hay limitaciones conocidas que afecten a este resumen de versión 1.",
    provenance: "Procedencia",
    current_attribution: "Atribución actual del origen contribuyente",
    source: "Origen",
    source_modified: "Fecha de revisión en el origen",
    source_adapter: "Adaptador del origen",
    mapping: "Mapeo de entrenamientos",
    contributing_events: "Eventos de evidencia contribuyentes",
    non_contributing_events: "Eventos de evidencia no contribuyentes",
    kilometres: "km",
    kilocalories: "kcal",
    beats_per_minute: "ppm",
    hours: "h",
    minutes: "min",
    seconds: "s",
    distance_unavailable: "La distancia no estaba disponible en las evidencias de origen.",
    energy_unavailable: "La energía no estaba disponible en las evidencias de origen.",
    heart_rate_unavailable:
        "La frecuencia cardíaca no estaba disponible en las evidencias de origen.",
    sport_unclassified: "Deporte sin clasificar",
    sport_unavailable: "Deporte no disponible",
    sport_unclassified_limitation: "El usuario todavía no ha clasificado el deporte registrado.",
    sport_unavailable_limitation: "El origen no proporcionó una referencia de deporte.",
};

#[cfg(test)]
mod tests {
    use std::fs;

    use fitfreed_application::{
        ReportSessionEvidence, TrainingProvenanceCurrentView, TrainingSessionSport,
        TrainingSourceProviderView,
    };
    use fitfreed_domain::{ReportBlock, ReportDefinition};
    use tempfile::tempdir;

    use super::*;

    fn report(
        locale: ReportLocale,
        include_physiological_context: bool,
    ) -> AuthorizedSessionReportExport {
        let session_ref =
            "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let definition = ReportDefinition::create_session_report(
            "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "Morning <progression>",
            locale,
            "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            ReportBlock::session_evidence(
                "report-block-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                session_ref,
                true,
            )
            .expect("session block"),
            ReportBlock::narrative(
                "report-block-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
                "Controlled <script>alert('no')</script> & strong.",
            )
            .expect("narrative block"),
        )
        .expect("report definition");
        AuthorizedSessionReportExport {
            definition,
            resolved_snapshot_ref:
                "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                    .to_owned(),
            session: ReportSessionEvidence {
                session_ref: session_ref.to_owned(),
                source_index: 1,
                started_at_local: "2026-08-18T07:30:00.000".to_owned(),
                stopped_at_local: "2026-08-18T08:30:00.000".to_owned(),
                utc_offset_minutes: Some(120),
                duration_milliseconds: 3_600_000,
                distance_meters: Some(10_000.5),
                energy_kilocalories: Some(650),
                average_heart_rate_bpm: include_physiological_context.then_some(148),
                maximum_heart_rate_bpm: include_physiological_context.then_some(172),
                exercise_count: Some(1),
                sport: TrainingSessionSport {
                    sport_ref: None,
                    state: TrainingSportState::Unavailable,
                    classification: None,
                },
            },
            provenance: TrainingProvenanceCurrentView {
                provider: TrainingSourceProviderView::restore("polar-flow".to_owned())
                    .expect("provider"),
                source_modified_at_utc: "2026-08-18T08:00:00Z".to_owned(),
                source_adapter_version: "polar-flow-archive@10".to_owned(),
                mapping_version: "polar-flow-training-session@5".to_owned(),
                contributing_event_count: 2,
                non_contributing_event_count: 1,
            },
            limitations: vec![ReportLimitation::SportUnavailable],
            include_physiological_context,
        }
    }

    #[test]
    fn writes_deterministic_self_contained_escaped_html_in_both_locales() {
        for locale in [ReportLocale::EnUs, ReportLocale::EsEs] {
            let directory = tempdir().expect("temporary directory");
            let first = directory.path().join("first.html");
            let second = directory.path().join("second.html");
            let exporter = SelfContainedHtmlReportExporter;
            let resolved = report(locale, true);

            exporter
                .export_report(&resolved, &first, &ReportExportCancellation::new())
                .expect("first export");
            exporter
                .export_report(&resolved, &second, &ReportExportCancellation::new())
                .expect("second export");
            let first_bytes = fs::read(first).expect("first bytes");
            let second_bytes = fs::read(second).expect("second bytes");
            assert_eq!(first_bytes, second_bytes);
            let html = String::from_utf8(first_bytes).expect("UTF-8 HTML");
            assert!(html.starts_with("<!doctype html>"));
            assert!(html.contains(&format!("<html lang=\"{}\">", locale.code())));
            assert!(html.contains("Morning &lt;progression&gt;"));
            assert!(html.contains("&lt;script&gt;alert(&#39;no&#39;)&lt;/script&gt; &amp; strong."));
            assert!(!html.contains("<script"));
            assert!(!html.contains("http://"));
            assert!(!html.contains("https://"));
            assert!(!html.contains("onclick"));
            assert!(html.contains("data-unit=\"m\""));
            assert!(html.contains("data-unit=\"bpm\""));
            assert!(html.contains("polar-flow-training-session@5"));
        }
    }

    #[test]
    fn omits_unapproved_physiological_context() {
        let html = render_report(
            &report(ReportLocale::EnUs, false),
            &ReportExportCancellation::new(),
        )
        .expect("rendered report");

        assert!(!html.contains("Average heart rate"));
        assert!(!html.contains("Maximum heart rate"));
        assert!(!html.contains("148 bpm"));
        assert!(!html.contains("172 bpm"));
    }

    #[test]
    fn cancellation_and_invalid_destinations_preserve_existing_output_without_staging_files() {
        let directory = tempdir().expect("temporary directory");
        let destination = directory.path().join("report.html");
        fs::write(&destination, "previous report").expect("previous report");
        let cancellation = ReportExportCancellation::new();
        cancellation.cancel();

        assert_eq!(
            SelfContainedHtmlReportExporter.export_report(
                &report(ReportLocale::EnUs, true),
                &destination,
                &cancellation,
            ),
            Err(ReportExportPortError::Cancelled)
        );
        assert_eq!(
            fs::read_to_string(&destination).expect("preserved report"),
            "previous report"
        );
        assert_eq!(
            fs::read_dir(directory.path()).expect("directory").count(),
            1
        );

        let missing_parent = directory.path().join("missing").join("report.html");
        assert!(matches!(
            SelfContainedHtmlReportExporter.export_report(
                &report(ReportLocale::EnUs, true),
                &missing_parent,
                &ReportExportCancellation::new(),
            ),
            Err(ReportExportPortError::Failure(_))
        ));
        assert!(!missing_parent.exists());

        let mut invalid = report(ReportLocale::EnUs, true);
        invalid.session.distance_meters = Some(f64::NAN);
        assert!(matches!(
            SelfContainedHtmlReportExporter.export_report(
                &invalid,
                &destination,
                &ReportExportCancellation::new(),
            ),
            Err(ReportExportPortError::Failure(_))
        ));
        assert_eq!(
            fs::read_to_string(&destination).expect("preserved report after invalid evidence"),
            "previous report"
        );
    }
}
