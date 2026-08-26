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
    const chart = mountEChartsAnalyticalChart(container, model, onSelection);
    const resize = () => chart.resize();
    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(resize);
    observer?.observe(container);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
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
