interface LoadingSurfaceProps {
  message: string;
}

export function LoadingSurface({ message }: LoadingSurfaceProps) {
  return (
    <p className="loading-surface" role="status" aria-live="polite">
      {message}
    </p>
  );
}
