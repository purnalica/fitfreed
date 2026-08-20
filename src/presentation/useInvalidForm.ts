import { useCallback, useState } from "react";

export const APPLICATION_ERROR_ID = "application-error";

export function useInvalidForm(onError: (code: string | undefined) => void) {
  const [invalid, setInvalid] = useState(false);

  const reject = useCallback((code: string) => {
    setInvalid(true);
    onError(code);
  }, [onError]);

  const edit = useCallback(() => {
    if (invalid) onError(undefined);
    setInvalid(false);
  }, [invalid, onError]);

  const accept = useCallback(() => {
    setInvalid(false);
  }, []);

  return {
    invalid,
    errorElementId: invalid ? APPLICATION_ERROR_ID : undefined,
    reject,
    edit,
    accept,
  };
}
