import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { APPLICATION_ERROR_ID, useInvalidForm } from "./useInvalidForm";

describe("useInvalidForm", () => {
  it("associates a rejected form with the application error until the user edits it", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useInvalidForm(onError));

    act(() => result.current.reject("invalid-training-range"));

    expect(result.current.invalid).toBe(true);
    expect(result.current.errorElementId).toBe(APPLICATION_ERROR_ID);
    expect(onError).toHaveBeenLastCalledWith("invalid-training-range");

    act(() => result.current.edit());

    expect(result.current.invalid).toBe(false);
    expect(onError).toHaveBeenLastCalledWith(undefined);
  });

  it("clears the association without emitting a separate error transition", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useInvalidForm(onError));

    act(() => result.current.accept());

    expect(result.current.invalid).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });
});
