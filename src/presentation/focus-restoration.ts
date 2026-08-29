const MAXIMUM_FOCUS_ATTEMPTS = 10;
const FOCUS_SETTLING_MILLISECONDS = 50;
const REVEAL_GAP_PIXELS = 16;

interface RevealFocusOptions {
  align?: "nearest" | "start";
  forceInitialFocus?: boolean;
  revealElement?: HTMLElement | null;
}

function measuredCompactTopRevealMargin(): string | undefined {
  const obstruction = document.querySelector<HTMLElement>(
    '[data-reveal-obstruction="compact-top"]',
  );
  if (!obstruction) return undefined;
  const rootWidth = document.documentElement.clientWidth;
  const obstructionBox = obstruction.getBoundingClientRect();
  if (
    rootWidth <= 0
    || obstructionBox.width < rootWidth - 1
    || !["fixed", "sticky"].includes(window.getComputedStyle(obstruction).position)
  ) return undefined;
  return `${Math.ceil(obstructionBox.height) + REVEAL_GAP_PIXELS}px`;
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
        const revealElement = options.revealElement ?? element;
        if (typeof revealElement.scrollIntoView === "function") {
          const previousMargin = revealElement.style.scrollMarginBlockStart;
          const measuredMargin = measuredCompactTopRevealMargin();
          if (measuredMargin) revealElement.style.scrollMarginBlockStart = measuredMargin;
          try {
            revealElement.scrollIntoView({ block: "start", inline: "nearest" });
          } finally {
            revealElement.style.scrollMarginBlockStart = previousMargin;
          }
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
