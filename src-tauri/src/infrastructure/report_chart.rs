use plotters::prelude::{
    ChartBuilder, Color, IntoDrawingArea, IntoFont, IntoSegmentedCoord, RGBColor, Rectangle,
    SVGBackend, SegmentValue, Text, BLACK, WHITE,
};

const WIDTH: u32 = 720;
const HEIGHT: u32 = 320;
const MAX_SVG_BYTES: usize = 96 * 1024;
const SVG_NAMESPACE_DECLARATION: &str = " xmlns=\"http://www.w3.org/2000/svg\"";
const INK: RGBColor = RGBColor(23, 33, 28);
const MUTED: RGBColor = RGBColor(66, 81, 73);
const GRID: RGBColor = RGBColor(202, 211, 204);
const BASELINE: RGBColor = RGBColor(39, 103, 73);
const COMPARISON: RGBColor = RGBColor(154, 93, 20);

pub(super) struct StaticComparisonChart<'a> {
    pub id: &'a str,
    pub title: &'a str,
    pub description: &'a str,
    pub axis_label: &'a str,
    pub baseline_label: &'a str,
    pub comparison_label: &'a str,
    pub unavailable_label: &'a str,
    pub baseline_value: Option<f64>,
    pub comparison_value: Option<f64>,
    pub decimal_separator: char,
}

pub(super) fn render_static_comparison_chart(
    input: &StaticComparisonChart<'_>,
) -> Result<String, String> {
    validate_input(input)?;
    let maximum = [input.baseline_value, input.comparison_value]
        .into_iter()
        .flatten()
        .fold(0.0_f64, f64::max);
    let upper_bound = if maximum > 0.0 {
        (maximum * 1.15).max(1.0)
    } else {
        1.0
    };
    let mut svg = String::new();
    {
        let drawing_area = SVGBackend::with_string(&mut svg, (WIDTH, HEIGHT)).into_drawing_area();
        drawing_area.fill(&WHITE).map_err(chart_error)?;
        let mut chart = ChartBuilder::on(&drawing_area)
            .margin(14)
            .x_label_area_size(48)
            .y_label_area_size(72)
            .build_cartesian_2d((0_usize..1_usize).into_segmented(), 0_f64..upper_bound)
            .map_err(chart_error)?;
        chart
            .configure_mesh()
            .disable_x_mesh()
            .bold_line_style(GRID.mix(0.55))
            .light_line_style(GRID.mix(0.25))
            .axis_style(BLACK.mix(0.65))
            .label_style(("sans-serif", 14).into_font().color(&INK))
            .axis_desc_style(("sans-serif", 15).into_font().color(&INK))
            .y_labels(5)
            .max_light_lines(1)
            .x_label_formatter(&|value| match value {
                SegmentValue::CenterOf(0) => input.baseline_label.to_owned(),
                SegmentValue::CenterOf(1) => input.comparison_label.to_owned(),
                _ => String::new(),
            })
            .y_label_formatter(&|value| format_axis_value(*value, input.decimal_separator))
            .y_desc(input.axis_label)
            .draw()
            .map_err(chart_error)?;

        for (index, (value, color)) in [
            (input.baseline_value, BASELINE),
            (input.comparison_value, COMPARISON),
        ]
        .into_iter()
        .enumerate()
        {
            if let Some(value) = value {
                let end = if index == 0 {
                    SegmentValue::Exact(1)
                } else {
                    SegmentValue::Last
                };
                let mut bar = Rectangle::new(
                    [(SegmentValue::Exact(index), 0.0), (end, value)],
                    color.filled(),
                );
                bar.set_margin(8, 8, 28, 28);
                chart
                    .draw_series(std::iter::once(bar))
                    .map_err(chart_error)?;
            } else {
                chart
                    .draw_series(std::iter::once(Text::new(
                        input.unavailable_label.to_owned(),
                        (SegmentValue::CenterOf(index), upper_bound * 0.08),
                        ("sans-serif", 14).into_font().color(&MUTED),
                    )))
                    .map_err(chart_error)?;
            }
        }
        drawing_area.present().map_err(chart_error)?;
    }

    let svg = svg.trim_end().replacen(SVG_NAMESPACE_DECLARATION, "", 1);
    let accessible_svg = add_accessible_metadata(&svg, input)?;
    validate_generated_svg(&accessible_svg)?;
    Ok(accessible_svg)
}

fn validate_input(input: &StaticComparisonChart<'_>) -> Result<(), String> {
    if input.id.is_empty()
        || !input
            .id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("static chart identity is invalid".to_owned());
    }
    for value in [input.baseline_value, input.comparison_value]
        .into_iter()
        .flatten()
    {
        if !value.is_finite() || value < 0.0 {
            return Err("static chart values must be finite and non-negative".to_owned());
        }
    }
    if !matches!(input.decimal_separator, '.' | ',') {
        return Err("static chart decimal separator is invalid".to_owned());
    }
    Ok(())
}

fn format_axis_value(value: f64, decimal_separator: char) -> String {
    let mut formatted = if value == 0.0 || value.abs() >= 100.0 {
        format!("{value:.0}")
    } else {
        format!("{value:.1}")
    };
    if decimal_separator == ',' {
        formatted = formatted.replace('.', ",");
    }
    formatted
}

fn add_accessible_metadata(svg: &str, input: &StaticComparisonChart<'_>) -> Result<String, String> {
    if !svg.starts_with("<svg") {
        return Err("static chart backend did not produce an SVG root".to_owned());
    }
    let opening_end = svg
        .find('>')
        .ok_or_else(|| "static chart SVG root is incomplete".to_owned())?;
    let title_id = format!("{}-title", input.id);
    let description_id = format!("{}-description", input.id);
    let mut output =
        String::with_capacity(svg.len() + input.title.len() + input.description.len() + 192);
    output.push_str("<svg class=\"comparison-chart\" role=\"img\" aria-labelledby=\"");
    push_xml_escaped(&mut output, &title_id);
    output.push_str("\" aria-describedby=\"");
    push_xml_escaped(&mut output, &description_id);
    output.push('"');
    output.push_str(&svg[4..opening_end]);
    output.push_str("><title id=\"");
    push_xml_escaped(&mut output, &title_id);
    output.push_str("\">");
    push_xml_escaped(&mut output, input.title);
    output.push_str("</title><desc id=\"");
    push_xml_escaped(&mut output, &description_id);
    output.push_str("\">");
    push_xml_escaped(&mut output, input.description);
    output.push_str("</desc>");
    output.push_str(&svg[opening_end + 1..]);
    Ok(output)
}

fn validate_generated_svg(svg: &str) -> Result<(), String> {
    if svg.len() > MAX_SVG_BYTES {
        return Err("static chart SVG exceeds its output budget".to_owned());
    }
    if !svg.starts_with("<svg class=\"comparison-chart\"") || !svg.ends_with("</svg>") {
        return Err("static chart SVG has an invalid document boundary".to_owned());
    }
    let lowercase = svg.to_ascii_lowercase();
    for forbidden in [
        "<script",
        "<foreignobject",
        "<image",
        "<use",
        "<a ",
        "<animate",
        "<set",
        "<mpath",
        "<!doctype",
        "<!entity",
        "<![cdata",
        "javascript:",
        "xlink:href",
        "href=",
        "src=",
        "url(",
        "http://",
        "https://",
        "file://",
        "data:",
        "onload=",
        "onclick=",
    ] {
        if lowercase.contains(forbidden) {
            return Err(format!(
                "static chart SVG contains forbidden content: {forbidden}"
            ));
        }
    }
    Ok(())
}

fn push_xml_escaped(output: &mut String, value: &str) {
    for character in value.chars() {
        match character {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' => output.push_str("&quot;"),
            '\'' => output.push_str("&apos;"),
            _ => output.push(character),
        }
    }
}

fn chart_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::{render_static_comparison_chart, StaticComparisonChart, MAX_SVG_BYTES};

    fn chart() -> StaticComparisonChart<'static> {
        StaticComparisonChart {
            id: "report-block-1-chart-1",
            title: "Training <history> — Duration",
            description: "Baseline: 1 h & comparison: 2 h.",
            axis_label: "Duration (h)",
            baseline_label: "Base <period>",
            comparison_label: "Comparison",
            unavailable_label: "Unavailable",
            baseline_value: Some(1.0),
            comparison_value: Some(2.0),
            decimal_separator: '.',
        }
    }

    #[test]
    fn renders_deterministic_accessible_script_free_svg_with_axes_and_categories() {
        let first = render_static_comparison_chart(&chart()).expect("static chart");
        let second = render_static_comparison_chart(&chart()).expect("deterministic static chart");

        assert_eq!(first, second);
        assert!(first.starts_with("<svg class=\"comparison-chart\" role=\"img\""));
        assert!(first.contains("aria-labelledby=\"report-block-1-chart-1-title\""));
        assert!(first.contains(">Training &lt;history&gt; — Duration</title>"));
        assert!(first.contains(">\nBase &lt;period&gt;\n</text>"));
        assert!(first.contains(">\nComparison\n</text>"));
        assert!(first.contains("Duration (h)"));
        assert!(first.contains("<line"));
        assert!(first.matches("opacity=\"0.25\"").count() <= 5);
        assert!(first.contains("<rect"));
        assert!(!first.contains("<script"));
        assert!(!first.contains("http://"));
        assert!(!first.contains("https://"));
        assert!(first.len() <= MAX_SVG_BYTES);
    }

    #[test]
    fn preserves_missing_values_as_an_explicit_gap() {
        let mut input = chart();
        input.baseline_value = None;
        input.description = "Baseline: Unavailable; comparison: 2 h.";

        let svg = render_static_comparison_chart(&input).expect("chart with a gap");

        assert!(svg.matches("Unavailable").count() >= 2);
        assert!(svg.contains("Baseline: Unavailable; comparison: 2 h."));
    }

    #[test]
    fn rejects_unsafe_or_unbounded_inputs() {
        let mut invalid_identity = chart();
        invalid_identity.id = "chart\" onload=\"alert(1)";
        assert!(render_static_comparison_chart(&invalid_identity).is_err());

        let mut invalid_value = chart();
        invalid_value.comparison_value = Some(f64::NAN);
        assert!(render_static_comparison_chart(&invalid_value).is_err());
    }
}
