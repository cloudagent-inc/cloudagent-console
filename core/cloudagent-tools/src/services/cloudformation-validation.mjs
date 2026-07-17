import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildEnabledEngineSelection,
  catalogWithSelectedGuardrails,
  normalizeEngineFinding,
} from "./guardrail-normalization.mjs";
import { CLOUDFORMATION_GUARD_ASSETS } from "./cloudformation-guard-assets.mjs";
import { runBoundedCommand } from "./terraform-plan-check.mjs";

const DEFAULT_TIMEOUT_MS = 60_000;

function text(value) {
  return String(value ?? "").trim();
}

function failure(code, message, details = {}) {
  return { ok: false, status: "error", error: { code, message }, ...details };
}

function commandFailure(stage, result) {
  if (result?.error?.code === "ENOENT") {
    return failure("tool_missing", `${stage} executable was not found.`, { tool: stage });
  }
  if (result?.timedOut) return failure(`${stage}_timeout`, `${stage} timed out.`);
  if (result?.outputExceeded) {
    return failure(`${stage}_output_limit`, `${stage} exceeded the output limit.`);
  }
  return failure(`${stage}_execution_failed`, `${stage} failed to execute.`, {
    diagnostics: text(result?.stderr || result?.stdout).slice(0, 8_000) || null,
  });
}

function parseJsonDocuments(raw = "") {
  const source = text(raw);
  if (!source) return [];
  try {
    const value = JSON.parse(source);
    return Array.isArray(value) ? value : [value];
  } catch {
    // Guard can emit concatenated JSON objects. Split them without losing
    // nested braces or braces embedded in strings.
  }
  const documents = [];
  let start = -1;
  let depth = 0;
  let quote = false;
  let escaping = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaping) escaping = false;
      else if (char === "\\") escaping = true;
      else if (char === '"') quote = false;
      continue;
    }
    if (char === '"') {
      quote = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          documents.push(JSON.parse(source.slice(start, index + 1)));
        } catch {
          // The caller treats an empty parsed set as an execution error.
        }
        start = -1;
      }
    }
  }
  return documents;
}

function findObjectContaining(value, token) {
  if (!value || typeof value !== "object") return null;
  if (JSON.stringify(value).toUpperCase().includes(token.toUpperCase())) {
    for (const entry of Object.values(value)) {
      if (entry && typeof entry === "object") {
        const nested = findObjectContaining(entry, token);
        if (nested) return nested;
      }
    }
    return value;
  }
  return null;
}

function valueByKeys(value = {}, keys = []) {
  for (const key of keys) {
    if (typeof value?.[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return null;
}

function resourceFromGuardPath(value) {
  const pathValue = text(value);
  const match = pathValue.match(/Resources(?:\.|\[)["']?([^\.\]"']+)/i);
  return match?.[1] || null;
}

export function normalizeCloudFormationGuardFindings({
  rawOutput = "",
  catalog = {},
  securityRules = {},
  enabledRuleRefs = [],
} = {}) {
  const documents = parseJsonDocuments(rawOutput);
  if (!documents.length) return { findings: [], parsed: false };
  const serialized = JSON.stringify(documents);
  const findings = [];
  for (const ruleRef of enabledRuleRefs) {
    if (!serialized.toUpperCase().includes(String(ruleRef).toUpperCase())) continue;
    const context = findObjectContaining(documents, ruleRef) || {};
    const guardPath = valueByKeys(context, ["path", "Path", "data_path", "DataPath"]);
    const normalized = normalizeEngineFinding({
      catalog,
      securityRules,
      engine: "guard",
      engineRuleId: ruleRef,
      finding: {
        title: valueByKeys(context, ["rule", "Rule", "rule_name", "RuleName"]) || ruleRef,
        message:
          valueByKeys(context, ["message", "Message", "custom_message", "CustomMessage"]) ||
          "CloudFormation Guard rule failed.",
        resource: resourceFromGuardPath(guardPath),
        path: guardPath,
      },
    });
    if (normalized) findings.push(normalized);
  }
  return { findings, parsed: true };
}

function normalizeLintFindings(rawOutput = "") {
  const source = text(rawOutput);
  if (!source) return [];
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.map((item) => ({
    ruleId: text(item?.Rule?.Id || item?.Rule || item?.RuleId) || null,
    severity: text(item?.Rule?.Severity || item?.Level || item?.Severity).toLowerCase() || "error",
    message: text(item?.Message || item?.message) || "CloudFormation lint finding.",
    path: Array.isArray(item?.Location) ? item.Location.join("/") : text(item?.Location) || null,
  }));
}

export async function runCloudFormationValidation({
  templateBody,
  catalog = { rules: [] },
  securityRules = {},
  cfnGuardBinary = "cfn-guard",
  cfnLintBinary = "cfn-lint",
  includeLint = true,
  commandRunner = runBoundedCommand,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  guardAssets = CLOUDFORMATION_GUARD_ASSETS,
} = {}) {
  const effectiveCatalog = catalogWithSelectedGuardrails(catalog, securityRules);
  const selection = buildEnabledEngineSelection({ catalog: effectiveCatalog, securityRules });
  const surfaceLimited = selection.surfaceLimited.filter((item) => !item.cloudformation);
  if (surfaceLimited.length) {
    return {
      ok: false,
      status: "coverage_incomplete",
      policy: {
        enabledPolicyIds: selection.policyIds,
        evaluatedGuardRuleRefs: [],
        coverageComplete: false,
        unmappedPolicyIds: surfaceLimited.map((item) => item.policyId),
      },
      findings: [],
      lintFindings: [],
    };
  }

  let tempDir = null;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-cfn-validation-"));
    await fs.chmod(tempDir, 0o700);
    const templatePath = path.join(tempDir, "template.yaml");
    const rulesDir = path.join(tempDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(templatePath, String(templateBody || ""), { mode: 0o600 });

    for (const ruleRef of selection.guardRuleRefs) {
      const asset = guardAssets[ruleRef];
      if (!asset) {
        return failure("guard_asset_missing", `No local Guard asset exists for selected rule '${ruleRef}'.`);
      }
      try {
        await fs.copyFile(asset, path.join(rulesDir, `${ruleRef}.guard`));
      } catch (error) {
        return failure("guard_asset_copy_failed", `Failed to prepare Guard rule '${ruleRef}'.`, {
          diagnostics: error?.message || String(error),
        });
      }
    }

    let lintFindings = [];
    if (includeLint) {
      const lint = await commandRunner(
        cfnLintBinary,
        ["--format", "json", "--template", templatePath],
        { cwd: tempDir, env: process.env, timeoutMs }
      );
      if (lint.error || lint.timedOut || lint.outputExceeded) return commandFailure("cfn-lint", lint);
      lintFindings = normalizeLintFindings(lint.stdout || lint.stderr);
      if (lintFindings == null) return commandFailure("cfn-lint", lint);
    }

    let guardPassed = true;
    let findings = [];
    if (selection.guardRuleRefs.length) {
      const guard = await commandRunner(
        cfnGuardBinary,
        [
          "validate",
          "--data",
          templatePath,
          "--rules",
          rulesDir,
          "--type",
          "CFNTemplate",
          "--output-format",
          "json",
          "--show-summary",
          "none",
        ],
        { cwd: tempDir, env: process.env, timeoutMs }
      );
      if (![0, 19].includes(guard.code)) return commandFailure("cfn-guard", guard);
      guardPassed = guard.code === 0;
      if (!guardPassed) {
        const normalized = normalizeCloudFormationGuardFindings({
          rawOutput: guard.stdout || guard.stderr,
          catalog: effectiveCatalog,
          securityRules,
          enabledRuleRefs: selection.guardRuleRefs,
        });
        if (!normalized.parsed || !normalized.findings.length) {
          return failure(
            "guard_output_unresolved",
            "CloudFormation Guard reported non-compliance but its findings could not be normalized."
          );
        }
        findings = normalized.findings;
      }
    }

    const lintErrors = lintFindings.filter((finding) => finding.severity === "error");
    // CloudFormation deployment is fail-closed for every selected Guard rule.
    // Disposition still controls how a finding is presented, but never allows
    // a non-compliant template to continue to stack deployment.
    const policyFailed = findings.length > 0;
    const ok = lintErrors.length === 0 && !policyFailed;
    return {
      ok,
      status: lintErrors.length
        ? "lint_failed"
        : policyFailed
          ? "policy_failed"
          : lintFindings.length
            ? "warnings"
            : "passed",
      deploymentAllowed: ok,
      requiresTemplateRevision: lintErrors.length > 0 || policyFailed,
      engines: {
        guard: {
          evaluated: selection.guardRuleRefs.length > 0,
          compliant: guardPassed,
        },
        lint: {
          evaluated: includeLint,
          passed: lintErrors.length === 0,
        },
      },
      policy: {
        enabledPolicyIds: selection.policyIds,
        evaluatedGuardRuleRefs: selection.guardRuleRefs,
        coverageComplete: true,
        unmappedPolicyIds: [],
      },
      findings,
      lintFindings,
    };
  } catch (error) {
    return failure("cloudformation_validation_failed", error?.message || String(error));
  } finally {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
