const SEVERITIES = new Set(["critical", "high", "medium", "low", "unknown"]);
const DISPOSITIONS = new Set(["require_confirmation", "warning", "informational"]);
const TERRAFORM_SCOPES = new Set(["resource", "global"]);
const TRIVY_MAPPING_STATUSES = new Set([
  "supported_exact",
  "partial",
  "deprecated",
  "unsupported",
]);

function text(value) {
  return String(value ?? "").trim();
}

function canonicalGuardrailId(value) {
  return text(value).toUpperCase().replace(/[\s-]+/g, "_");
}

function canonicalEngineRuleId(value) {
  return text(value).toUpperCase();
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function mappingByCanonicalId(mappings = {}) {
  return Object.fromEntries(
    Object.entries(mappings || {}).map(([id, mapping]) => [canonicalGuardrailId(id), mapping])
  );
}

function normalizeGuardMapping(mapping = null) {
  if (!mapping || typeof mapping !== "object") return null;
  const ruleRefs = uniqueStrings([
    ...(Array.isArray(mapping.ruleRefs) ? mapping.ruleRefs : []),
    mapping.ruleRef,
  ]);
  if (!ruleRefs.length) return null;
  return {
    engine: "guard",
    ruleRefs,
  };
}

function normalizeTrivyMapping(mapping = null) {
  if (!mapping || typeof mapping !== "object") return null;
  const checks = (Array.isArray(mapping.checks) ? mapping.checks : [])
    .map((check) => {
      const id = canonicalEngineRuleId(check?.id);
      if (!id) return null;
      return {
        id,
        aliases: uniqueStrings(check?.aliases).map(canonicalEngineRuleId),
        sourceUrl: text(check?.sourceUrl) || null,
      };
    })
    .filter(Boolean);
  const legacyCheckIds = uniqueStrings([
    ...(Array.isArray(mapping.checkIds) ? mapping.checkIds : []),
    ...(Array.isArray(mapping.aliases) ? mapping.aliases : []),
    mapping.checkId,
  ]).map(canonicalEngineRuleId);
  const checkIds = uniqueStrings([
    ...checks.flatMap((check) => [check.id, ...check.aliases]),
    ...legacyCheckIds,
  ]).map(canonicalEngineRuleId);
  if (!checkIds.length) return null;
  const scope = text(mapping.scope).toLowerCase() || "resource";
  if (!TERRAFORM_SCOPES.has(scope)) {
    throw new Error(`Unsupported Terraform guardrail scope: ${mapping.scope}`);
  }
  const status = text(mapping.status).toLowerCase() || "supported_exact";
  if (!TRIVY_MAPPING_STATUSES.has(status)) {
    throw new Error(`Unsupported Trivy mapping status: ${mapping.status}`);
  }
  return {
    engine: "trivy",
    status,
    reason: text(mapping.reason) || null,
    checks,
    primaryCheckIds: checks.length ? checks.map((check) => check.id) : checkIds,
    checkIds,
    scope,
    governedAttributePaths: uniqueStrings(mapping.governedAttributePaths),
  };
}

function normalizeSeverity(value) {
  const severity = text(value).toLowerCase() || "unknown";
  if (!SEVERITIES.has(severity)) {
    throw new Error(`Unsupported guardrail severity: ${value}`);
  }
  return severity;
}

function normalizeDisposition(value) {
  const aliases = {
    block: "require_confirmation",
    warn: "warning",
    info: "informational",
  };
  const raw = text(value).toLowerCase() || "require_confirmation";
  const disposition = aliases[raw] || raw;
  if (!DISPOSITIONS.has(disposition)) {
    throw new Error(`Unsupported guardrail disposition: ${value}`);
  }
  return disposition;
}

/**
 * Joins legacy/user-facing registry metadata to explicit Guard and Trivy
 * crosswalks. Missing mappings remain visible as surface-limited coverage.
 */
export function normalizeGuardrailCatalog({
  rules = [],
  guardMappings = {},
  trivyMappings = {},
  schemaVersion = 1,
  catalogVersion = "unversioned",
} = {}) {
  if (!Array.isArray(rules)) {
    throw new Error("Guardrail rules must be an array.");
  }

  const guardById = mappingByCanonicalId(guardMappings);
  const trivyById = mappingByCanonicalId(trivyMappings);
  const seen = new Set();
  const normalizedRules = rules.map((rule) => {
    const id = canonicalGuardrailId(rule?.id);
    if (!id) throw new Error("Every guardrail requires an id.");
    if (seen.has(id)) throw new Error(`Duplicate guardrail id: ${id}`);
    seen.add(id);

    const inlineEnforcement = rule?.enforcement || {};
    const cloudformation = normalizeGuardMapping(
      guardById[id] || inlineEnforcement.cloudformation
    );
    const terraform = normalizeTrivyMapping(
      trivyById[id] || inlineEnforcement.terraform
    );

    return {
      id,
      title: text(rule?.title) || id,
      description: text(rule?.description) || null,
      categories: uniqueStrings(
        Array.isArray(rule?.category) ? rule.category : [rule?.category]
      ),
      service: text(rule?.service) || null,
      serviceName: text(rule?.serviceName) || null,
      severity: normalizeSeverity(rule?.severity),
      defaultDisposition: normalizeDisposition(
        rule?.defaultDisposition || rule?.disposition
      ),
      enforcement: {
        cloudformation,
        terraform,
      },
      surfaces: {
        cloudformation: Boolean(cloudformation),
        terraform: Boolean(terraform && terraform.status === "supported_exact"),
      },
      source: {
        registryId: text(rule?.id) || null,
        registryFileName: text(rule?.fileName) || null,
      },
    };
  });

  const catalog = {
    schemaVersion,
    catalogVersion: text(catalogVersion) || "unversioned",
    rules: normalizedRules,
  };
  buildGuardrailEngineIndex(catalog);
  return catalog;
}

/**
 * Builds a reverse lookup from engine rule identity to canonical guardrail id.
 * Ambiguous engine mappings are rejected instead of silently picking a rule.
 */
export function buildGuardrailEngineIndex(catalog = {}) {
  const index = new Map();
  for (const rule of catalog?.rules || []) {
    const mappings = [
      ["guard", rule?.enforcement?.cloudformation?.ruleRefs || []],
      ["trivy", rule?.enforcement?.terraform?.checkIds || []],
    ];
    for (const [engine, ruleIds] of mappings) {
      for (const engineRuleId of ruleIds) {
        const key = `${engine}:${canonicalEngineRuleId(engineRuleId)}`;
        const existing = index.get(key);
        if (existing && existing !== rule.id) {
          throw new Error(
            `Ambiguous ${engine} rule mapping ${engineRuleId}: ${existing}, ${rule.id}`
          );
        }
        index.set(key, rule.id);
      }
    }
  }
  return index;
}

export function resolveEnabledGuardrails({ catalog = {}, securityRules = {} } = {}) {
  const selections = securityRules?.rules || {};
  return (catalog?.rules || [])
    .filter((rule) => selections?.[rule.id]?.enabled === true)
    .map((rule) => ({
      ...rule,
      disposition: normalizeDisposition(
        selections?.[rule.id]?.disposition || rule.defaultDisposition
      ),
    }));
}

/**
 * Keeps selected rules that are not yet present in the curated crosswalk
 * visible as surface-limited coverage instead of silently dropping them.
 */
export function catalogWithSelectedGuardrails(catalog = { rules: [] }, securityRules = {}) {
  const existing = new Set((catalog?.rules || []).map((rule) => canonicalGuardrailId(rule?.id)));
  const missing = Object.entries(securityRules?.rules || {})
    .filter(([, selection]) => selection?.enabled === true)
    .map(([id]) => canonicalGuardrailId(id))
    .filter((id) => id && !existing.has(id))
    .map((id) => ({
      id,
      title: id,
      description: null,
      categories: [],
      service: null,
      serviceName: null,
      severity: "unknown",
      defaultDisposition: "require_confirmation",
      enforcement: { cloudformation: null, terraform: null },
      surfaces: { cloudformation: false, terraform: false },
      source: { registryId: id, registryFileName: null },
    }));
  return { ...catalog, rules: [...(catalog?.rules || []), ...missing] };
}

export function buildEnabledEngineSelection({ catalog = {}, securityRules = {} } = {}) {
  const enabled = resolveEnabledGuardrails({ catalog, securityRules });
  return {
    policyIds: enabled.map((rule) => rule.id),
    guardRuleRefs: uniqueStrings(
      enabled.flatMap((rule) => rule?.enforcement?.cloudformation?.ruleRefs || [])
    ),
    trivyCheckIds: uniqueStrings(
      enabled.flatMap((rule) => rule?.surfaces?.terraform
        ? rule?.enforcement?.terraform?.checkIds || []
        : [])
    ).map(canonicalEngineRuleId),
    trivyPrimaryCheckIds: uniqueStrings(
      enabled.flatMap((rule) => rule?.surfaces?.terraform
        ? rule?.enforcement?.terraform?.primaryCheckIds || []
        : [])
    ).map(canonicalEngineRuleId),
    surfaceLimited: enabled
      .filter((rule) => !rule.surfaces.cloudformation || !rule.surfaces.terraform)
      .map((rule) => ({
        policyId: rule.id,
        cloudformation: rule.surfaces.cloudformation,
        terraform: rule.surfaces.terraform,
      })),
  };
}

export function normalizeEngineFinding({
  catalog = {},
  securityRules = {},
  engine,
  engineRuleId,
  finding = {},
} = {}) {
  const normalizedEngine = text(engine).toLowerCase();
  if (!new Set(["guard", "trivy"]).has(normalizedEngine)) {
    throw new Error(`Unsupported guardrail engine: ${engine}`);
  }
  const index = buildGuardrailEngineIndex(catalog);
  const policyId = index.get(
    `${normalizedEngine}:${canonicalEngineRuleId(engineRuleId)}`
  );
  if (!policyId) return null;

  const rule = resolveEnabledGuardrails({ catalog, securityRules }).find(
    (candidate) => candidate.id === policyId
  );
  if (!rule) return null;

  return {
    ...finding,
    policyId,
    engine: normalizedEngine,
    engineRuleId: text(engineRuleId),
    severity: rule.severity,
    disposition: rule.disposition,
  };
}
