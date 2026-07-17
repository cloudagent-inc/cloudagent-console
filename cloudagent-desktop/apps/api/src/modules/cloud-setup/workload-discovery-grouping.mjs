export const MAX_DISCOVERED_WORKLOADS = 5;

function resourceKey(resource = {}, index = 0) {
  return String(
    resource.resourceArn ||
      resource.resourceId ||
      resource.physicalResourceId ||
      `${resource.resourceType || "resource"}:${resource.region || "global"}:${index}`
  );
}

function stackKey(stack = {}, index = 0) {
  return String(
    stack.stackId ||
      stack.stackArn ||
      stack.arn ||
      `${stack.name || stack.stackName || "stack"}:${stack.region || "global"}:${index}`
  );
}

function uniqueEntries(entries = [], keyForEntry) {
  const seen = new Set();
  return entries.filter((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const key = keyForEntry(entry, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function consolidateDiscoveredWorkloads(
  workloads = [],
  { environmentName = "this environment", maxWorkloads = MAX_DISCOVERED_WORKLOADS } = {}
) {
  const candidates = Array.isArray(workloads)
    ? workloads.filter((workload) => workload && typeof workload === "object" && !Array.isArray(workload))
    : [];
  const limit = Math.max(1, Number(maxWorkloads) || MAX_DISCOVERED_WORKLOADS);
  if (candidates.length <= limit) return candidates;

  const primary = candidates.slice(0, limit - 1);
  const overflow = candidates.slice(limit - 1);
  const firstOverflow = overflow[0] || {};
  const resources = uniqueEntries(
    overflow.flatMap((workload) => workload?.trackedResources?.resources || []),
    resourceKey
  );
  const stacks = uniqueEntries(
    overflow.flatMap((workload) => workload?.trackedResources?.stacks || []),
    stackKey
  );
  const environments = Array.from(
    new Set(overflow.flatMap((workload) => workload?.environments || []).filter(Boolean))
  );

  return [
    ...primary,
    {
      ...firstOverflow,
      name: `Additional grouped resources - ${environmentName}`,
      description: `Consolidated ${overflow.length} lower-priority discovery groups so the review stays focused on the top ${limit} workload candidates.`,
      ...(environments.length ? { environments } : {}),
      trackedResources: { resources, stacks },
      confidence: null,
      reasoning: "Grouped lower-priority candidates together to avoid presenting one workload per stack or resource.",
      metadata: {
        ...(firstOverflow.metadata || {}),
        discoverySource: "consolidated_overflow",
        consolidatedWorkloadCount: overflow.length,
      },
    },
  ];
}
