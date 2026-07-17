import { normalizeGuardrailCatalog } from "./guardrail-normalization.mjs";
import {
  CURATED_TRIVY_MAPPINGS,
  CURATED_TRIVY_RULES,
} from "./curated-trivy-guardrails.mjs";

export const CURATED_GUARD_MAPPINGS = Object.freeze(
  Object.fromEntries(
    CURATED_TRIVY_RULES.map((rule) => [rule.id, { ruleRef: rule.fileName }])
  )
);

// Curated exact crosswalk. Add a rule only after confirming that its Guard and
// Trivy implementations express the same user-facing policy. Unknown, partial,
// deprecated, and collision-blocked rules remain unmapped so coverage cannot
// silently appear complete.
export const DEFAULT_GUARDRAIL_CATALOG = normalizeGuardrailCatalog({
  schemaVersion: 1,
  catalogVersion: "2026-07-15+trivy.ce19a054+guard.7f7340c",
  rules: CURATED_TRIVY_RULES,
  guardMappings: CURATED_GUARD_MAPPINGS,
  trivyMappings: CURATED_TRIVY_MAPPINGS,
});

export default DEFAULT_GUARDRAIL_CATALOG;
