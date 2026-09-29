import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const appRoot = path.join(repoRoot, "cloudagent-desktop", "release", "app");
const nodeModulesRoot = path.join(appRoot, "node_modules");
const outputPath = path.join(appRoot, "legal", "THIRD_PARTY_LICENSES.md");

const LEGAL_FILE_PATTERN = /^(licen[cs]e|copying|notice)(\..*|[-_].*)?$/i;

function normalizeLicense(packageJson) {
  if (typeof packageJson.license === "string" && packageJson.license.trim()) {
    return packageJson.license.trim();
  }

  if (Array.isArray(packageJson.licenses)) {
    const expressions = packageJson.licenses
      .map((entry) => (typeof entry === "string" ? entry : entry?.type))
      .filter(Boolean);
    if (expressions.length > 0) return expressions.join(" OR ");
  }

  throw new Error(
    `Package ${packageJson.name || "<unknown>"}@${packageJson.version || "<unknown>"} has no declared license`
  );
}

async function readPackage(packageRoot) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  let packageJson;
  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Unable to read ${packageJsonPath}: ${error.message}`);
  }

  if (!packageJson.name || !packageJson.version) {
    throw new Error(`Package metadata is incomplete in ${packageJsonPath}`);
  }

  const directoryEntries = await fs.readdir(packageRoot, { withFileTypes: true });
  const legalFileNames = directoryEntries
    .filter((entry) => entry.isFile() && LEGAL_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const legalFiles = await Promise.all(
    legalFileNames.map(async (name) => ({
      name,
      text: (await fs.readFile(path.join(packageRoot, name), "utf8")).trim(),
    }))
  );

  return {
    name: packageJson.name,
    version: packageJson.version,
    license: normalizeLicense(packageJson),
    legalFiles,
  };
}

async function collectPackagesFromNodeModules(nodeModulesPath, collected) {
  let entries;
  try {
    entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    if (entry.name.startsWith("@")) {
      const scopePath = path.join(nodeModulesPath, entry.name);
      const scopedEntries = await fs.readdir(scopePath, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (!scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink()) continue;
        await collectPackage(path.join(scopePath, scopedEntry.name), collected);
      }
      continue;
    }

    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    await collectPackage(path.join(nodeModulesPath, entry.name), collected);
  }
}

async function collectPackage(packageRoot, collected) {
  const packageRecord = await readPackage(packageRoot);
  if (!packageRecord) return;

  if (!packageRecord.name.startsWith("@cloudagent/")) {
    const identity = `${packageRecord.name}@${packageRecord.version}`;
    const serialized = JSON.stringify(packageRecord);
    const existing = collected.get(identity);
    if (existing && JSON.stringify(existing) !== serialized) {
      throw new Error(`Conflicting license metadata found for ${identity}`);
    }
    collected.set(identity, packageRecord);
  }

  await collectPackagesFromNodeModules(path.join(packageRoot, "node_modules"), collected);
}

function longestBacktickRun(value) {
  return Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
}

function fencedText(value) {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(value) + 1));
  return `${fence}text\n${value}\n${fence}`;
}

function renderInventory(appVersion, packages) {
  const licenseCounts = new Map();
  for (const packageRecord of packages) {
    licenseCounts.set(
      packageRecord.license,
      (licenseCounts.get(packageRecord.license) || 0) + 1
    );
  }

  const noticeGroups = new Map();
  for (const packageRecord of packages) {
    const groupKey = JSON.stringify({
      license: packageRecord.license,
      legalFiles: packageRecord.legalFiles,
    });
    const group = noticeGroups.get(groupKey) || {
      license: packageRecord.license,
      legalFiles: packageRecord.legalFiles,
      packages: [],
    };
    group.packages.push(`${packageRecord.name}@${packageRecord.version}`);
    noticeGroups.set(groupKey, group);
  }

  const lines = [
    "# Third-Party Package Licenses",
    "",
    `This file was generated for CloudAgent Console ${appVersion} from the exact production`,
    "packages installed into the desktop application. Do not edit it manually.",
    "",
    "Electron and Chromium notices are distributed separately as",
    "`ELECTRON_LICENSE.txt` and `LICENSES.chromium.html`.",
    "",
    "## Summary",
    "",
    "| Declared license | Packages |",
    "| --- | ---: |",
    ...[...licenseCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([license, count]) => `| ${license.replaceAll("|", "\\|")} | ${count} |`),
    "",
  ];

  for (const group of [...noticeGroups.values()].sort((left, right) =>
    left.packages[0].localeCompare(right.packages[0])
  )) {
    const heading =
      group.packages.length === 1
        ? group.packages[0]
        : `${group.packages[0]} and ${group.packages.length - 1} other ${
            group.packages.length === 2 ? "package" : "packages"
          }`;
    lines.push(
      `## ${heading}`,
      "",
      `Declared license: \`${group.license}\``,
      ""
    );

    if (group.packages.length > 1) {
      lines.push("Packages covered by this identical published notice:", "");
      lines.push(...group.packages.map((identity) => `- ${identity}`), "");
    }

    if (group.legalFiles.length === 0) {
      lines.push(
        "The published package did not include a package-level license or notice file.",
        "Its declared license expression is recorded above; the distribution also includes",
        "the Apache License 2.0 text used by Apache-licensed dependencies.",
        ""
      );
      continue;
    }

    for (const legalFile of group.legalFiles) {
      lines.push(`### ${legalFile.name}`, "", fencedText(legalFile.text), "");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  const appPackage = JSON.parse(
    await fs.readFile(path.join(appRoot, "package.json"), "utf8")
  );
  const collected = new Map();
  await collectPackagesFromNodeModules(nodeModulesRoot, collected);

  const packages = [...collected.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.version.localeCompare(right.version)
  );
  if (packages.length === 0) {
    throw new Error(`No production packages found in ${nodeModulesRoot}`);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderInventory(appPackage.version, packages), "utf8");
  console.log(`Generated licenses for ${packages.length} third-party packages at ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
