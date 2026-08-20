interface ProgressSubmitButtonProps {
  loading: boolean;
  disabled?: boolean;
  actionLabel: string;
  progressLabel: string;
}

export function ProgressSubmitButton({
  loading,
  disabled = false,
  actionLabel,
  progressLabel,
}: ProgressSubmitButtonProps) {
  return (
    <>
      <button type="submit" disabled={loading || disabled}>
        {actionLabel}
      </button>
      {loading && (
        <span className="progress-submit-status" role="status" aria-live="polite">
          {progressLabel}
        </span>
      )}
    </>
  );
}
