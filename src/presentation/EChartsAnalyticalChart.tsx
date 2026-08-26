import { useEffect, useId, useRef } from "react";

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
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof mountEChartsAnalyticalChart> | undefined>(undefined);
  const renderedModelRef = useRef<AnalyticalChartModel | undefined>(undefined);
  const renderedSelectionRef = useRef<typeof onSelection>(undefined);
  const latestModelRef = useRef(model);
  const latestSelectionRef = useRef(onSelection);
  latestModelRef.current = model;
  latestSelectionRef.current = onSelection;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderAtCurrentSize = () => {
      if (container.clientWidth <= 0 || container.clientHeight <= 0) return;
      if (chartRef.current) {
        chartRef.current.resize();
      } else {
        const latestModel = latestModelRef.current;
        const latestSelection = latestSelectionRef.current;
        chartRef.current = mountEChartsAnalyticalChart(
          container,
          latestModel,
          latestSelection,
        );
        renderedModelRef.current = latestModel;
        renderedSelectionRef.current = latestSelection;
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
      chartRef.current?.dispose();
      chartRef.current = undefined;
      renderedModelRef.current = undefined;
      renderedSelectionRef.current = undefined;
    };
  }, [model.renderer]);

  useEffect(() => {
    if (!chartRef.current
      || (renderedModelRef.current === model && renderedSelectionRef.current === onSelection)) return;
    chartRef.current.update(model, onSelection);
    renderedModelRef.current = model;
    renderedSelectionRef.current = onSelection;
  }, [model, onSelection]);

  return (
    <div
      className="analytical-chart-canvas"
      role="img"
      aria-label={model.accessibleName}
      aria-describedby={descriptionId}
      data-chart-renderer={model.renderer}
    >
      <span id={descriptionId} className="sr-only">{model.accessibleDescription}</span>
      <div
        ref={containerRef}
        className="analytical-chart-renderer"
        aria-hidden="true"
      />
    </div>
  );
}
