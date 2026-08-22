import { ProgressSubmitButton } from "./ProgressSubmitButton";

export type RangeOperation = "apply" | "reset" | "navigation";

interface RangeFilterActionsProps {
  className: string;
  operation?: RangeOperation;
  applyLabel: string;
  applyingLabel: string;
  resetLabel: string;
  resettingLabel: string;
  navigationLabel?: string;
  onReset: (initiatingElement: HTMLButtonElement) => void;
}

export function RangeFilterActions({
  className,
  operation,
  applyLabel,
  applyingLabel,
  resetLabel,
  resettingLabel,
  navigationLabel,
  onReset,
}: RangeFilterActionsProps) {
  const busy = operation !== undefined;
  const progress = operation === "apply"
    ? applyingLabel
    : operation === "reset"
      ? resettingLabel
      : operation === "navigation"
        ? navigationLabel
        : undefined;

  return (
    <div className={className}>
      <ProgressSubmitButton
        loading={operation === "apply"}
        disabled={busy}
        actionLabel={applyLabel}
        progressLabel={applyingLabel}
      />
      <button
        type="button"
        className="secondary"
        onClick={(event) => onReset(event.currentTarget)}
        disabled={busy}
      >
        {resetLabel}
      </button>
      {operation !== "apply" && progress && (
        <span className="progress-submit-status" role="status" aria-live="polite">
          {progress}
        </span>
      )}
    </div>
  );
}
