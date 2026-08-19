import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreFocusAfterReveal } from "./focus-restoration";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("restoreFocusAfterReveal", () => {
  it("restores focus displaced to the document while a revealed view settles", () => {
    vi.useFakeTimers();
    const target = document.createElement("button");
    document.body.append(target);

    restoreFocusAfterReveal(target);
    vi.advanceTimersByTime(0);
    expect(target).toHaveFocus();

    target.blur();
    expect(document.body).toHaveFocus();
    vi.advanceTimersByTime(50);
    expect(target).toHaveFocus();
  });

  it("does not override focus explicitly moved to another control", () => {
    vi.useFakeTimers();
    const target = document.createElement("button");
    const alternative = document.createElement("button");
    document.body.append(target, alternative);

    restoreFocusAfterReveal(target);
    vi.advanceTimersByTime(0);
    alternative.focus();
    vi.advanceTimersByTime(500);

    expect(alternative).toHaveFocus();
  });

  it("cancels pending restoration when its owner is removed", () => {
    vi.useFakeTimers();
    const target = document.createElement("button");
    document.body.append(target);

    const cancel = restoreFocusAfterReveal(target);
    cancel();
    vi.runAllTimers();

    expect(target).not.toHaveFocus();
  });
});
