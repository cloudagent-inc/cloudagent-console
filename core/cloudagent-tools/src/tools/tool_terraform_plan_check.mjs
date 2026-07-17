import { tool } from "@openai/agents";
import { z } from "zod";

import { getUserId } from "../util/run-context.mjs";
import { runTerraformPlanCheck } from "../services/terraform-plan-check.mjs";
import { catalogWithSelectedGuardrails } from "../services/guardrail-normalization.mjs";

export function createTerraformPlanCheckTool({
  workloadsService,
  accountsService,
  resolveRepoPath,
  buildCredentialEnv,
  catalog = { schemaVersion: 1, catalogVersion: "unversioned", rules: [] },
  terraformBinary = process.env.CLOUDAGENT_TERRAFORM_BIN || "terraform",
  opentofuBinary = process.env.CLOUDAGENT_OPENTOFU_BIN || "tofu",
  trivyBinary = process.env.CLOUDAGENT_TRIVY_BIN || "trivy",
  getToolSettings = null,
  planRunner = runTerraformPlanCheck,
} = {}) {
  if (!workloadsService?.getWorkloadDefaults) {
    throw new Error("createTerraformPlanCheckTool requires workloadsService.getWorkloadDefaults");
  }
  if (!accountsService?.getPermissionProfileDefaults) {
    throw new Error("createTerraformPlanCheckTool requires accountsService.getPermissionProfileDefaults");
  }
  if (typeof resolveRepoPath !== "function") {
    throw new Error("createTerraformPlanCheckTool requires resolveRepoPath");
  }
  if (typeof buildCredentialEnv !== "function") {
    throw new Error("createTerraformPlanCheckTool requires buildCredentialEnv");
  }

  return tool({
    name: "terraform_plan_check",
    description:
      "Create an ephemeral, non-applying Terraform/OpenTofu plan with workload environment credentials, evaluate the workload's selected Trivy guardrails, and return a PR-safe summary. This tool never applies changes and runs plan with state locking disabled.",
    parameters: z.object({
      workloadId: z.string().min(1),
      rootId: z.string().nullable().optional().describe("Configured IaC root ID. Omit when the workload has one root."),
      permissionProfileId: z.string().nullable().optional().describe("Read-only environment profile. Defaults to the workload's first environment."),
    }).strict(),
    async execute({ workloadId, rootId, permissionProfileId }, runContext) {
      const userId = getUserId(runContext);
      const defaults = await workloadsService.getWorkloadDefaults(userId, workloadId);
      if (!defaults?.workload) {
        return { ok: false, status: "error", error: { code: "workload_not_found", message: "Workload not found." } };
      }
      const deploymentPreferences = defaults.deploymentPreferences || {};
      const roots = Array.isArray(deploymentPreferences?.iac?.roots)
        ? deploymentPreferences.iac.roots
        : [];
      const supportedRoots = roots.filter((root) => ["terraform", "opentofu"].includes(root?.type));
      const root = rootId
        ? supportedRoots.find((candidate) => candidate.id === rootId)
        : supportedRoots.length === 1
          ? supportedRoots[0]
          : null;
      if (!root) {
        return {
          ok: false,
          status: "error",
          error: {
            code: supportedRoots.length > 1 ? "terraform_root_ambiguous" : "terraform_root_not_configured",
            message: supportedRoots.length > 1
              ? "This workload has multiple Terraform roots; provide rootId."
              : "Configure a Terraform/OpenTofu root module on the workload first.",
          },
        };
      }
      const gitRepo = deploymentPreferences.gitRepo || {};
      const repoPath = await resolveRepoPath({
        localPath: gitRepo.localPath,
        owner: gitRepo.owner,
        repo: gitRepo.repo,
        repoFullName: gitRepo.fullName,
      });
      const workloadEnvironments = Array.isArray(defaults.workload.environments)
        ? defaults.workload.environments
        : [];
      const resolvedPermissionProfileId = permissionProfileId || workloadEnvironments[0] || null;
      if (!resolvedPermissionProfileId) {
        return {
          ok: false,
          status: "error",
          error: { code: "permission_profile_required", message: "A read-only workload environment is required for Terraform planning." },
        };
      }
      const accountDefaults = await accountsService.getPermissionProfileDefaults(
        userId,
        resolvedPermissionProfileId
      );
      if (!accountDefaults?.authProfile) {
        return {
          ok: false,
          status: "error",
          error: { code: "permission_profile_not_found", message: "The selected environment profile was not found." },
        };
      }
      let credentialEnv;
      try {
        credentialEnv = buildCredentialEnv(accountDefaults.authProfile);
      } catch (error) {
        return {
          ok: false,
          status: "error",
          error: { code: "credentials_not_configured", message: error?.message || String(error) },
        };
      }
      const effectiveCatalog = catalogWithSelectedGuardrails(catalog, defaults.securityRules);
      const configuredTools = typeof getToolSettings === "function"
        ? await getToolSettings()
        : {};
      const result = await planRunner({
        repoPath,
        root,
        credentialEnv,
        catalog: effectiveCatalog,
        securityRules: defaults.securityRules,
        terraformBinary: root.type === "opentofu"
          ? configuredTools.opentofuBinary || opentofuBinary
          : configuredTools.terraformBinary || terraformBinary,
        trivyBinary: configuredTools.trivyBinary || trivyBinary,
      });
      runContext?.context?.recordContextEvent?.({
        type: "terraform_plan_check",
        sourceTool: "terraform_plan_check",
        timestamp: new Date().toISOString(),
        workloadId,
        permissionProfileId: resolvedPermissionProfileId,
        rootId: root.id,
        ok: result.ok,
        status: result.status,
        checkout: result.checkout || null,
        plan: result.plan || null,
        policy: result.policy || null,
        findings: result.findings || [],
      });
      return {
        ...result,
        workloadId,
        permissionProfileId: resolvedPermissionProfileId,
        repository: gitRepo.fullName || null,
      };
    },
  });
}
