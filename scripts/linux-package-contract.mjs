export const linuxPackageContract = Object.freeze({
  architecture: "amd64",
  bundleProductName: "fitfreed",
  category: "HealthcareAndFitness",
  desktopEntryPath: "usr/share/applications/fitfreed.desktop",
  desktopTemplate: "linux/fitfreed.desktop.hbs",
  executablePath: "usr/bin/fitfreed",
  homepage: "https://fitfreed.org/",
  license: "GPL-3.0-or-later",
  licensePath: "usr/share/doc/fitfreed/copyright",
  longDescription:
    "FitFreed imports portable fitness data into a local library for private exploration, reports, and export.",
  packageName: "fitfreed",
  platform: "linux",
  priority: "optional",
  publisher: "FitFreed contributors",
  requiredDependencies: ["libgtk-3-0", "libwebkit2gtk-4.1-0"],
  requiredIconPaths: [
    "usr/share/icons/hicolor/32x32/apps/fitfreed.png",
    "usr/share/icons/hicolor/128x128/apps/fitfreed.png",
  ],
  section: "utils",
  shortDescription: "Explore your fitness history on your own computer.",
  target: "deb",
});

export function expectedLinuxDebianArtifactName(version) {
  return `FitFreed_${version}_${linuxPackageContract.architecture}.deb`;
}

export function validateLinuxPackageConfiguration(config) {
  const errors = [];
  const bundle = config.bundle ?? {};
  const deb = bundle.linux?.deb ?? {};
  const unexpectedTopLevelFields = Object.keys(config)
    .filter((field) => !["$schema", "bundle", "productName"].includes(field))
    .sort();
  if (unexpectedTopLevelFields.length > 0) {
    errors.push(`Linux Tauri configuration contains unexpected top-level fields: ${unexpectedTopLevelFields.join(", ")}`);
  }
  if (config.productName !== linuxPackageContract.bundleProductName) {
    errors.push(`Linux Tauri productName must be ${linuxPackageContract.bundleProductName}`);
  }
  const expectedBundleValues = {
    publisher: linuxPackageContract.publisher,
    homepage: linuxPackageContract.homepage,
    copyright: "Copyright FitFreed contributors",
    license: linuxPackageContract.license,
    licenseFile: "../LICENSE",
    category: linuxPackageContract.category,
    shortDescription: linuxPackageContract.shortDescription,
    longDescription: linuxPackageContract.longDescription,
  };
  if (JSON.stringify(bundle.targets) !== JSON.stringify([linuxPackageContract.target])) {
    errors.push("Linux Tauri targets must contain only deb");
  }
  for (const [field, expected] of Object.entries(expectedBundleValues)) {
    if (bundle[field] !== expected) errors.push(`Linux Tauri bundle ${field} must be ${expected}`);
  }
  const allowedBundleFields = ["linux", "targets", ...Object.keys(expectedBundleValues)];
  const unexpectedBundleFields = Object.keys(bundle)
    .filter((field) => !allowedBundleFields.includes(field))
    .sort();
  if (unexpectedBundleFields.length > 0) {
    errors.push(`Linux Tauri configuration contains unexpected bundle fields: ${unexpectedBundleFields.join(", ")}`);
  }
  if (bundle.fileAssociations !== undefined) {
    errors.push("Linux Tauri configuration must not claim a generic file association");
  }
  if (deb.section !== linuxPackageContract.section) {
    errors.push(`Debian section must be ${linuxPackageContract.section}`);
  }
  if (deb.priority !== linuxPackageContract.priority) {
    errors.push(`Debian priority must be ${linuxPackageContract.priority}`);
  }
  if (deb.desktopTemplate !== linuxPackageContract.desktopTemplate) {
    errors.push(`Debian desktop template must be ${linuxPackageContract.desktopTemplate}`);
  }
  const unexpectedLinuxFields = Object.keys(bundle.linux ?? {})
    .filter((field) => field !== "deb")
    .sort();
  if (unexpectedLinuxFields.length > 0) {
    errors.push(`Linux Tauri configuration contains unexpected Linux fields: ${unexpectedLinuxFields.join(", ")}`);
  }
  const expectedFiles = { [`/${linuxPackageContract.licensePath}`]: "../LICENSE" };
  if (JSON.stringify(deb.files) !== JSON.stringify(expectedFiles)) {
    errors.push("Debian custom files must contain only the canonical GPL license destination");
  }
  const allowedDebFields = ["desktopTemplate", "files", "priority", "section"];
  const unexpectedDebFields = Object.keys(deb).filter((field) => !allowedDebFields.includes(field));
  if (unexpectedDebFields.length > 0) {
    errors.push(`Debian configuration contains unexpected fields: ${unexpectedDebFields.join(", ")}`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    architecture: linuxPackageContract.architecture,
    packageName: linuxPackageContract.packageName,
    productName: linuxPackageContract.bundleProductName,
    target: linuxPackageContract.target,
  };
}
