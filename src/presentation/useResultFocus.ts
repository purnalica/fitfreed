import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

import { restoreFocusAfterReveal } from "./focus-restoration";

interface ResultFocus<T extends HTMLElement> {
  resultHeadingRef: RefObject<T | null>;
  requestResultFocus: (initiatingElement?: HTMLElement | null) => void;
}

export function useResultFocus<T extends HTMLElement>(visible: boolean): ResultFocus<T> {
  const resultHeadingRef = useRef<T>(null);
  const initiatingElementRef = useRef<HTMLElement | null>(null);
  const [requestId, setRequestId] = useState(0);
  const requestResultFocus = useCallback((initiatingElement: HTMLElement | null = null) => {
    initiatingElementRef.current = initiatingElement;
    setRequestId((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!visible || requestId === 0) return;
    return restoreFocusAfterReveal(
      resultHeadingRef.current,
      initiatingElementRef.current,
    );
  }, [requestId, visible]);

  return { resultHeadingRef, requestResultFocus };
}
