export type DesktopPlatform = "windows" | "macos" | "linux" | "unknown";

interface NavigatorPlatformEvidence {
  platform: string;
  userAgent: string;
}

export function desktopPlatformFromNavigator(
  evidence: NavigatorPlatformEvidence,
): DesktopPlatform {
  const value = `${evidence.platform} ${evidence.userAgent}`.toLowerCase();
  if (/windows|win32|win64/.test(value)) return "windows";
  if (/macintosh|macintel|mac os/.test(value)) return "macos";
  if (/linux|x11/.test(value)) return "linux";
  return "unknown";
}

export function currentDesktopPlatform(): DesktopPlatform {
  return desktopPlatformFromNavigator({
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  });
}
