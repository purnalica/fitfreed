const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const requiredReleaseNoteSections = Object.freeze([
  "Highlights",
  "Compatibility",
  "Privacy and data",
  "Known limitations",
  "Installation and recovery",
  "Support",
]);

const deliveryStateClaims = Object.freeze([
  { pattern: /\b(?:un)?signed\b/i, label: "code-signing state" },
  { pattern: /\bnotari[sz]/i, label: "notarization state" },
  { pattern: /\bpublic release\b/i, label: "public-release state" },
  {
    pattern: /\bprivate (?:alpha|candidate|development|distribution|package|release)\b/i,
    label: "private-distribution state",
  },
  { pattern: /\bproduction (?:trust|update)/i, label: "production-channel state" },
]);

export function releaseNotesSourcePath(version) {
  if (!semanticVersion.test(version ?? "")) {
    throw new Error(`invalid release notes version: ${version}`);
  }
  return `release/notes/${version}.md`;
}

export function validateReviewedReleaseNotes(source) {
  if (typeof source !== "string") {
    throw new Error("reviewed release notes must be a string");
  }

  const errors = [];
  if (!source.endsWith("\n")) errors.push("reviewed release notes must end with a newline");
  if (!source.startsWith("## Highlights\n")) {
    errors.push("reviewed release notes must begin with the Highlights section");
  }
  if (/^# /m.test(source)) {
    errors.push("reviewed release notes must not contain a level-one heading");
  }

  const headings = [...source.matchAll(/^## (.+)$/gm)].map((match) => ({
    title: match[1],
    index: match.index,
    bodyStart: match.index + match[0].length,
  }));
  const headingTitles = headings.map(({ title }) => title);

  for (const requiredSection of requiredReleaseNoteSections) {
    const count = headingTitles.filter((title) => title === requiredSection).length;
    if (count === 0) errors.push(`missing required section: ${requiredSection}`);
    if (count > 1) errors.push(`duplicated required section: ${requiredSection}`);
  }

  for (const title of headingTitles) {
    if (!requiredReleaseNoteSections.includes(title)) {
      errors.push(`unexpected release-note section: ${title}`);
    }
  }

  if (
    headingTitles.length !== requiredReleaseNoteSections.length
    || headingTitles.some((title, index) => title !== requiredReleaseNoteSections[index])
  ) {
    errors.push("release-note sections must appear exactly once in the required order");
  }

  for (const [index, heading] of headings.entries()) {
    if (!requiredReleaseNoteSections.includes(heading.title)) continue;
    const bodyEnd = headings[index + 1]?.index ?? source.length;
    if (source.slice(heading.bodyStart, bodyEnd).trim().length === 0) {
      errors.push(`release-note section has no content: ${heading.title}`);
    }
  }

  for (const { pattern, label } of deliveryStateClaims) {
    if (pattern.test(source)) {
      errors.push(`reviewed release notes contain generated ${label}`);
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return source;
}
