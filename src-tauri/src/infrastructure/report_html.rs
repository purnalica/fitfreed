use std::{collections::BTreeMap, fs, io::Write, path::Path};

use fitfreed_application::{
    AuthorizedReportExport, ReportEvidenceProvenance, ReportExportCancellation, ReportExportPort,
    ReportExportPortError, ReportExportReceipt, ReportLimitation, ReportRouteEvidence,
    TrainingComparison, TrainingRouteKindView, TrainingSeriesComparison, TrainingSeriesSummary,
    TrainingSessionSport, TrainingSportState,
};
use fitfreed_domain::{
    PlannedTrainingCompletion, PlannedTrainingExerciseKind, PlannedTrainingIntensity,
    PlannedTrainingIntensityMetric, PlannedTrainingMappingState, PlannedTrainingPhaseChange,
    PlannedTrainingPhaseGoal, PlannedTrainingRepeat, PlannedTrainingSessionRelation,
    PlannedTrainingSport, PlannedTrainingTargetKind, ReportBlockContent, ReportLocale,
    ReportTrainingMetric,
};

use super::{
    local_file::PrivateStagingFile,
    report_chart::{render_static_comparison_chart, StaticComparisonChart},
};

const SPORT_ICON_SPRITE: &str = include_str!("../../../assets/sport/sport-icons.svg");
const REPORT_HTML_OUTPUT_VERSION: u32 = 7;
const SVG_NAMESPACE_DECLARATION: &str = " xmlns=\"http://www.w3.org/2000/svg\"";
const EMBEDDED_STYLE: &str = "\
:root{color-scheme:light dark;font-family:system-ui,-apple-system,sans-serif;line-height:1.5}\
body{max-width:64rem;margin:0 auto;padding:2rem;color:#17211c;background:#f5f7f3}\
.sport-icon-sprite{position:absolute;width:0;height:0;overflow:hidden}\
main{background:#fff;border:1px solid #cad3cc;border-radius:1rem;padding:clamp(1rem,4vw,3rem)}\
h1,h2{line-height:1.15}section{margin-block:2rem}dl{display:grid;grid-template-columns:minmax(10rem,1fr) 2fr;gap:.5rem 1rem}\
dt{font-weight:700}dd{margin:0}.narrative{white-space:pre-wrap}.attribution,.limitation{color:#425149}\
.sport-identity{display:inline-flex;align-items:center;gap:.5rem}.sport-icon{width:1.75rem;height:1.75rem;padding:.3rem;color:#276749;background:#eef3ef;border-radius:50%;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;fill:none}\
.comparison-series,.planned-exercise{border:1px solid #cad3cc;border-radius:.75rem;padding:1rem;margin-block:1rem}.comparison-chart{display:block;max-width:100%;height:auto;margin-block:1rem}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{padding:.6rem;text-align:left;vertical-align:top;border-bottom:1px solid #cad3cc}caption{font-weight:700;text-align:left;margin-bottom:.5rem}\
.route-visual{background:#eef3ef;border:1px solid #cad3cc;border-radius:.75rem;max-width:100%;height:auto}.route-visual rect{fill:#eef3ef}.route-visual polyline{fill:none;stroke:#276749;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}.route-visual circle{fill:#17211c;stroke:#fff;stroke-width:2}\
@media(max-width:40rem){body{padding:.5rem}main{border-radius:.5rem}dl{grid-template-columns:1fr}dd{margin-bottom:.75rem}}\
@media(prefers-color-scheme:dark){body{color:#e7eee9;background:#121713}main{background:#1b231d;border-color:#445047}.attribution,.limitation{color:#b8c5bc}}\
@media print{body{max-width:none;padding:0;background:#fff;color:#000}main{border:0;padding:0}}";

pub struct SelfContainedHtmlReportExporter;

impl ReportExportPort for SelfContainedHtmlReportExporter {
    fn export_report(
        &self,
        report: &AuthorizedReportExport,
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
    report: &AuthorizedReportExport,
    cancellation: &ReportExportCancellation,
) -> Result<String, ReportExportPortError> {
    ensure_active(cancellation)?;
    validate_evidence(report)?;
    let labels = Labels::for_locale(report.definition.locale());
    let narrative_length = report
        .definition
        .blocks()
        .iter()
        .find_map(|block| match block.content() {
            ReportBlockContent::Narrative { body } => Some(body.len()),
            ReportBlockContent::SessionEvidence { .. }
            | ReportBlockContent::Route { .. }
            | ReportBlockContent::TrainingFinding { .. }
            | ReportBlockContent::TrainingComparison { .. }
            | ReportBlockContent::TrainingChart { .. }
            | ReportBlockContent::TrainingExactTable { .. }
            | ReportBlockContent::TrainingCoverage { .. }
            | ReportBlockContent::PlannedTraining { .. } => None,
        })
        .unwrap_or(0);
    let mut html = String::with_capacity(8_192 + narrative_length);
    html.push_str("<!doctype html><html lang=\"");
    html.push_str(report.definition.locale().code());
    html.push_str("\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>");
    push_escaped(&mut html, report.definition.title());
    html.push_str("</title><style>");
    html.push_str(EMBEDDED_STYLE);
    html.push_str("</style></head><body>");
    html.push_str(&SPORT_ICON_SPRITE.replacen(SVG_NAMESPACE_DECLARATION, "", 1));
    html.push_str("<main data-fitfreed-output-version=\"");
    html.push_str(&REPORT_HTML_OUTPUT_VERSION.to_string());
    html.push_str("\" data-fitfreed-report-version=\"");
    html.push_str(&report.definition.definition_version().to_string());
    html.push_str("\"><header><p class=\"attribution\">");
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

    let routes = report
        .routes
        .iter()
        .map(|route| (route.block_ref.as_str(), route))
        .collect::<BTreeMap<_, _>>();
    for block in report.definition.blocks() {
        ensure_active(cancellation)?;
        match block.content() {
            ReportBlockContent::SessionEvidence { .. } => {
                render_session_section(&mut html, report, labels)?
            }
            ReportBlockContent::Route { .. } => {
                let route = routes.get(block.block_ref()).ok_or_else(|| {
                    ReportExportPortError::Failure(
                        "authorized report route block is unavailable".to_owned(),
                    )
                })?;
                render_route_section(&mut html, route, labels);
            }
            ReportBlockContent::Narrative { body } => {
                render_narrative_section(&mut html, body, labels)
            }
            ReportBlockContent::TrainingFinding { metric, .. } => {
                render_training_finding(
                    &mut html,
                    report_training_comparison(report)?,
                    *metric,
                    labels,
                    report.definition.locale(),
                    block.block_ref(),
                );
            }
            ReportBlockContent::TrainingComparison { .. } => {
                render_training_comparison(
                    &mut html,
                    report_training_comparison(report)?,
                    labels,
                    report.definition.locale(),
                    block.block_ref(),
                );
            }
            ReportBlockContent::TrainingChart { metric, .. } => {
                render_training_chart(
                    &mut html,
                    report_training_comparison(report)?,
                    *metric,
                    labels,
                    report.definition.locale(),
                    block.block_ref(),
                    cancellation,
                )?;
            }
            ReportBlockContent::TrainingExactTable { .. } => {
                render_training_exact_table(
                    &mut html,
                    report_training_comparison(report)?,
                    labels,
                    report.definition.locale(),
                    block.block_ref(),
                );
            }
            ReportBlockContent::TrainingCoverage { .. } => {
                render_training_coverage(
                    &mut html,
                    report_training_comparison(report)?,
                    labels,
                    block.block_ref(),
                );
            }
            ReportBlockContent::PlannedTraining { target_ref } => {
                render_planned_training_section(
                    &mut html,
                    report,
                    labels,
                    block.block_ref(),
                    target_ref,
                )?;
            }
        }
    }
    html.push_str(
        "<section aria-labelledby=\"limitations-heading\"><h2 id=\"limitations-heading\">",
    );
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
    match &report.provenance {
        ReportEvidenceProvenance::Session(provenance) => {
            html.push_str(labels.current_attribution);
            html.push_str("</p><dl><dt>");
            html.push_str(labels.source);
            html.push_str("</dt><dd>");
            push_escaped(&mut html, source_label(provenance.provider.code()));
            html.push_str("</dd><dt>");
            html.push_str(labels.source_modified);
            html.push_str("</dt><dd><time datetime=\"");
            push_escaped_attribute(&mut html, &provenance.source_modified_at_utc);
            html.push_str("\">");
            push_escaped(&mut html, &provenance.source_modified_at_utc);
            html.push_str("</time></dd>");
            push_code_term(
                &mut html,
                labels.source_adapter,
                &provenance.source_adapter_version,
            );
            push_code_term(&mut html, labels.mapping, &provenance.mapping_version);
            push_data_term(
                &mut html,
                labels.contributing_events,
                &provenance.contributing_event_count.to_string(),
                &provenance.contributing_event_count.to_string(),
                None,
            );
            push_data_term(
                &mut html,
                labels.non_contributing_events,
                &provenance.non_contributing_event_count.to_string(),
                &provenance.non_contributing_event_count.to_string(),
                None,
            );
            html.push_str("</dl>");
        }
        ReportEvidenceProvenance::LibrarySnapshot => {
            html.push_str(labels.library_snapshot_attribution);
            html.push_str("</p>");
        }
        ReportEvidenceProvenance::PlannedTrainingSnapshot => {
            html.push_str(labels.planned_snapshot_attribution);
            html.push_str("</p>");
        }
        ReportEvidenceProvenance::AuthoredOnly => {
            html.push_str(labels.authored_only_attribution);
            html.push_str("</p>");
        }
    }
    html.push_str("</section></main></body></html>\n");
    Ok(html)
}

fn render_session_section(
    html: &mut String,
    report: &AuthorizedReportExport,
    labels: &Labels,
) -> Result<(), ReportExportPortError> {
    let session = report.session.as_ref().ok_or_else(|| {
        ReportExportPortError::Failure(
            "authorized session report evidence is unavailable".to_owned(),
        )
    })?;
    html.push_str("<section aria-labelledby=\"session-heading\"><h2 id=\"session-heading\">");
    html.push_str(labels.session_evidence);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.recorded_evidence);
    html.push_str("</p><dl><dt>");
    html.push_str(labels.started);
    html.push_str("</dt><dd><time>");
    push_escaped(html, &session.started_at_local);
    html.push_str("</time></dd><dt>");
    html.push_str(labels.stopped);
    html.push_str("</dt><dd><time>");
    push_escaped(html, &session.stopped_at_local);
    html.push_str("</time></dd>");
    if let Some(offset) = session.utc_offset_minutes {
        push_term(html, labels.utc_offset, &format_utc_offset(offset));
    }
    push_data_term(
        html,
        labels.duration,
        &session.duration_milliseconds.to_string(),
        &format_duration(session.duration_milliseconds, labels),
        Some("ms"),
    );
    if let Some(distance) = session.distance_meters {
        push_data_term(
            html,
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
    if let Some(energy) = session.energy_kilocalories {
        push_data_term(
            html,
            labels.energy,
            &energy.to_string(),
            &format!("{energy} {}", labels.kilocalories),
            Some("kcal"),
        );
    }
    if report.include_physiological_context {
        if let Some(average) = session.average_heart_rate_bpm {
            push_data_term(
                html,
                labels.average_heart_rate,
                &average.to_string(),
                &format!("{average} {}", labels.beats_per_minute),
                Some("bpm"),
            );
        }
        if let Some(maximum) = session.maximum_heart_rate_bpm {
            push_data_term(
                html,
                labels.maximum_heart_rate,
                &maximum.to_string(),
                &format!("{maximum} {}", labels.beats_per_minute),
                Some("bpm"),
            );
        }
    }
    push_sport_term(html, labels.sport, &sport_identity(&session.sport, labels));
    if let Some(count) = session.exercise_count {
        push_data_term(
            html,
            labels.exercises,
            &count.to_string(),
            &count.to_string(),
            None,
        );
    }
    html.push_str("</dl></section>");
    Ok(())
}

fn render_planned_training_section(
    html: &mut String,
    report: &AuthorizedReportExport,
    labels: &Labels,
    block_ref: &str,
    target_ref: &str,
) -> Result<(), ReportExportPortError> {
    let evidence = report.planned_training.as_ref().ok_or_else(|| {
        ReportExportPortError::Failure(
            "authorized planned-training report evidence is unavailable".to_owned(),
        )
    })?;
    if evidence.block_ref != block_ref || evidence.target.target.target.target_id() != target_ref {
        return Err(invalid_planned_training_evidence());
    }
    let summary = &evidence.target.target;
    let target = &summary.target;
    html.push_str("<section aria-labelledby=\"");
    push_escaped_attribute(html, block_ref);
    html.push_str("-heading\"><h2 id=\"");
    push_escaped_attribute(html, block_ref);
    html.push_str("-heading\">");
    html.push_str(labels.planned_training_evidence);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.planned_source_evidence);
    html.push_str("</p><h3>");
    push_escaped(html, target.name());
    html.push_str("</h3>");
    if let Some(description) = target.description() {
        html.push_str("<p>");
        push_escaped(html, description);
        html.push_str("</p>");
    }
    html.push_str("<dl>");
    match target.kind() {
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local,
            completion,
        } => {
            push_term(html, labels.kind, labels.scheduled_training);
            html.push_str("<dt>");
            html.push_str(labels.scheduled_for);
            html.push_str("</dt><dd><time datetime=\"");
            push_escaped_attribute(html, scheduled_at_local);
            html.push_str("\">");
            push_escaped(html, scheduled_at_local);
            html.push_str("</time></dd>");
            push_term(
                html,
                labels.completion,
                match completion {
                    PlannedTrainingCompletion::Pending => labels.pending,
                    PlannedTrainingCompletion::Completed => labels.completed,
                },
            );
        }
        PlannedTrainingTargetKind::FavoriteTemplate => {
            push_term(html, labels.kind, labels.favorite_template)
        }
    }
    let mapping = target.mapping_coverage();
    push_term(
        html,
        labels.mapping,
        match mapping.state() {
            PlannedTrainingMappingState::Complete => labels.mapping_complete,
            PlannedTrainingMappingState::Partial => labels.mapping_partial,
        },
    );
    if mapping.unmapped_field_count() > 0 {
        push_data_term(
            html,
            labels.unmapped_fields,
            &mapping.unmapped_field_count().to_string(),
            &mapping.unmapped_field_count().to_string(),
            None,
        );
    }
    push_code_term(
        html,
        labels.source_evidence_revision,
        target.evidence_revision(),
    );
    if let Some(count) = summary.shape.exercise_count {
        push_data_term(
            html,
            labels.exercises,
            &count.to_string(),
            &count.to_string(),
            None,
        );
    }
    if let Some(count) = summary.shape.phase_count {
        push_data_term(
            html,
            labels.unique_phases,
            &count.to_string(),
            &count.to_string(),
            None,
        );
    }
    if let Some(count) = summary.shape.expanded_phase_count {
        push_data_term(
            html,
            labels.expanded_phases,
            &count.to_string(),
            &count.to_string(),
            None,
        );
    }
    if let Some(count) = summary.shape.repeat_block_count {
        push_data_term(
            html,
            labels.repeat_blocks,
            &count.to_string(),
            &count.to_string(),
            None,
        );
    }
    push_term(
        html,
        labels.completed_session,
        match &summary.relation {
            PlannedTrainingSessionRelation::NotApplicable => labels.not_applicable,
            PlannedTrainingSessionRelation::Absent => labels.no_related_session,
            PlannedTrainingSessionRelation::Exact { .. } => labels.related_session,
            PlannedTrainingSessionRelation::Ambiguous { .. } => labels.ambiguous_relation,
        },
    );
    html.push_str("</dl>");

    if let Some(exercises) = target.exercises() {
        for exercise in exercises {
            html.push_str("<article class=\"planned-exercise\"><h3>");
            html.push_str(labels.exercise);
            html.push(' ');
            html.push_str(&(exercise.ordinal + 1).to_string());
            html.push_str("</h3><dl>");
            push_term(
                html,
                labels.kind,
                planned_exercise_kind_label(exercise.kind, labels),
            );
            if let Some(duration) = exercise.duration_goal_milliseconds {
                push_data_term(
                    html,
                    labels.duration_goal,
                    &duration.to_string(),
                    &format_duration(duration, labels),
                    Some("ms"),
                );
            }
            if let Some(distance) = exercise.distance_goal_meters {
                push_data_term(
                    html,
                    labels.distance_goal,
                    &format_finite_number(distance),
                    &format!(
                        "{} {}",
                        format_decimal(distance / 1_000.0, report.definition.locale()),
                        labels.kilometres
                    ),
                    Some("m"),
                );
            }
            push_sport_term(
                html,
                labels.sport,
                &planned_training_sport_identity(&exercise.sport, labels),
            );
            html.push_str("</dl>");
            if let Some(phases) = exercise.phases.as_deref() {
                html.push_str("<div class=\"table-scroll\"><table><caption>");
                html.push_str(labels.phases);
                html.push_str("</caption><thead><tr><th scope=\"col\">");
                html.push_str(labels.phase);
                html.push_str("</th><th scope=\"col\">");
                html.push_str(labels.goal);
                html.push_str("</th><th scope=\"col\">");
                html.push_str(labels.intensity);
                html.push_str("</th><th scope=\"col\">");
                html.push_str(labels.transition);
                html.push_str("</th></tr></thead><tbody>");
                for phase in phases {
                    html.push_str("<tr><th scope=\"row\">");
                    html.push_str(&(phase.ordinal + 1).to_string());
                    html.push_str(". ");
                    push_escaped(html, &phase.name);
                    html.push_str("</th><td>");
                    render_planned_phase_goal(
                        html,
                        &phase.goal,
                        labels,
                        report.definition.locale(),
                    );
                    html.push_str("</td><td>");
                    push_escaped(html, &planned_intensity_label(&phase.intensity, labels));
                    html.push_str("</td><td>");
                    push_escaped(
                        html,
                        &planned_transition_label(
                            phase.transition.change,
                            phase.transition.repeat.as_ref(),
                            labels,
                        ),
                    );
                    html.push_str("</td></tr>");
                }
                html.push_str("</tbody></table></div>");
            }
            html.push_str("</article>");
        }
    } else {
        html.push_str("<p>");
        html.push_str(labels.exercises_unavailable);
        html.push_str("</p>");
    }
    html.push_str("</section>");
    Ok(())
}

fn planned_exercise_kind_label(kind: PlannedTrainingExerciseKind, labels: &Labels) -> &'static str {
    match kind {
        PlannedTrainingExerciseKind::Open => labels.open_exercise,
        PlannedTrainingExerciseKind::Phased => labels.phased_exercise,
        PlannedTrainingExerciseKind::Volume => labels.volume_exercise,
        PlannedTrainingExerciseKind::Strength => labels.strength_exercise,
        PlannedTrainingExerciseKind::Unmapped => labels.unmapped,
    }
}

fn planned_training_sport_identity(sport: &PlannedTrainingSport, labels: &Labels) -> SportIdentity {
    match sport {
        PlannedTrainingSport::Unavailable => SportIdentity {
            icon: "unavailable",
            label: labels.sport_unavailable.to_owned(),
        },
        PlannedTrainingSport::Unmapped => SportIdentity {
            icon: "unknown",
            label: labels.sport_unknown.to_owned(),
        },
        PlannedTrainingSport::Recognized(suggestion) => {
            let family = suggestion
                .canonical_family()
                .and_then(|value| sport_family_identity(value.as_code(), labels));
            SportIdentity {
                icon: family.map_or("other", |(icon, _)| icon),
                label: suggestion
                    .localized_names()
                    .iter()
                    .find(|name| name.language_tag() == labels.recognition_locale)
                    .or_else(|| {
                        suggestion
                            .localized_names()
                            .iter()
                            .find(|name| name.language_tag() == "en")
                    })
                    .map(|name| name.value().to_owned())
                    .or_else(|| family.map(|(_, label)| label.to_owned()))
                    .unwrap_or_else(|| labels.sport_unknown.to_owned()),
            }
        }
    }
}

fn render_planned_phase_goal(
    html: &mut String,
    goal: &PlannedTrainingPhaseGoal,
    labels: &Labels,
    locale: ReportLocale,
) {
    match goal {
        PlannedTrainingPhaseGoal::DurationMilliseconds(value) => push_data(
            html,
            &value.to_string(),
            &format_duration(*value, labels),
            Some("ms"),
        ),
        PlannedTrainingPhaseGoal::DistanceMeters(value) => push_data(
            html,
            &format_finite_number(*value),
            &format!(
                "{} {}",
                format_decimal(*value / 1_000.0, locale),
                labels.kilometres
            ),
            Some("m"),
        ),
        PlannedTrainingPhaseGoal::Unmapped => html.push_str(labels.unmapped),
    }
}

fn planned_intensity_label(intensity: &PlannedTrainingIntensity, labels: &Labels) -> String {
    match intensity {
        PlannedTrainingIntensity::None => labels.no_intensity.to_owned(),
        PlannedTrainingIntensity::ZoneRange {
            metric,
            lower_zone,
            upper_zone,
        } => format!(
            "{} {}–{}",
            match metric {
                PlannedTrainingIntensityMetric::HeartRate => labels.heart_rate_zones,
                PlannedTrainingIntensityMetric::Speed => labels.speed_zones,
                PlannedTrainingIntensityMetric::Power => labels.power_zones,
            },
            lower_zone,
            upper_zone
        ),
        PlannedTrainingIntensity::Unmapped => labels.unmapped.to_owned(),
    }
}

fn planned_transition_label(
    change: PlannedTrainingPhaseChange,
    repeat: Option<&PlannedTrainingRepeat>,
    labels: &Labels,
) -> String {
    let change = match change {
        PlannedTrainingPhaseChange::Manual => labels.manual_transition,
        PlannedTrainingPhaseChange::Automatic => labels.automatic_transition,
        PlannedTrainingPhaseChange::Unmapped => labels.unmapped,
    };
    match repeat {
        Some(repeat) => format!(
            "{change}; {} {} {} {} {}",
            labels.repeat_from_phase,
            repeat.return_to_phase_ordinal + 1,
            labels.for_total_iterations,
            repeat.total_iterations,
            labels.total_iterations,
        ),
        None => change.to_owned(),
    }
}

fn render_narrative_section(html: &mut String, body: &str, labels: &Labels) {
    html.push_str("<section aria-labelledby=\"narrative-heading\"><h2 id=\"narrative-heading\">");
    html.push_str(labels.interpretation);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.user_authored);
    html.push_str("</p><p class=\"narrative\">");
    push_escaped(html, body);
    html.push_str("</p></section>");
}

fn report_training_comparison(
    report: &AuthorizedReportExport,
) -> Result<&TrainingComparison, ReportExportPortError> {
    report.training_comparison.as_ref().ok_or_else(|| {
        ReportExportPortError::Failure(
            "authorized training comparison evidence is unavailable".to_owned(),
        )
    })
}

fn render_training_finding(
    html: &mut String,
    comparison: &TrainingComparison,
    metric: ReportTrainingMetric,
    labels: &Labels,
    locale: ReportLocale,
    block_ref: &str,
) {
    open_analytical_section(html, block_ref, labels.training_finding, labels);
    for (index, series) in comparison.series.iter().enumerate() {
        html.push_str("<div class=\"comparison-series\"><h3>");
        push_series_label(html, index, comparison.series.len(), labels);
        html.push_str("</h3><p>");
        let baseline = training_metric_display(&series.baseline, metric, labels, locale);
        let current = training_metric_display(&series.comparison, metric, labels, locale);
        let change = training_metric_change_display(series, metric, labels, locale);
        html.push_str(training_metric_label(metric, labels));
        html.push_str(": ");
        match (baseline, current, change) {
            (Some(baseline), Some(current), Some(change)) => {
                push_escaped(html, &baseline);
                html.push_str(" → ");
                push_escaped(html, &current);
                html.push_str(" (");
                push_escaped(html, &change);
                html.push_str(").");
            }
            _ => html.push_str(labels.comparison_unavailable),
        }
        html.push_str("</p></div>");
    }
    close_analytical_section(html, comparison, labels);
}

fn render_training_comparison(
    html: &mut String,
    comparison: &TrainingComparison,
    labels: &Labels,
    locale: ReportLocale,
    block_ref: &str,
) {
    open_analytical_section(html, block_ref, labels.training_comparison, labels);
    for (index, series) in comparison.series.iter().enumerate() {
        html.push_str("<div class=\"comparison-series\"><h3>");
        push_series_label(html, index, comparison.series.len(), labels);
        html.push_str("</h3><dl>");
        for metric in [
            ReportTrainingMetric::SessionCount,
            ReportTrainingMetric::TrainingDays,
            ReportTrainingMetric::Duration,
        ] {
            let baseline = training_metric_display(&series.baseline, metric, labels, locale)
                .unwrap_or_else(|| labels.unavailable.to_owned());
            let current = training_metric_display(&series.comparison, metric, labels, locale)
                .unwrap_or_else(|| labels.unavailable.to_owned());
            let value = format!("{baseline} → {current}");
            push_term(html, training_metric_label(metric, labels), &value);
        }
        html.push_str("</dl></div>");
    }
    close_analytical_section(html, comparison, labels);
}

fn render_training_chart(
    html: &mut String,
    comparison: &TrainingComparison,
    metric: ReportTrainingMetric,
    labels: &Labels,
    locale: ReportLocale,
    block_ref: &str,
    cancellation: &ReportExportCancellation,
) -> Result<(), ReportExportPortError> {
    open_analytical_section(html, block_ref, labels.training_chart, labels);
    for (index, series) in comparison.series.iter().enumerate() {
        ensure_active(cancellation)?;
        let series_label = training_series_label(index, comparison.series.len(), labels);
        let metric_label = training_metric_label(metric, labels);
        let title = format!("{series_label} — {metric_label}");
        let baseline_display = training_metric_display(&series.baseline, metric, labels, locale)
            .unwrap_or_else(|| labels.unavailable.to_owned());
        let comparison_display =
            training_metric_display(&series.comparison, metric, labels, locale)
                .unwrap_or_else(|| labels.unavailable.to_owned());
        let description = format!(
            "{}: {}; {}: {}.",
            labels.baseline, baseline_display, labels.comparison, comparison_display
        );
        let axis_label = training_metric_chart_axis_label(metric, labels);
        let chart_id = format!("{block_ref}-chart-{}", index + 1);
        let chart = render_static_comparison_chart(&StaticComparisonChart {
            id: &chart_id,
            title: &title,
            description: &description,
            axis_label: &axis_label,
            baseline_label: labels.baseline,
            comparison_label: labels.comparison,
            unavailable_label: labels.unavailable,
            baseline_value: training_metric_chart_value(&series.baseline, metric),
            comparison_value: training_metric_chart_value(&series.comparison, metric),
            decimal_separator: match locale {
                ReportLocale::EnUs => '.',
                ReportLocale::EsEs => ',',
            },
        })
        .map_err(|error| {
            ReportExportPortError::Failure(format!("static report chart rendering failed: {error}"))
        })?;
        html.push_str("<figure class=\"comparison-series\"><figcaption>");
        push_escaped(html, &series_label);
        html.push_str(" — ");
        html.push_str(metric_label);
        html.push_str("</figcaption>");
        html.push_str(&chart);
        render_metric_table(html, series, &[metric], labels, locale);
        html.push_str("</figure>");
        ensure_active(cancellation)?;
    }
    close_analytical_section(html, comparison, labels);
    Ok(())
}

fn render_training_exact_table(
    html: &mut String,
    comparison: &TrainingComparison,
    labels: &Labels,
    locale: ReportLocale,
    block_ref: &str,
) {
    open_analytical_section(html, block_ref, labels.training_exact_table, labels);
    for (index, series) in comparison.series.iter().enumerate() {
        html.push_str("<div class=\"comparison-series\"><h3>");
        push_series_label(html, index, comparison.series.len(), labels);
        html.push_str("</h3>");
        render_metric_table(
            html,
            series,
            &[
                ReportTrainingMetric::SessionCount,
                ReportTrainingMetric::TrainingDays,
                ReportTrainingMetric::Duration,
                ReportTrainingMetric::Distance,
                ReportTrainingMetric::Energy,
            ],
            labels,
            locale,
        );
        html.push_str("</div>");
    }
    close_analytical_section(html, comparison, labels);
}

fn render_metric_table(
    html: &mut String,
    series: &TrainingSeriesComparison,
    metrics: &[ReportTrainingMetric],
    labels: &Labels,
    locale: ReportLocale,
) {
    html.push_str("<div class=\"table-scroll\"><table><thead><tr><th scope=\"col\">");
    html.push_str(labels.metric);
    html.push_str("</th><th scope=\"col\">");
    html.push_str(labels.baseline);
    html.push_str("</th><th scope=\"col\">");
    html.push_str(labels.comparison);
    html.push_str("</th><th scope=\"col\">");
    html.push_str(labels.change);
    html.push_str("</th></tr></thead><tbody>");
    for metric in metrics {
        html.push_str("<tr><th scope=\"row\">");
        html.push_str(training_metric_label(*metric, labels));
        html.push_str("</th><td>");
        push_metric_cell(html, &series.baseline, *metric, labels, locale);
        html.push_str("</td><td>");
        push_metric_cell(html, &series.comparison, *metric, labels, locale);
        html.push_str("</td><td>");
        if let (Some(exact), Some(display)) = (
            training_metric_change_exact(series, *metric),
            training_metric_change_display(series, *metric, labels, locale),
        ) {
            push_data(html, &exact, &display, training_metric_unit(*metric));
        } else {
            html.push_str(labels.unavailable);
        }
        html.push_str("</td></tr>");
    }
    html.push_str("</tbody></table></div>");
}

fn render_training_coverage(
    html: &mut String,
    comparison: &TrainingComparison,
    labels: &Labels,
    block_ref: &str,
) {
    open_analytical_section(html, block_ref, labels.training_coverage, labels);
    for (index, series) in comparison.series.iter().enumerate() {
        html.push_str("<div class=\"comparison-series\"><h3>");
        push_series_label(html, index, comparison.series.len(), labels);
        html.push_str("</h3><table><thead><tr><th scope=\"col\">");
        html.push_str(labels.coverage_measurement);
        html.push_str("</th><th scope=\"col\">");
        html.push_str(labels.baseline);
        html.push_str("</th><th scope=\"col\">");
        html.push_str(labels.comparison);
        html.push_str("</th></tr></thead><tbody>");
        for (label, baseline, current) in [
            (
                labels.training_days,
                format!(
                    "{} / {}",
                    series.baseline.training_days, series.baseline.calendar_days
                ),
                format!(
                    "{} / {}",
                    series.comparison.training_days, series.comparison.calendar_days
                ),
            ),
            (
                labels.distance,
                format!(
                    "{} / {}",
                    series.baseline.distance_session_count, series.baseline.session_count
                ),
                format!(
                    "{} / {}",
                    series.comparison.distance_session_count, series.comparison.session_count
                ),
            ),
            (
                labels.energy,
                format!(
                    "{} / {}",
                    series.baseline.energy_session_count, series.baseline.session_count
                ),
                format!(
                    "{} / {}",
                    series.comparison.energy_session_count, series.comparison.session_count
                ),
            ),
            (
                labels.heart_rate,
                format!(
                    "{} / {}",
                    series.baseline.heart_rate_session_count, series.baseline.session_count
                ),
                format!(
                    "{} / {}",
                    series.comparison.heart_rate_session_count, series.comparison.session_count
                ),
            ),
        ] {
            html.push_str("<tr><th scope=\"row\">");
            html.push_str(label);
            html.push_str("</th><td>");
            html.push_str(&baseline);
            html.push_str("</td><td>");
            html.push_str(&current);
            html.push_str("</td></tr>");
        }
        html.push_str("</tbody></table><p class=\"limitation\">");
        html.push_str(labels.coverage_limitation);
        html.push_str("</p></div>");
    }
    close_analytical_section(html, comparison, labels);
}

fn open_analytical_section(html: &mut String, block_ref: &str, heading: &str, labels: &Labels) {
    html.push_str("<section aria-labelledby=\"");
    push_escaped_attribute(html, block_ref);
    html.push_str("-heading\"><h2 id=\"");
    push_escaped_attribute(html, block_ref);
    html.push_str("-heading\">");
    html.push_str(heading);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.fitfreed_calculation);
    html.push_str("</p>");
}

fn close_analytical_section(html: &mut String, comparison: &TrainingComparison, labels: &Labels) {
    html.push_str("<p class=\"limitation\">");
    html.push_str(labels.comparison_limitation);
    html.push_str("</p>");
    if let (Some(baseline), Some(current)) = (
        comparison.baseline_range.as_ref(),
        comparison.comparison_range.as_ref(),
    ) {
        html.push_str("<dl><dt>");
        html.push_str(labels.baseline);
        html.push_str("</dt><dd>");
        push_escaped(html, &format!("{} – {}", baseline.from, baseline.through));
        html.push_str("</dd><dt>");
        html.push_str(labels.comparison);
        html.push_str("</dt><dd>");
        push_escaped(html, &format!("{} – {}", current.from, current.through));
        html.push_str("</dd></dl>");
    }
    html.push_str("</section>");
}

fn push_series_label(html: &mut String, index: usize, count: usize, labels: &Labels) {
    html.push_str(&training_series_label(index, count, labels));
}

fn training_series_label(index: usize, count: usize, labels: &Labels) -> String {
    if count == 1 {
        labels.training_history.to_owned()
    } else {
        format!("{} {}", labels.source_series, index + 1)
    }
}

fn push_metric_cell(
    html: &mut String,
    summary: &TrainingSeriesSummary,
    metric: ReportTrainingMetric,
    labels: &Labels,
    locale: ReportLocale,
) {
    if let (Some(exact), Some(display)) = (
        training_metric_exact(summary, metric),
        training_metric_display(summary, metric, labels, locale),
    ) {
        push_data(html, &exact, &display, training_metric_unit(metric));
    } else {
        html.push_str(labels.unavailable);
    }
}

fn push_data(html: &mut String, exact: &str, display: &str, unit: Option<&str>) {
    html.push_str("<data value=\"");
    push_escaped_attribute(html, exact);
    if let Some(unit) = unit {
        html.push_str("\" data-unit=\"");
        push_escaped_attribute(html, unit);
    }
    html.push_str("\">");
    push_escaped(html, display);
    html.push_str("</data>");
}

fn training_metric_exact(
    summary: &TrainingSeriesSummary,
    metric: ReportTrainingMetric,
) -> Option<String> {
    match metric {
        ReportTrainingMetric::SessionCount => Some(summary.session_count.to_string()),
        ReportTrainingMetric::TrainingDays => Some(summary.training_days.to_string()),
        ReportTrainingMetric::Duration => Some(summary.total_duration_milliseconds.to_string()),
        ReportTrainingMetric::Distance => summary.total_distance_meters.map(format_finite_number),
        ReportTrainingMetric::Energy => summary
            .total_energy_kilocalories
            .map(|value| value.to_string()),
    }
}

fn training_metric_change_exact(
    series: &TrainingSeriesComparison,
    metric: ReportTrainingMetric,
) -> Option<String> {
    match metric {
        ReportTrainingMetric::SessionCount => Some(series.session_count_change.to_string()),
        ReportTrainingMetric::TrainingDays => Some(series.training_day_change.to_string()),
        ReportTrainingMetric::Duration => Some(series.duration_milliseconds_change.to_string()),
        ReportTrainingMetric::Distance => series.distance_meters_change.map(format_finite_number),
        ReportTrainingMetric::Energy => series
            .energy_kilocalories_change
            .map(|value| value.to_string()),
    }
}

fn training_metric_display(
    summary: &TrainingSeriesSummary,
    metric: ReportTrainingMetric,
    labels: &Labels,
    locale: ReportLocale,
) -> Option<String> {
    match metric {
        ReportTrainingMetric::SessionCount => Some(summary.session_count.to_string()),
        ReportTrainingMetric::TrainingDays => Some(summary.training_days.to_string()),
        ReportTrainingMetric::Duration => Some(format_duration_i128(
            summary.total_duration_milliseconds,
            labels,
        )),
        ReportTrainingMetric::Distance => summary.total_distance_meters.map(|value| {
            format!(
                "{} {}",
                format_decimal(value / 1_000.0, locale),
                labels.kilometres
            )
        }),
        ReportTrainingMetric::Energy => summary
            .total_energy_kilocalories
            .map(|value| format!("{value} {}", labels.kilocalories)),
    }
}

fn training_metric_change_display(
    series: &TrainingSeriesComparison,
    metric: ReportTrainingMetric,
    labels: &Labels,
    locale: ReportLocale,
) -> Option<String> {
    let sign = |value: f64| if value > 0.0 { "+" } else { "" };
    match metric {
        ReportTrainingMetric::SessionCount => {
            Some(format_signed_integer(series.session_count_change))
        }
        ReportTrainingMetric::TrainingDays => {
            Some(format_signed_integer(series.training_day_change))
        }
        ReportTrainingMetric::Duration => Some(format_signed_duration(
            series.duration_milliseconds_change,
            labels,
        )),
        ReportTrainingMetric::Distance => series.distance_meters_change.map(|value| {
            format!(
                "{}{} {}",
                sign(value),
                format_decimal(value / 1_000.0, locale),
                labels.kilometres
            )
        }),
        ReportTrainingMetric::Energy => series.energy_kilocalories_change.map(|value| {
            format!(
                "{}{} {}",
                if value > 0 { "+" } else { "" },
                value,
                labels.kilocalories
            )
        }),
    }
}

fn training_metric_chart_value(
    summary: &TrainingSeriesSummary,
    metric: ReportTrainingMetric,
) -> Option<f64> {
    match metric {
        ReportTrainingMetric::SessionCount => Some(summary.session_count as f64),
        ReportTrainingMetric::TrainingDays => Some(summary.training_days as f64),
        ReportTrainingMetric::Duration => {
            Some(summary.total_duration_milliseconds as f64 / 3_600_000.0)
        }
        ReportTrainingMetric::Distance => {
            summary.total_distance_meters.map(|value| value / 1_000.0)
        }
        ReportTrainingMetric::Energy => summary.total_energy_kilocalories.map(|value| value as f64),
    }
}

fn training_metric_chart_axis_label(metric: ReportTrainingMetric, labels: &Labels) -> String {
    match metric {
        ReportTrainingMetric::SessionCount => labels.sessions.to_owned(),
        ReportTrainingMetric::TrainingDays => labels.training_days.to_owned(),
        ReportTrainingMetric::Duration => format!("{} ({})", labels.duration, labels.hours),
        ReportTrainingMetric::Distance => format!("{} ({})", labels.distance, labels.kilometres),
        ReportTrainingMetric::Energy => format!("{} ({})", labels.energy, labels.kilocalories),
    }
}

fn training_metric_label(metric: ReportTrainingMetric, labels: &Labels) -> &'static str {
    match metric {
        ReportTrainingMetric::SessionCount => labels.sessions,
        ReportTrainingMetric::TrainingDays => labels.training_days,
        ReportTrainingMetric::Duration => labels.duration,
        ReportTrainingMetric::Distance => labels.distance,
        ReportTrainingMetric::Energy => labels.energy,
    }
}

const fn training_metric_unit(metric: ReportTrainingMetric) -> Option<&'static str> {
    match metric {
        ReportTrainingMetric::SessionCount | ReportTrainingMetric::TrainingDays => None,
        ReportTrainingMetric::Duration => Some("ms"),
        ReportTrainingMetric::Distance => Some("m"),
        ReportTrainingMetric::Energy => Some("kcal"),
    }
}

fn format_signed_integer(value: i128) -> String {
    if value > 0 {
        format!("+{value}")
    } else {
        value.to_string()
    }
}

fn format_signed_duration(milliseconds: i128, labels: &Labels) -> String {
    let sign = if milliseconds > 0 {
        "+"
    } else if milliseconds < 0 {
        "−"
    } else {
        ""
    };
    format!("{sign}{}", format_duration_i128(milliseconds.abs(), labels))
}

fn render_route_section(html: &mut String, route: &ReportRouteEvidence, labels: &Labels) {
    html.push_str("<section aria-labelledby=\"");
    push_escaped_attribute(html, route.block_ref.as_str());
    html.push_str("-heading\"><h2 id=\"");
    push_escaped_attribute(html, route.block_ref.as_str());
    html.push_str("-heading\">");
    html.push_str(labels.route);
    html.push_str("</h2><p class=\"attribution\">");
    html.push_str(labels.precise_location);
    html.push_str("</p>");
    if !route.included {
        html.push_str("<p>");
        html.push_str(labels.route_omitted);
        html.push_str("</p></section>");
        return;
    }
    let summary = format!(
        "{}: {} {}",
        route_kind_label(route.kind, labels),
        route.source_point_count,
        labels.recorded_points
    );
    let svg_points = route_svg_points(route);
    if svg_points.is_empty() {
        html.push_str("<p>");
        html.push_str(labels.route_fully_redacted);
        html.push_str("</p>");
    } else {
        html.push_str(
            "<svg class=\"route-visual\" viewBox=\"0 0 640 320\" role=\"img\" aria-label=\"",
        );
        push_escaped_attribute(html, &summary);
        html.push_str("\"><title>");
        push_escaped(html, &summary);
        html.push_str("</title><rect x=\"1\" y=\"1\" width=\"638\" height=\"318\" rx=\"18\"/>");
        if svg_points.len() == 1 {
            let (x, y) = svg_points[0];
            html.push_str(&format!("<circle cx=\"{x:.2}\" cy=\"{y:.2}\" r=\"7\"/>"));
        } else {
            html.push_str("<polyline points=\"");
            for (index, (x, y)) in svg_points.iter().enumerate() {
                if index > 0 {
                    html.push(' ');
                }
                html.push_str(&format!("{x:.2},{y:.2}"));
            }
            html.push_str("\"/>");
        }
        html.push_str("</svg>");
    }
    html.push_str("<dl>");
    push_term(
        html,
        labels.route_kind,
        route_kind_label(route.kind, labels),
    );
    push_data_term(
        html,
        labels.route_source_points,
        &route.source_point_count.to_string(),
        &route.source_point_count.to_string(),
        None,
    );
    push_data_term(
        html,
        labels.endpoint_redaction,
        &route.endpoint_redaction_meters.to_string(),
        &format!("{} {}", route.endpoint_redaction_meters, labels.metres),
        Some("m"),
    );
    html.push_str("</dl></section>");
}

fn route_svg_points(route: &ReportRouteEvidence) -> Vec<(f64, f64)> {
    let mut unwrapped = Vec::with_capacity(route.visual_points.len());
    for point in &route.visual_points {
        let mut longitude = point.longitude_degrees;
        if let Some((_, previous_longitude)) = unwrapped.last().copied() {
            while longitude - previous_longitude > 180.0 {
                longitude -= 360.0;
            }
            while longitude - previous_longitude < -180.0 {
                longitude += 360.0;
            }
        }
        unwrapped.push((point.latitude_degrees, longitude));
    }
    let Some((minimum_latitude, maximum_latitude, minimum_longitude, maximum_longitude)) =
        unwrapped
            .iter()
            .copied()
            .fold(None, |bounds, (latitude, longitude)| match bounds {
                None => Some((latitude, latitude, longitude, longitude)),
                Some((min_lat, max_lat, min_lon, max_lon)) => Some((
                    min_lat.min(latitude),
                    max_lat.max(latitude),
                    min_lon.min(longitude),
                    max_lon.max(longitude),
                )),
            })
    else {
        return Vec::new();
    };
    let latitude_span = maximum_latitude - minimum_latitude;
    let longitude_span = maximum_longitude - minimum_longitude;
    unwrapped
        .into_iter()
        .map(|(latitude, longitude)| {
            let x = if longitude_span == 0.0 {
                320.0
            } else {
                24.0 + (longitude - minimum_longitude) / longitude_span * 592.0
            };
            let y = if latitude_span == 0.0 {
                160.0
            } else {
                24.0 + (maximum_latitude - latitude) / latitude_span * 272.0
            };
            (x, y)
        })
        .collect()
}

fn route_kind_label(kind: TrainingRouteKindView, labels: &Labels) -> &'static str {
    match kind {
        TrainingRouteKindView::Primary => labels.primary_route,
        TrainingRouteKindView::Transition => labels.transition_route,
    }
}

fn validate_evidence(report: &AuthorizedReportExport) -> Result<(), ReportExportPortError> {
    if let Some(session) = &report.session {
        let invalid_distance = session
            .distance_meters
            .is_some_and(|value| !value.is_finite() || value < 0.0);
        if session.duration_milliseconds < 0
            || invalid_distance
            || session.energy_kilocalories.is_some_and(|value| value < 0)
            || session
                .average_heart_rate_bpm
                .is_some_and(|value| value < 0)
            || session
                .maximum_heart_rate_bpm
                .is_some_and(|value| value < 0)
        {
            return Err(ReportExportPortError::Failure(
                "report evidence is outside the supported numeric domain".to_owned(),
            ));
        }
    }
    validate_training_comparison_evidence(report)?;
    validate_planned_training_evidence(report)?;
    Ok(())
}

fn validate_planned_training_evidence(
    report: &AuthorizedReportExport,
) -> Result<(), ReportExportPortError> {
    let expected = report
        .definition
        .blocks()
        .iter()
        .find_map(|block| match block.content() {
            ReportBlockContent::PlannedTraining { target_ref } => {
                Some((block.block_ref(), target_ref.as_str()))
            }
            ReportBlockContent::SessionEvidence { .. }
            | ReportBlockContent::Route { .. }
            | ReportBlockContent::Narrative { .. }
            | ReportBlockContent::TrainingFinding { .. }
            | ReportBlockContent::TrainingComparison { .. }
            | ReportBlockContent::TrainingChart { .. }
            | ReportBlockContent::TrainingExactTable { .. }
            | ReportBlockContent::TrainingCoverage { .. } => None,
        });
    match (expected, report.planned_training.as_ref()) {
        (None, None) => {
            if matches!(
                report.provenance,
                ReportEvidenceProvenance::PlannedTrainingSnapshot
            ) {
                Err(invalid_planned_training_evidence())
            } else {
                Ok(())
            }
        }
        (Some((block_ref, target_ref)), Some(evidence))
            if evidence.block_ref == block_ref
                && evidence.target.snapshot_ref == report.resolved_snapshot_ref
                && evidence.target.target.target.target_id() == target_ref
                && report.session.is_none()
                && report.routes.is_empty()
                && report.training_comparison.is_none()
                && matches!(
                    report.provenance,
                    ReportEvidenceProvenance::PlannedTrainingSnapshot
                ) =>
        {
            Ok(())
        }
        _ => Err(invalid_planned_training_evidence()),
    }
}

fn invalid_planned_training_evidence() -> ReportExportPortError {
    ReportExportPortError::Failure(
        "authorized planned-training report evidence is inconsistent".to_owned(),
    )
}

fn validate_training_comparison_evidence(
    report: &AuthorizedReportExport,
) -> Result<(), ReportExportPortError> {
    let expected_query =
        report
            .definition
            .blocks()
            .iter()
            .find_map(|block| match block.content() {
                ReportBlockContent::TrainingFinding { query, .. }
                | ReportBlockContent::TrainingComparison { query }
                | ReportBlockContent::TrainingChart { query, .. }
                | ReportBlockContent::TrainingExactTable { query }
                | ReportBlockContent::TrainingCoverage { query } => Some(query),
                ReportBlockContent::SessionEvidence { .. }
                | ReportBlockContent::Route { .. }
                | ReportBlockContent::Narrative { .. }
                | ReportBlockContent::PlannedTraining { .. } => None,
            });
    let Some(expected_query) = expected_query else {
        return if report.training_comparison.is_none() {
            Ok(())
        } else {
            Err(invalid_comparison_evidence())
        };
    };
    let Some(comparison) = report.training_comparison.as_ref() else {
        return Err(invalid_comparison_evidence());
    };
    if comparison.baseline_range.as_ref().is_none_or(|range| {
        range.from != expected_query.baseline_range().from()
            || range.through != expected_query.baseline_range().through()
    }) || comparison.comparison_range.as_ref().is_none_or(|range| {
        range.from != expected_query.comparison_range().from()
            || range.through != expected_query.comparison_range().through()
    }) || comparison.series.is_empty()
    {
        return Err(invalid_comparison_evidence());
    }
    for series in &comparison.series {
        validate_training_summary(&series.baseline)?;
        validate_training_summary(&series.comparison)?;
        let expected_session_change = signed_change(
            series.baseline.session_count,
            series.comparison.session_count,
        )?;
        let expected_day_change = signed_change(
            series.baseline.training_days,
            series.comparison.training_days,
        )?;
        let Some(expected_duration_change) = series
            .comparison
            .total_duration_milliseconds
            .checked_sub(series.baseline.total_duration_milliseconds)
        else {
            return Err(invalid_comparison_evidence());
        };
        let expected_distance_change = match (
            series.baseline.total_distance_meters,
            series.comparison.total_distance_meters,
        ) {
            (Some(baseline), Some(comparison)) => Some(comparison - baseline),
            _ => None,
        };
        let expected_energy_change = match (
            series.baseline.total_energy_kilocalories,
            series.comparison.total_energy_kilocalories,
        ) {
            (Some(baseline), Some(comparison)) => Some(comparison - baseline),
            _ => None,
        };
        if series.series_ref.is_empty()
            || series.session_count_change != expected_session_change
            || series.training_day_change != expected_day_change
            || series.duration_milliseconds_change != expected_duration_change
            || series.distance_meters_change != expected_distance_change
            || series.energy_kilocalories_change != expected_energy_change
            || series
                .distance_meters_change
                .is_some_and(|value| !value.is_finite())
        {
            return Err(invalid_comparison_evidence());
        }
    }
    Ok(())
}

fn signed_change(baseline: usize, comparison: usize) -> Result<i128, ReportExportPortError> {
    let baseline = i128::try_from(baseline).map_err(|_| invalid_comparison_evidence())?;
    let comparison = i128::try_from(comparison).map_err(|_| invalid_comparison_evidence())?;
    comparison
        .checked_sub(baseline)
        .ok_or_else(invalid_comparison_evidence)
}

fn validate_training_summary(summary: &TrainingSeriesSummary) -> Result<(), ReportExportPortError> {
    if summary.calendar_days == 0
        || summary.training_days > summary.calendar_days
        || summary.total_duration_milliseconds < 0
        || summary.distance_session_count > summary.session_count
        || summary
            .total_distance_meters
            .is_some_and(|value| !value.is_finite() || value < 0.0)
        || summary.energy_session_count > summary.session_count
        || summary
            .total_energy_kilocalories
            .is_some_and(|value| value < 0)
        || summary.heart_rate_session_count > summary.session_count
    {
        return Err(invalid_comparison_evidence());
    }
    Ok(())
}

fn invalid_comparison_evidence() -> ReportExportPortError {
    ReportExportPortError::Failure("report training comparison evidence is inconsistent".to_owned())
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
    format_duration_i128(i128::from(milliseconds), labels)
}

fn format_duration_i128(milliseconds: i128, labels: &Labels) -> String {
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

struct SportIdentity {
    icon: &'static str,
    label: String,
}

fn sport_family_identity(family: &str, labels: &Labels) -> Option<(&'static str, &'static str)> {
    let families = labels.sport_families;
    match family {
        "running" => Some(("running", families.running)),
        "cycling" => Some(("cycling", families.cycling)),
        "swimming" => Some(("swimming", families.swimming)),
        "walking" => Some(("walking", families.walking)),
        "hiking" => Some(("hiking", families.hiking)),
        "strength" => Some(("strength", families.strength)),
        "mobility" => Some(("mobility", families.mobility)),
        "racket-sport" => Some(("racket-sport", families.racket_sport)),
        "team-sport" => Some(("team-sport", families.team_sport)),
        "winter-sport" => Some(("winter-sport", families.winter_sport)),
        "water-sport" => Some(("water-sport", families.water_sport)),
        "other" => Some(("other", families.other)),
        _ => None,
    }
}

fn sport_identity(sport: &TrainingSessionSport, labels: &Labels) -> SportIdentity {
    match sport.state {
        TrainingSportState::PersonallyOverridden => {
            let classification = sport.classification.as_ref();
            let family = classification
                .and_then(|value| value.canonical_family.as_deref())
                .and_then(|value| sport_family_identity(value, labels));
            SportIdentity {
                icon: family.map_or("custom", |(icon, _)| icon),
                label: classification
                    .and_then(|value| value.display_label.clone())
                    .or_else(|| family.map(|(_, label)| label.to_owned()))
                    .unwrap_or_else(|| labels.sport_unknown.to_owned()),
            }
        }
        TrainingSportState::Recognized => {
            let recognition = sport.recognition.as_ref();
            let family = recognition
                .and_then(|value| value.canonical_family.as_deref())
                .and_then(|value| sport_family_identity(value, labels));
            SportIdentity {
                icon: family.map_or("other", |(icon, _)| icon),
                label: recognition
                    .and_then(|value| {
                        localized_sport_name(&value.localized_names, labels.recognition_locale)
                    })
                    .map(str::to_owned)
                    .or_else(|| family.map(|(_, label)| label.to_owned()))
                    .unwrap_or_else(|| labels.sport_unknown.to_owned()),
            }
        }
        TrainingSportState::Ambiguous => SportIdentity {
            icon: "unknown",
            label: labels.sport_ambiguous.to_owned(),
        },
        TrainingSportState::Unknown => SportIdentity {
            icon: "unknown",
            label: labels.sport_unknown.to_owned(),
        },
        TrainingSportState::Unavailable => SportIdentity {
            icon: "unavailable",
            label: labels.sport_unavailable.to_owned(),
        },
    }
}

fn localized_sport_name<'a>(
    localized_names: &'a BTreeMap<String, String>,
    locale: &str,
) -> Option<&'a str> {
    localized_names
        .get(locale)
        .or_else(|| {
            locale
                .split_once('-')
                .and_then(|(language, _)| localized_names.get(language))
        })
        .or_else(|| localized_names.get("en"))
        .or_else(|| localized_names.values().next())
        .map(String::as_str)
}

fn push_sport_term(html: &mut String, term: &str, identity: &SportIdentity) {
    html.push_str("<dt>");
    html.push_str(term);
    html.push_str("</dt><dd><span class=\"sport-identity\"><svg class=\"sport-icon\" viewBox=\"0 0 32 32\" aria-hidden=\"true\" focusable=\"false\"><use href=\"#sport-icon-");
    html.push_str(identity.icon);
    html.push_str("\"></use></svg><span>");
    push_escaped(html, &identity.label);
    html.push_str("</span></span></dd>");
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

struct SportFamilyLabels {
    running: &'static str,
    cycling: &'static str,
    swimming: &'static str,
    walking: &'static str,
    hiking: &'static str,
    strength: &'static str,
    mobility: &'static str,
    racket_sport: &'static str,
    team_sport: &'static str,
    winter_sport: &'static str,
    water_sport: &'static str,
    other: &'static str,
}

struct Labels {
    recognition_locale: &'static str,
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
    sport_families: &'static SportFamilyLabels,
    exercises: &'static str,
    planned_training_evidence: &'static str,
    planned_source_evidence: &'static str,
    kind: &'static str,
    scheduled_training: &'static str,
    favorite_template: &'static str,
    scheduled_for: &'static str,
    completion: &'static str,
    pending: &'static str,
    completed: &'static str,
    mapping_complete: &'static str,
    mapping_partial: &'static str,
    unmapped_fields: &'static str,
    source_evidence_revision: &'static str,
    unique_phases: &'static str,
    expanded_phases: &'static str,
    repeat_blocks: &'static str,
    completed_session: &'static str,
    not_applicable: &'static str,
    no_related_session: &'static str,
    related_session: &'static str,
    ambiguous_relation: &'static str,
    exercise: &'static str,
    phases: &'static str,
    phase: &'static str,
    goal: &'static str,
    intensity: &'static str,
    transition: &'static str,
    duration_goal: &'static str,
    distance_goal: &'static str,
    open_exercise: &'static str,
    phased_exercise: &'static str,
    volume_exercise: &'static str,
    strength_exercise: &'static str,
    exercises_unavailable: &'static str,
    unmapped: &'static str,
    no_intensity: &'static str,
    heart_rate_zones: &'static str,
    speed_zones: &'static str,
    power_zones: &'static str,
    manual_transition: &'static str,
    automatic_transition: &'static str,
    repeat_from_phase: &'static str,
    for_total_iterations: &'static str,
    total_iterations: &'static str,
    route: &'static str,
    precise_location: &'static str,
    route_omitted: &'static str,
    route_fully_redacted: &'static str,
    route_kind: &'static str,
    route_source_points: &'static str,
    endpoint_redaction: &'static str,
    primary_route: &'static str,
    transition_route: &'static str,
    recorded_points: &'static str,
    metres: &'static str,
    interpretation: &'static str,
    user_authored: &'static str,
    training_finding: &'static str,
    training_comparison: &'static str,
    training_chart: &'static str,
    training_exact_table: &'static str,
    training_coverage: &'static str,
    fitfreed_calculation: &'static str,
    comparison_unavailable: &'static str,
    comparison_limitation: &'static str,
    coverage_limitation: &'static str,
    metric: &'static str,
    baseline: &'static str,
    comparison: &'static str,
    change: &'static str,
    coverage_measurement: &'static str,
    training_history: &'static str,
    source_series: &'static str,
    sessions: &'static str,
    training_days: &'static str,
    heart_rate: &'static str,
    unavailable: &'static str,
    limitations: &'static str,
    no_known_limitations: &'static str,
    provenance: &'static str,
    current_attribution: &'static str,
    library_snapshot_attribution: &'static str,
    planned_snapshot_attribution: &'static str,
    authored_only_attribution: &'static str,
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
    sport_unknown: &'static str,
    sport_ambiguous: &'static str,
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

static EN_US_SPORT_FAMILIES: SportFamilyLabels = SportFamilyLabels {
    running: "Running",
    cycling: "Cycling",
    swimming: "Swimming",
    walking: "Walking",
    hiking: "Hiking",
    strength: "Strength",
    mobility: "Mobility",
    racket_sport: "Racket sport",
    team_sport: "Team sport",
    winter_sport: "Winter sport",
    water_sport: "Water sport",
    other: "Other",
};

static EN_US: Labels = Labels {
    recognition_locale: "en-US",
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
    sport_families: &EN_US_SPORT_FAMILIES,
    exercises: "Exercises",
    planned_training_evidence: "Planned training evidence",
    planned_source_evidence: "Planned intent imported from the identified local source revision",
    kind: "Kind",
    scheduled_training: "Scheduled training",
    favorite_template: "Favorite template",
    scheduled_for: "Scheduled for",
    completion: "Completion",
    pending: "Pending",
    completed: "Completed",
    mapping_complete: "Complete",
    mapping_partial: "Partial",
    unmapped_fields: "Unmapped source fields",
    source_evidence_revision: "Source evidence revision",
    unique_phases: "Defined phases",
    expanded_phases: "Expanded phases",
    repeat_blocks: "Repeat blocks",
    completed_session: "Completed session",
    not_applicable: "Not applicable",
    no_related_session: "No related session",
    related_session: "One related session",
    ambiguous_relation: "Multiple possible related sessions",
    exercise: "Exercise",
    phases: "Phases",
    phase: "Phase",
    goal: "Goal",
    intensity: "Intensity",
    transition: "Transition",
    duration_goal: "Duration goal",
    distance_goal: "Distance goal",
    open_exercise: "Open exercise",
    phased_exercise: "Phased exercise",
    volume_exercise: "Volume exercise",
    strength_exercise: "Strength exercise",
    exercises_unavailable: "The source evidence does not contain a structured exercise definition.",
    unmapped: "Not interpreted",
    no_intensity: "No intensity target",
    heart_rate_zones: "Heart-rate zones",
    speed_zones: "Speed zones",
    power_zones: "Power zones",
    manual_transition: "Manual transition",
    automatic_transition: "Automatic transition",
    repeat_from_phase: "Repeat from phase",
    for_total_iterations: "for",
    total_iterations: "total iterations",
    route: "Route",
    precise_location: "Recorded location evidence with user-reviewed endpoint privacy",
    route_omitted: "Route geometry was omitted during privacy review.",
    route_fully_redacted: "No recorded route point remains after endpoint redaction.",
    route_kind: "Route kind",
    route_source_points: "Recorded points",
    endpoint_redaction: "Endpoint redaction",
    primary_route: "Primary route",
    transition_route: "Transition route",
    recorded_points: "recorded points",
    metres: "m",
    interpretation: "User commentary",
    user_authored: "User-authored text",
    training_finding: "Training finding",
    training_comparison: "Training period comparison",
    training_chart: "Training comparison chart",
    training_exact_table: "Exact training values",
    training_coverage: "Training coverage and limitations",
    fitfreed_calculation: "FitFreed calculation from recorded training evidence",
    comparison_unavailable: "The selected metric is unavailable for one or both periods.",
    comparison_limitation:
        "This is a descriptive comparison of recorded evidence; it does not establish causation or provide advice.",
    coverage_limitation:
        "Coverage counts describe recorded availability. Missing measurements are not represented as zero.",
    metric: "Metric",
    baseline: "Baseline",
    comparison: "Comparison",
    change: "Change",
    coverage_measurement: "Coverage",
    training_history: "Training history",
    source_series: "Source series",
    sessions: "Recorded sessions",
    training_days: "Training days",
    heart_rate: "Heart rate",
    unavailable: "Unavailable",
    limitations: "Coverage and limitations",
    no_known_limitations: "No known limitations affect this version-1 summary.",
    provenance: "Provenance",
    current_attribution: "Current contributing source attribution",
    library_snapshot_attribution:
        "Calculated from the identified revision of the locally imported training library.",
    planned_snapshot_attribution:
        "Resolved from the identified revision of the locally imported planned-training library.",
    authored_only_attribution:
        "This report currently contains user-authored content and no imported evidence.",
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
    sport_unknown: "Unknown sport",
    sport_ambiguous: "Sport identity needs review",
    sport_unavailable: "Sport unavailable",
    sport_unclassified_limitation:
        "The recorded sport could not be identified unambiguously from the available evidence.",
    sport_unavailable_limitation: "The source did not provide a sport reference.",
};

static ES_ES_SPORT_FAMILIES: SportFamilyLabels = SportFamilyLabels {
    running: "Carrera",
    cycling: "Ciclismo",
    swimming: "Natación",
    walking: "Caminata",
    hiking: "Senderismo",
    strength: "Fuerza",
    mobility: "Movilidad",
    racket_sport: "Deporte de raqueta",
    team_sport: "Deporte de equipo",
    winter_sport: "Deporte de invierno",
    water_sport: "Deporte acuático",
    other: "Otro",
};

static ES_ES: Labels = Labels {
    recognition_locale: "es-ES",
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
    sport_families: &ES_ES_SPORT_FAMILIES,
    exercises: "Ejercicios",
    planned_training_evidence: "Evidencias del entrenamiento planificado",
    planned_source_evidence:
        "Intención planificada importada de la revisión local identificada del origen",
    kind: "Tipo",
    scheduled_training: "Entrenamiento programado",
    favorite_template: "Plantilla favorita",
    scheduled_for: "Programado para",
    completion: "Realización",
    pending: "Pendiente",
    completed: "Completado",
    mapping_complete: "Completo",
    mapping_partial: "Parcial",
    unmapped_fields: "Campos del origen sin interpretar",
    source_evidence_revision: "Revisión de las evidencias de origen",
    unique_phases: "Fases definidas",
    expanded_phases: "Fases expandidas",
    repeat_blocks: "Bloques de repetición",
    completed_session: "Sesión completada",
    not_applicable: "No aplicable",
    no_related_session: "Sin sesión relacionada",
    related_session: "Una sesión relacionada",
    ambiguous_relation: "Varias sesiones posiblemente relacionadas",
    exercise: "Ejercicio",
    phases: "Fases",
    phase: "Fase",
    goal: "Objetivo",
    intensity: "Intensidad",
    transition: "Transición",
    duration_goal: "Objetivo de duración",
    distance_goal: "Objetivo de distancia",
    open_exercise: "Ejercicio abierto",
    phased_exercise: "Ejercicio por fases",
    volume_exercise: "Ejercicio por volumen",
    strength_exercise: "Ejercicio de fuerza",
    exercises_unavailable:
        "Las evidencias de origen no contienen una definición estructurada del ejercicio.",
    unmapped: "Sin interpretar",
    no_intensity: "Sin objetivo de intensidad",
    heart_rate_zones: "Zonas de frecuencia cardíaca",
    speed_zones: "Zonas de velocidad",
    power_zones: "Zonas de potencia",
    manual_transition: "Transición manual",
    automatic_transition: "Transición automática",
    repeat_from_phase: "Repetir desde la fase",
    for_total_iterations: "hasta completar",
    total_iterations: "iteraciones",
    route: "Ruta",
    precise_location:
        "Evidencias de ubicación registradas con privacidad de extremos revisada por el usuario",
    route_omitted: "La geometría de la ruta se omitió durante la revisión de privacidad.",
    route_fully_redacted:
        "No queda ningún punto registrado de la ruta después de ocultar los extremos.",
    route_kind: "Tipo de ruta",
    route_source_points: "Puntos registrados",
    endpoint_redaction: "Ocultación de extremos",
    primary_route: "Ruta principal",
    transition_route: "Ruta de transición",
    recorded_points: "puntos registrados",
    metres: "m",
    interpretation: "Comentarios de la persona usuaria",
    user_authored: "Texto escrito por el usuario",
    training_finding: "Conclusión sobre los entrenamientos",
    training_comparison: "Comparación de periodos de entrenamiento",
    training_chart: "Gráfico comparativo de entrenamientos",
    training_exact_table: "Valores exactos de entrenamiento",
    training_coverage: "Cobertura y limitaciones de entrenamiento",
    fitfreed_calculation: "Cálculo de FitFreed a partir de evidencias de entrenamiento registradas",
    comparison_unavailable: "La métrica seleccionada no está disponible en uno o ambos periodos.",
    comparison_limitation:
        "Esta comparación describe evidencias registradas; no establece causalidad ni ofrece recomendaciones.",
    coverage_limitation:
        "Los recuentos de cobertura describen la disponibilidad registrada. Las mediciones ausentes no se representan como cero.",
    metric: "Métrica",
    baseline: "Periodo de referencia",
    comparison: "Periodo comparado",
    change: "Cambio",
    coverage_measurement: "Cobertura",
    training_history: "Historial de entrenamiento",
    source_series: "Serie de origen",
    sessions: "Sesiones registradas",
    training_days: "Días de entrenamiento",
    heart_rate: "Frecuencia cardíaca",
    unavailable: "No disponible",
    limitations: "Cobertura y limitaciones",
    no_known_limitations: "No hay limitaciones conocidas que afecten a este resumen de versión 1.",
    provenance: "Procedencia",
    current_attribution: "Atribución actual del origen contribuyente",
    library_snapshot_attribution:
        "Calculado a partir de la revisión identificada de la biblioteca local de entrenamientos importados.",
    planned_snapshot_attribution:
        "Resuelto a partir de la revisión identificada de la biblioteca local importada de entrenamientos planificados.",
    authored_only_attribution:
        "Este informe contiene actualmente texto escrito por el usuario y ninguna evidencia importada.",
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
    sport_unknown: "Deporte desconocido",
    sport_ambiguous: "La identidad del deporte necesita revisión",
    sport_unavailable: "Deporte no disponible",
    sport_unclassified_limitation:
        "No se pudo identificar inequívocamente el deporte registrado con las evidencias disponibles.",
    sport_unavailable_limitation: "El origen no proporcionó una referencia de deporte.",
};

#[cfg(test)]
mod tests {
    use std::{collections::BTreeMap, fs};

    use fitfreed_application::{
        PlannedTrainingPlanShape, PlannedTrainingReconciliationState, PlannedTrainingTargetDetail,
        PlannedTrainingTargetSummary, ReportPlannedTrainingEvidence, ReportSessionEvidence,
        TrainingComparison, TrainingDateRange, TrainingProvenanceCurrentView,
        TrainingRoutePointView, TrainingSeriesComparison, TrainingSeriesSummary,
        TrainingSessionSport, TrainingSourceProviderView, TrainingSportClassification,
        TrainingSportRecognition,
    };
    use fitfreed_domain::{
        PlannedTrainingCompletion, PlannedTrainingEditability, PlannedTrainingExercise,
        PlannedTrainingExerciseKind, PlannedTrainingIntensity, PlannedTrainingIntensityMetric,
        PlannedTrainingMappingCoverage, PlannedTrainingPhase, PlannedTrainingPhaseChange,
        PlannedTrainingPhaseGoal, PlannedTrainingRepeat, PlannedTrainingSessionRelation,
        PlannedTrainingSport, PlannedTrainingTarget, PlannedTrainingTargetKind,
        PlannedTrainingTransition, ReportBlock, ReportDateRange, ReportDefinition, ReportOrigin,
        ReportQuestion, ReportTrainingComparisonQuery, ReportTrainingMetric,
        REPORT_DEFINITION_VERSION,
    };
    use tempfile::tempdir;

    use super::*;

    fn report(locale: ReportLocale, include_physiological_context: bool) -> AuthorizedReportExport {
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
        AuthorizedReportExport {
            definition,
            resolved_snapshot_ref:
                "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                    .to_owned(),
            session: Some(ReportSessionEvidence {
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
                    recognition: None,
                    recognition_candidate_count: 0,
                },
            }),
            routes: vec![],
            training_comparison: None,
            planned_training: None,
            provenance: ReportEvidenceProvenance::Session(TrainingProvenanceCurrentView {
                provider: TrainingSourceProviderView::restore("polar-flow".to_owned())
                    .expect("provider"),
                source_modified_at_utc: "2026-08-18T08:00:00Z".to_owned(),
                source_adapter_version: "polar-flow-archive@11".to_owned(),
                mapping_version: "polar-flow-training-session@6".to_owned(),
                contributing_event_count: 2,
                non_contributing_event_count: 1,
            }),
            limitations: vec![ReportLimitation::SportUnavailable],
            include_physiological_context,
        }
    }

    fn routed_report(included: bool) -> AuthorizedReportExport {
        let mut resolved = report(ReportLocale::EnUs, false);
        let session_ref = resolved
            .session
            .as_ref()
            .expect("session evidence")
            .session_ref
            .clone();
        let route_ref = "route-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let route_block_ref =
            "report-block-1111111111111111111111111111111111111111111111111111111111111111";
        resolved.definition = ReportDefinition::compose_session_report(
            resolved.definition.report_ref(),
            resolved.definition.title(),
            resolved.definition.locale(),
            resolved.definition.source_snapshot_ref(),
            &session_ref,
            vec![
                ReportBlock::route(route_block_ref, &session_ref, route_ref, 200)
                    .expect("route block"),
                resolved.definition.blocks()[1].clone(),
                resolved.definition.blocks()[0].clone(),
            ],
        )
        .expect("routed report definition");
        resolved.routes = vec![ReportRouteEvidence {
            block_ref: route_block_ref.to_owned(),
            route_ref: route_ref.to_owned(),
            kind: TrainingRouteKindView::Primary,
            started_at_local: "2026-08-18T07:30:00.000".to_owned(),
            source_point_count: 4,
            visual_points: if included {
                vec![
                    TrainingRoutePointView {
                        ordinal: 1,
                        latitude_degrees: 40.123,
                        longitude_degrees: -3.456,
                        altitude_meters: None,
                        elapsed_milliseconds: Some(60_000),
                    },
                    TrainingRoutePointView {
                        ordinal: 2,
                        latitude_degrees: 40.124,
                        longitude_degrees: -3.455,
                        altitude_meters: None,
                        elapsed_milliseconds: Some(120_000),
                    },
                ]
            } else {
                Vec::new()
            },
            endpoint_redaction_meters: 200,
            included,
        }];
        resolved
    }

    fn analytical_report(locale: ReportLocale) -> AuthorizedReportExport {
        let mut resolved = report(locale, false);
        let session_ref = resolved
            .session
            .as_ref()
            .expect("session evidence")
            .session_ref
            .clone();
        let query = ReportTrainingComparisonQuery::new(
            ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline range"),
            ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison range"),
        );
        resolved.definition = ReportDefinition::compose_session_report(
            resolved.definition.report_ref(),
            resolved.definition.title(),
            resolved.definition.locale(),
            resolved.definition.source_snapshot_ref(),
            &session_ref,
            vec![
                ReportBlock::training_finding(
                    format!("report-block-{}", "2".repeat(64)),
                    query.clone(),
                    ReportTrainingMetric::SessionCount,
                )
                .expect("finding"),
                ReportBlock::training_comparison(
                    format!("report-block-{}", "3".repeat(64)),
                    query.clone(),
                )
                .expect("comparison"),
                resolved.definition.blocks()[0].clone(),
                ReportBlock::training_chart(
                    format!("report-block-{}", "4".repeat(64)),
                    query.clone(),
                    ReportTrainingMetric::Duration,
                )
                .expect("chart"),
                ReportBlock::training_exact_table(
                    format!("report-block-{}", "5".repeat(64)),
                    query.clone(),
                )
                .expect("table"),
                ReportBlock::training_coverage(format!("report-block-{}", "6".repeat(64)), query)
                    .expect("coverage"),
                resolved.definition.blocks()[1].clone(),
            ],
        )
        .expect("analytical definition");
        let summary =
            |session_count: usize, training_days: usize, duration: i128| TrainingSeriesSummary {
                calendar_days: 31,
                training_days,
                session_count,
                total_duration_milliseconds: duration,
                distance_session_count: session_count,
                total_distance_meters: Some(session_count as f64 * 10_000.0),
                energy_session_count: session_count,
                total_energy_kilocalories: Some(session_count as i128 * 500),
                heart_rate_session_count: session_count.saturating_sub(1),
            };
        resolved.training_comparison = Some(TrainingComparison {
            available_range: Some(TrainingDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-02-28".to_owned(),
            }),
            baseline_range: Some(TrainingDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-31".to_owned(),
            }),
            comparison_range: Some(TrainingDateRange {
                from: "2026-02-01".to_owned(),
                through: "2026-02-28".to_owned(),
            }),
            series: vec![TrainingSeriesComparison {
                series_ref: "opaque-series-must-not-leave".to_owned(),
                baseline: summary(1, 1, 3_600_000),
                comparison: summary(2, 2, 7_200_000),
                session_count_change: 1,
                training_day_change: 1,
                duration_milliseconds_change: 3_600_000,
                distance_meters_change: Some(10_000.0),
                energy_kilocalories_change: Some(500),
            }],
        });
        resolved
    }

    fn blank_report() -> AuthorizedReportExport {
        let definition = ReportDefinition::compose_report(
            "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "My <training> notes",
            ReportLocale::EnUs,
            "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            ReportOrigin::Blank,
            vec![ReportBlock::narrative(
                "report-block-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
                "Only my words & <script>never code</script>.",
            )
            .expect("narrative block")],
        )
        .expect("blank report definition");
        AuthorizedReportExport {
            definition,
            resolved_snapshot_ref:
                "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                    .to_owned(),
            session: None,
            routes: Vec::new(),
            training_comparison: None,
            planned_training: None,
            provenance: ReportEvidenceProvenance::AuthoredOnly,
            limitations: Vec::new(),
            include_physiological_context: false,
        }
    }

    fn question_report() -> AuthorizedReportExport {
        let mut resolved = analytical_report(ReportLocale::EnUs);
        let blocks = resolved
            .definition
            .blocks()
            .iter()
            .filter(|block| !matches!(block.content(), ReportBlockContent::SessionEvidence { .. }))
            .cloned()
            .collect();
        resolved.definition = ReportDefinition::compose_report(
            resolved.definition.report_ref(),
            "How has my recent training changed?",
            ReportLocale::EnUs,
            resolved.definition.source_snapshot_ref(),
            ReportOrigin::Question {
                question: ReportQuestion::TrainingPeriodComparisonV1,
            },
            blocks,
        )
        .expect("question report definition");
        resolved.session = None;
        resolved.provenance = ReportEvidenceProvenance::LibrarySnapshot;
        resolved.limitations = Vec::new();
        resolved
    }

    fn planned_training_report(locale: ReportLocale) -> AuthorizedReportExport {
        let target_ref = format!("planned-target-{}", "1".repeat(64));
        let block_ref = format!("report-block-{}", "2".repeat(64));
        let snapshot_ref = format!("planned-snapshot-{}", "3".repeat(64));
        let target = PlannedTrainingTarget::restore(
            "provider-neutral-origin-1",
            &target_ref,
            format!("planned-evidence-{}", "4".repeat(64)),
            PlannedTrainingTargetKind::Scheduled {
                scheduled_at_local: "2026-08-30T08:00:00".to_owned(),
                completion: PlannedTrainingCompletion::Pending,
            },
            "Progressive <intervals>",
            Some("Four controlled efforts & recovery.".to_owned()),
            PlannedTrainingEditability::Editable,
            Some(vec![PlannedTrainingExercise {
                exercise_id: format!("planned-exercise-{}", "5".repeat(64)),
                ordinal: 0,
                kind: PlannedTrainingExerciseKind::Phased,
                duration_goal_milliseconds: Some(1_800_000),
                distance_goal_meters: None,
                sport: PlannedTrainingSport::Unavailable,
                phases: Some(vec![
                    PlannedTrainingPhase {
                        phase_id: format!("planned-phase-{}", "6".repeat(64)),
                        ordinal: 0,
                        name: "Warm-up".to_owned(),
                        goal: PlannedTrainingPhaseGoal::DurationMilliseconds(300_000),
                        intensity: PlannedTrainingIntensity::ZoneRange {
                            metric: PlannedTrainingIntensityMetric::HeartRate,
                            lower_zone: 1,
                            upper_zone: 2,
                        },
                        transition: PlannedTrainingTransition {
                            transition_id: format!("planned-transition-{}", "7".repeat(64)),
                            change: PlannedTrainingPhaseChange::Automatic,
                            repeat: None,
                        },
                    },
                    PlannedTrainingPhase {
                        phase_id: format!("planned-phase-{}", "8".repeat(64)),
                        ordinal: 1,
                        name: "Controlled effort".to_owned(),
                        goal: PlannedTrainingPhaseGoal::DistanceMeters(1_000.0),
                        intensity: PlannedTrainingIntensity::ZoneRange {
                            metric: PlannedTrainingIntensityMetric::HeartRate,
                            lower_zone: 2,
                            upper_zone: 4,
                        },
                        transition: PlannedTrainingTransition {
                            transition_id: format!("planned-transition-{}", "9".repeat(64)),
                            change: PlannedTrainingPhaseChange::Manual,
                            repeat: Some(PlannedTrainingRepeat {
                                repeat_id: format!("planned-repeat-{}", "a".repeat(64)),
                                return_to_phase_ordinal: 0,
                                total_iterations: 4,
                            }),
                        },
                    },
                ]),
            }]),
            PlannedTrainingMappingCoverage::complete(),
        )
        .expect("planned target");
        let detail = PlannedTrainingTargetDetail {
            snapshot_ref: snapshot_ref.clone(),
            target: PlannedTrainingTargetSummary {
                source_index: 1,
                reconciliation_state: PlannedTrainingReconciliationState::Current,
                target,
                relation: PlannedTrainingSessionRelation::Absent,
                shape: PlannedTrainingPlanShape {
                    exercise_count: Some(1),
                    phase_count: Some(2),
                    expanded_phase_count: Some(8),
                    repeat_block_count: Some(1),
                    contains_intensity_evidence: true,
                },
            },
        };
        let definition = ReportDefinition::compose_report(
            format!("report-{}", "b".repeat(64)),
            "Planned session",
            locale,
            &snapshot_ref,
            ReportOrigin::PlannedTraining {
                target_ref: target_ref.clone(),
            },
            vec![
                ReportBlock::planned_training(&block_ref, &target_ref)
                    .expect("planned-training block"),
                ReportBlock::narrative(
                    format!("report-block-{}", "c".repeat(64)),
                    "My pacing notes.",
                )
                .expect("narrative block"),
            ],
        )
        .expect("planned report definition");
        AuthorizedReportExport {
            definition,
            resolved_snapshot_ref: snapshot_ref,
            session: None,
            routes: Vec::new(),
            training_comparison: None,
            planned_training: Some(ReportPlannedTrainingEvidence {
                block_ref,
                target: detail,
            }),
            provenance: ReportEvidenceProvenance::PlannedTrainingSnapshot,
            limitations: Vec::new(),
            include_physiological_context: false,
        }
    }

    #[test]
    fn renders_planned_training_evidence_semantically_in_both_locales() {
        for locale in [ReportLocale::EnUs, ReportLocale::EsEs] {
            let html = render_report(
                &planned_training_report(locale),
                &ReportExportCancellation::new(),
            )
            .expect("planned report HTML");

            assert!(html.contains("data-fitfreed-output-version=\"7\""));
            assert!(html.contains("Progressive &lt;intervals&gt;"));
            assert!(html.contains("Four controlled efforts &amp; recovery."));
            assert!(html.contains("Warm-up"));
            assert!(html.contains("Controlled effort"));
            assert!(html.contains("data-unit=\"ms\""));
            assert!(html.contains("data-unit=\"m\""));
            assert!(html.contains(match locale {
                ReportLocale::EnUs => "Planned training evidence",
                ReportLocale::EsEs => "Evidencias del entrenamiento planificado",
            }));
            assert!(html.contains(match locale {
                ReportLocale::EnUs => "Heart-rate zones 2–4",
                ReportLocale::EsEs => "Zonas de frecuencia cardíaca 2–4",
            }));
            assert!(html.contains(match locale {
                ReportLocale::EnUs => "Repeat from phase 1 for 4 total iterations",
                ReportLocale::EsEs => "Repetir desde la fase 1 hasta completar 4 iteraciones",
            }));
            assert!(html.contains(match locale {
                ReportLocale::EnUs => "identified revision of the locally imported planned-training library",
                ReportLocale::EsEs => "revisión identificada de la biblioteca local importada de entrenamientos planificados",
            }));
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
            assert!(html.contains("polar-flow-training-session@6"));
            assert!(html.contains(match locale {
                ReportLocale::EnUs => "User commentary",
                ReportLocale::EsEs => "Comentarios de la persona usuaria",
            }));
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
    fn renders_localized_and_authored_sport_identities_with_semantic_icons() {
        let mut recognized_report = report(ReportLocale::EsEs, false);
        recognized_report.session.as_mut().expect("session").sport = TrainingSessionSport {
            sport_ref: Some(
                "sport-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_owned(),
            ),
            state: TrainingSportState::Recognized,
            classification: Some(TrainingSportClassification {
                canonical_family: None,
                display_label: None,
                authorship: None,
                revision: 0,
            }),
            recognition: Some(TrainingSportRecognition {
                canonical_family: Some("running".to_owned()),
                localized_names: BTreeMap::from([
                    ("en".to_owned(), "Road running".to_owned()),
                    ("es".to_owned(), "Carrera en asfalto".to_owned()),
                ]),
                catalogue_revision: "catalogue-2026-08-25".to_owned(),
                retrieved_at_utc: "2026-08-25T10:00:00Z".to_owned(),
                mapping_version: "sport-mapping@1".to_owned(),
                evidence_ref:
                    "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                        .to_owned(),
            }),
            recognition_candidate_count: 1,
        };
        let recognized_html = render_report(&recognized_report, &ReportExportCancellation::new())
            .expect("recognized report");
        assert!(recognized_html.contains("href=\"#sport-icon-running\""));
        assert!(recognized_html.contains(">Carrera en asfalto<"));
        assert!(!recognized_html.contains(">Road running<"));

        let mut family_report = report(ReportLocale::EsEs, false);
        family_report.session.as_mut().expect("session").sport = TrainingSessionSport {
            sport_ref: Some(
                "sport-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_owned(),
            ),
            state: TrainingSportState::PersonallyOverridden,
            classification: Some(TrainingSportClassification {
                canonical_family: Some("water-sport".to_owned()),
                display_label: None,
                authorship: Some("user".to_owned()),
                revision: 1,
            }),
            recognition: None,
            recognition_candidate_count: 0,
        };
        let family_html =
            render_report(&family_report, &ReportExportCancellation::new()).expect("family report");
        assert!(family_html.contains("href=\"#sport-icon-water-sport\""));
        assert!(family_html.contains(">Deporte acuático<"));
        assert!(!family_html.contains(">water-sport<"));

        let mut authored_report = report(ReportLocale::EnUs, false);
        authored_report.session.as_mut().expect("session").sport = TrainingSessionSport {
            sport_ref: Some(
                "sport-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_owned(),
            ),
            state: TrainingSportState::PersonallyOverridden,
            classification: Some(TrainingSportClassification {
                canonical_family: None,
                display_label: Some("River paddling".to_owned()),
                authorship: Some("user".to_owned()),
                revision: 1,
            }),
            recognition: None,
            recognition_candidate_count: 0,
        };
        let authored_html = render_report(&authored_report, &ReportExportCancellation::new())
            .expect("authored report");
        assert!(authored_html.contains("href=\"#sport-icon-custom\""));
        assert!(authored_html.contains(">River paddling<"));
    }

    #[test]
    fn renders_ordered_local_route_svg_without_exporting_recorded_coordinates() {
        let html = render_report(&routed_report(true), &ReportExportCancellation::new())
            .expect("routed report");

        assert!(html.contains(&format!(
            "data-fitfreed-report-version=\"{REPORT_DEFINITION_VERSION}\""
        )));
        assert!(html.contains("data-fitfreed-output-version=\"7\""));
        assert!(html.contains("<svg class=\"route-visual\""));
        assert!(
            html.find(">Route</h2>").expect("route section")
                < html
                    .find(">User commentary</h2>")
                    .expect("narrative section")
        );
        assert!(
            html.find(">User commentary</h2>")
                .expect("narrative section")
                < html
                    .find(">Session evidence</h2>")
                    .expect("session section")
        );
        assert!(!html.contains("40.123"));
        assert!(!html.contains("-3.456"));
        assert!(!html.contains("http://"));
        assert!(!html.contains("https://"));

        let omitted = render_report(&routed_report(false), &ReportExportCancellation::new())
            .expect("omitted route report");
        assert!(omitted.contains("Route geometry was omitted during privacy review."));
        assert!(!omitted.contains("<svg class=\"route-visual\""));
    }

    #[test]
    fn renders_each_analytical_view_from_one_exact_comparison_without_opaque_identity() {
        for (locale, expected_heading) in [
            (ReportLocale::EnUs, "Training finding"),
            (ReportLocale::EsEs, "Conclusión sobre los entrenamientos"),
        ] {
            let report = analytical_report(locale);
            let first = render_report(&report, &ReportExportCancellation::new())
                .expect("analytical report");
            let second = render_report(&report, &ReportExportCancellation::new())
                .expect("deterministic analytical report");
            assert_eq!(first, second);
            assert!(first.contains(expected_heading));
            assert!(first.contains("<svg class=\"comparison-chart\""));
            assert!(first.contains("role=\"img\""));
            assert!(first.contains(match locale {
                ReportLocale::EnUs => ">Training history — Duration</title>",
                ReportLocale::EsEs => ">Historial de entrenamiento — Duración</title>",
            }));
            assert!(first.contains("<table>"));
            assert!(first.contains("data-unit=\"ms\""));
            assert!(first.contains("2026-01-01 – 2026-01-31"));
            assert!(first.contains("2026-02-01 – 2026-02-28"));
            assert!(!first.contains("opaque-series-must-not-leave"));
            assert!(!first.contains("<script"));
            assert!(!first.contains("class=\"comparison-bars\""));
            assert!(!first.contains("http://"));
            assert!(!first.contains("https://"));
            let finding = first.find(expected_heading).expect("finding order");
            let comparison = first
                .find(match locale {
                    ReportLocale::EnUs => "Training period comparison",
                    ReportLocale::EsEs => "Comparación de periodos de entrenamiento",
                })
                .expect("comparison order");
            assert!(finding < comparison);
        }
    }

    #[test]
    fn renders_non_session_reports_without_inventing_session_or_provider_evidence() {
        let blank =
            render_report(&blank_report(), &ReportExportCancellation::new()).expect("blank report");
        assert!(blank.contains("My &lt;training&gt; notes"));
        assert!(blank.contains("Only my words &amp; &lt;script&gt;never code&lt;/script&gt;."));
        assert!(blank.contains(
            "This report currently contains user-authored content and no imported evidence."
        ));
        assert!(!blank.contains("Session evidence"));
        assert!(!blank.contains("Polar Flow"));
        assert!(!blank.contains("polar-flow-training-session"));

        let question = render_report(&question_report(), &ReportExportCancellation::new())
            .expect("question report");
        assert!(question.contains("How has my recent training changed?"));
        assert!(question.contains(
            "Calculated from the identified revision of the locally imported training library."
        ));
        assert!(question.contains("Training finding"));
        assert!(!question.contains("Session evidence"));
        assert!(!question.contains("Polar Flow"));
        assert!(!question.contains("polar-flow-training-session"));
    }

    #[test]
    fn renders_a_factual_question_report_without_manufacturing_authored_commentary() {
        let mut factual = question_report();
        let blocks = factual
            .definition
            .blocks()
            .iter()
            .filter(|block| !matches!(block.content(), ReportBlockContent::Narrative { .. }))
            .cloned()
            .collect();
        factual.definition = ReportDefinition::compose_report(
            factual.definition.report_ref(),
            factual.definition.title(),
            factual.definition.locale(),
            factual.definition.source_snapshot_ref(),
            factual.definition.origin().clone(),
            blocks,
        )
        .expect("factual question report definition");

        let html = render_report(&factual, &ReportExportCancellation::new())
            .expect("factual question report");

        assert!(html.contains("How has my recent training changed?"));
        assert!(html.contains("Training finding"));
        assert!(!html.contains("User commentary"));
        assert!(!html.contains("class=\"narrative\""));
    }

    #[test]
    fn rejects_missing_or_inconsistent_training_comparison_evidence() {
        let mut missing = analytical_report(ReportLocale::EnUs);
        missing.training_comparison = None;
        assert!(matches!(
            render_report(&missing, &ReportExportCancellation::new()),
            Err(ReportExportPortError::Failure(_))
        ));

        let mut inconsistent = analytical_report(ReportLocale::EnUs);
        inconsistent
            .training_comparison
            .as_mut()
            .expect("comparison")
            .series[0]
            .duration_milliseconds_change = 1;
        assert!(matches!(
            render_report(&inconsistent, &ReportExportCancellation::new()),
            Err(ReportExportPortError::Failure(_))
        ));

        let mut invalid_number = analytical_report(ReportLocale::EnUs);
        invalid_number
            .training_comparison
            .as_mut()
            .expect("comparison")
            .series[0]
            .comparison
            .total_distance_meters = Some(f64::NAN);
        assert!(matches!(
            render_report(&invalid_number, &ReportExportCancellation::new()),
            Err(ReportExportPortError::Failure(_))
        ));
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
        invalid
            .session
            .as_mut()
            .expect("session evidence")
            .distance_meters = Some(f64::NAN);
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
