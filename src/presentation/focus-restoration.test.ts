import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreFocusAfterReveal } from "./focus-restoration";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it("remembers explicit focus movement even when the new control is removed before polling", () => {
    vi.useFakeTimers();
    const target = document.createElement("button");
    const alternative = document.createElement("button");
    document.body.append(target, alternative);

    restoreFocusAfterReveal(target);
    vi.advanceTimersByTime(0);
    expect(target).toHaveFocus();

    alternative.focus();
    alternative.remove();
    expect(document.body).toHaveFocus();
    vi.advanceTimersByTime(500);

    expect(target).not.toHaveFocus();
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

  it("keeps start-aligned focus below the measured compact application navigation", () => {
    vi.useFakeTimers();
    const navigation = document.createElement("aside");
    navigation.dataset.revealObstruction = "compact-top";
    navigation.style.position = "sticky";
    const target = document.createElement("h2");
    target.tabIndex = -1;
    let marginDuringReveal = "";
    target.scrollIntoView = vi.fn(() => {
      marginDuringReveal = target.style.scrollMarginBlockStart;
    });
    document.body.append(navigation, target);
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1280);
    vi.spyOn(navigation, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      right: 1280,
      top: 0,
      bottom: 300,
      width: 1280,
      height: 300,
      toJSON: () => ({}),
    });
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      x: 40,
      y: 210,
      left: 40,
      right: 500,
      top: 210,
      bottom: 250,
      width: 460,
      height: 40,
      toJSON: () => ({}),
    });
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);

    restoreFocusAfterReveal(target, null, { align: "start", forceInitialFocus: true });
    vi.advanceTimersByTime(0);

    expect(target).toHaveFocus();
    expect(marginDuringReveal).toBe("316px");
    expect(target.style.scrollMarginBlockStart).toBe("");
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("focuses a heading while revealing its complete task surface", () => {
    vi.useFakeTimers();
    const surface = document.createElement("section");
    const heading = document.createElement("h2");
    heading.tabIndex = -1;
    surface.append(heading);
    document.body.append(surface);
    surface.scrollIntoView = vi.fn();
    heading.scrollIntoView = vi.fn();

    restoreFocusAfterReveal(heading, null, {
      align: "start",
      forceInitialFocus: true,
      revealElement: surface,
    });
    vi.advanceTimersByTime(0);

    expect(heading).toHaveFocus();
    expect(surface.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      inline: "nearest",
    });
    expect(heading.scrollIntoView).not.toHaveBeenCalled();
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
