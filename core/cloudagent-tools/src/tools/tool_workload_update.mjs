import { tool } from "@openai/agents";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { getUserId } from "../util/run-context.mjs";
import { logStart, logEnd } from "../util/logging.mjs";

const DEBUG_WORKLOADS =
  process.env.CLOUDOPS_DEBUG_LOG_ENABLED === "true" ||
  process.env.DEBUG_WORKLOADS === "true" ||
  process.env.DEBUG_AGENT_TOOLS === "true" ||
  process.env.DEBUG_AGENT_TOOLS === "1";
import {
  DEFAULT_TRACKED_RESOURCES,
  deepMerge,
  deleteByPath,
  sanitizePatch
} from "../services/workloads-service.mjs";

const GitRepoSchema = z
  .object({
    connectionId: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
    repo: z.string().nullable().optional(),
    fullName: z.string().nullable().optional(),
    branch: z.string().nullable().optional(),
    localPath: z.string().nullable().optional()
  })
  .strict();

const IacRootSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["terraform", "opentofu", "cloudformation"]),
    rootPath: z.string().min(1),
    workspace: z.string().nullable().optional(),
    varFiles: z.array(z.string()).nullable().optional(),
    backendType: z.enum(["local", "s3"]).nullable().optional(),
    templatePaths: z.array(z.string()).nullable().optional()
  })
  .strict();

const IacConfigSchema = z
  .object({
    roots: z.array(IacRootSchema)
  })
  .strict();

const PipelineConfigSchema = z
  .object({
    autoDeploy: z.boolean().nullable().optional(),
    requireApproval: z.boolean().nullable().optional(),
    branch: z.string().nullable().optional(),
    awsAccountId: z.string().nullable().optional(),
    awsRoleName: z.string().nullable().optional(),
    awsRoleArn: z.string().nullable().optional(),
    roleName: z.string().nullable().optional(),
    roleArn: z.string().nullable().optional(),
    stackName: z.string().nullable().optional(),
    configFile: z.string().nullable().optional(),
    connectionArn: z.string().nullable().optional(),
    connectionName: z.string().nullable().optional(),
    repositoryLinkId: z.string().nullable().optional(),
    ownerId: z.string().nullable().optional(),
    repositoryName: z.string().nullable().optional(),
    publishDeploymentStatus: z.enum(["DISABLED", "ENABLED"]).nullable().optional(),
    triggerResourceUpdateOn: z.enum(["FILE_CHANGE", "ANY_CHANGE"]).nullable().optional(),
    pullRequestComment: z.enum(["DISABLED", "ENABLED"]).nullable().optional(),
    region: z.string().nullable().optional()
  })
  .strict();

const ChangeSetNotificationsSchema = z
  .object({
    email: z
      .object({
        enabled: z.boolean().nullable().optional(),
        address: z.string().nullable().optional()
      })
      .strict()
      .nullable()
      .optional(),
    slack: z
      .object({
        enabled: z.boolean().nullable().optional()
      })
      .strict()
      .nullable()
      .optional()
  })
  .strict();

const RequiredTagSchema = z
  .object({
    key: z.string(),
    value: z.string().nullable().optional(),
    notes: z.string().nullable().optional()
  })
  .strict();

const ArchitecturePreferencesSchema = z
  .object({
    instanceSize: z.string().nullable().optional(),
    databasePreference: z.string().nullable().optional(),
    nosqlPreference: z.string().nullable().optional(),
    staticWebsite: z.string().nullable().optional(),
    dynamicWebsite: z.string().nullable().optional()
  })
  .strict();

const ResourceRulesSchema = z
  .object({
    allowedResources: z
      .object({
        allowAll: z.boolean().nullable().optional(),
        allowedList: z.array(z.string()).nullable().optional(),
        deniedList: z.array(z.string()).nullable().optional()
      })
      .strict()
      .nullable()
      .optional()
  })
  .strict();

const DeploymentStackSchema = z
  .object({
    description: z.string().nullable().optional(),
    stackId: z.string(),
    stackName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    environmentProfileId: z.string().nullable().optional(),
    environmentName: z.string().nullable().optional(),
    environmentAccountId: z.string().nullable().optional(),
    stackArn: z.string().nullable().optional()
  })
  .strict();

export const DeploymentPreferencesSchema = z
  .object({
    method: z
      .enum(["cloudformation", "terraform", "opentofu", "aws_cli"])
      .nullable()
      .optional(),
    gitRepo: GitRepoSchema.nullable().optional(),
    sourceMode: z.enum(["none", "github"]).nullable().optional(),
    deliveryMethod: z
      .enum(["manual", "github_actions", "codepipeline", "cloudformation_git_sync"])
      .nullable()
      .optional(),
    stateSource: z.enum(["s3"]).nullable().optional(),
    stateBucket: z.string().nullable().optional(),
    pipelineConfig: PipelineConfigSchema.nullable().optional(),
    iac: IacConfigSchema.nullable().optional(),
    changeSet: z.boolean().nullable().optional(),
    changeSetNotifications: ChangeSetNotificationsSchema.nullable().optional(),
    defaultRegions: z.array(z.string()).nullable().optional(),
    requiredTags: z.array(RequiredTagSchema).nullable().optional(),
    useExistingVPCs: z.boolean().nullable().optional(),
    specifiedVPCs: z.array(z.string()).nullable().optional(),
    resourceRules: ResourceRulesSchema.nullable().optional(),
    accessMode: z.string().nullable().optional(),
    architecturePreferences: ArchitecturePreferencesSchema.nullable().optional(),
    stacks: z.array(DeploymentStackSchema).nullable().optional(),
    isOrgManagementAccount: z.boolean().nullable().optional(),
    orgManagementAccountId: z.string().nullable().optional(),
    orgPermissionProfileId: z.string().nullable().optional()
  })
  .strict();

const SecurityRuleCategorySchema = z
  .object({
    enable_all: z.boolean().nullable()
  })
  .strict();

const SecurityRuleSelectionSchema = z
  .object({
    enabled: z.boolean().nullable(),
    disposition: z
      .enum(["require_confirmation", "warning", "informational"])
      .nullable()
  })
  .strict();

export const SecurityRulesSchema = z
  .object({
    categories: z
      .object({})
      .catchall(SecurityRuleCategorySchema)
      .nullable()
      .optional(),
    rules: z
      .object({})
      .catchall(SecurityRuleSelectionSchema)
      .nullable()
      .optional()
  })
  .strict();

const WorkloadTrackedResourceSchema = z.object({
  resourceId: z.string(),
  resourceArn: z.string().nullable().optional(),
  resourceType: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  environmentProfileId: z.string().nullable().optional(),
  environmentName: z.string().nullable().optional(),
  environmentAccountId: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  resourceGroup: z.string().nullable().optional(),
  subscriptionId: z.string().nullable().optional()
}).strict();

export const TrackedResourcesSchema = z.object({
  resources: z.array(WorkloadTrackedResourceSchema).nullable().optional(),
  stacks: z.array(DeploymentStackSchema).nullable().optional()
}).strict();

export function createUpdateWorkloadTool({ cache, workloadsService, accountsService }) {
  if (!cache) throw new Error("createUpdateWorkloadTool requires a cache instance");
  if (!workloadsService?.getWorkload) throw new Error("workloadsService.getWorkload is required");
  if (!accountsService?.getPermissionProfileDefaults) {
    throw new Error("accountsService.getPermissionProfileDefaults is required");
  }

  return tool({
    name: "update_workload",
    description: `Create or update a workload.

TO CREATE: Omit workloadId entirely - a UUID will be auto-generated.
TO UPDATE: Provide the existing workloadId.

CRITICAL: Only include fields you want to change. Omit fields entirely if not modifying them.
Do NOT use placeholder values like ":nochange:", ":unchanged:", "null", etc.
Omitted fields are automatically preserved.

Examples:
- Update description only: { "workloadId": "abc-123", "description": "New description" }
- Create new workload: { "workloadName": "My App", "environments": ["permission-profile-record-id"] }`,
    parameters: z.object({
      workloadId: z.string().nullable().optional().describe("Existing workload UUID to update. Omit to create new."),
      workloadName: z.string().nullable().optional().describe("Name for the workload. Omit if unchanged."),
      description: z.string().nullable().optional().describe("Description. Omit if unchanged."),
      environments: z.array(z.string()).nullable().optional().describe("Permission profile record IDs. Omit if unchanged."),
      deploymentPreferences: DeploymentPreferencesSchema.nullable().optional().describe("Deployment config. Omit if unchanged."),
      securityRules: SecurityRulesSchema.nullable().optional().describe("Security rules. Omit if unchanged."),
      trackedResources: TrackedResourcesSchema.nullable().optional().describe("Tracked resources/stacks. Omit if unchanged."),
      allowClear: z.boolean().nullable().optional().describe("Set true to allow null/empty values to clear fields."),
      unset: z.array(z.string()).nullable().optional().describe("Dot-paths to remove, e.g. ['deploymentPreferences.gitRepo'].")
    }),

    async execute(args, runContext) {
      const {
        workloadId: rawWorkloadId,
        workloadName: rawWorkloadName,
        description: rawDescription,
        environments,
        deploymentPreferences,
        securityRules,
        trackedResources,
        allowClear,
        unset
      } = args;

      // Helper to check if a string value is a placeholder the agent uses to mean "no change"
      function isAgentPlaceholder(val) {
        if (val == null) return true;
        if (typeof val !== "string") return false;
        const trimmed = val.trim();
        if (!trimmed) return true;
        // Colon-wrapped placeholders like :new:, :auto:, :nochange:, :unchanged:, :isNull:, etc.
        if (/^:[a-zA-Z_]+:?$/i.test(trimmed)) return true;
        // Common null-like or placeholder strings (case-insensitive)
        const lc = trimmed.toLowerCase();
        if (["null", "undefined", "none", "new", "auto", "nochange", "unchanged", "n/a", "na"].includes(lc)) return true;
        return false;
      }

      // Filter out placeholder values that indicate "create new" - the agent sometimes sends these
      const workloadId = isAgentPlaceholder(rawWorkloadId) ? null : rawWorkloadId.trim();
      
      // Filter out "no change" placeholders from string fields
      const workloadName = isAgentPlaceholder(rawWorkloadName) ? undefined : rawWorkloadName;
      const description = isAgentPlaceholder(rawDescription) ? undefined : rawDescription;

      const userId = getUserId(runContext);
      logStart("update_workload", {
        userId,
        workloadId,
        action: workloadId ? "update" : "create"
      });

      if (rawWorkloadId != null && workloadId == null) {
        console.warn("[update_workload] Ignoring placeholder or invalid workloadId from agent input.", {
          userId,
          rawWorkloadId
        });
      }
      if (rawWorkloadName != null && workloadName === undefined) {
        console.warn("[update_workload] Ignoring placeholder or empty workloadName from agent input.", {
          userId,
          rawWorkloadName
        });
      }
      if (rawDescription != null && description === undefined) {
        console.warn("[update_workload] Ignoring placeholder or empty description from agent input.", {
          userId,
          rawDescription
        });
      }

      if (DEBUG_WORKLOADS) {
        console.log("[update_workload] TOOL INPUT:", {
          userId,
          rawWorkloadId,
          workloadId,
          rawWorkloadName,
          workloadName,
          rawDescription,
          description,
          environments,
          hasDeploymentPreferences: !!deploymentPreferences,
          hasSecurityRules: !!securityRules,
          hasTrackedResources: !!trackedResources,
          allowClear,
          unset,
          args: JSON.stringify(args, null, 2)
        });
      }

      const nowIso = new Date().toISOString();
      let finalItem;
      let action;

      try {
        if (workloadId) {
          if (DEBUG_WORKLOADS) {
            console.log("[update_workload] Checking for existing workload:", { userId, workloadId });
          }
          const existing = await workloadsService.getWorkload(userId, workloadId, { includeShared: false });
          if (DEBUG_WORKLOADS) {
            console.log("[update_workload] Existing workload lookup result:", { 
              found: !!existing, 
              existingKeys: existing ? Object.keys(existing) : null 
            });
          }
          if (!existing) {
            finalItem = {
              userId,
              workloadId,
              workloadName: workloadName ?? "untitled-workload",
              description: description ?? "",
              environments: environments ?? [],
              deploymentPreferences: deploymentPreferences ?? { method: "cloudformation" },
              securityRules:
                securityRules ?? {
                  encryption: { enable_all: false, s3_encryption_at_rest: false, s3_encryption_in_transit: false, dynamodb_encryption: false, rds_encryption: false, efs_encryption: false, ec2_encryption: false },
                  logging: { enable_all: false, s3_logging: false, rds_logging: false, ec2_logging: false, cloudtrail_logging: false, vpc_flow_logging: false },
                  public_resources: { enable_all: false, prevent_public_s3: false, prevent_public_ec2: false, prevent_public_rds: false, prevent_public_efs: false, prevent_public_alb: false }
                },
              trackedResources: trackedResources ?? DEFAULT_TRACKED_RESOURCES(),
              createdAt: nowIso,
              updatedAt: nowIso
            };
            if (DEBUG_WORKLOADS) {
              console.log("[update_workload] Create with provided ID - calling putWorkload:", {
                workloadId: finalItem.workloadId,
                workloadName: finalItem.workloadName
              });
            }
            await workloadsService.putWorkload(finalItem);
            action = "created";
          } else {
            const patch = {
              ...(workloadName !== undefined ? { workloadName } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(environments !== undefined ? { environments } : {}),
              ...(deploymentPreferences !== undefined ? { deploymentPreferences } : {}),
              ...(securityRules !== undefined ? { securityRules } : {}),
              ...(trackedResources !== undefined ? { trackedResources } : {}),
              updatedAt: nowIso
            };
            const cleanedPatch = sanitizePatch(patch, { allowClear: !!allowClear });
            const merged = deepMerge(existing, cleanedPatch);
            if (Array.isArray(unset)) {
              for (const pathStr of unset) {
                if (typeof pathStr === "string" && pathStr.trim().length) {
                  deleteByPath(merged, pathStr);
                }
              }
            }
            if (DEBUG_WORKLOADS) {
              console.log("[update_workload] Update path - patch/merge details:", {
                patchKeys: Object.keys(patch),
                cleanedPatchKeys: Object.keys(cleanedPatch),
                mergedKeys: Object.keys(merged),
                patch: JSON.stringify(patch, null, 2),
                cleanedPatch: JSON.stringify(cleanedPatch, null, 2)
              });
            }
            finalItem = await workloadsService.updateWorkloadPartial({
              userId,
              workloadId,
              existing,
              finalItem: merged,
              unsetPaths: Array.isArray(unset) ? unset : []
            });
            action = "updated";
          }
        } else {
          const newId = randomUUID();
          if (workloadName === undefined) {
            console.warn("[update_workload] Create request omitted workloadName; defaulting to untitled-workload.", {
              userId,
              generatedWorkloadId: newId
            });
          }
          if (DEBUG_WORKLOADS) {
            console.log("[update_workload] Create path - generating new workloadId:", { newId });
          }
          if (description === undefined) {
            console.warn("[update_workload] Create request omitted description; defaulting to empty string.", {
              userId,
              generatedWorkloadId: newId
            });
          }
          let seedSecurity = securityRules;
          let seedDeploy = deploymentPreferences;

          const envFirst =
            Array.isArray(environments) && environments.length ? String(environments[0] || "").trim() : null;
          const permissionProfileId = envFirst || null;

          if (permissionProfileId) {
            if (DEBUG_WORKLOADS) {
              console.log("[update_workload] Fetching permission profile defaults for:", {
                permissionProfileId
              });
            }
            const { authProfile = null, securityRules: accSec = {}, deploymentPreferences: accDep = {} } =
              await accountsService.getPermissionProfileDefaults(userId, permissionProfileId, { includeShared: false });

            if (seedSecurity == null) seedSecurity = accSec;
            if (seedDeploy == null) seedDeploy = accDep;
            if (DEBUG_WORKLOADS) {
              console.log("[update_workload] Permission profile defaults result:", {
                authProfileType: authProfile?.provider || authProfile?.type || null,
                awsAccountId: authProfile?.awsAccountId || null,
                hasAccSec: !!accSec,
                hasAccDep: !!accDep
              });
            }
          }

          const defaultSec = {
            encryption: { enable_all: false, s3_encryption_at_rest: false, s3_encryption_in_transit: false, dynamodb_encryption: false, rds_encryption: false, efs_encryption: false, ec2_encryption: false },
            logging: { enable_all: false, s3_logging: false, rds_logging: false, ec2_logging: false, cloudtrail_logging: false, vpc_flow_logging: false },
            public_resources: { enable_all: false, prevent_public_s3: false, prevent_public_ec2: false, prevent_public_rds: false, prevent_public_efs: false, prevent_public_alb: false }
          };
          const defaultDep = { method: "cloudformation" };

          finalItem = {
            userId,
            workloadId: newId,
            workloadName: workloadName ?? "untitled-workload",
            description: description ?? "",
            environments: environments ?? [],
            deploymentPreferences: seedDeploy ?? defaultDep,
            securityRules: seedSecurity ?? defaultSec,
            trackedResources: trackedResources ?? DEFAULT_TRACKED_RESOURCES(),
            createdAt: nowIso,
            updatedAt: nowIso
          };
          if (DEBUG_WORKLOADS) {
            console.log("[update_workload] Create path - calling putWorkload with:", {
              workloadId: finalItem.workloadId,
              workloadName: finalItem.workloadName,
              finalItemKeys: Object.keys(finalItem)
            });
          }
          await workloadsService.putWorkload(finalItem);
          action = "created";
      }

      const list = cache.getWorkloadsSnapshot(userId) || [];
      const idx = list.findIndex(w => w.workloadId === finalItem.workloadId);
      if (idx >= 0) list[idx] = finalItem;
      else list.unshift(finalItem);
      cache.setWorkloads(userId, list);

      if (!finalItem.workloadId || typeof finalItem.workloadId !== "string") {
        console.error("[update_workload] ERROR: finalItem.workloadId is missing or invalid!", { finalItem });
        throw new Error(`Internal error: workloadId is missing or invalid after ${action}`);
      }

      const out = { ok: true, action, workloadId: finalItem.workloadId, workload: finalItem, cache: "updated" };

      if (DEBUG_WORKLOADS) {
        console.log("[update_workload] TOOL OUTPUT:", {
          ok: out.ok,
          action: out.action,
          workloadId: out.workloadId,
          finalItemKeys: Object.keys(finalItem),
          finalItem: JSON.stringify(finalItem, null, 2)
        });
      }

      logEnd("update_workload", out);
      return out;
    } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        if (DEBUG_WORKLOADS) {
          console.error("[update_workload] TOOL ERROR:", {
            errorName: error?.name,
            errorMessage: error?.message,
            errorCode: error?.code,
            userId,
            workloadId,
            error
          });
        }
        logEnd("update_workload", out);
        throw error;
      }
    }
  });
}
