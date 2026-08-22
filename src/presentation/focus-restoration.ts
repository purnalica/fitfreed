const MAXIMUM_FOCUS_ATTEMPTS = 10;
const FOCUS_SETTLING_MILLISECONDS = 50;

interface RevealFocusOptions {
  align?: "nearest" | "start";
}

export function restoreFocusAfterReveal(
  element: HTMLElement | null,
  initiatingElement: HTMLElement | null = null,
  options: RevealFocusOptions = {},
): () => void {
  if (!element) return () => undefined;
  let cancelled = false;
  let attemptCount = 0;
  let timer: number | undefined;

  const attempt = () => {
    if (cancelled || !element.isConnected) return;
    const activeElement = document.activeElement;
    if (
      activeElement !== element
      && activeElement !== initiatingElement
      && activeElement !== document.body
      && activeElement !== document.documentElement
      && activeElement !== null
    ) {
      cancelled = true;
      return;
    }
    attemptCount += 1;
    if (activeElement !== element) {
      if (options.align === "start") {
        element.focus({ preventScroll: true });
        if (typeof element.scrollIntoView === "function") {
          element.scrollIntoView({ block: "start", inline: "nearest" });
        }
      } else {
        element.focus();
      }
    }
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
