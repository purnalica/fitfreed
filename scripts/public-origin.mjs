import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  readFileSync(new URL("../schemas/public-origin-v1.schema.json", import.meta.url), "utf8"),
);
const configuration = JSON.parse(
  readFileSync(new URL("../release/public-origin.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

export function validatePublicOriginConfiguration(candidate) {
  const errors = [];
  if (!validateSchema(candidate)) {
    errors.push(...validateSchema.errors.map(
      ({ instancePath, message }) =>
        `public origin violation at ${instancePath || "/"}: ${message}`,
    ));
  }
  try {
    const url = new URL(candidate?.canonicalOrigin);
    if (url.protocol !== "https:") errors.push("public origin must use HTTPS");
    if (url.username || url.password) errors.push("public origin must not contain credentials");
    if (url.port) errors.push("public origin must use the default HTTPS port");
    if (url.pathname !== "/" || url.search || url.hash) {
      errors.push("public origin must not contain a path, query, or fragment");
    }
    if (url.hostname.toLowerCase().startsWith("www.")) {
      errors.push("public origin must use the apex domain");
    }
  } catch {
    errors.push("public origin must be an absolute URL");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return candidate;
}

export const publicOrigin = validatePublicOriginConfiguration(configuration).canonicalOrigin;

export function publicUpdateUrl(relativePath) {
  if (
    typeof relativePath !== "string"
    || relativePath.length === 0
    || relativePath.startsWith("/")
    || relativePath.includes("?")
    || relativePath.includes("#")
    || relativePath.split("/").includes("..")
  ) {
    throw new Error("public update path is unsafe");
  }
  return new URL(`updates/${relativePath}`, publicOrigin).toString();
}

export const publicUpdateEndpoint = publicUpdateUrl("stable.json");
