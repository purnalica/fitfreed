const MAXIMUM_FOCUS_ATTEMPTS = 10;
const FOCUS_SETTLING_MILLISECONDS = 50;

interface RevealFocusOptions {
  align?: "nearest" | "start";
  forceInitialFocus?: boolean;
}

export function restoreFocusAfterReveal(
  element: HTMLElement | null,
  initiatingElement: HTMLElement | null = null,
  options: RevealFocusOptions = {},
): () => void {
  if (!element) return () => undefined;
  let cancelled = false;
  let focusEstablished = false;
  let attemptCount = 0;
  let timer: number | undefined;

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    document.removeEventListener("focusin", observeExplicitFocusMovement);
    if (timer !== undefined) window.clearTimeout(timer);
  };

  function observeExplicitFocusMovement(event: FocusEvent) {
    if (
      !focusEstablished
      || event.target === element
      || event.target === initiatingElement
    ) return;
    stop();
  }

  document.addEventListener("focusin", observeExplicitFocusMovement);

  const attempt = () => {
    if (cancelled) return;
    if (!element.isConnected) {
      stop();
      return;
    }
    const activeElement = document.activeElement;
    if (
      activeElement !== element
      && activeElement !== initiatingElement
      && activeElement !== document.body
      && activeElement !== document.documentElement
      && activeElement !== null
      && (focusEstablished || !options.forceInitialFocus)
    ) {
      stop();
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
    if (document.activeElement === element) focusEstablished = true;
    if (attemptCount < MAXIMUM_FOCUS_ATTEMPTS) {
      timer = window.setTimeout(attempt, FOCUS_SETTLING_MILLISECONDS);
    } else {
      stop();
    }
  };

  timer = window.setTimeout(attempt, 0);
  return stop;
}
