import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_DISCOVERED_WORKLOADS,
  consolidateDiscoveredWorkloads,
} from "../src/modules/cloud-setup/workload-discovery-grouping.mjs";

test("workload discovery keeps focused results unchanged", () => {
  const workloads = Array.from({ length: 3 }, (_, index) => ({ name: `App ${index + 1}` }));
  assert.deepEqual(consolidateDiscoveredWorkloads(workloads), workloads);
});

test("workload discovery caps review cards and preserves overflow resources", () => {
  const workloads = Array.from({ length: 8 }, (_, index) => ({
    name: `Candidate ${index + 1}`,
    environments: ["profile-1"],
    trackedResources: {
      resources: [{ resourceId: `resource-${index + 1}` }],
      stacks: [{ stackId: `stack-${index + 1}` }],
    },
  }));
  workloads[7].trackedResources.resources.push({ resourceId: "resource-5" });

  const result = consolidateDiscoveredWorkloads(workloads, {
    environmentName: "Development",
  });

  assert.equal(result.length, MAX_DISCOVERED_WORKLOADS);
  assert.deepEqual(result.slice(0, 4).map((workload) => workload.name), [
    "Candidate 1",
    "Candidate 2",
    "Candidate 3",
    "Candidate 4",
  ]);
  assert.equal(result[4].name, "Additional grouped resources - Development");
  assert.equal(result[4].metadata.consolidatedWorkloadCount, 4);
  assert.deepEqual(
    result[4].trackedResources.resources.map((resource) => resource.resourceId),
    ["resource-5", "resource-6", "resource-7", "resource-8"]
  );
  assert.equal(result[4].trackedResources.stacks.length, 4);
  assert.deepEqual(result[4].environments, ["profile-1"]);
});
