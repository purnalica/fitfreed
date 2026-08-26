export async function accessibleDescription(element) {
  return browser.execute((candidate) => {
    const descriptionId = candidate.getAttribute("aria-describedby");
    return descriptionId === null
      ? null
      : document.getElementById(descriptionId)?.textContent ?? null;
  }, element);
}
