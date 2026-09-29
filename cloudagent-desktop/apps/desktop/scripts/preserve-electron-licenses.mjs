import fs from "node:fs/promises";
import path from "node:path";

async function firstExistingPath(paths) {
  for (const candidate of paths) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isFile() && stats.size > 0) return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function findMacResourcesPath(appOutDir) {
  const entries = await fs.readdir(appOutDir, { withFileTypes: true });
  const appBundles = entries.filter(
    (entry) => entry.isDirectory() && entry.name.endsWith(".app")
  );
  if (appBundles.length !== 1) {
    throw new Error(
      `Expected one extracted Electron app in ${appOutDir}, found ${appBundles.length}`
    );
  }
  return path.join(appOutDir, appBundles[0].name, "Contents", "Resources");
}

export default async function preserveElectronLicenses(context) {
  const resourcesPath =
    context.electronPlatformName === "darwin"
      ? await findMacResourcesPath(context.appOutDir)
      : path.join(context.appOutDir, "resources");
  const legalPath = path.join(resourcesPath, "legal");
  const electronLicensePath = await firstExistingPath([
    path.join(context.appOutDir, "LICENSE"),
    path.join(context.appOutDir, "LICENSE.electron.txt"),
  ]);
  const chromiumLicensesPath = await firstExistingPath([
    path.join(context.appOutDir, "LICENSES.chromium.html"),
  ]);

  if (!electronLicensePath || !chromiumLicensesPath) {
    throw new Error(
      `Electron distribution licenses are missing from ${context.appOutDir}; refusing to package an incomplete legal notice set`
    );
  }

  await fs.mkdir(legalPath, { recursive: true });
  await Promise.all([
    fs.copyFile(electronLicensePath, path.join(legalPath, "ELECTRON_LICENSE.txt")),
    fs.copyFile(chromiumLicensesPath, path.join(legalPath, "LICENSES.chromium.html")),
  ]);

  console.log(`Preserved Electron and Chromium licenses in ${legalPath}`);
}
