import { describe, expect, it } from "vitest";

import { desktopPlatformFromNavigator } from "./desktop-platform";

describe("desktop platform detection", () => {
  it("recognizes the supported Windows browser evidence without confusing macOS or Linux", () => {
    expect(desktopPlatformFromNavigator({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    })).toBe("windows");
    expect(desktopPlatformFromNavigator({
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    })).toBe("macos");
    expect(desktopPlatformFromNavigator({
      platform: "Linux x86_64",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    })).toBe("linux");
  });

  it("fails closed when the runtime exposes no recognizable desktop platform", () => {
    expect(desktopPlatformFromNavigator({
      platform: "",
      userAgent: "embedded-runtime",
    })).toBe("unknown");
  });
});
