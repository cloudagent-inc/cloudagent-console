import { DEFAULT_GUARDRAIL_CATALOG } from "@cloudagent/cloudagent-tools/services/default-guardrail-catalog";

const EMPTY_COVERAGE = Object.freeze({
  cloudformation: false,
  trivy: false,
});

export const guardrailCoverageByRuleId = Object.freeze(
  Object.fromEntries(
    DEFAULT_GUARDRAIL_CATALOG.rules.map((rule) => [
      rule.id,
      Object.freeze({
        cloudformation: rule.surfaces.cloudformation,
        trivy: rule.surfaces.terraform,
      }),
    ]),
  ),
);

export const mappedGuardrailCount = DEFAULT_GUARDRAIL_CATALOG.rules.length;

export function getGuardrailCoverage(ruleId) {
  return (
    guardrailCoverageByRuleId[
      String(ruleId || "")
        .trim()
        .toUpperCase()
    ] || EMPTY_COVERAGE
  );
}

export function summarizeEnabledGuardrailCoverage(securityRules = {}) {
  return Object.entries(securityRules?.rules || {}).reduce(
    (summary, [ruleId, selection]) => {
      if (selection?.enabled !== true) return summary;
      const coverage = getGuardrailCoverage(ruleId);
      if (coverage.cloudformation || coverage.trivy) summary.mapped += 1;
      if (coverage.cloudformation) summary.cloudformation += 1;
      if (coverage.trivy) summary.trivy += 1;
      return summary;
    },
    { mapped: 0, cloudformation: 0, trivy: 0 },
  );
}
