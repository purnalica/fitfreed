import { useEffect, useRef } from "react";

import type {
  AnalyticalChartModel,
  AnalyticalChartSelection,
} from "./analytical-chart";
import { mountEChartsAnalyticalChart } from "./echarts-analytical-chart-adapter";

interface EChartsAnalyticalChartProps {
  model: AnalyticalChartModel;
  onSelection?: (selection: AnalyticalChartSelection) => void;
}

export default function EChartsAnalyticalChart({
  model,
  onSelection,
}: EChartsAnalyticalChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let chart: ReturnType<typeof mountEChartsAnalyticalChart> | undefined;
    const renderAtCurrentSize = () => {
      if (container.clientWidth <= 0 || container.clientHeight <= 0) return;
      if (chart) {
        chart.resize();
      } else {
        chart = mountEChartsAnalyticalChart(container, model, onSelection);
      }
    };
    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(renderAtCurrentSize);
    observer?.observe(container);
    window.addEventListener("resize", renderAtCurrentSize);
    renderAtCurrentSize();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", renderAtCurrentSize);
      chart?.dispose();
    };
  }, [model, onSelection]);

  return (
    <div
      ref={containerRef}
      className="analytical-chart-canvas"
      role="img"
      aria-label={model.accessibleName}
      data-chart-renderer={model.renderer}
    />
  );
}
