import { elapsedEditorValue } from "./training-range-editor-model";
import type { TrainingSessionRange } from "./training-session-range";

export function formatTrainingRangeTiming(range: TrainingSessionRange): string {
  return `${elapsedEditorValue(range.startedAtElapsedMilliseconds)}–${
    elapsedEditorValue(range.endedAtElapsedMilliseconds)
  }`;
}

export function formatTrainingRangeChoice(range: TrainingSessionRange): string {
  return `${range.title} · ${formatTrainingRangeTiming(range)}`;
}

export function duplicateTrainingRangeTitleCounts(
  ranges: TrainingSessionRange[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const range of ranges) {
    counts.set(range.title, (counts.get(range.title) ?? 0) + 1);
  }
  return counts;
}
