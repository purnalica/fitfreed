import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = [".ts", ".tsx", ".css", ".json", ".svg"];
const externalCssClasses = new Set([
  "leaflet-container",
  "leaflet-control",
  "leaflet-control-scale-line",
  "leaflet-pane",
]);
const indexedLocalePaths = [
  // Settings indexes these labels through the closed AppearancePreference union.
  "settings.system",
  "settings.light",
  "settings.dark",
];

function filesBelow(directory, predicate = () => true) {
  if (!statSync(directory).isDirectory()) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(candidate, predicate);
    return predicate(candidate) ? [candidate] : [];
  });
}

function relative(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join("/");
}

export function findUnreachableFiles(entry, modules) {
  const reached = new Set();
  function visit(candidate) {
    if (reached.has(candidate) || !modules.has(candidate)) return;
    reached.add(candidate);
    for (const dependency of modules.get(candidate)) visit(dependency);
  }
  visit(entry);
  return [...modules.keys()].filter((candidate) => !reached.has(candidate)).sort();
}

export function findUnreferencedCssClasses({
  selectors,
  references,
  dynamicPrefixes,
  externalClasses,
}) {
  return selectors.filter((selector) => (
    !references.has(selector)
    && !externalClasses.has(selector)
    && ![...dynamicPrefixes].some((prefix) => selector.startsWith(prefix))
  )).sort();
}

function flattenLocale(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const candidate = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string"
      ? [candidate]
      : flattenLocale(child, candidate);
  });
}

export function findUnusedLocalePaths(locale, usedPaths, subtreePaths) {
  return flattenLocale(locale).filter((candidate) => (
    !usedPaths.has(candidate)
    && ![...subtreePaths].some((prefix) => candidate.startsWith(`${prefix}.`))
  )).sort();
}

function resolveImport(root, importer, specifier, knownFiles) {
  if (!specifier.startsWith(".")) return null;
  const withoutQuery = specifier.split("?")[0];
  const unresolved = path.resolve(path.dirname(importer), withoutQuery);
  for (const candidate of [
    unresolved,
    ...sourceExtensions.map((extension) => `${unresolved}${extension}`),
    ...sourceExtensions.map((extension) => path.join(unresolved, `index${extension}`)),
  ]) {
    const repositoryPath = relative(root, candidate);
    if (knownFiles.has(repositoryPath)) return repositoryPath;
  }
  return null;
}

function sourceGraph(root) {
  const sourceRoot = path.join(root, "src");
  const assetRoot = path.join(root, "assets");
  const candidates = [
    ...filesBelow(sourceRoot, (candidate) => sourceExtensions.includes(path.extname(candidate))),
    ...filesBelow(assetRoot, (candidate) => path.extname(candidate) === ".svg"),
  ];
  const knownFiles = new Set(candidates.map((candidate) => relative(root, candidate)));
  const modules = new Map();
  const importPattern = /(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g;

  for (const candidate of candidates) {
    const repositoryPath = relative(root, candidate);
    if (!/\.(?:ts|tsx)$/.test(candidate)) {
      modules.set(repositoryPath, []);
      continue;
    }
    const source = readFileSync(candidate, "utf8");
    const dependencies = [...source.matchAll(importPattern)]
      .map((match) => resolveImport(root, candidate, match[1], knownFiles))
      .filter(Boolean);
    modules.set(repositoryPath, [...new Set(dependencies)]);
  }

  const productionModules = new Map(
    [...modules].filter(([candidate]) => (
      !/\.test\.[tj]sx?$/.test(candidate)
      && candidate !== "src/test-setup.ts"
      && candidate !== "src/vite-env.d.ts"
      && !candidate.endsWith(".json")
      && !candidate.endsWith(".svg")
    )),
  );
  for (const [candidate, dependencies] of productionModules) {
    productionModules.set(
      candidate,
      dependencies.filter((dependency) => productionModules.has(dependency)),
    );
  }
  return { candidates, modules, productionModules };
}

function cssInventory(root, graph) {
  const stylesheetPath = path.join(root, "src", "App.css");
  const stylesheet = readFileSync(stylesheetPath, "utf8");
  const selectors = [...new Set(
    [...stylesheet.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]),
  )];
  const reached = new Set();
  function visit(candidate) {
    if (reached.has(candidate) || !graph.modules.has(candidate)) return;
    reached.add(candidate);
    for (const dependency of graph.modules.get(candidate)) visit(dependency);
  }
  visit("src/main.tsx");
  const runtimeText = [...reached]
    .map((candidate) => readFileSync(path.join(root, candidate), "utf8"))
    .join("\n");
  const references = new Set(
    selectors.filter((selector) => runtimeText.includes(selector)),
  );
  const dynamicPrefixes = new Set(
    [...runtimeText.matchAll(/([A-Za-z_][A-Za-z0-9_-]*-)\$\{/g)]
      .map((match) => match[1]),
  );
  return {
    selectorCount: selectors.length,
    unreferenced: findUnreferencedCssClasses({
      selectors,
      references,
      dynamicPrefixes,
      externalClasses: externalCssClasses,
    }),
  };
}

function jsonDeclarationPath(declaration, canonicalLocalePath) {
  if (path.resolve(declaration.getSourceFile().fileName) !== canonicalLocalePath) return null;
  const parts = [];
  let current = declaration;
  while (current) {
    if (ts.isPropertyAssignment(current)) {
      const name = current.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        parts.unshift(name.text);
      }
    }
    current = current.parent;
  }
  return parts.join(".");
}

function localeUsage(root) {
  const configPath = path.join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const canonicalLocalePath = path.join(root, "src", "locales", "en-US.json");
  const locale = JSON.parse(readFileSync(canonicalLocalePath, "utf8"));
  const localeLeaves = new Set(flattenLocale(locale));
  const usedPaths = new Set();
  const subtreePaths = new Set();

  function declarationsFor(node) {
    return checker.getSymbolAtLocation(node)?.declarations ?? [];
  }

  function localePathFor(node) {
    for (const declaration of declarationsFor(node)) {
      const candidate = jsonDeclarationPath(declaration, canonicalLocalePath);
      if (candidate) return candidate;
    }
    return null;
  }

  function markTypeContract(prefix, type, location, seen = new Set()) {
    if (!type || seen.has(type)) return;
    seen.add(type);
    if (type.isUnion()) {
      for (const member of type.types) markTypeContract(prefix, member, location, seen);
      return;
    }
    if (type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) {
      if (localeLeaves.has(prefix)) usedPaths.add(prefix);
      return;
    }
    const properties = checker.getPropertiesOfType(type);
    if (properties.length === 0) {
      if (checker.getIndexTypeOfType(type, ts.IndexKind.String)) subtreePaths.add(prefix);
      return;
    }
    for (const property of properties) {
      const name = property.getName();
      const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location;
      markTypeContract(
        `${prefix}.${name}`,
        checker.getTypeOfSymbolAtLocation(property, declaration),
        location,
        new Set(seen),
      );
    }
  }

  function markElementKeys(prefix, argument) {
    const argumentType = checker.getTypeAtLocation(argument);
    const members = argumentType.isUnion() ? argumentType.types : [argumentType];
    const keys = members.flatMap((member) => (
      member.isStringLiteral() ? [member.value] : []
    ));
    if (keys.length === members.length && keys.length > 0) {
      for (const key of keys) {
        const candidate = `${prefix}.${key}`;
        if (localeLeaves.has(candidate)) usedPaths.add(candidate);
        else subtreePaths.add(candidate);
      }
    } else {
      subtreePaths.add(prefix);
    }
  }

  for (const dynamicPath of indexedLocalePaths) usedPaths.add(dynamicPath);

  for (const sourceFile of program.getSourceFiles()) {
    const sourcePath = path.resolve(sourceFile.fileName);
    if (!sourcePath.startsWith(`${path.join(root, "src")}${path.sep}`)
      || /\.test\.[tj]sx?$/.test(sourceFile.fileName)
      || sourceFile.fileName.endsWith("test-setup.ts")) {
      continue;
    }
    function visit(node) {
      if (ts.isPropertyAccessExpression(node)) {
        const localePath = localePathFor(node.name);
        if (localePath) {
          if (localeLeaves.has(localePath)) usedPaths.add(localePath);
          const parent = node.parent;
          const isReceiver = ts.isPropertyAccessExpression(parent) && parent.expression === node;
          if (!localeLeaves.has(localePath) && !isReceiver) {
            if (ts.isElementAccessExpression(parent) && parent.expression === node) {
              markElementKeys(localePath, parent.argumentExpression);
            } else {
              const contextualType = checker.getContextualType(node);
              const narrowsContract = contextualType
                && checker.typeToString(contextualType) !== checker.typeToString(
                  checker.getTypeAtLocation(node),
                );
              if (narrowsContract) {
                markTypeContract(localePath, contextualType, node);
              } else if (!ts.isJsxExpression(parent) && !ts.isCallExpression(parent)) {
                subtreePaths.add(localePath);
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  return {
    localeKeyCount: localeLeaves.size,
    unused: findUnusedLocalePaths(locale, usedPaths, subtreePaths),
  };
}

function automationInventory(root) {
  const scriptDirectory = path.join(root, "scripts");
  const scripts = filesBelow(scriptDirectory, (candidate) => statSync(candidate).isFile());
  const workflowDirectory = path.join(root, ".github", "workflows");
  const workflows = filesBelow(workflowDirectory, (candidate) => statSync(candidate).isFile());
  const packageManifest = readFileSync(path.join(root, "package.json"), "utf8");
  const sources = new Map([
    ...scripts.map((candidate) => [candidate, readFileSync(candidate, "utf8")]),
    ...workflows.map((candidate) => [candidate, readFileSync(candidate, "utf8")]),
  ]);
  const orphanScripts = scripts.filter((candidate) => {
    if (candidate.endsWith(".test.mjs")) return false;
    const basename = path.basename(candidate);
    const scriptRelativePath = relative(scriptDirectory, candidate);
    return !packageManifest.includes(`scripts/${basename}`)
      && ![...sources].some(([sourcePath, source]) => (
        sourcePath !== candidate
        && (
          source.includes(`scripts/${scriptRelativePath}`)
          || source.includes(`./${scriptRelativePath}`)
          || source.includes(`./${basename}`)
        )
      ));
  }).map((candidate) => relative(root, candidate)).sort();

  const testFiles = filesBelow(path.join(root, "test"), (candidate) => statSync(candidate).isFile());
  const automationText = `${packageManifest}\n${[...sources.values()].join("\n")}`;
  const orphanTests = testFiles.filter((candidate) => {
    const repositoryPath = relative(root, candidate);
    if (automationText.includes(repositoryPath)) return false;
    const basename = path.basename(candidate);
    return !testFiles.some((sourcePath) => (
      sourcePath !== candidate && readFileSync(sourcePath, "utf8").includes(basename)
    ));
  }).map((candidate) => relative(root, candidate)).sort();

  return {
    scriptCount: scripts.length,
    scriptTestCount: scripts.filter((candidate) => candidate.endsWith(".test.mjs")).length,
    e2eFileCount: testFiles.length,
    orphanScripts,
    orphanTests,
  };
}

export function auditPresentationInventory(root = repositoryRoot) {
  const graph = sourceGraph(root);
  const unreachable = findUnreachableFiles("src/main.tsx", graph.productionModules);
  const css = cssInventory(root, graph);
  const locale = localeUsage(root);
  const automation = automationInventory(root);
  return {
    productionModuleCount: graph.productionModules.size,
    unreachable,
    css,
    locale,
    automation,
  };
}

function validateInventory(inventory) {
  const errors = [];
  if (inventory.unreachable.length > 0) {
    errors.push(`unreachable production modules: ${inventory.unreachable.join(", ")}`);
  }
  if (inventory.css.unreferenced.length > 0) {
    errors.push(`unreferenced CSS classes: ${inventory.css.unreferenced.join(", ")}`);
  }
  if (inventory.locale.unused.length > 0) {
    errors.push(`unused locale keys: ${inventory.locale.unused.join(", ")}`);
  }
  if (inventory.automation.orphanScripts.length > 0) {
    errors.push(`unreferenced scripts: ${inventory.automation.orphanScripts.join(", ")}`);
  }
  if (inventory.automation.orphanTests.length > 0) {
    errors.push(`unreferenced packaged tests: ${inventory.automation.orphanTests.join(", ")}`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return inventory;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(validateInventory(auditPresentationInventory()))}\n`);
  } catch (error) {
    process.stderr.write(`Presentation inventory check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
