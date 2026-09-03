export const windowsPackageContract = Object.freeze({
  applicationIdentifier: "org.fitfreed.desktop",
  applicationDataDirectory: "%APPDATA%\\org.fitfreed.desktop",
  architecture: "x86_64",
  bundleProductName: "FitFreed",
  category: "HealthcareAndFitness",
  desktopShortcut: "%USERPROFILE%\\Desktop\\FitFreed.lnk",
  executable: "fitfreed.exe",
  homepage: "https://fitfreed.org/",
  installDirectory: "%LOCALAPPDATA%\\FitFreed",
  installMode: "currentUser",
  installerLanguages: Object.freeze(["English", "Spanish"]),
  license: "GPL-3.0-or-later",
  longDescription:
    "FitFreed imports portable fitness data into a local library for private exploration, reports, and export.",
  platform: "win32",
  publisher: "FitFreed contributors",
  shortDescription: "Explore your fitness history on your own computer.",
  startMenuShortcut:
    "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\FitFreed.lnk",
  target: "nsis",
  uninstaller: "uninstall.exe",
  uninstallRegistry:
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed",
  webviewInstallMode: "offlineInstaller",
});

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function expectedWindowsNsisArtifactName(version) {
  if (!versionPattern.test(version)) throw new Error("invalid package version");
  return `${windowsPackageContract.bundleProductName}_${version}_x64-setup.exe`;
}

export function validateWindowsPublicSigningOverlay(config) {
  const errors = [];
  const bundle = config?.bundle ?? {};
  const windows = bundle.windows ?? {};
  const signCommand = windows.signCommand ?? {};
  const topLevelFields = unexpectedFields(config, ["$schema", "bundle"]);
  const bundleFields = unexpectedFields(bundle, ["windows"]);
  const windowsFields = unexpectedFields(windows, ["signCommand"]);
  const commandFields = unexpectedFields(signCommand, ["args", "cmd"]);
  if (topLevelFields.length > 0) {
    errors.push(`Windows public signing overlay has unexpected top-level fields: ${topLevelFields.join(", ")}`);
  }
  if (bundleFields.length > 0) {
    errors.push(`Windows public signing overlay has unexpected bundle fields: ${bundleFields.join(", ")}`);
  }
  if (windowsFields.length > 0) {
    errors.push(`Windows public signing overlay has unexpected Windows fields: ${windowsFields.join(", ")}`);
  }
  if (commandFields.length > 0) {
    errors.push(`Windows public signing overlay has unexpected command fields: ${commandFields.join(", ")}`);
  }
  const expectedArguments = ["../scripts/windows-authenticode-sign.mjs", "%1"];
  if (
    signCommand.cmd !== "node"
    || JSON.stringify(signCommand.args) !== JSON.stringify(expectedArguments)
  ) {
    errors.push("Windows public signing overlay must use the exact signing command");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { arguments: expectedArguments, command: "node" };
}

function unexpectedFields(object, allowed) {
  return Object.keys(object ?? {}).filter((field) => !allowed.includes(field)).sort();
}

export function validateWindowsPackageConfiguration(config, version = "0.1.0") {
  const errors = [];
  const bundle = config.bundle ?? {};
  const windows = bundle.windows ?? {};
  const nsis = windows.nsis ?? {};
  const expectedBundleValues = {
    category: windowsPackageContract.category,
    copyright: "Copyright FitFreed contributors",
    homepage: windowsPackageContract.homepage,
    license: windowsPackageContract.license,
    licenseFile: "../LICENSE",
    longDescription: windowsPackageContract.longDescription,
    publisher: windowsPackageContract.publisher,
    shortDescription: windowsPackageContract.shortDescription,
  };

  const topLevelFields = unexpectedFields(config, ["$schema", "bundle", "productName"]);
  if (topLevelFields.length > 0) {
    errors.push(`Windows Tauri configuration contains unexpected top-level fields: ${topLevelFields.join(", ")}`);
  }
  if (config.productName !== windowsPackageContract.bundleProductName) {
    errors.push(`Windows Tauri productName must be ${windowsPackageContract.bundleProductName}`);
  }
  if (JSON.stringify(bundle.targets) !== JSON.stringify([windowsPackageContract.target])) {
    errors.push("Windows Tauri targets must contain only nsis");
  }
  for (const [field, expected] of Object.entries(expectedBundleValues)) {
    if (bundle[field] !== expected) errors.push(`Windows Tauri bundle ${field} must be ${expected}`);
  }
  const bundleFields = unexpectedFields(bundle, [
    "targets",
    "windows",
    ...Object.keys(expectedBundleValues),
  ]);
  if (bundleFields.length > 0) {
    errors.push(`Windows Tauri configuration contains unexpected bundle fields: ${bundleFields.join(", ")}`);
  }
  if (bundle.fileAssociations !== undefined) {
    errors.push("Windows Tauri configuration must not claim a generic file association");
  }

  if (windows.allowDowngrades !== true) {
    errors.push("Windows NSIS must allow downgrades for authenticated recovery");
  }
  if (windows.webviewInstallMode?.type !== windowsPackageContract.webviewInstallMode) {
    errors.push("Windows WebView2 installation mode must be offlineInstaller");
  }
  if (windows.webviewInstallMode?.silent !== true) {
    errors.push("Windows offline WebView2 installation must remain silent");
  }
  for (const signingField of [
    "certificateThumbprint",
    "digestAlgorithm",
    "signCommand",
    "timestampUrl",
    "tsp",
  ]) {
    if (windows[signingField] !== undefined) {
      errors.push(`Windows source configuration cannot contain signing authority: ${signingField}`);
    }
  }
  const windowsFields = unexpectedFields(windows, ["allowDowngrades", "nsis", "webviewInstallMode"]);
  if (windowsFields.length > 0) {
    errors.push(`Windows configuration contains unexpected fields: ${windowsFields.join(", ")}`);
  }

  if (nsis.installMode !== windowsPackageContract.installMode) {
    errors.push("Windows NSIS install mode must be currentUser");
  }
  if (JSON.stringify(nsis.languages) !== JSON.stringify(windowsPackageContract.installerLanguages)) {
    errors.push("Windows NSIS languages must be English, Spanish");
  }
  if (nsis.displayLanguageSelector !== false) {
    errors.push("Windows NSIS language selector must remain disabled");
  }
  if (nsis.installerIcon !== "icons/icon.ico" || nsis.uninstallerIcon !== "icons/icon.ico") {
    errors.push("Windows NSIS installer and uninstaller must use the canonical icon");
  }
  const nsisFields = unexpectedFields(nsis, [
    "displayLanguageSelector",
    "installerIcon",
    "installMode",
    "languages",
    "uninstallerIcon",
  ]);
  if (nsisFields.length > 0) {
    errors.push(`Windows NSIS configuration contains unexpected NSIS fields: ${nsisFields.join(", ")}`);
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    architecture: windowsPackageContract.architecture,
    installMode: windowsPackageContract.installMode,
    packageName: expectedWindowsNsisArtifactName(version),
    target: windowsPackageContract.target,
    webviewInstallMode: windowsPackageContract.webviewInstallMode,
  };
}
