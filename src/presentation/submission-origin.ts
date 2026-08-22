export function submissionOrigin(event: Event): HTMLElement | null {
  const submitter = (event as SubmitEvent).submitter;
  if (submitter instanceof HTMLElement) return submitter;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
