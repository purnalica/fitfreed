import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  releaseNotesSourcePath,
  validateReviewedReleaseNotes,
} from "./release-notes.mjs";

const initialLocales = Object.freeze(["en-US", "es-ES"]);

const documentContracts = Object.freeze({
  userGuide: {
    path: (version) => `docs/user/public-macos-${version}.md`,
    title: (version) => `Public macOS ${version} Guide`,
    headings: [
      "Status",
      "Preserve the source data first",
      "Download and verify",
      "Install and launch",
      "Language and first run",
      "Import and reimport",
      "Explore the local history",
      "Local data and privacy",
      "Updates and automatic recovery",
      "Remove the application or delete its data",
      "Safe support and security reports",
    ],
    evidence: (version) => [
      [/No public binary is available while/, "inactive public-release status"],
      [new RegExp("immutable `v" + escapeRegExp(version) + "`"), "exact immutable release tag"],
      [/Apple Silicon on macOS 15\.0 or later/, "supported platform boundary"],
      [/English \(United States\) and Spanish \(Spain\)/, "initial locale boundary"],
      [/\*\*Show me how\*\*[\s\S]*bundled localized guide/, "bundled source acquisition"],
      [/exact reimport does not duplicate canonical history/i, "reimport behavior"],
      [/complete-history training sport discovery[\s\S]*user-authored segmentation/, "implemented training exploration"],
      [/privacy-reviewed self-contained HTML export/i, "implemented report export"],
      [/has no account, analytics, or synchronization service/i, "local-first privacy boundary"],
      [/automatic recovery/i, "update recovery guidance"],
      [/org\.fitfreed\.desktop/, "library removal target"],
      [/GitHub private vulnerability reporting|SECURITY\.md/, "security reporting route"],
    ],
  },
  linuxUserGuide: {
    path: (version) => `docs/user/public-linux-${version}.md`,
    title: (version) => `Public Linux ${version} Guide`,
    headings: [
      "Status",
      "Preserve the source data first",
      "Download and verify",
      "Install and first launch",
      "Language and first run",
      "Import, reimport, and exploration",
      "Local data and privacy",
      "Updates and recovery",
      "Remove the application or delete its data",
      "Unsupported systems",
      "Safe support and security reports",
    ],
    evidence: (version) => [
      [/No public Linux binary is available while/, "inactive Linux release status"],
      [new RegExp("immutable `v" + escapeRegExp(version) + "`"), "exact immutable release tag"],
      [/x86-64 Ubuntu Desktop 24\.04 and 26\.04 LTS/, "supported Linux boundary"],
      [new RegExp(`FitFreed_${escapeRegExp(version)}_amd64\\.deb`), "exact Debian package"],
      [/SHA256SUMS\.minisig/, "detached checksum signature"],
      [/English \(United States\) and Spanish \(Spain\)/, "initial locale boundary"],
      [/exact reimport does not duplicate canonical history/i, "reimport behavior"],
      [/complete-history training exploration/i, "implemented training exploration"],
      [/self-contained HTML report export/i, "implemented report export"],
      [/has no account, analytics, or synchronization service/i, "local-first privacy boundary"],
      [/XDG_DATA_HOME[\s\S]*\.local\/share[\s\S]*org\.fitfreed\.desktop/, "Linux library location"],
      [/administrator authorization/i, "native update authorization"],
      [/automatic recovery/i, "update recovery guidance"],
      [/removes the application[\s\S]*retains the separate local library/i, "removal retention boundary"],
      [/ARM64[\s\S]*AppImage[\s\S]*RPM[\s\S]*Flatpak[\s\S]*Snap/, "unsupported Linux boundary"],
      [/GitHub private vulnerability reporting|SECURITY\.md/, "security reporting route"],
    ],
  },
  operations: {
    path: () => "docs/development/public-release-operations.md",
    title: () => "Public Release Operations",
    headings: [
      "Status and authority",
      "Trust and credential inventory",
      "One-time GitHub configuration",
      "Prepare the versioned source",
      "Build approval and sealed candidate",
      "Exact-candidate evaluation",
      "Promotion and remote acceptance",
      "Failure and restart matrix",
      "Pages containment and rollback",
      "Withdrawal and corrective release",
      "Key rotation and compromise",
      "Incident communication and closure",
    ],
    evidence: () => [
      [/public-macos-release/, "protected environment"],
      [/prevent_self_review/, "independent environment review"],
      [/build-candidate/, "candidate build boundary"],
      [/publish-candidate/, "candidate promotion boundary"],
      [/candidate\.tar\.gz/, "sealed candidate transport"],
      [/retained for seven days/i, "candidate retention window"],
      [/receives no Apple or updater secret/i, "secret-free promotion"],
      [/immutable Release/i, "immutable publication"],
      [/withdraw/i, "withdrawal procedure"],
      [/compromise/i, "key-compromise procedure"],
    ],
  },
  manualEvaluation: {
    path: () => "docs/testing/macos-candidate-manual-evaluation.md",
    title: () => "macOS Product-Owner Experience Evaluation",
    headings: [
      "Status and boundary",
      "X6 product-experience profile",
      "Exact-candidate profile",
      "Product-owner experience review",
      "Experience tasks",
      "Recording boundary",
      "Acceptance rule",
    ],
    evidence: () => [
      [/private alpha candidate guide/, "private distribution profile"],
      [/public macOS guide/, "public distribution profile"],
      [
        /Functional correctness belongs to automated unit, integration, contract, packaged end-to-end \(E2E\)/,
        "automated functional responsibility",
      ],
      [/not asked to execute a control matrix/, "product-owner scope boundary"],
      [/sealed Actions artifact awaiting\s+promotion/, "exact public candidate boundary"],
      [/Start without coaching/, "unassisted usability boundary"],
      [/Inspect one training session[\s\S]*analytical depth/, "training-depth experience review"],
      [/Find or create one relevant report[\s\S]*editor by default/, "report experience review"],
      [/prompts for experience judgment, not proof/, "experience-only task boundary"],
      [/Do not ask for a completed control checklist/, "bounded product-owner evidence"],
    ],
  },
  readiness: {
    path: () => "docs/testing/public-release-readiness.md",
    title: () => "Public macOS Release Readiness",
    headings: ["Decision status", "Readiness ledger", "Final acceptance rule"],
    evidence: () => [
      [/not accepted or publicly available/, "inactive release decision"],
      [/single current readiness ledger/, "single current readiness source"],
      [/Passed locally/, "local evidence state"],
      [/Pending hosted verification/, "hosted evidence state"],
      [/Open external gate/, "external gate state"],
      [/Awaiting exact candidate/, "candidate evidence state"],
      [/Not authorized/, "publication authority state"],
      [/Production updater authority/, "production updater gate"],
      [/Developer ID Application/, "Apple trust gate"],
      [/Protected GitHub environment/, "GitHub protection gate"],
      [
        /Functional correctness, keyboard behavior, scaling[\s\S]*exact-candidate automation/,
        "automated candidate responsibility",
      ],
    ],
  },
});

const supportingDocumentEvidence = Object.freeze({
  "DISCLAIMER.md": () => [
    /at your own risk/i,
    /No medical or professional advice/,
    /No legal or regulatory advice/,
  ],
  "SUPPORT.md": (version) => [
    /no supported release/i,
    new RegExp(`public-macos-${escapeRegExp(version)}\\.md`),
    /Never attach a real provider export/,
  ],
  "SECURITY.md": () => [
    /no released or supported version/i,
    /private vulnerability reporting/,
    /synthetic data/,
  ],
});

const requiredCatalogKeys = Object.freeze([
  "settings.language",
  "settings.localeEnglish",
  "settings.localeSpanish",
  "updates.heading",
  "updates.checkNow",
  "updates.releaseNotes",
  "updates.installNotice",
  "updates.install",
  "updates.postpone",
  "updates.recovery.updated",
  "updates.recovery.recovered",
  "updates.recovery.acknowledge",
  "updates.statuses.offline",
  "updates.statuses.available",
  "updates.statuses.withdrawnInstalled",
  "updates.statuses.manualRecoveryRequired",
  "updates.statuses.untrusted",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function flattenMessages(value, prefix = "") {
  const messages = new Map();
  for (const [key, child] of Object.entries(value ?? {})) {
    const messageKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") messages.set(messageKey, child);
    else if (child && typeof child === "object" && !Array.isArray(child)) {
      for (const entry of flattenMessages(child, messageKey)) messages.set(...entry);
    }
  }
  return messages;
}

function inspectMarkdown(errors, name, source, contract, version) {
  if (typeof source !== "string") {
    errors.push(`missing public documentation: ${contract.path(version)}`);
    return;
  }
  if (!source.endsWith("\n")) errors.push(`${name} must end with a newline`);

  const titles = [...source.matchAll(/^# (.+)$/gm)].map((match) => match[1]);
  const expectedTitle = contract.title(version);
  if (titles.length !== 1 || titles[0] !== expectedTitle) {
    errors.push(`${name} must have the single title: ${expectedTitle}`);
  }

  const headings = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  if (JSON.stringify(headings) !== JSON.stringify(contract.headings)) {
    errors.push(`${name} section order must be: ${contract.headings.join("; ")}`);
  }

  for (const [pattern, label] of contract.evidence(version)) {
    if (!pattern.test(source)) errors.push(`${name} does not document ${label}`);
  }
}

export function validatePublicDocumentationBundle(bundle) {
  const errors = [];
  const version = bundle?.version;
  if (typeof version !== "string" || version.length === 0) {
    errors.push("package version is missing");
  }

  for (const [name, contract] of Object.entries(documentContracts)) {
    inspectMarkdown(errors, name, bundle?.documents?.[contract.path(version)], contract, version);
  }

  for (const [documentPath, evidence] of Object.entries(supportingDocumentEvidence)) {
    const source = bundle?.documents?.[documentPath];
    if (typeof source !== "string") {
      errors.push(`missing public documentation: ${documentPath}`);
      continue;
    }
    for (const pattern of evidence(version)) {
      if (!pattern.test(source)) errors.push(`${documentPath} is missing required public guidance: ${pattern}`);
    }
  }

  if (bundle?.policy?.releaseVersion !== version) {
    errors.push("public release policy version does not match package version");
  }
  const policyLocales = Object.keys(bundle?.policy?.update?.releaseNotes ?? {}).sort();
  if (JSON.stringify(policyLocales) !== JSON.stringify([...initialLocales].sort())) {
    errors.push(`public release policy locales must be exactly: ${initialLocales.join(", ")}`);
  }
  for (const locale of initialLocales) {
    const note = bundle?.policy?.update?.releaseNotes?.[locale];
    if (typeof note !== "string" || note.trim().length === 0) {
      errors.push(`public release policy note is empty for ${locale}`);
    }

    const messages = flattenMessages(bundle?.catalogs?.[locale]);
    for (const key of requiredCatalogKeys) {
      if (!messages.get(key)?.trim()) errors.push(`${locale} catalog is missing public guidance: ${key}`);
    }
  }

  try {
    validateReviewedReleaseNotes(bundle?.reviewedReleaseNotes);
  } catch (error) {
    errors.push(`reviewed release notes are not distribution-neutral: ${error.message}`);
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    version,
    documents: Object.keys(bundle.documents).length,
    locales: [...initialLocales],
    catalogGuidanceKeys: requiredCatalogKeys.length,
  };
}

export function loadPublicDocumentationBundle(repositoryRoot) {
  const packageMetadata = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
  const version = packageMetadata.version;
  const documentPaths = [
    ...Object.values(documentContracts).map((contract) => contract.path(version)),
    ...Object.keys(supportingDocumentEvidence),
  ];
  return {
    version,
    documents: Object.fromEntries(documentPaths.map((documentPath) => [
      documentPath,
      readFileSync(path.join(repositoryRoot, documentPath), "utf8"),
    ])),
    policy: JSON.parse(readFileSync(
      path.join(repositoryRoot, "release", "publication", `${version}.json`),
      "utf8",
    )),
    catalogs: Object.fromEntries(initialLocales.map((locale) => [
      locale,
      JSON.parse(readFileSync(path.join(repositoryRoot, "src", "locales", `${locale}.json`), "utf8")),
    ])),
    reviewedReleaseNotes: readFileSync(path.join(repositoryRoot, releaseNotesSourcePath(version)), "utf8"),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    process.stdout.write(
      `${JSON.stringify(validatePublicDocumentationBundle(loadPublicDocumentationBundle(repositoryRoot)))}\n`,
    );
  } catch (error) {
    process.stderr.write(`Public documentation check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
