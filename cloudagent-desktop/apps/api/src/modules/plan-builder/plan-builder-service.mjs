import { z } from "zod";
import globals from "@cloudagent/platform/global-variables";
import { parseStoredJsonValue } from "@cloudagent/storage";
import { getLocalOpenAIKey, isLocalOpenAIConfigured } from "../../platform/openai.mjs";

export const DEFAULT_PLAN_BUILDER_TASK_MAX_TURNS = 50;
export const MAX_PLAN_BUILDER_TASK_MAX_TURNS = 150;
export const localPlanBuilderSessions = new Map();
export const localPlanBuilderHistories = new Map();
export function blueprintToPlanState(blueprint = {}) {
  const plan = parseStoredJsonValue(blueprint?.plan, {}) || {};
  const rawDescription = parseStoredJsonValue(blueprint?.description, blueprint?.description);
  const planDescription = Array.isArray(rawDescription)
    ? rawDescription.join("\n")
    : (typeof rawDescription === "string" ? rawDescription : "");
  const planSettings = parseStoredJsonValue(blueprint?.planSettings, {}) || {};
  return {
    planId: blueprint?.recordId || plan?.planId || plan?.id || null,
    planTitle: blueprint?.title || plan?.planTitle || plan?.title || "Untitled Skill",
    planDescription,
    cloudProvider: blueprint?.cloudProvider || plan?.cloudProvider || "aws",
    plan: Array.isArray(plan?.plan) ? plan.plan : Array.isArray(plan?.tasks) ? plan.tasks : [],
    requiredPermissions: parseStoredJsonValue(blueprint?.requiredPermissions, {}),
    planSettings,
    planOverview: planSettings.planOverview || plan?.planOverview || null,
    planDefaultValues: planSettings.defaultValues || plan?.planDefaultValues || null,
    skeletonSettings: planSettings.skeletonSettings || plan?.skeletonSettings || null,
  };
}

export function normalizeDescriptionList(value) {
  const parsed = parseStoredJsonValue(value, value);
  if (Array.isArray(parsed)) return parsed.filter((entry) => typeof entry === "string" && entry.trim());
  if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
  return [];
}

export function normalizeBuilderPlanArray(value) {
  const parsed = parseStoredJsonValue(value, value);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.plan)) return parsed.plan;
  if (Array.isArray(parsed?.skeleton)) return parsed.skeleton;
  return [];
}

export function normalizeLocalPlanArrays(phases) {
  if (!Array.isArray(phases)) return [];
  return phases.map((phase) => ({
    ...phase,
    tasks: Array.isArray(phase?.tasks)
      ? phase.tasks.map((task) => {
          const parsedMaxTurns = Number.parseInt(String(task?.maxTurns ?? ""), 10);
          return {
            ...task,
            completionCriteria: Array.isArray(task?.completionCriteria)
              ? task.completionCriteria
              : task?.completionCriteria == null
                ? []
                : [String(task.completionCriteria)],
            maxTurns: Number.isFinite(parsedMaxTurns)
              ? Math.min(
                  MAX_PLAN_BUILDER_TASK_MAX_TURNS,
                  Math.max(1, parsedMaxTurns)
                )
              : DEFAULT_PLAN_BUILDER_TASK_MAX_TURNS,
          };
        })
      : [],
  }));
}

export function ensureLocalPlanCloudProvider(phases, cloudProvider = "aws") {
  const provider = String(cloudProvider || "aws").trim().toLowerCase() === "azure" ? "azure" : "aws";
  return normalizeLocalPlanArrays(phases).map((phase) => ({
    ...phase,
    tasks: Array.isArray(phase?.tasks)
      ? phase.tasks.map((task) => ({
          ...task,
          cloudProvider: task?.cloudProvider || provider,
        }))
      : [],
  }));
}

export function getOrInitLocalPlanBuilderState(sessionId) {
  const empty = {
    planId: undefined,
    planTitle: undefined,
    planDescription: undefined,
    cloudProvider: "aws",
    plan: [],
    status: "idle",
    cursor: undefined,
    requiredPermissions: undefined,
    planSettings: undefined,
  };
  if (!sessionId) return { ...empty };
  if (!localPlanBuilderSessions.has(sessionId)) {
    localPlanBuilderSessions.set(sessionId, { ...empty });
  }
  return localPlanBuilderSessions.get(sessionId);
}

export function setLocalPlanBuilderState(sessionId, nextState) {
  if (!sessionId) return;
  const current = getOrInitLocalPlanBuilderState(sessionId);
  localPlanBuilderSessions.set(sessionId, { ...current, ...nextState });
}

export function normalizeLocalPlanBuilderMessageArgs(message, planState, normalizeBlueprintCloudProvider) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return message;
  const action = message?.action;
  const args = message?.args && typeof message.args === "object" ? { ...message.args } : null;
  if (!action || !args) return message;

  args.cloudProvider = normalizeBlueprintCloudProvider(
    args.cloudProvider || planState?.cloudProvider || "aws"
  );

  if (action === "generate_or_update_skeleton") {
    const hasExisting = Array.isArray(args.existingPlan) && args.existingPlan.length > 0;
    if (!hasExisting && Array.isArray(planState?.plan) && planState.plan.length > 0) {
      args.existingPlan = planState.plan;
    }
  }

  if (
    (action === "update_tasks_batch" || action === "update_tasks_all") &&
    (!Array.isArray(args.plan) || args.plan.length === 0)
  ) {
    args.plan = Array.isArray(planState?.plan) ? planState.plan : [];
  }

  if (action === "update_plan_settings") {
    const planObj = args.planObj && typeof args.planObj === "object" ? { ...args.planObj } : {};
    if (!Array.isArray(planObj.plan) || planObj.plan.length === 0) {
      planObj.plan = Array.isArray(planState?.plan) ? planState.plan : [];
    }
    args.planObj = planObj;
  }

  return { ...message, args };
}

export async function savePlanBuilderBlueprint(store, payload = {}) {
  const planState = payload.planState || payload.plan || {};
  const recordId = payload.recordId || planState.recordId || planState.planId || planState.blueprintId;
  const planTitle = planState.planTitle || planState.title || payload.title || "Untitled Skill";
  const planDescription =
    (typeof planState.planDescription === "string" ? planState.planDescription : "") ||
    (typeof payload.planDescription === "string" ? payload.planDescription : "") ||
    (typeof planState.description === "string" ? planState.description : "") ||
    (typeof payload.description === "string" ? payload.description : "") ||
    "";
  const sourcePlanSettings =
    planState.planSettings && typeof planState.planSettings === "object" && !Array.isArray(planState.planSettings)
      ? planState.planSettings
      : payload.planSettings && typeof payload.planSettings === "object" && !Array.isArray(payload.planSettings)
        ? payload.planSettings
        : {};
  const planSettings = {
    ...sourcePlanSettings,
    ...(planState.planOverview ? { planOverview: planState.planOverview } : {}),
    ...(planState.planDefaultValues ? { defaultValues: planState.planDefaultValues } : {}),
    ...(planState.skeletonSettings ? { skeletonSettings: planState.skeletonSettings } : {}),
  };
  const planPayload = {
    title: planTitle,
    planTitle,
    cloudProvider: planState.cloudProvider || payload.cloudProvider || "aws",
    plan: normalizeBuilderPlanArray(planState.plan || planState.skeleton),
    ...(planDescription ? { description: planDescription } : {}),
    ...(planState.planOverview ? { planOverview: planState.planOverview } : {}),
    ...(planState.planDefaultValues ? { planDefaultValues: planState.planDefaultValues } : {}),
    ...(planState.skeletonSettings ? { skeletonSettings: planState.skeletonSettings } : {}),
  };
  const blueprintInput = {
    ...(recordId ? { recordId } : {}),
    title: planTitle,
    description: normalizeDescriptionList(planDescription),
    cloudProvider: planPayload.cloudProvider,
    plan: planPayload,
    requiredPermissions: planState.requiredPermissions || payload.requiredPermissions || {},
    planSettings,
    status: payload.status || "ready",
  };
  const blueprint = recordId && await store.getSkill(recordId)
    ? await store.updateSkill(recordId, blueprintInput)
    : await store.createSkill(blueprintInput);
  return {
    ok: true,
    recordId: blueprint.recordId,
    blueprint,
    planState: blueprintToPlanState(blueprint),
    warnings: [],
  };
}

export function getLocalPlanBuilderOpenAIError() {
  return {
    ok: false,
    success: false,
    error: "OPENAI_NOT_CONFIGURED",
    message:
      "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to use the local skill builder.",
  };
}

export async function loadLocalPlanBuilderFunctions() {
  if (!process.env.OPENAI_TOKEN && process.env.OPENAI_API_KEY) {
    process.env.OPENAI_TOKEN = process.env.OPENAI_API_KEY;
  }
  const [functionsModule, serviceModule] = await Promise.all([
    import("@cloudagent/skills/builder-functions"),
    import("@cloudagent/skills/skill-service"),
  ]);
  return {
    generateOrUpdateSkeleton: functionsModule.generateOrUpdateSkeleton,
    updateTasksBatch: functionsModule.updateTasksBatch,
    updateTasksSerial: functionsModule.updateTasksSerial,
    updatePlanSettings: functionsModule.updatePlanSettings,
    generatePlanTitleAndDescriptionFromPlan:
      functionsModule.generatePlanTitleAndDescriptionFromPlan,
    DEFAULT_SKELETON_SETTINGS: serviceModule.DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider: serviceModule.normalizeBlueprintCloudProvider,
    normalizeTitle: serviceModule.normalizeTitle,
  };
}

export function parsePlanBuilderMessage(message) {
  if (message && typeof message === "object" && !Array.isArray(message)) return message;
  if (typeof message !== "string") return { action: "chat", args: {} };
  const trimmed = message.trim();
  if (!trimmed) return { action: "chat", args: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  return { action: "chat", args: { prompt: trimmed } };
}

export function buildPlanBuilderStateFromPayload(payload = {}) {
  const planState = payload.planState || {};
  return {
    planId:
      payload.planId ||
      payload.recordId ||
      planState.planId ||
      planState.recordId ||
      `local-plan-${Date.now()}`,
    planTitle:
      payload.planTitle ||
      planState.planTitle ||
      planState.title ||
      "Untitled Skill",
    planDescription:
      payload.planDescription ||
      planState.planDescription ||
      planState.description ||
      "",
    cloudProvider:
      payload.cloudProvider ||
      planState.cloudProvider ||
      "aws",
    plan: normalizeBuilderPlanArray(planState.plan || planState.skeleton || payload.plan),
    requiredPermissions: planState.requiredPermissions || payload.requiredPermissions || {},
    planSettings: planState.planSettings || payload.planSettings || {},
    planOverview: planState.planOverview || null,
    planDefaultValues:
      planState.planDefaultValues ||
      planState.planSettings?.defaultValues ||
      null,
    skeletonSettings:
      planState.skeletonSettings ||
      payload.skeletonSettings ||
      planState.planSettings?.skeletonSettings ||
      null,
  };
}

export function collectPlanTaskPointers(plan = []) {
  const pointers = [];
  if (!Array.isArray(plan)) return pointers;
  plan.forEach((phase, phaseIndex) => {
    if (!Array.isArray(phase?.tasks)) return;
    phase.tasks.forEach((_task, taskIndex) => {
      pointers.push({ phaseIndex, taskIndex });
    });
  });
  return pointers;
}

export async function persistPlanBuilderDraft(store, payload, planState, status = "in_progress") {
  if (payload.persistDraft === false && !payload.recordId) {
    return {
      recordId: payload.recordId || planState.planId,
      planState,
      blueprint: null,
    };
  }
  return savePlanBuilderBlueprint(store, {
    ...payload,
    recordId: payload.recordId || planState.recordId || planState.planId,
    planState,
    status,
  });
}

export async function runLocalPlanBuilderGenerate(store, payload = {}) {
  if (!isLocalOpenAIConfigured()) return getLocalPlanBuilderOpenAIError();

  const started = Date.now();
  const {
    generateOrUpdateSkeleton,
    updateTasksBatch,
    updatePlanSettings,
    generatePlanTitleAndDescriptionFromPlan,
    DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider,
    normalizeTitle,
  } = await loadLocalPlanBuilderFunctions();
  const initial = buildPlanBuilderStateFromPayload(payload);
  const cloudProvider = normalizeBlueprintCloudProvider(initial.cloudProvider);
  const skeletonSettings = {
    ...DEFAULT_SKELETON_SETTINGS,
    ...(initial.skeletonSettings || payload.skeletonSettings || {}),
    phases: {
      ...DEFAULT_SKELETON_SETTINGS.phases,
      ...(initial.skeletonSettings?.phases || payload.skeletonSettings?.phases || {}),
    },
  };
  const planDescription =
    initial.planDescription ||
    payload.planDescription ||
    (typeof payload.message === "string" ? payload.message : "") ||
    initial.planTitle;

  await persistPlanBuilderDraft(
    store,
    payload,
    {
      ...initial,
      cloudProvider,
      skeletonSettings,
      planDescription,
    },
    "in_progress"
  );

  const skeleton = await generateOrUpdateSkeleton({
    planId: initial.planId,
    planTitle: initial.planTitle,
    planDescription,
    existingPlan: initial.plan,
    skeletonSettings,
    cloudProvider,
  });
  const taskPointers = collectPlanTaskPointers(skeleton);
  const { plan: generatedPlan } = taskPointers.length
    ? await updateTasksBatch({
        plan: skeleton,
        tasks: taskPointers,
        notes: skeletonSettings.notes || payload.notes || "",
        skeletonSettings,
        cloudProvider,
      })
    : { plan: skeleton };
  const meta = await generatePlanTitleAndDescriptionFromPlan(
    generatedPlan,
    planDescription,
    cloudProvider
  ).catch(() => ({
    title: initial.planTitle,
    description: planDescription,
  }));
  const { overview, defaultValues, policy } = await updatePlanSettings({
    planId: initial.planId,
    planObj: { plan: generatedPlan },
    planDescription: meta.description || planDescription,
    cloudProvider,
  });
  const finalState = {
    ...initial,
    planId: initial.planId,
    planTitle: normalizeTitle(meta.title || initial.planTitle, meta.description || planDescription),
    planDescription: meta.description || planDescription,
    cloudProvider,
    plan: generatedPlan,
    skeleton: generatedPlan,
    planOverview: overview || null,
    planDefaultValues: defaultValues || null,
    requiredPermissions: policy || initial.requiredPermissions || null,
    planSettings: {
      ...(initial.planSettings || {}),
      ...(defaultValues ? { defaultValues } : {}),
      ...(overview ? { planOverview: overview } : {}),
      skeletonSettings,
    },
    skeletonSettings,
  };
  const saved = await savePlanBuilderBlueprint(store, {
    ...payload,
    recordId: payload.recordId || initial.planId,
    planState: finalState,
    status: "ready",
  });
  return {
    ok: true,
    success: true,
    sessionId: payload.sessionId || null,
    recordId: saved.recordId,
    planState: saved.planState,
    blueprint: saved.blueprint,
    durationMs: Date.now() - started,
  };
}

export async function runLocalPlanBuilderAgentChat(store, payload = {}) {
  if (!isLocalOpenAIConfigured()) return getLocalPlanBuilderOpenAIError();

  const started = Date.now();
  const sessionId = String(payload.sessionId || "").trim();
  if (!sessionId) {
    return {
      ok: false,
      success: false,
      error: "sessionId required",
    };
  }

  const [
    { Agent, run, user, extractAllTextOutput, tool },
    { OpenAIResponsesModel, setDefaultOpenAIKey },
    { default: OpenAI },
  ] = await Promise.all([
    import("@openai/agents"),
    import("@openai/agents-openai"),
    import("openai"),
  ]);
  const {
    generateOrUpdateSkeleton,
    updateTasksBatch,
    updateTasksSerial,
    updatePlanSettings,
    generatePlanTitleAndDescriptionFromPlan,
    DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider,
    normalizeTitle,
  } = await loadLocalPlanBuilderFunctions();

  const apiKey = getLocalOpenAIKey();
  setDefaultOpenAIKey(apiKey);
  const modelName =
    process.env.OPENAI_LOCAL_MODEL ||
    process.env.OPENAI_MODEL ||
    globals.OPENAI_MODEL ||
    "gpt-5.4";
  const openai = new OpenAI({ apiKey });
  const model = new OpenAIResponsesModel(openai, modelName);

  const StructuredResponse = z.object({
    planState: z.unknown().nullable().optional(),
    commentary: z.string(),
  });
  const TaskPointer = z.object({
    phaseIndex: z.number().int().nonnegative(),
    taskIndex: z.number().int().nonnegative(),
    notes: z.string().nullable().optional(),
  });
  const SkeletonSettings = z.object({
    phases: z.object({
      assessment: z.boolean().nullable().optional(),
      summary: z.boolean().nullable().optional(),
      configuration: z.boolean().nullable().optional(),
      validation: z.boolean().nullable().optional(),
    }).nullable().optional(),
    notes: z.string().nullable().optional(),
    deploymentMethod: z.enum(["cli", "cloudformation"]).nullable().optional(),
    cloudFormationStackExists: z.boolean().nullable().optional(),
  }).nullable().optional();
  const CloudProvider = z.enum(["aws", "azure"]).nullable().optional();
  const PlanTask = z.object({
    id: z.string(),
    title: z.string().nullable().optional(),
    cloudProvider: z.enum(["aws", "azure"]).nullable().optional(),
    notes: z.array(z.string()).nullable().optional(),
    description: z.string().nullable().optional(),
    depends_on: z.array(z.string()).nullable().optional(),
    skip_conditions: z.string().nullable().optional(),
    completionCriteria: z.array(z.string()).nullable().optional(),
    maxTurns: z.number().int().min(1).max(MAX_PLAN_BUILDER_TASK_MAX_TURNS).nullable().optional(),
  }).strict();
  const PlanPhase = z.object({
    title: z.string(),
    tasks: z.array(PlanTask),
  }).strict();
  const PlanArray = z.array(PlanPhase);
  const PlanObj = z.object({ plan: PlanArray }).strict();

  const generateOrUpdateSkeletonTool = tool({
    name: "generate_or_update_skeleton",
    description: "Generate a new AWS or Azure plan skeleton or update an existing one using notes.",
    parameters: z.object({
      planId: z.string(),
      planTitle: z.string(),
      planDescription: z.string(),
      cloudProvider: CloudProvider,
      existingPlan: PlanArray.nullable().optional(),
      skeletonSettings: SkeletonSettings,
    }),
    async execute({ planId, planTitle, planDescription, cloudProvider = "aws", existingPlan = [], skeletonSettings }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      const skeleton = await generateOrUpdateSkeleton({
        planId,
        planTitle,
        planDescription,
        cloudProvider: normalizedCloudProvider,
        existingPlan: existingPlan || [],
        skeletonSettings,
      });
      return {
        cloudProvider: normalizedCloudProvider,
        plan: ensureLocalPlanCloudProvider(skeleton, normalizedCloudProvider),
      };
    },
  });

  const updateTasksBatchTool = tool({
    name: "update_tasks_batch",
    description: "Update settings for one or more selected tasks in a single pass.",
    parameters: z.object({
      plan: PlanArray,
      tasks: z.array(TaskPointer).min(1),
      notes: z.string().nullable().optional(),
      cloudProvider: CloudProvider,
      skeletonSettings: SkeletonSettings,
    }),
    async execute({ plan, tasks, notes = "", cloudProvider = "aws", skeletonSettings }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      const result = await updateTasksBatch({
        plan,
        tasks,
        notes,
        skeletonSettings,
        cloudProvider: normalizedCloudProvider,
      });
      return {
        cloudProvider: normalizedCloudProvider,
        plan: ensureLocalPlanCloudProvider(result.plan, normalizedCloudProvider),
      };
    },
  });

  const updateTasksSerialTool = tool({
    name: "update_tasks_all",
    description: "Sequentially update settings for all tasks in order.",
    parameters: z.object({
      plan: PlanArray,
      cloudProvider: CloudProvider,
      notes: z.string().nullable().optional(),
    }),
    async execute({ plan, cloudProvider = "aws", notes = "" }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      const result = await updateTasksSerial({
        plan,
        notes,
        cloudProvider: normalizedCloudProvider,
      });
      return {
        cloudProvider: normalizedCloudProvider,
        plan: ensureLocalPlanCloudProvider(result.plan, normalizedCloudProvider),
      };
    },
  });

  const updatePlanSettingsTool = tool({
    name: "update_plan_settings",
    description: "Generate overview, default values, and permissions for the current plan.",
    parameters: z.object({
      planId: z.string().nullable().optional(),
      planObj: PlanObj,
      cloudProvider: CloudProvider,
      planDescription: z.string(),
    }),
    async execute({ planId, planObj, cloudProvider = "aws", planDescription }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      return updatePlanSettings({
        planId,
        planObj: {
          ...planObj,
          plan: ensureLocalPlanCloudProvider(planObj?.plan || [], normalizedCloudProvider),
        },
        planDescription,
        cloudProvider: normalizedCloudProvider,
      });
    },
  });

  const agent = new Agent({
    name: "Local Plan Builder",
    instructions: `
You are a Plan Builder Agent. Help users quickly create and refine AWS or Azure plans using the available tools.

RESPONSE FORMAT:
- Always respond with a structured JSON object containing:
  - planState: The current full plan state object, or null if unchanged
  - commentary: Short explanation of what changed or next steps

TOOLS:
- generate_or_update_skeleton: Create or update the skeleton.
- update_tasks_all: Sequentially update task settings for all tasks.
- update_tasks_batch: Update selected tasks only.
- update_plan_settings: Generate overview, default values, and required permissions.

DEFAULT FLOW:
- Unless the user explicitly asks to update tasks now, only create or update the skeleton and stop for review.
- When the user asks to generate or update the whole blueprint/task details, use update_tasks_all.
- When the user asks to update selected tasks, use update_tasks_batch.
- When the user asks to finalize settings, defaults, or permissions, use update_plan_settings.

RULES:
- Preserve planState.cloudProvider and pass it into every tool call.
- Default to "aws" only when no provider is specified.
- Do not use a skeleton field in planState; store the current phases/tasks under planState.plan.
- Keep existing fields when not updated; do not alter task order or task ids unless the user asks.
- Ensure depends_on references only prior tasks.
- Keep commentary concise.

PLAN STATE UPDATES:
- After generate_or_update_skeleton, set planState.plan from the returned plan and preserve planId, planTitle, planDescription, and cloudProvider.
- After update_tasks_batch or update_tasks_all, set planState.plan from the returned plan and preserve planId, planTitle, planDescription, and cloudProvider.
- After update_plan_settings, set planOverview, planDefaultValues, and requiredPermissions without changing plan tasks.
    `,
    model,
    tools: [
      generateOrUpdateSkeletonTool,
      updateTasksBatchTool,
      updateTasksSerialTool,
      updatePlanSettingsTool,
    ],
    responseFormat: { type: "json_object" },
  });

  const recordId = payload.recordId || null;
  let serverPlanState = getOrInitLocalPlanBuilderState(sessionId);
  if (recordId) {
    const blueprint = await store.getSkill(recordId).catch(() => null);
    if (blueprint) {
      serverPlanState = {
        ...serverPlanState,
        ...blueprintToPlanState(blueprint),
      };
    }
  }

  const payloadState = buildPlanBuilderStateFromPayload(payload);
  let mergedState = {
    ...serverPlanState,
    ...payloadState,
    ...(payload.planState && typeof payload.planState === "object" ? payload.planState : {}),
  };
  const explicitPlanId =
    payload.planId ||
    payload.recordId ||
    payload.planState?.planId ||
    payload.planState?.recordId;
  if (!explicitPlanId && serverPlanState?.planId) {
    mergedState.planId = serverPlanState.planId;
  }
  if (!payload.planTitle && !payload.planState?.planTitle && serverPlanState?.planTitle) {
    mergedState.planTitle = serverPlanState.planTitle;
  }
  if (!payload.planDescription && !payload.planState?.planDescription && serverPlanState?.planDescription) {
    mergedState.planDescription = serverPlanState.planDescription;
  }
  mergedState.cloudProvider = normalizeBlueprintCloudProvider(mergedState.cloudProvider);
  mergedState.plan = ensureLocalPlanCloudProvider(
    normalizeBuilderPlanArray(mergedState.plan || mergedState.skeleton),
    mergedState.cloudProvider
  );
  delete mergedState.skeleton;
  setLocalPlanBuilderState(sessionId, mergedState);

  const currentPlanState = getOrInitLocalPlanBuilderState(sessionId);
  const normalizedMessage = normalizeLocalPlanBuilderMessageArgs(
    payload.message,
    currentPlanState,
    normalizeBlueprintCloudProvider
  );
  const historyKey = sessionId;
  const history = localPlanBuilderHistories.get(historyKey) || [];
  const contextMessage =
    `Current Plan State (if any):\n${JSON.stringify(currentPlanState, null, 2)}\n\n` +
    `User request: ${typeof normalizedMessage === "string" ? normalizedMessage : JSON.stringify(normalizedMessage)}`;
  history.push(user(contextMessage));

  const result = await run(agent, history, {
    maxTurns: 30,
    runConfig: { tracingDisabled: true },
    context: { ui: "local-api" },
  });
  const rawResponse = result.finalOutput ?? extractAllTextOutput(result.history) ?? "";
  localPlanBuilderHistories.set(historyKey, result.history);

  let structuredResponse;
  try {
    structuredResponse = StructuredResponse.parse(
      typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse
    );
  } catch {
    const jsonMatch = typeof rawResponse === "string"
      ? rawResponse.match(/```json\n([\s\S]*?)\n```/)
      : null;
    if (jsonMatch) {
      try {
        structuredResponse = StructuredResponse.parse(JSON.parse(jsonMatch[1]));
      } catch {
        structuredResponse = { planState: null, commentary: String(rawResponse || "") };
      }
    } else {
      structuredResponse = { planState: null, commentary: String(rawResponse || "") };
    }
  }

  let normalizedPlanState = currentPlanState;
  if (structuredResponse.planState && typeof structuredResponse.planState === "object") {
    normalizedPlanState = {
      ...currentPlanState,
      ...structuredResponse.planState,
    };
  }
  normalizedPlanState.cloudProvider = normalizeBlueprintCloudProvider(normalizedPlanState.cloudProvider);
  normalizedPlanState.plan = ensureLocalPlanCloudProvider(
    normalizeBuilderPlanArray(normalizedPlanState.plan || normalizedPlanState.skeleton),
    normalizedPlanState.cloudProvider
  );
  delete normalizedPlanState.skeleton;

  if (Array.isArray(normalizedPlanState.plan) && normalizedPlanState.plan.length > 0) {
    const meta = await generatePlanTitleAndDescriptionFromPlan(
      normalizedPlanState.plan,
      typeof payload.message === "string"
        ? payload.message
        : normalizedPlanState.planDescription || normalizedPlanState.planTitle || "",
      normalizedPlanState.cloudProvider
    ).catch(() => null);
    if (meta) {
      normalizedPlanState.planTitle = normalizeTitle(
        meta.title || normalizedPlanState.planTitle,
        meta.description || normalizedPlanState.planDescription
      );
      normalizedPlanState.planDescription =
        meta.description || normalizedPlanState.planDescription;
    }
  }
  setLocalPlanBuilderState(sessionId, normalizedPlanState);

  const hasPlan = Array.isArray(normalizedPlanState.plan) && normalizedPlanState.plan.length > 0;
  const hasSettingsAny = Boolean(normalizedPlanState.planOverview || normalizedPlanState.planDefaultValues);
  const hasSettingsAll = Boolean(normalizedPlanState.planOverview && normalizedPlanState.planDefaultValues);
  let status = "in_progress";
  if (hasPlan) status = "in_progress_skeleton";
  if (hasSettingsAny) status = "in_progress_settings";
  if (hasSettingsAll) status = "ready";

  const saved = await persistPlanBuilderDraft(
    store,
    payload,
    normalizedPlanState,
    status
  );
  const savedState = saved.planState || normalizedPlanState;
  if (savedState) {
    setLocalPlanBuilderState(sessionId, savedState);
  }

  return {
    ok: true,
    success: true,
    response: structuredResponse.commentary,
    message: structuredResponse.commentary,
    recordId: saved.recordId,
    planState: savedState,
    blueprint: saved.blueprint || null,
    sessionId,
    warnings: [],
    durationMs: Date.now() - started,
  };
}

export async function runLocalPlanBuilderChatAction(store, payload = {}) {
  if (!isLocalOpenAIConfigured()) return getLocalPlanBuilderOpenAIError();

  if (payload.useDirectLocalPlanBuilder !== true) {
    return runLocalPlanBuilderAgentChat(store, payload);
  }

  const started = Date.now();
  const message = parsePlanBuilderMessage(payload.message);
  const args = message.args || {};
  const {
    generateOrUpdateSkeleton,
    updateTasksBatch,
    updatePlanSettings,
    DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider,
  } = await loadLocalPlanBuilderFunctions();
  const current = buildPlanBuilderStateFromPayload(payload);
  const action = message.action || "chat";
  let nextState = { ...current };
  let response = "Updated the local skill draft.";
  let status = "in_progress";

  if (action === "generate_or_update_skeleton" || action === "chat") {
    const cloudProvider = normalizeBlueprintCloudProvider(args.cloudProvider || current.cloudProvider);
    const planDescription =
      args.planDescription ||
      current.planDescription ||
      args.prompt ||
      (typeof payload.message === "string" ? payload.message : "") ||
      current.planTitle;
    const skeletonSettings = {
      ...DEFAULT_SKELETON_SETTINGS,
      ...(current.skeletonSettings || {}),
      ...(args.skeletonSettings || {}),
      phases: {
        ...DEFAULT_SKELETON_SETTINGS.phases,
        ...(current.skeletonSettings?.phases || {}),
        ...(args.skeletonSettings?.phases || {}),
      },
    };
    const skeleton = await generateOrUpdateSkeleton({
      planId: args.planId || current.planId,
      planTitle: args.planTitle || current.planTitle,
      planDescription,
      existingPlan: normalizeBuilderPlanArray(args.existingPlan || current.plan),
      skeletonSettings,
      cloudProvider,
    });
    nextState = {
      ...current,
      planId: args.planId || current.planId,
      planTitle: args.planTitle || current.planTitle,
      planDescription,
      cloudProvider,
      plan: skeleton,
      skeleton,
      skeletonSettings,
    };
    response = "Generated an updated local skill skeleton.";
    status = "in_progress_skeleton";
  } else if (action === "update_tasks_batch") {
    const cloudProvider = normalizeBlueprintCloudProvider(args.cloudProvider || current.cloudProvider);
    const { plan } = await updateTasksBatch({
      plan: normalizeBuilderPlanArray(args.plan || current.plan),
      tasks: Array.isArray(args.tasks) ? args.tasks : collectPlanTaskPointers(current.plan),
      notes: args.notes || "",
      skeletonSettings: current.skeletonSettings || args.skeletonSettings || null,
      cloudProvider,
    });
    nextState = {
      ...current,
      cloudProvider,
      plan,
      skeleton: plan,
    };
    response = "Updated local skill task details.";
    status = "in_progress_tasks";
  } else if (action === "update_plan_settings") {
    const cloudProvider = normalizeBlueprintCloudProvider(args.cloudProvider || current.cloudProvider);
    const plan = normalizeBuilderPlanArray(args.planObj?.plan || args.plan || current.plan);
    const { overview, defaultValues, policy } = await updatePlanSettings({
      planId: args.planId || current.planId,
      planObj: { plan },
      planDescription: args.planDescription || current.planDescription,
      cloudProvider,
    });
    nextState = {
      ...current,
      cloudProvider,
      plan,
      skeleton: plan,
      planOverview: overview || null,
      planDefaultValues: defaultValues || null,
      requiredPermissions: policy || current.requiredPermissions || null,
      planSettings: {
        ...(current.planSettings || {}),
        ...(defaultValues ? { defaultValues } : {}),
        ...(overview ? { planOverview: overview } : {}),
        ...(current.skeletonSettings ? { skeletonSettings: current.skeletonSettings } : {}),
      },
    };
    response = "Generated local skill settings.";
    status = "ready";
  } else {
    response = `Unsupported local plan builder action: ${action}`;
  }

  const saved = await persistPlanBuilderDraft(store, payload, nextState, status);
  return {
    ok: true,
    success: true,
    response,
    message: response,
    recordId: saved.recordId,
    planState: saved.planState || nextState,
    sessionId: payload.sessionId || null,
    warnings: [],
    durationMs: Date.now() - started,
  };
}
