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

  it("moves focus from the initiating control to the revealed result", () => {
    vi.useFakeTimers();
    const initiatingControl = document.createElement("button");
    const target = document.createElement("h2");
    target.tabIndex = -1;
    document.body.append(initiatingControl, target);
    initiatingControl.focus();

    restoreFocusAfterReveal(target, initiatingControl);
    vi.advanceTimersByTime(0);

    expect(target).toHaveFocus();
  });

  it("establishes explicit-action focus before respecting later user movement", () => {
    vi.useFakeTimers();
    const settlingResult = document.createElement("h2");
    settlingResult.tabIndex = -1;
    const target = document.createElement("h2");
    target.tabIndex = -1;
    const alternative = document.createElement("button");
    document.body.append(settlingResult, target, alternative);
    settlingResult.focus();

    restoreFocusAfterReveal(target, null, { forceInitialFocus: true });
    vi.advanceTimersByTime(0);
    expect(target).toHaveFocus();

    alternative.focus();
    vi.advanceTimersByTime(500);
    expect(alternative).toHaveFocus();
  });

  it("aligns a result with the start of its visible workspace when requested", () => {
    vi.useFakeTimers();
    const initiatingControl = document.createElement("button");
    const target = document.createElement("h2");
    target.tabIndex = -1;
    target.scrollIntoView = vi.fn();
    document.body.append(initiatingControl, target);
    initiatingControl.focus();

    restoreFocusAfterReveal(target, initiatingControl, { align: "start" });
    vi.advanceTimersByTime(0);

    expect(target).toHaveFocus();
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      inline: "nearest",
    });
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
