interface ProgressSubmitButtonProps {
  loading: boolean;
  actionLabel: string;
  progressLabel: string;
}

export function ProgressSubmitButton({
  loading,
  actionLabel,
  progressLabel,
}: ProgressSubmitButtonProps) {
  return (
    <>
      <button type="submit" disabled={loading}>
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
