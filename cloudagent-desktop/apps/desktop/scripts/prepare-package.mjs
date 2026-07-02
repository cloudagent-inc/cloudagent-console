import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const releaseRoot = path.join(repoRoot, "cloudagent-desktop", "release");
const appRoot = path.join(releaseRoot, "app");

const runtimeCorePackages = [
  "agent-runtime",
  "cloudagent",
  "cloudagent-tools",
  "diagrams/icons",
  "mcp",
  "platform",
  "scanners",
  "skills",
  "storage",
  "workflows",
  "workloads",
];

const cloudAgentPackageDependencies = {
  "@cloudagent/agent-runtime": "file:core/agent-runtime",
  "@cloudagent/cloudagent": "file:core/cloudagent",
  "@cloudagent/cloudagent-tools": "file:core/cloudagent-tools",
  "@cloudagent/core": "file:core/platform",
  "@cloudagent/diagram-ui-icons": "file:core/diagrams/icons",
  "@cloudagent/mcp": "file:core/mcp",
  "@cloudagent/scanners": "file:core/scanners",
  "@cloudagent/skills": "file:core/skills",
  "@cloudagent/storage": "file:core/storage",
  "@cloudagent/workflows": "file:core/workflows",
  "@cloudagent/workloads": "file:core/workloads",
};

function readJson(filePath) {
  return fs.readFile(filePath, "utf8").then((raw) => JSON.parse(raw));
}

function shouldCopyRuntimeFile(source, { allowDist = false } = {}) {
  const parts = source.split(path.sep);
  if (parts.includes("node_modules")) return false;
  if (!allowDist && parts.includes("dist")) return false;
  if (parts.includes("build")) return false;
  if (parts.includes(".cloudagent")) return false;
  if (parts.includes("coverage")) return false;
  if (parts.includes("__tests__")) return false;
  if (parts.includes("test") || parts.includes("tests")) return false;
  const base = path.basename(source);
  if (base === ".DS_Store") return false;
  if (base.endsWith(".log")) return false;
  return true;
}

async function copyDirectory(from, to, options = {}) {
  await fs.cp(from, to, {
    recursive: true,
    force: true,
    filter: (source) => shouldCopyRuntimeFile(source, options),
  });
}

async function copyCorePackages() {
  await Promise.all(
    runtimeCorePackages.map((packagePath) =>
      copyDirectory(path.join(repoRoot, "core", packagePath), path.join(appRoot, "core", packagePath))
    )
  );
}

async function writePackageJson() {
  const rootPackage = await readJson(path.join(repoRoot, "package.json"));
  const apiPackage = await readJson(
    path.join(repoRoot, "cloudagent-desktop", "apps", "api", "package.json")
  );
  const apiDependencies = apiPackage.dependencies || {};
  const externalApiDependencies = Object.fromEntries(
    Object.entries(apiDependencies).filter(([name]) => !name.startsWith("@cloudagent/"))
  );

  const packageJson = {
    name: "cloudagent-desktop-runtime",
    version: rootPackage.version || "0.1.0",
    private: true,
    type: "module",
    main: "cloudagent-desktop/apps/desktop/src/main/main.mjs",
    dependencies: {
      ...externalApiDependencies,
      ...cloudAgentPackageDependencies,
    },
  };

  await fs.writeFile(
    path.join(appRoot, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8"
  );
}

async function main() {
  await fs.rm(appRoot, { recursive: true, force: true });
  await fs.mkdir(appRoot, { recursive: true });

  await Promise.all([
    copyDirectory(
      path.join(repoRoot, "cloudagent-desktop", "apps", "desktop", "src"),
      path.join(appRoot, "cloudagent-desktop", "apps", "desktop", "src")
    ),
    copyDirectory(
      path.join(repoRoot, "cloudagent-desktop", "apps", "api", "src"),
      path.join(appRoot, "cloudagent-desktop", "apps", "api", "src")
    ),
    copyDirectory(
      path.join(repoRoot, "cloudagent-desktop", "apps", "ui", "dist"),
      path.join(appRoot, "cloudagent-desktop", "apps", "ui", "dist"),
      { allowDist: true }
    ),
    copyCorePackages(),
  ]);

  await writePackageJson();

  console.log(`Prepared CloudAgent desktop package app at ${appRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
