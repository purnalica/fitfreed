const MAXIMUM_FOCUS_ATTEMPTS = 10;
const FOCUS_SETTLING_MILLISECONDS = 50;

export function restoreFocusAfterReveal(element: HTMLElement | null): () => void {
  if (!element) return () => undefined;
  let cancelled = false;
  let attemptCount = 0;
  let timer: number | undefined;

  const attempt = () => {
    if (cancelled || !element.isConnected) return;
    const activeElement = document.activeElement;
    if (
      activeElement !== element
      && activeElement !== document.body
      && activeElement !== document.documentElement
      && activeElement !== null
    ) {
      cancelled = true;
      return;
    }
    attemptCount += 1;
    if (activeElement !== element) element.focus();
    if (attemptCount < MAXIMUM_FOCUS_ATTEMPTS) {
      timer = window.setTimeout(attempt, FOCUS_SETTLING_MILLISECONDS);
    }
  };

  timer = window.setTimeout(attempt, 0);
  return () => {
    cancelled = true;
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
