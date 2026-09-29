import fs from "node:fs/promises";
import path from "node:path";

const REQUIRED_LEGAL_FILES = [
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "THIRD_PARTY_LICENSES.md",
  "ELECTRON_LICENSE.txt",
  "LICENSES.chromium.html",
];

export default async function verifyPackagedLegalFiles(context) {
  const resourcesPath =
    context.electronPlatformName === "darwin"
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "Resources"
        )
      : path.join(context.appOutDir, "resources");
  const legalPath = path.join(resourcesPath, "legal");
  const missing = [];

  for (const fileName of REQUIRED_LEGAL_FILES) {
    const filePath = path.join(legalPath, fileName);
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile() || stats.size === 0) missing.push(fileName);
    } catch (error) {
      if (error?.code === "ENOENT") {
        missing.push(fileName);
      } else {
        throw error;
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Packaged legal files are missing or empty in ${legalPath}: ${missing.join(", ")}`
    );
  }

  console.log(`Verified ${REQUIRED_LEGAL_FILES.length} packaged legal files in ${legalPath}`);
}
