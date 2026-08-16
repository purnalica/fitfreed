interface CommandError {
  code?: string;
}

export function commandErrorCode(reason: unknown): string {
  if (reason && typeof reason === "object" && "code" in reason) {
    const code = (reason as CommandError).code;
    if (typeof code === "string") return code;
  }
  return "unexpected";
}
