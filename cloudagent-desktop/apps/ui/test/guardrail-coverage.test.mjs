import assert from "node:assert/strict";
import test from "node:test";

import {
  getGuardrailCoverage,
  mappedGuardrailCount,
  summarizeEnabledGuardrailCoverage,
} from "../src/components/SecurityRules/guardrailCoverage.js";

test("uses the validator catalog as the UI guardrail coverage source", () => {
  assert.equal(mappedGuardrailCount, 38);
  assert.deepEqual(getGuardrailCoverage("RDS_STORAGE_ENCRYPTED"), {
    cloudformation: true,
    trivy: true,
  });
  assert.deepEqual(getGuardrailCoverage("CLOUDTRAIL_ENABLED"), {
    cloudformation: false,
    trivy: false,
  });
});

test("summarizes enabled validator-backed policies only", () => {
  assert.deepEqual(
    summarizeEnabledGuardrailCoverage({
      rules: {
        RDS_STORAGE_ENCRYPTED: { enabled: true },
        RDS_INSTANCE_PUBLIC_ACCESS_CHECK: { enabled: false },
        S3_BUCKET_LOGGING_ENABLED: { enabled: true },
        CLOUDTRAIL_ENABLED: { enabled: true },
      },
    }),
    { mapped: 2, cloudformation: 2, trivy: 2 },
  );
});
