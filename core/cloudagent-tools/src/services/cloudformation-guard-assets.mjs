import { CURATED_TRIVY_RULES } from "./curated-trivy-guardrails.mjs";

export const AWS_GUARD_RULES_REGISTRY_SHA =
  "7f7340c26ae5d5e8874651dbffeb12e0e9f505b6";
export const AWS_GUARD_RULES_REGISTRY_URL =
  `https://github.com/aws-cloudformation/aws-guard-rules-registry/tree/${AWS_GUARD_RULES_REGISTRY_SHA}`;

// The curated policy set is intentionally shared by both validators. Every
// entry must have a pinned local .guard asset with the same fileName.
export const CLOUDFORMATION_GUARD_ASSETS = Object.freeze(
  Object.fromEntries(
    CURATED_TRIVY_RULES.map((rule) => [
      rule.fileName,
      new URL(`../guardrails/cloudformation/${rule.fileName}.guard`, import.meta.url),
    ])
  )
);

export default CLOUDFORMATION_GUARD_ASSETS;
