import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  buildEnabledEngineSelection,
  normalizeEngineFinding,
  normalizeGuardrailCatalog,
} from "../src/services/guardrail-normalization.mjs";
import { DEFAULT_GUARDRAIL_CATALOG } from "../src/services/default-guardrail-catalog.mjs";
import {
  AWS_GUARD_RULES_REGISTRY_SHA,
  CLOUDFORMATION_GUARD_ASSETS,
} from "../src/services/cloudformation-guard-assets.mjs";
import uiRegistryRules from "../../../cloudagent-desktop/apps/ui/src/helpers/rules.json" with { type: "json" };

const registryRules = [
  {
    id: "RDS_STORAGE_ENCRYPTED",
    title: "RDS storage must be encrypted",
    category: ["Encryption"],
    service: "amazon_rds",
    serviceName: "RDS",
    fileName: "rds_storage_encrypted",
    severity: "high",
    disposition: "block",
  },
  {
    id: "CFN_ONLY_RULE",
    title: "CloudFormation-only rule",
    severity: "medium",
    disposition: "warn",
  },
];

function createCatalog() {
  return normalizeGuardrailCatalog({
    rules: registryRules,
    catalogVersion: "test-v1",
    guardMappings: {
      RDS_STORAGE_ENCRYPTED: { ruleRef: "rds_storage_encrypted" },
      CFN_ONLY_RULE: { ruleRefs: ["cfn_only_rule"] },
    },
    trivyMappings: {
      RDS_STORAGE_ENCRYPTED: {
        checkIds: ["AVD-AWS-TEST"],
        aliases: ["aws-rds-test"],
        scope: "resource",
      },
    },
  });
}

test("normalizes registry, Guard, and Trivy identities into one catalog", () => {
  const catalog = createCatalog();
  assert.equal(catalog.catalogVersion, "test-v1");
  assert.equal(catalog.rules[0].id, "RDS_STORAGE_ENCRYPTED");
  assert.deepEqual(catalog.rules[0].enforcement.cloudformation.ruleRefs, [
    "rds_storage_encrypted",
  ]);
  assert.deepEqual(catalog.rules[0].enforcement.terraform.checkIds, [
    "AVD-AWS-TEST",
    "AWS-RDS-TEST",
  ]);
  assert.equal(catalog.rules[0].defaultDisposition, "require_confirmation");
  assert.deepEqual(catalog.rules[1].surfaces, {
    cloudformation: true,
    terraform: false,
  });
});

test("builds engine selections from the user's canonical rule selection", () => {
  const catalog = createCatalog();
  const selection = buildEnabledEngineSelection({
    catalog,
    securityRules: {
      rules: {
        RDS_STORAGE_ENCRYPTED: { enabled: true },
        CFN_ONLY_RULE: { enabled: false },
      },
    },
  });

  assert.deepEqual(selection.policyIds, ["RDS_STORAGE_ENCRYPTED"]);
  assert.deepEqual(selection.guardRuleRefs, ["rds_storage_encrypted"]);
  assert.deepEqual(selection.trivyCheckIds, ["AVD-AWS-TEST", "AWS-RDS-TEST"]);
  assert.deepEqual(selection.surfaceLimited, []);
});

test("normalizes Guard and Trivy findings back to the same canonical rule", () => {
  const catalog = createCatalog();
  const securityRules = {
    rules: {
      RDS_STORAGE_ENCRYPTED: {
        enabled: true,
        disposition: "warning",
      },
    },
  };

  const guardFinding = normalizeEngineFinding({
    catalog,
    securityRules,
    engine: "guard",
    engineRuleId: "rds_storage_encrypted",
    finding: { message: "Guard failure" },
  });
  const trivyFinding = normalizeEngineFinding({
    catalog,
    securityRules,
    engine: "trivy",
    engineRuleId: "avd-aws-test",
    finding: { message: "Trivy failure" },
  });

  assert.equal(guardFinding.policyId, "RDS_STORAGE_ENCRYPTED");
  assert.equal(trivyFinding.policyId, "RDS_STORAGE_ENCRYPTED");
  assert.equal(guardFinding.disposition, "warning");
  assert.equal(trivyFinding.disposition, "warning");
});

test("rejects ambiguous engine mappings", () => {
  assert.throws(
    () =>
      normalizeGuardrailCatalog({
        rules: [
          { id: "RULE_ONE" },
          { id: "RULE_TWO" },
        ],
        trivyMappings: {
          RULE_ONE: { checkId: "AVD-AWS-SAME" },
          RULE_TWO: { checkId: "AVD-AWS-SAME" },
        },
      }),
    /Ambiguous trivy rule mapping/
  );
});

test("returns null for disabled or unmapped engine findings", () => {
  const catalog = createCatalog();
  assert.equal(
    normalizeEngineFinding({
      catalog,
      securityRules: { rules: {} },
      engine: "trivy",
      engineRuleId: "AVD-AWS-TEST",
    }),
    null
  );
  assert.equal(
    normalizeEngineFinding({
      catalog,
      securityRules: { rules: { RDS_STORAGE_ENCRYPTED: { enabled: true } } },
      engine: "trivy",
      engineRuleId: "AVD-AWS-NOT-MAPPED",
    }),
    null
  );
});

test("default S3 mappings provide complete Guard and Trivy coverage", () => {
  const securityRules = {
    rules: {
      S3_BUCKET_LOGGING_ENABLED: { enabled: true },
      S3_BUCKET_LEVEL_PUBLIC_ACCESS_PROHIBITED: { enabled: true },
      S3_BUCKET_VERSIONING_ENABLED: { enabled: true },
    },
  };
  const selection = buildEnabledEngineSelection({
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules,
  });

  assert.deepEqual(selection.guardRuleRefs, [
    "s3_bucket_logging_enabled",
    "s3_bucket_level_public_access_prohibited",
    "s3_bucket_versioning_enabled",
  ]);
  assert.deepEqual(
    selection.trivyCheckIds.filter((id) => /^AWS-\d+$/.test(id)),
    ["AWS-0089", "AWS-0086", "AWS-0087", "AWS-0091", "AWS-0093", "AWS-0090"]
  );
  assert.deepEqual(selection.surfaceLimited, []);
});

test("all public access block Trivy checks normalize to one S3 policy", () => {
  const securityRules = {
    rules: {
      S3_BUCKET_LEVEL_PUBLIC_ACCESS_PROHIBITED: { enabled: true },
    },
  };

  for (const checkId of ["AWS-0086", "AWS-0087", "AWS-0091", "AWS-0093"]) {
    const finding = normalizeEngineFinding({
      catalog: DEFAULT_GUARDRAIL_CATALOG,
      securityRules,
      engine: "trivy",
      engineRuleId: checkId,
      finding: { message: "Public access block setting is disabled." },
    });
    assert.equal(finding.policyId, "S3_BUCKET_LEVEL_PUBLIC_ACCESS_PROHIBITED");
    assert.equal(finding.disposition, "require_confirmation");
  }
});

test("default catalog exposes the audited exact shared validator coverage set", () => {
  const terraformRules = DEFAULT_GUARDRAIL_CATALOG.rules.filter(
    (rule) => rule.surfaces.terraform
  );
  const cloudFormationRules = DEFAULT_GUARDRAIL_CATALOG.rules.filter(
    (rule) => rule.surfaces.cloudformation
  );
  const primaryCheckIds = terraformRules.flatMap(
    (rule) => rule.enforcement.terraform.primaryCheckIds
  );

  assert.equal(terraformRules.length, 38);
  assert.equal(cloudFormationRules.length, 38);
  assert.deepEqual(
    cloudFormationRules.map((rule) => rule.id),
    terraformRules.map((rule) => rule.id)
  );
  assert.equal(primaryCheckIds.length, 44);
  assert.equal(new Set(primaryCheckIds).size, 44);
  assert.ok(
    terraformRules.every(
      (rule) => rule.enforcement.terraform.status === "supported_exact"
    )
  );
  assert.ok(
    terraformRules.every((rule) =>
      rule.enforcement.terraform.checks.every(
        (check) => check.sourceUrl?.startsWith("https://github.com/aquasecurity/trivy-checks/")
      )
    )
  );
});

test("every shared policy has a pinned local Guard asset with its canonical rule id", async () => {
  assert.equal(AWS_GUARD_RULES_REGISTRY_SHA, "7f7340c26ae5d5e8874651dbffeb12e0e9f505b6");
  assert.equal(Object.keys(CLOUDFORMATION_GUARD_ASSETS).length, 38);

  for (const rule of DEFAULT_GUARDRAIL_CATALOG.rules) {
    assert.equal(rule.enforcement.cloudformation.ruleRefs.length, 1);
    const [ruleRef] = rule.enforcement.cloudformation.ruleRefs;
    const source = await fs.readFile(CLOUDFORMATION_GUARD_ASSETS[ruleRef], "utf8");
    assert.match(source, new RegExp(`^rule\\s+${rule.id}\\s`, "m"));
  }
});

test("audited Trivy mappings reference the current UI rule registry", () => {
  const registryIds = uiRegistryRules.map((rule) => rule.id);
  const uniqueRegistryIds = new Set(registryIds);
  const duplicateIds = [...uniqueRegistryIds].filter(
    (id) => registryIds.filter((candidate) => candidate === id).length > 1
  );
  const mappedIds = new Set(DEFAULT_GUARDRAIL_CATALOG.rules.map((rule) => rule.id));

  assert.equal(uiRegistryRules.length, 192);
  assert.equal(uniqueRegistryIds.size, 191);
  assert.deepEqual(duplicateIds, ["DYNAMODB_TABLE_ENCRYPTED_KMS"]);
  assert.ok([...mappedIds].every((id) => uniqueRegistryIds.has(id)));
  assert.equal([...uniqueRegistryIds].filter((id) => !mappedIds.has(id)).length, 153);
});
