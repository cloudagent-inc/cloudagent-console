export const DEFAULT_SKELETON_SETTINGS = Object.freeze({
  maxPhases: 6,
  maxTasksPerPhase: 8,
});

export async function loadBlueprintRecord() {
  return null;
}

export async function updateBlueprintRecord() {
  return null;
}

export function normalizeTitle(value, fallback = "Untitled Blueprint") {
  const title = String(value || "").trim();
  return title || fallback;
}

export function normalizeBlueprintCloudProvider(value, fallback = "aws") {
  const provider = String(value || fallback || "aws").trim().toLowerCase();
  if (["aws", "azure", "gcp"].includes(provider)) return provider;
  return fallback;
}
