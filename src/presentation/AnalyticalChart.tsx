import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from "react";

import {
  type AnalyticalChartModel,
  type AnalyticalChartSelection,
  validateAnalyticalChartModel,
} from "./analytical-chart";

const EChartsAnalyticalChart = lazy(() => import("./EChartsAnalyticalChart"));

interface AnalyticalChartProps {
  model: AnalyticalChartModel;
  loadingMessage: string;
  unavailableMessage: string;
  onSelection?: (selection: AnalyticalChartSelection) => void;
}

interface ChartErrorBoundaryProps {
  resetKey: string;
  fallback: ReactNode;
  children: ReactNode;
}

interface ChartErrorBoundaryState {
  failed: boolean;
  resetKey: string;
}

class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  state: ChartErrorBoundaryState = {
    failed: false,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(): Partial<ChartErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ChartErrorBoundaryProps,
    state: ChartErrorBoundaryState,
  ): Partial<ChartErrorBoundaryState> | null {
    return props.resetKey === state.resetKey
      ? null
      : { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The visible localized fallback is intentional; private evidence and runtime errors are not logged.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function resetKey(model: AnalyticalChartModel): string {
  return [
    model.layout.kind,
    model.coordinate.ref,
    model.coordinate.domain.minimum,
    model.coordinate.domain.maximum,
    model.series.map((series) => `${series.id}:${series.points.length}`).join("|"),
  ].join(":");
}

export function AnalyticalChart({
  model,
  loadingMessage,
  unavailableMessage,
  onSelection,
}: AnalyticalChartProps) {
  const unavailable = <p className="analytical-chart-status" role="status">{unavailableMessage}</p>;
  if (validateAnalyticalChartModel(model).length > 0) return unavailable;

  return (
    <ChartErrorBoundary resetKey={resetKey(model)} fallback={unavailable}>
      <Suspense fallback={
        <p className="analytical-chart-status" role="status">{loadingMessage}</p>
      }>
        <EChartsAnalyticalChart model={model} onSelection={onSelection} />
      </Suspense>
    </ChartErrorBoundary>
  );
}
