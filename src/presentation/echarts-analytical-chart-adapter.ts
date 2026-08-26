import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import {
  init,
  use,
  type EChartsCoreOption,
  type EChartsType,
} from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

import type {
  AnalyticalChartAxis,
  AnalyticalChartModel,
  AnalyticalChartSelection,
  AnalyticalChartValueFormat,
} from "./analytical-chart";
import {
  analyticalAxisNumberFormatter,
  formatAnalyticalDuration,
} from "./presentation-format";

use([
  LineChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
  SVGRenderer,
]);

export interface AnalyticalChartPalette {
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  line: string;
  surface: string;
  baseFontSize: number;
  fontFamily: string;
  seriesColors?: string[];
}

interface CompiledDataItem {
  name?: string;
  value: [number, number | null];
  silent?: boolean;
}

interface CompiledAxis {
  type: "value";
  name: string;
  nameLocation: "middle";
  nameGap: number;
  min: number;
  max: number;
  inverse?: boolean;
  position?: "left" | "right";
  offset?: number;
  axisLabel: {
    color: string;
    fontFamily: string;
    fontSize: number;
    formatter: (value: number) => string;
  };
  axisLine: { lineStyle: { color: string } };
  splitLine: { lineStyle: { color: string } };
  nameTextStyle: {
    color: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
  };
}

interface CompiledSeries {
  id: string;
  name: string;
  type: "line";
  yAxisIndex: number;
  data: CompiledDataItem[];
  connectNulls: false;
  showSymbol: boolean;
  symbolSize: number;
  lineStyle: { width: number; color: string };
  itemStyle: { color: string };
  emphasis: { focus: "series" };
  markArea?: {
    silent: true;
    itemStyle: { color: string };
    data: [[{ xAxis: number }, { xAxis: number }]];
  };
  markLine?: {
    silent: true;
    symbol: "none";
    lineStyle: { color: string; type: "dashed"; width: number };
    label: { show: false };
    data: Array<{
      xAxis: number;
      lineStyle?: { color: string; type: "dashed" | "dotted" | "solid"; width: number };
    }>;
  };
}

export interface CompiledEChartsOption {
  animation: false;
  backgroundColor: string;
  color: string[];
  aria: {
    enabled: true;
    description: string;
    decal: { show: true };
  };
  grid: { left: number; right: number; top: number; bottom: number; containLabel: true };
  legend: {
    show: boolean;
    textStyle: { color: string; fontFamily: string; fontSize: number };
    top: number;
  };
  tooltip: {
    trigger: "axis";
    renderMode: "richText";
    textStyle: { fontFamily: string; fontSize: number };
    axisPointer: {
      type: "cross";
      label: {
        color: string;
        backgroundColor: string;
        fontFamily: string;
        fontSize: number;
      };
    };
  };
  xAxis: CompiledAxis;
  yAxis: CompiledAxis[];
  dataZoom: Array<Record<string, unknown>>;
  series: CompiledSeries[];
}

export interface CompiledEChartsAnalyticalChart {
  option: CompiledEChartsOption;
  selectionByDataIndex: Map<string, AnalyticalChartSelection>;
}

export interface EChartsAnalyticalChartHandle {
  resize: () => void;
  dispose: () => void;
}

function valueFormatter(format: AnalyticalChartValueFormat, locale: AnalyticalChartModel["locale"]) {
  if (format.kind === "duration-milliseconds") {
    return (value: number) => formatAnalyticalDuration(value, locale);
  }
  const formatter = analyticalAxisNumberFormatter(locale, format.maximumFractionDigits);
  return (value: number) => formatter.format(value);
}

function axisName(label: string, unit: string): string {
  return unit === "" ? label : `${label} (${unit})`;
}

function chartScale(palette: AnalyticalChartPalette): number {
  return Math.min(2, Math.max(0.75, palette.baseFontSize / 16));
}

function chartFontSize(palette: AnalyticalChartPalette): number {
  return Math.round(palette.baseFontSize * 0.8125);
}

function scaledPixels(value: number, palette: AnalyticalChartPalette): number {
  return Math.round(value * chartScale(palette));
}

function compileAxis(
  axis: AnalyticalChartAxis,
  index: number,
  model: AnalyticalChartModel,
  palette: AnalyticalChartPalette,
): CompiledAxis {
  const position = index % 2 === 0 ? "left" : "right";
  return {
    type: "value",
    name: axisName(axis.label, axis.unit),
    nameLocation: "middle",
    nameGap: scaledPixels(48 + Math.floor(index / 2) * 44, palette),
    min: axis.domain.minimum,
    max: axis.domain.maximum,
    inverse: axis.direction === "lower-at-top",
    position,
    offset: scaledPixels(Math.floor(index / 2) * 52, palette),
    axisLabel: {
      color: palette.muted,
      fontFamily: palette.fontFamily,
      fontSize: chartFontSize(palette),
      formatter: valueFormatter(axis.format, model.locale),
    },
    axisLine: { lineStyle: { color: palette.line } },
    splitLine: { lineStyle: { color: palette.line } },
    nameTextStyle: {
      color: palette.ink,
      fontFamily: palette.fontFamily,
      fontSize: chartFontSize(palette),
      fontWeight: 700,
    },
  };
}

function axisSideSpace(
  axisCount: number,
  parity: 0 | 1,
  palette: AnalyticalChartPalette,
): number {
  const count = Array.from({ length: axisCount }, (_, index) => index)
    .filter((index) => index % 2 === parity).length;
  return scaledPixels(64 + Math.max(0, count - 1) * 52, palette);
}

export function compileEChartsAnalyticalChart(
  model: AnalyticalChartModel,
  palette: AnalyticalChartPalette,
): CompiledEChartsAnalyticalChart {
  const selectionByDataIndex = new Map<string, AnalyticalChartSelection>();
  const colors = palette.seriesColors?.length
    ? palette.seriesColors
    : [palette.accent, palette.ink, palette.muted];
  const axisIndexes = new Map(model.axes.map((axis, index) => [axis.id, index]));
  const series: CompiledSeries[] = model.series.map((sourceSeries, seriesIndex) => {
    const data: CompiledDataItem[] = [];
    for (const point of sourceSeries.points) {
      if (point.gapBefore && point.value !== null) {
        data.push({ value: [point.coordinate, null], silent: true });
      }
      const dataIndex = data.length;
      data.push({ name: point.id, value: [point.coordinate, point.value] });
      if (point.value !== null) {
        selectionByDataIndex.set(`${seriesIndex}:${dataIndex}`, {
          seriesId: sourceSeries.id,
          pointId: point.id,
          coordinate: point.coordinate,
        });
      }
    }
    const annotations = seriesIndex === 0 ? model.annotations : undefined;
    return {
      id: sourceSeries.id,
      name: sourceSeries.label,
      type: "line",
      yAxisIndex: axisIndexes.get(sourceSeries.axisId) ?? 0,
      data,
      connectNulls: false,
      showSymbol: sourceSeries.points.length <= 500,
      symbolSize: scaledPixels(7, palette),
      lineStyle: { width: 3, color: colors[seriesIndex % colors.length] },
      itemStyle: { color: colors[seriesIndex % colors.length] },
      emphasis: { focus: "series" },
      ...(annotations?.range?.startCoordinate !== undefined
        && annotations.range.endCoordinate !== undefined ? {
        markArea: {
          silent: true as const,
          itemStyle: { color: palette.accentSoft },
          data: [[
            { xAxis: annotations.range.startCoordinate },
            { xAxis: annotations.range.endCoordinate },
          ]],
        },
      } : {}),
      ...(annotations?.selectedCoordinate !== undefined
        || annotations?.range?.startCoordinate !== undefined
        || annotations?.range?.endCoordinate !== undefined ? {
        markLine: {
          silent: true as const,
          symbol: "none" as const,
          lineStyle: { color: palette.ink, type: "dashed" as const, width: 2 },
          label: { show: false },
          data: [
            ...(annotations?.range?.startCoordinate === undefined ? [] : [{
              xAxis: annotations.range.startCoordinate,
              lineStyle: {
                color: palette.accent,
                type: "dashed" as const,
                width: 3,
              },
            }]),
            ...(annotations?.range?.endCoordinate === undefined ? [] : [{
              xAxis: annotations.range.endCoordinate,
              lineStyle: {
                color: palette.accent,
                type: "solid" as const,
                width: 3,
              },
            }]),
            ...(annotations?.selectedCoordinate === undefined ? [] : [{
              xAxis: annotations.selectedCoordinate,
              lineStyle: {
                color: palette.ink,
                type: "dotted" as const,
                width: 2,
              },
            }]),
          ],
        },
      } : {}),
    };
  });
  const coordinateFormatter = valueFormatter(model.coordinate.format, model.locale);
  const zoom = model.interaction.zoom
    ? [
        {
          type: "inside",
          xAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: "shift",
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          filterMode: "none",
          height: scaledPixels(22, palette),
          bottom: scaledPixels(8, palette),
          borderColor: palette.line,
          fillerColor: palette.accentSoft,
          handleStyle: { color: palette.accent, borderColor: palette.accent },
          textStyle: {
            color: palette.muted,
            fontFamily: palette.fontFamily,
            fontSize: chartFontSize(palette),
          },
        },
      ]
    : [];

  return {
    selectionByDataIndex,
    option: {
      animation: false,
      backgroundColor: palette.surface,
      color: colors,
      aria: {
        enabled: true,
        description: model.accessibleDescription,
        decal: { show: true },
      },
      grid: {
        left: axisSideSpace(model.axes.length, 0, palette),
        right: axisSideSpace(model.axes.length, 1, palette),
        top: scaledPixels(model.series.length > 1 ? 50 : 28, palette),
        bottom: scaledPixels(model.interaction.zoom ? 74 : 52, palette),
        containLabel: true,
      },
      legend: {
        show: model.series.length > 1,
        textStyle: {
          color: palette.ink,
          fontFamily: palette.fontFamily,
          fontSize: chartFontSize(palette),
        },
        top: scaledPixels(4, palette),
      },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        textStyle: {
          fontFamily: palette.fontFamily,
          fontSize: chartFontSize(palette),
        },
        axisPointer: {
          type: "cross",
          label: {
            color: palette.surface,
            backgroundColor: palette.ink,
            fontFamily: palette.fontFamily,
            fontSize: chartFontSize(palette),
          },
        },
      },
      xAxis: {
        type: "value",
        name: axisName(model.coordinate.label, model.coordinate.unit),
        nameLocation: "middle",
        nameGap: scaledPixels(36, palette),
        min: model.coordinate.domain.minimum,
        max: model.coordinate.domain.maximum,
        axisLabel: {
          color: palette.muted,
          fontFamily: palette.fontFamily,
          fontSize: chartFontSize(palette),
          formatter: coordinateFormatter,
        },
        axisLine: { lineStyle: { color: palette.line } },
        splitLine: { lineStyle: { color: palette.line } },
        nameTextStyle: {
          color: palette.ink,
          fontFamily: palette.fontFamily,
          fontSize: chartFontSize(palette),
          fontWeight: 700,
        },
      },
      yAxis: model.axes.map((axis, index) => compileAxis(axis, index, model, palette)),
      dataZoom: zoom,
      series,
    },
  };
}

function cssValue(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

export function analyticalChartPalette(element: HTMLElement): AnalyticalChartPalette {
  const styles = getComputedStyle(element);
  const computedFontSize = Number.parseFloat(styles.fontSize);
  return {
    accent: cssValue(styles, "--accent-deep", "#1f583f"),
    accentSoft: cssValue(styles, "--accent-soft", "#d9ece3"),
    ink: cssValue(styles, "--ink", "#172019"),
    muted: cssValue(styles, "--muted", "#5d675f"),
    line: cssValue(styles, "--line", "#cbd2c8"),
    surface: cssValue(styles, "--surface", "#ffffff"),
    baseFontSize: Number.isFinite(computedFontSize) ? computedFontSize : 16,
    fontFamily: styles.fontFamily.trim() || "sans-serif",
    seriesColors: [
      cssValue(styles, "--accent-deep", "#1f583f"),
      cssValue(styles, "--danger", "#9c413d"),
      cssValue(styles, "--warning", "#9a5d14"),
      cssValue(styles, "--ink-soft", "#36423a"),
    ],
  };
}

export function mountEChartsAnalyticalChart(
  element: HTMLElement,
  model: AnalyticalChartModel,
  onSelection?: (selection: AnalyticalChartSelection) => void,
): EChartsAnalyticalChartHandle {
  const compiled = compileEChartsAnalyticalChart(model, analyticalChartPalette(element));
  const chart: EChartsType = init(element, undefined, {
    renderer: model.renderer,
    devicePixelRatio: window.devicePixelRatio,
  });
  chart.setOption(compiled.option as unknown as EChartsCoreOption);
  chart.on("click", (event) => {
    if (!model.interaction.pointSelection || !onSelection) return;
    const candidate = event as unknown as { seriesIndex?: number; dataIndex?: number };
    if (candidate.seriesIndex === undefined || candidate.dataIndex === undefined) return;
    const selection = compiled.selectionByDataIndex.get(
      `${candidate.seriesIndex}:${candidate.dataIndex}`,
    );
    if (selection) onSelection(selection);
  });
  return {
    resize: () => chart.resize(),
    dispose: () => chart.dispose(),
  };
}
