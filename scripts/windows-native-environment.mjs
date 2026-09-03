const nativeEnvironmentKeys = new Set([
  "ALLUSERSPROFILE",
  "APPDATA",
  "COMMONPROGRAMFILES",
  "COMMONPROGRAMFILES(X86)",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR",
]);

export function windowsNativeToolEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => nativeEnvironmentKeys.has(key.toUpperCase())),
  );
}
