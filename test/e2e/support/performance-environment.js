const runtimes = Object.freeze({
  darwin: "packaged-macos-webview",
  linux: "packaged-linux-webview",
  win32: "packaged-windows-webview",
});

function assertSupportedPlatform(platform) {
  if (!Object.hasOwn(runtimes, platform)) {
    throw new Error(`unsupported packaged WebView platform: ${platform}`);
  }
}

export function packagedWebviewRuntime(platform = process.platform) {
  assertSupportedPlatform(platform);
  return runtimes[platform];
}

export function platformHostCommands(platform = process.platform) {
  assertSupportedPlatform(platform);
  if (platform !== "darwin") {
    return {
      deviceModel: null,
      operatingSystemVersion: null,
    };
  }
  return {
    deviceModel: { arguments: ["-n", "hw.model"], program: "sysctl" },
    operatingSystemVersion: { arguments: ["-productVersion"], program: "sw_vers" },
  };
}
