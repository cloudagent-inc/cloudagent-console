// Blueprint builder shared functions

import OpenAI from "openai/index.mjs";
import fs from "fs";
import readline from "readline";
import _get from "lodash.get";
import {
  loadBlueprintRecord,
  updateBlueprintRecord,
  DEFAULT_SKELETON_SETTINGS,
  normalizeTitle,
  normalizeBlueprintCloudProvider
} from "./skill-service-local.mjs";
import globals from "@cloudagent/platform/global-variables";

const OPENAI_MODEL = globals.OPENAI_MODEL;
const OPENAI_TOKEN = process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || "";
const openai = new OpenAI({ apiKey: OPENAI_TOKEN || "missing-local-openai-key" });

function getCloudProviderContext(cloudProvider = "aws") {
  const provider = normalizeBlueprintCloudProvider(cloudProvider);
  if (provider === "azure") {
    return {
      provider,
      label: "Azure",
      environment: "Azure subscription or tenant",
      cliName: "Azure CLI",
      cliCommand: "az",
      docsSource: "official Microsoft Azure documentation",
      examples: [
        '"Enable Azure Backup for Virtual Machines"',
        '"Configure Network Security Group Flow Logs"',
        '"Enable Diagnostic Settings for Azure Resources"'
      ],
      resourceExamples: "Azure virtual machines, resource groups, storage accounts, network security groups, subscriptions, and diagnostic settings"
    };
  }
  return {
    provider: "aws",
    label: "AWS",
    environment: "AWS account",
    cliName: "AWS CLI",
    cliCommand: "aws",
    docsSource: "official AWS documentation",
    examples: [
      '"Enable AWS Backup for EC2 Instances"',
      '"Configure VPC Flow Logs to CloudWatch"',
      '"Enable IMDSv2 on EC2 Instances"'
    ],
    resourceExamples: "S3 buckets, EC2 instances, VPCs, IAM roles, CloudWatch Logs, and CloudFormation stacks"
  };
}

function applyCloudProviderToPlan(plan, cloudProvider = "aws") {
  const provider = normalizeBlueprintCloudProvider(cloudProvider);
  if (!Array.isArray(plan)) return [];
  return plan.map(phase => ({
    ...phase,
    tasks: Array.isArray(phase?.tasks)
      ? phase.tasks.map(task => ({ ...task, cloudProvider: task?.cloudProvider || provider }))
      : []
  }));
}

// ———————————————— Helpers ————————————————

function log(tag, msg, obj) {
  const ts = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  if (obj !== undefined) console.log(`${ts} ${tag} ${msg}`, obj);
  else                    console.log(`${ts} ${tag} ${msg}`);
}

function writeJSONToFile(filename, jsonData) {
  try {
    fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2), "utf-8");
    console.log(`JSON written → ${filename}`);
  } catch (err) {
    console.error(`writeJSONToFile error:`, err.message);
  }
}

function readJSONFromFile(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf-8"));
  } catch {
    return null;
  }
}



function getUserInput(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a); }));
}

function getText(resp) {
  if (!resp?.output?.length) return "";
  // find the first block that is a finished assistant message
  const msg = resp.output.find(b => b.type === "message" && b.status === "completed");
  return msg?.content?.[0]?.text ?? "";
}

/* ---------- Tool definitions passed to the model ---------- */
const WEB_SEARCH_TOOLS = [
  { type: "web_search_preview" } // OpenAI built-in web search tool
];

/**********************************************************************
 * callModel
 * ----------
 * • Works with the Responses API (no conversation_id).
 * • Chains context via previous_response_id (stored in closure).
 * • Supports streaming and tool-call resolution, just like before.
 *********************************************************************/

let lastResponseId = null

async function callModel({ model = OPENAI_MODEL, messages = [], tools = [], toolChoice = "none", json = true, reasoningEffort = null } = {}) {
  
  /* 1️⃣  First request ---------------------------------------------------- */
  log("[CALL]", `⇢ model=${toolChoice} msgs=${messages.length}`);   
  let resp = await openai.responses.create({
    model,
    input: messages,        
    tools,
    tool_choice: toolChoice,
    ...(json ? { text: { format: { type: "json_object" } } } : {}),
    ...(lastResponseId && { previous_response_id: lastResponseId }),
    ...(reasoningEffort ? {reasoning : {effort: reasoningEffort}} : {})
  });
  
  lastResponseId = resp.id;

  // Tool dispatch disabled by default to avoid blocking in CLI/testing mode
  log("[CALL]", "⇠ assistant reply received");
  return resp;
}

function safeJSON(str, fallback = {}) {
  try {
    return JSON.parse(str.replace(/```json?|```/g, "").trim());
  } catch {
    return fallback;
  }
}
// ———————————————— Phase Functions ————————————————

/**
 * generatePlanTitleAndDescription
 * - Takes the user's original description and generates a refined title and description
 * - Returns: { title, description }
 */
export async function generatePlanTitleAndDescription(planDescription, cloudProvider = "aws") {
  const providerContext = getCloudProviderContext(cloudProvider);
  const systemPrompt = `You are a ${providerContext.label} planning assistant. Given a user's description of what they want to accomplish, generate:
1. A concise, descriptive title (max 80 characters) that captures the essence of the plan
2. A refined description (1-3 sentences) that clearly explains what the plan will accomplish

The title should be action-oriented and specific. For example:
${providerContext.examples.map(example => `- ${example}`).join("\n")}

The description should expand on the title and provide context about what will be done.

Return JSON only:
{
  "title": "...",
  "description": "..."
}`;
  const userPrompt = `User's request: ${planDescription}`;
  const r = await openai.chat.completions.create({ 
    model: OPENAI_MODEL, 
    messages: [ 
      { role: "system", content: systemPrompt }, 
      { role: "user", content: userPrompt } 
    ],
    response_format: { type: "json_object" }
  });
  const content = _get(r, ["choices", 0, "message", "content"], "{}");
  const parsed = safeJSON(content, { title: planDescription.slice(0, 80), description: planDescription });
  return {
    title: (parsed.title || planDescription).slice(0, 80),
    description: parsed.description || planDescription
  };
}

function buildPlanSummaryForMeta(plan) {
  if (!Array.isArray(plan)) return "";
  return plan
    .map(phase => {
      const tasks = Array.isArray(phase?.tasks)
        ? phase.tasks
            .map(task => `- ${task?.title || task?.id || "Task"}`)
            .join("\n")
        : "";
      return `Phase: ${phase?.title || "Phase"}\n${tasks}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function deriveFallbackTitleFromPlan(plan) {
  if (!Array.isArray(plan)) return "Untitled";
  for (const phase of plan) {
    if (Array.isArray(phase?.tasks)) {
      for (const task of phase.tasks) {
        if (typeof task?.title === "string" && task.title.trim()) {
          return task.title.trim().slice(0, 80);
        }
      }
    }
    if (typeof phase?.title === "string" && phase.title.trim()) {
      return phase.title.trim().slice(0, 80);
    }
  }
  return "Untitled";
}

/**
 * generatePlanTitleAndDescriptionFromPlan
 * - Generates a refined title and description based on the plan/skeleton
 * - Returns: { title, description }
 */
export async function generatePlanTitleAndDescriptionFromPlan(plan, fallbackDescription = "", cloudProvider = "aws") {
  const providerContext = getCloudProviderContext(cloudProvider);
  const planSummary = buildPlanSummaryForMeta(plan);
  const fallbackTitle = deriveFallbackTitleFromPlan(plan);
  const systemPrompt = `You are a ${providerContext.label} planning assistant. Given a plan skeleton (phases and task titles),
generate:
1) A concise, descriptive title (max 80 characters) that captures the essence of the plan
2) A refined description (1-3 sentences) that clearly explains what the plan will accomplish

Base your output on the plan itself (not the original user prompt). The title should be action-oriented, specific, and appropriate for ${providerContext.label}.

Return JSON only:
{
  "title": "...",
  "description": "..."
}`;
  const userPrompt = `Plan summary:\n${planSummary || "(no plan summary available)"}\n\nOriginal objective (optional): ${fallbackDescription || "(none)"}`;
  const r = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" }
  });
  const content = _get(r, ["choices", 0, "message", "content"], "{}");
  const parsed = safeJSON(content, { title: fallbackTitle, description: fallbackDescription });
  return {
    title: (parsed.title || fallbackTitle || "Untitled").slice(0, 80),
    description: parsed.description || fallbackDescription || ""
  };
}

function normalizeDescriptionList(value) {
  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === "string") {
      const candidate = value[0].trim();
      if (candidate.startsWith("[") && candidate.endsWith("]")) {
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed)) {
            return parsed.filter(v => typeof v === "string");
          }
        } catch (_) {}
      }
    }
    return value.filter(v => typeof v === "string");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(v => typeof v === "string");
        }
      } catch (_) {}
    }
    return [value];
  }
  return [];
}

export async function createPlanOverview(finalPlan, planDescription, cloudProvider = "aws") {
  const providerContext = getCloudProviderContext(cloudProvider);
  const systemPrompt = `Your task is to create a concise yet descriptive markdown summary of a ${providerContext.label} configuration plan. The summary should provide an overview of the plan's phases and tasks, but make it flow naturally. 
  
Use h2 and h3 headers if needed, and start with an "overview" section that describes what the plan does. The language should be addressing someone who wants to understand what this plan does, and don't reference it with something like "This plan titled...", but it should be more like "Configure backups for your EC2 instances to ensure high availability and resiliency. This plan will ensure that all EC2 instances are evaluated, guide you through possible options for configuring backups, and then also includes options for testing and validation at the end."
  
Then include a second section for "Execution Details" section that summarizes each phase and what is done (do not have too many nested bulletpoints, but maybe just a high level description of the tasks included in each phase). Also describe the actions being done, but no need to reference exactly how they are being executed - for example, do not reference ${providerContext.cliName} commands. When the task is about collecting user input, summarize what is being collected and use language like guide the user through potential options, or present the user with possible configurations, etc.

Use ${providerContext.label} terminology and resource names.
  `;
  const userPrompt = `Plan Description: ${planDescription}
  Plan JSON:
  ${JSON.stringify(finalPlan, null, 2)}\n\nPlease provide a markdown summary of this plan.`;
  const r = await openai.chat.completions.create({ model: OPENAI_MODEL, messages: [ { role: "system", content: systemPrompt }, { role: "user", content: userPrompt } ] });
  const content = _get(r, ["choices", 0, "message", "content"], "").replace(/```/g, "").trim();
  // Return only the overview text content; do not return or mutate the plan
  return { title: planDescription, description: content };
}

export async function createPlanDefaultValues(planId, plan, planDescription, cloudProvider = "aws") {
  const providerContext = getCloudProviderContext(cloudProvider);
  const systemPrompt = `You are a ${providerContext.label} Plan Default-Values assistant. Read the plan JSON and produce a MARKDOWN “Input Summary Form” listing every value the user must supply once, grouped by phase.

INPUT FORMAT
You will receive one object named **plan** with phases -> tasks. Use each task's completionCriteria (not execution_plan) to extract required inputs.

RULES FOR EXTRACTING INPUTS
1) A field is anything completionCriteria asks the user to enter/choose/select.
2) Ignore prompts that only confirm/verify previous choices.
3) If the same field appears in multiple tasks, list it once using the earliest default.
4) Suggest appropriate, industry-standard defaults for ${providerContext.label} when clear (e.g., secure logging defaults, reasonable cost budget thresholds, strong password policies). If no sensible default, use "" (not "none"/"not set").
5) If options are provided, include them in parentheses after the default.
6) Do not invent fields; extract exactly what is present.
7) Do not include ${providerContext.label} region or subscription/account identifiers in the default values list.

MARKDOWN OUTPUT FORMAT
• Use only H2 (##) and H3 (###) headers.
• For each phase:
    ## <Phase Title>
    
    ## <Group of Inputs Header (Optional)
    - <Input name> – default: <default> (options: <opt1>, <opt2>, …)
• If a phase has no inputs, omit it. If no inputs at all, return empty output.
• No code fences.

PROCESS
1) Think step-by-step silently; output only the final Markdown.
2) No prose/comments/code fencing.`;
  const userPrompt   = `Plan:\n${JSON.stringify(plan, null, 2)}`;
  const resp = await openai.chat.completions.create(
    { model: OPENAI_MODEL, 
    messages: [ 
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
      ], 
    reasoning_effort: "low" }
    );
  
    const inputSummary =  _get(resp, ["choices", 0, "message", "content"], "");
    const formattedForm    = await formatUserMessage(inputSummary);
    // Return only the formatted default values form; do not mutate or write the plan
    return formattedForm;
}

export async function formatUserMessage(userMessage) {
  const systemPrompt = `Your task is to format the provided input message in a way that will be used in a UI to present a form to a user. The form will have form fields (Input, Select, Checkbox, etc.) that take in user input. To insert a form field into the text, use the following format:
    
__input_field__ {"fieldType":<type>, "label": <label>, "default_value":<(optional) value>,"options":<(optional) options>,"allow_multiple_selection":<boolean value, used for input_select only>} __input_field_end__

Reformat the message into a form that is easy to follow, and insert fields whereever a user input or decision is required. Mark fields optional by adding (Optional) in the label.

Formatting Rules:
1) Use markdown for formatting the text and headers
2) Add the explanation text before the input field (For example, if the message requests providing an s3 bucket name, then the output should be:

Please provide the S3 bucket name:
__input_field__ <.. field details..> __input_field_end

  As you can see the form field is always after
3) The fieldLabel will be displayed above any form input rendered, so do not repeat the same text in a separate entry or line
4) Keep the formatting simple, avoid using lists, and use h2 or h3 headers to mark different sections when needed
5) When listing options within fields, do not repeat the options ahead of the field itself, just include the options within the fields. Example:

Input:
Here is the list of EC2 Instances and their IMDSv2 status. None of the instances currently have IMDSv2 enabled. Please select the insances for which you would like to enable IMDSv2:\n\n1. i-123456\n2. i-abcdedf\n3. i-789012\n\nPlease provide the numbers corresponding to the instances you want to enable IMDSv2.

Ideal Output:

Here is the list of EC2 Instances and their IMDSv2 status. None of the instances currently have IMDSv2 enabled. Please select the insances for which you would like to enable IMDSv2.
__input_field__ {"fieldType": "input_select", "label": "EC2 Instances", "default_value": "", "options": [{"label": "i-123456"}, {"label": "i-abcdedf"}, {"label": "i-789012"}], "allow_multiple_selection": true} __input_field_end__

6) Avoid commas in the field labels if possible

Available fieldTypes are:
 - input: this is when the user needs to provide a string or number type of value 
 - input_select: same as input but when there are a prepopulated set of values the user can select from  (use options to provide set of possible options with each option having a label property). If the user can select multiple values, set "allow_multiple_selection" to true (otherwise, it should be false)
 - checkbox: a value the user can set to true/false
 - radio_group: group of radio buttons that the user has to select only one from (use options to provide an array of options. each option should have label property 

use default_value when there is a default value to be select, otherwise keep it empty 
label is the label for the input field 

Important Guidelines: 
1) exclude sections that contain bash commands, json objects (e.g. surrounded by \`\`\`bash \`\`\` or \`\`\`json \`\`\`)
2) Keep any surrounding text around the input fields
3) __input_field__ and __input_field_end__ are keywords that shouldn't be modified
4) field definitions must be valid JSON
5) If there is a long list of options to select from, do not repeat the list outside of the field options 
6) Reformat the message when necessary to make it easier to understand.`;
  const userPrompt   = `Create an output based on the following with proper input fields inserted (if the message is informational and does not require input from the user, return it as is):\n\nMessage:\n${userMessage}`;
  const resp = await openai.chat.completions.create({ model: OPENAI_MODEL, messages: [ { role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], reasoning_effort: "high" });
  return _get(resp, ["choices", 0, "message", "content"], "");
}

export async function runBlueprintGenerationFlow({
  userId,
  recordId,
  planId,
  planTitle,
  planDescription,
  cloudProvider = "aws",
  skeletonSettings = null,
  sourceRecordId = null,
  existingPlan = [],
  clientPlanState = null,
  notes = ""
}) {
  if (!userId) throw new Error("runBlueprintGenerationFlow: userId is required");
  if (!recordId) throw new Error("runBlueprintGenerationFlow: recordId is required");
  if (!planId) throw new Error("runBlueprintGenerationFlow: planId is required");
  if (!planDescription) throw new Error("runBlueprintGenerationFlow: planDescription is required");

  try {
    const normalizedCloudProvider = normalizeBlueprintCloudProvider(
      cloudProvider || clientPlanState?.cloudProvider
    );
    const isPlaceholderTitle = (title) => {
      const t = typeof title === "string" ? title.trim() : "";
      if (!t) return true;
      if (t.toLowerCase() === "untitled") return true;
      if (planDescription && t === planDescription.trim()) return true;
      if (/^plan[_-][a-z0-9]+$/i.test(t)) return true;
      if (planId && t.replace(/\s+/g, "").toLowerCase() === planId.replace(/[-_]/g, "").toLowerCase()) return true;
      return false;
    };

    // Prefer user-provided title/description, but auto-generate when missing/placeholder
    let generatedTitle = planTitle;
    let generatedDescription = planDescription;
    const shouldAutoTitle = isPlaceholderTitle(planTitle);
    const shouldAutoDescription = !planDescription || shouldAutoTitle;

    const baseTitle = normalizeTitle(planTitle, planDescription);

    let seedPlan = Array.isArray(existingPlan) ? existingPlan : [];
    let seedSkeletonSettings = skeletonSettings || undefined;

    if (clientPlanState && Array.isArray(clientPlanState.plan)) {
      seedPlan = clientPlanState.plan;
    }

    if (sourceRecordId && !seedPlan.length) {
      const source = await loadBlueprintRecord({ userId, recordId: sourceRecordId }).catch(() => null);
      if (Array.isArray(source?.plan?.plan)) seedPlan = source.plan.plan;
      if (!generatedTitle && source?.plan?.title) generatedTitle = source.plan.title;
    }

    if (!seedSkeletonSettings) {
      seedSkeletonSettings = clientPlanState?.skeletonSettings || DEFAULT_SKELETON_SETTINGS;
    }

    const normalizedTitle = normalizeTitle(generatedTitle || baseTitle, generatedDescription);
    const initialDescriptionList = normalizeDescriptionList(generatedDescription);
    await updateBlueprintRecord({
      userId,
      recordId,
      patch: {
        title: normalizedTitle,
        cloudProvider: normalizedCloudProvider,
        plan: { title: normalizedTitle, cloudProvider: normalizedCloudProvider, plan: [] },
        description: initialDescriptionList,
        status: "in_progress_skeleton"
      }
    });

    const clientPlanArray = Array.isArray(clientPlanState?.plan) ? clientPlanState.plan : null;
    let skeleton = clientPlanArray && clientPlanArray.length
      ? clientPlanArray
      : await generateOrUpdateSkeleton({
          planId,
          planTitle: generatedTitle || baseTitle,
          planDescription,
          cloudProvider: normalizedCloudProvider,
          existingPlan: seedPlan,
          skeletonSettings: seedSkeletonSettings
        });
    if (!Array.isArray(skeleton)) {
      skeleton = Array.isArray(seedPlan) ? seedPlan : [];
    }
    skeleton = applyCloudProviderToPlan(skeleton, normalizedCloudProvider);

    if (shouldAutoTitle || shouldAutoDescription) {
      const planMeta = await generatePlanTitleAndDescriptionFromPlan(skeleton, planDescription, normalizedCloudProvider);
      if (shouldAutoTitle) generatedTitle = planMeta.title;
      if (shouldAutoDescription) generatedDescription = planMeta.description;
    }

    const skeletonDescriptionList = normalizeDescriptionList(generatedDescription);
    await updateBlueprintRecord({
      userId,
      recordId,
      patch: {
        title: normalizeTitle(generatedTitle || baseTitle, generatedDescription),
        cloudProvider: normalizedCloudProvider,
        plan: {
          title: normalizeTitle(generatedTitle || baseTitle, generatedDescription),
          cloudProvider: normalizedCloudProvider,
          plan: skeleton
        },
        description: skeletonDescriptionList,
        status: "in_progress_skeleton"
      }
    });

    let planWithTasks = Array.isArray(skeleton) ? skeleton : [];
    const allTaskPointers = [];
    if (Array.isArray(skeleton)) {
      skeleton.forEach((phase, phaseIndex) => {
        if (!Array.isArray(phase?.tasks)) return;
        phase.tasks.forEach((_, taskIndex) => {
          allTaskPointers.push({ phaseIndex, taskIndex });
        });
      });
    }
    if (allTaskPointers.length) {
      const { plan: batchPlan } = await updateTasksBatch({
        plan: skeleton,
        tasks: allTaskPointers,
        notes,
        skeletonSettings: seedSkeletonSettings,
        cloudProvider: normalizedCloudProvider
      });
      if (Array.isArray(batchPlan)) {
        planWithTasks = applyCloudProviderToPlan(batchPlan, normalizedCloudProvider);
      }
    }

    await updateBlueprintRecord({
      userId,
      recordId,
      patch: {
        cloudProvider: normalizedCloudProvider,
        plan: {
          title: normalizeTitle(generatedTitle || baseTitle, generatedDescription),
          cloudProvider: normalizedCloudProvider,
          plan: planWithTasks
        },
        status: "in_progress_tasks"
      }
    });

    await updateBlueprintRecord({
      userId,
      recordId,
      patch: { status: "in_progress_settings" }
    });

    const { overview, defaultValues, policy } = await updatePlanSettings({
      planId,
      planObj: { plan: planWithTasks },
      planDescription: generatedDescription || planDescription,
      cloudProvider: normalizedCloudProvider
    });

    const finalTitle = normalizeTitle(generatedTitle || overview?.title || baseTitle, generatedDescription);
    const finalDescriptionText = generatedDescription || overview?.description || planDescription;
    const finalPlan = {
      title: finalTitle,
      cloudProvider: normalizedCloudProvider,
      plan: Array.isArray(planWithTasks) ? planWithTasks : []
    };
    const finalDescriptionList = normalizeDescriptionList(finalDescriptionText);

    await updateBlueprintRecord({
      userId,
      recordId,
      patch: {
        title: finalTitle,
        cloudProvider: normalizedCloudProvider,
        plan: finalPlan,
        planSettings: {
          ...(defaultValues ? { defaultValues } : {}),
          ...(overview ? { planOverview: overview } : {}),
          ...(seedSkeletonSettings ? { skeletonSettings: seedSkeletonSettings } : {}),
          options: {},
        },
        requiredPermissions: policy || undefined,
        description: finalDescriptionList,
        status: "ready"
      }
    });

    const planState = {
      planId,
      planTitle: finalTitle,
      planDescription: finalDescriptionText,
      cloudProvider: normalizedCloudProvider,
      plan: finalPlan.plan,
      planOverview: overview || null,
      planDefaultValues: defaultValues || null,
      requiredPermissions: policy || null,
      skeletonSettings: seedSkeletonSettings
    };

    return { recordId, planState, overview, defaultValues, policy };
  } catch (error) {
    await updateBlueprintRecord({
      userId,
      recordId,
      patch: {
        status: "error",
        errorMessage: error?.message || String(error)
      }
    }).catch(() => {});
    throw error;
  }
}

export async function updateSkipConditions(plan,) {
  const systemPrompt = `Your job is to review the plan provided which is for an AI agent to follow in a cloud environment, and make sure to keep original conditions in (We just want to add to them if applicable) 
    
To do this: 
 1. Review all tasks in the plan
 2. Identify tasks that are relevant to the fields in the form
 3. Update the skip_conditions field in those tasks that preserves the original conditions and updates it with how the task would be skipped based on the form values. The form will be known to the agent as "User Preferences" so use that wording in your updates (e.g. "Skip if the user indicated in their User Preferences to not list IAM roles")
 
For tasks that don't need any updates, don't include them in the output

Format should be a JSON object as follows: 
{
  "updates: {
    "task_id": "<updated skip_conditions field>"
  }
}`;
  const userPrompt   = `# Plan:\n ${JSON.stringify(plan, null, 4)}    `;
  const resp = await openai.chat.completions.create({ model: OPENAI_MODEL, messages: [ { role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], reasoning_effort: "high" });
  return _get(resp, ["choices", 0, "message", "content"], "").replace(/```json?|```/g, "").trim();
}


/**
 * generateSkeleton
 * - fetches or regenerates a plan skeleton via the model
 * - returns an array of { title, tasks: [ {id,title,notes} ] }
 */
export async function generateSkeleton(planId, planDescription, skeletonSettings={
    phases: {
      assessment: true,
      summary: false,
      configuration: true,
      validation: true,
    },
    notes: "",
    deploymentMethod: "cli",
    cloudFormationStackExists: null
  }, cloudProvider = "aws") {
  let notes = ""
  try {
    notes = fs.readFileSync(`plan_drafts/${planId}.txt`, "utf-8");
  }catch (e){}
  
  const dmText = skeletonSettings?.deploymentMethod || 'cli';
  const cfnExists = skeletonSettings?.cloudFormationStackExists;
  const providerContext = getCloudProviderContext(cloudProvider);
  
  const sys = `
You are a ${providerContext.label} planning assistant that creates a plan for carrying out the task provided by the user. The plan will be executed by an AI agent that has access to a ${providerContext.environment} acting on behalf of the user requesting this plan.


# Plan Guidelines:
1. Create a plan that is as minimal as possible and includes only the tasks that are directly related to the overall goal (E.g. don't include tasks about enabling logging if the user only asked to enable backups even if the logging is related to the backups)
2. Limit the plan to ${providerContext.label} infrastructure items only.
3. Tasks outside of the ${providerContext.label} environment (e.g. communicate with application owners, or validate application functionality) should be marked clearly for the user to do. Example "User: Communicate with Application Owners"
5. Do *NOT* include tasks for validating permissions, checking CLI profiles, subscriptions/accounts, tenants, or configured regions (This information will be provided at run-time)
6. The AI Agent will be provided ${providerContext.label} credentials, target scope and other information at run-time, so do NOT include any tasks that repeat this information.
7. The plan should not reference the deployment method (${providerContext.cliName}, CloudFormation, Bicep, Terraform, etc.) in the task titles or descriptions, but rather the task should be about the desired outcome and the agent will determine the best way to achieve it.
8. Each task must include a short, action-oriented title (aim for 6-10 words) and a 1-sentence description of what the task accomplishes.
9. Include "cloudProvider": "${providerContext.provider}" on every task.
${providerContext.provider === "azure" ? "10. Do not create AWS-specific tasks, CloudFormation tasks, IAM policy tasks, EC2/S3/VPC terminology, or AWS region/profile setup for Azure plans." : ""}

## Example Plan Phases and Tasks
Goal: ${providerContext.provider === "azure" ? "Configure Diagnostic Settings for Azure Virtual Machines (Deployment Method: Azure CLI)" : "Configure Logging for CloudFront Distributions (Deployment Method: AWS CLI)"}

Plan:
Assessment Phase:
${providerContext.provider === "azure" ? `  - List virtual machines and diagnostic settings status
  - User: Select virtual machines to update
  - List available Log Analytics workspaces
  - User: Choose a Log Analytics workspace
  - Fetch current diagnostic settings` : `  - List CloudFront Distributions and their logging status
  - User: Select CloudFront Distributions to Update
  - List available S3 Buckets 
  - User: Choose to create a new S3 Bucket or select an existing one
  - Fetch Distribution Config & ETag`}

Summmary Phase:
  - User: Review the plan and approve the changes

Configuration Phase:
${providerContext.provider === "azure" ? `  - Create Log Analytics workspace (if required)
  - Configure diagnostic settings for selected virtual machines
  - Enable selected log and metric categories` : `  - Create S3 Bucket (if required)
  - Update S3 Bucket Policy to allow CloudFront to write logs to the bucket
  - Update CloudFront Distribution to use the selected S3 Bucket for logging`}

Validation Phase:
${providerContext.provider === "azure" ? "  - Validate diagnostic settings are enabled" : "  - Validate CloudFront Distributions logging status is enabled"}

## Phase Structure
${skeletonSettings.phases.assessment || skeletonSettings.phases.summary || skeletonSettings.phases.configuration || skeletonSettings.phases.validation ? `### Include the following phases` : ''}
${skeletonSettings.phases.assessment ? '**Assessment** – discover existing resources, gather user inputs.' : '' }  
${skeletonSettings.phases.summary ? '**Summary** – single task: echo intended changes & ask for approval.  ' : ''}
${skeletonSettings.phases.configuration ? '**Configuration** – create supporting resources then apply config.  ' : ''}
${skeletonSettings.phases.validation ? '**Validation** – confirm configuration works.' : ''}


# Web Search Policy (OPTIONAL)
- Tools available: \`web_search\`.
- Use web_search when needed to refresh your knowledge and validate the best course of action.
- Prefer **${providerContext.docsSource}** and other reputable sources.
- Use additional searches as needed for specific service features, limits, or recommended practices.
- **Do not** include citations or URLs in the final JSON—use search to inform task selection and TODOs.
- Rank sources by credibility. Prioritize:
  1) ${providerContext.docsSource}, 2) official provider blogs / announcements, 3) official provider GitHub repos,
     then 4) Reputable third-parties (e.g., HashiCorp, CNCF).
- Avoid forum opinions unless corroborated by official docs.

# JSON schema 
{
  "plan": [
    {
      "title": string,          // phase label
      "tasks": [
        {
          "id": kebab_case,     // e.g., list_s3_buckets
          "title": string,      // short, action-oriented
          "description": string // 1 sentence
        }
      ]
    }
  ]
}

# Output rules
- Think step-by-step **silently**; output **only** the final JSON.
- If JSON is invalid, correct it and output again.
- **No prose**, **no markdown**, only the JSON object with a top-level "plan" key.
          `
    const user = `# Goal\n${planDescription}${notes ? `\n\n# Notes\n${notes}` : '' }`;
    // console.log('sending user prompt',user)
    const resp = await callModel({
      messages: [
        { role: "system", content: sys },
        { role: "user",   content: user }
      ],
      tools: WEB_SEARCH_TOOLS,
      json: false,
      reasoningEffort: "medium"
      
    });
  const plan = safeJSON(getText(resp), { plan: [] }).plan;

  return plan;
}

/**
 * generateExecutionPlanForTask
 * - given a single task and a summary of the plan
 * - returns an array of executionPlan steps
 */
export async function generateExecutionPlanForTask(task, planSummary, notes = '', cloudProvider = "aws") {
  const providerContext = getCloudProviderContext(cloudProvider);
  const execSystem = `# ROLE
You are writing an **executionPlan** for a single task that will be executed by an automated agent inside a ${providerContext.label}-capable shell.

# CRITICAL CONTEXT
• **Credentials & Region**: Already known at runtime. **Never** ask for, validate, or request them.
• **Plan Awareness**: This task is one step within a larger plan. Use prior outputs and avoid re-asking for inputs previously collected. Do not perform actions scheduled for later tasks.
• **User Input Comes From UI Forms**: If user input is required, state exactly **what to ask** and a **recommended default**. **Do not** write interactive CLI commands (no \`read\`, no prompts in bash). The agent will render a form.

# CLI RULES
• Allowed commands: **\`${providerContext.cliCommand}\`**, **\`jq\`**, and common bash built-ins only.
• Prefer filtered, human-readable output via \`--query\`, \`jq\`, or simple loops.

# PLANNING CHECKLIST (follow mentally, do not output)
1) Does any step re-ask for info already gathered earlier in the plan? If yes, **reuse** prior selections from terminal history instead.
2) Does any step do something slated for later tasks? If yes, **skip** and reference that later task.
3) Will a later task need values you obtain here (IDs, ARNs, names)? **Print** a concise, copyable summary to terminal.
4) No region/profile prompts. No interactive shell input. Keep each step to **one sentence**.

# WEB SEARCH (OPTIONAL)
Tool: \`web_search\`. Use sparingly for provider specifics. Prefer **${providerContext.docsSource}**. Do not include citations or links in the final output.


# Examples
${providerContext.provider === "azure" ? "The examples below are format examples only. For Azure output, use Azure CLI commands and Azure resources, not AWS services or AWS CLI commands." : ""}

## Example 1 (Configuration Updates)
{
  
  "title": "Create Encrypted Snapshot",
  "description": "Copies an EBS snapshot with encryption enabled using the AWS CLI.",
  "executionPlan": [
    "1. Use the data from the previous tasks' outputs as required inputs to this step: the source region, the source snapshot ID , and the desired KMS key ID for encryption.",
    "2. Execute the aws ec2 copy-snapshot CLI command with encryption enabled. Example command:",
    "   aws ec2 copy-snapshot --source-region SOURCE_REGION --source-snapshot-id SOURCE_SNAPSHOT_ID --encrypted --kms-key-id KMS_KEY_ID",
    "3. Capture the output of the command (which returns JSON with a SnapshotId) and use jq to extract the SnapshotId, e.g., piping the output through 'jq -r \".SnapshotId\"'.",
    "4. Summarize the task output by indicating whether the snapshot was successfully copied from the specified source region, and encryption was applied using the provided KMS key, resulting in a new encrypted snapshot. Include the snapshot Id in the summary."
  ]
}
    
    
## Example 2 (Collecting Information from User)
{
 "title": "Capture Config Selections",
  "description": "Collect configuration selections by prompting the user to choose VPC/subnet IDs, log destination type (CloudWatch Logs, S3, or Kinesis Data Firehose), traffic type (accepted, rejected, or all), and whether to create new or use existing resources. This task leverages outputs from previous steps for an informed selection process.",
  "executionPlan": [
      "1. List the VPC(s) or Subnet(s) that the user selected previously to which the following settings will apply.",
      "2. Prompt user to select the Log Destination Type:",
      "   - Present the following options: [ 'CloudWatch Logs', 'S3', 'Kinesis Data Firehose' ].",
      "   - Recommended default: CloudWatch Logs.",
      "   - Example prompt: 'Select a log destination type. Options: CloudWatch Logs, S3, Kinesis Data Firehose.'",
      "3. Prompt user to specify the Traffic Type for VPC Flow Logs:",
      "   - Provide the following options: [ 'accepted', 'rejected', 'all' ].",
      "   - Recommended default: all.",
      "   - Include a brief explanation to help decision making (e.g., 'accepted' logs only allowed traffic, 'rejected' logs denied traffic, and 'all' logs both).",
      "   - Example prompt: 'Select the traffic type for flow logs: accepted, rejected, or all.'",
      "4. Prompt user for Resource Creation Preferences:",
      "   - For each resource (IAM roles, CloudWatch log groups, and Kinesis streams), ask if the user wants to create new resources or use existing ones based on identified resources in previous steps (if there are no resources, then only prompt them about creating new resources.",
      "   - Example prompts:",
      "       - 'Do you want to create a new IAM role or use an existing one for VPC Flow Logs? Options: [Create new, Use existing].' Recommended default: create a new IAM role",
      "       - 'Do you want to create a new CloudWatch Log Group or use an existing one? Options: [Create new, Use existing].' Recommended default: create a new CloudWatch Log Group",
      "       - 'If using Kinesis Data Firehose, do you want to use an existing stream or create a new one? Options: [Create new, Use existing].'",
      "For creating new resources, capture the names of the resources while providing a default name ",
      "6. Summarize the captured configuration selections:",
      "   - Display a summary of all selections collected: VPC/Subnet IDs, log destination type, traffic type, and resource creation preferences."
      
    ]
}

# OUTPUT FORMAT (STRICT)
Return **only** a JSON object:
{
  "executionPlan": [
    "1. …",
    "2. …",
    "2a. …",
    "3. …",
    "N. Summary & Handoff: …"
  ]
}

• \`executionPlan\` is a JSON array of **numbered strings** (use plain numbering and optional lettered substeps).
• **Exactly one sentence per step**.
• End with a **“Summary & Handoff”** step that prints all values needed by future tasks (IDs/ARNs/names), in a small, readable table or key:value list`;  

    const execUser   = `## FullPlan Summary
${planSummary}

## Current Task
${JSON.stringify(task, null, 2)}

${notes && notes.length > 0 ? `## Update the task execution plan according to the followings notes:\n${notes}` : '' }

Return JSON: { "executionPlan": [...] }`;

    const resp = await callModel({
      messages: [
        { role: "system", content: execSystem },
        { role: "user",   content: execUser   }
      ],
      tools: WEB_SEARCH_TOOLS,
      json: false,
      reasoningEffort: "medium"
    });
  const planOut = safeJSON(getText(resp), {}).executionPlan || [];
  return planOut;
}

/**
 * generateTaskSettings
 * - given a task and planSummary, returns:
 *    { title?, description?, depends_on?, skip_conditions?, completionCriteria[] }
 */
export async function generateTaskSettings(task, planSummary, notes='', cloudProvider = "aws") {
  const providerContext = getCloudProviderContext(cloudProvider);
  const sys = `# Overview: Update Task Fields
Your goal is to update the provided task by refining the following fields (This is a plan that will be executed by an AI agent at the behest of a user):
- title (short, action-oriented, 6-10 words)
- description (1-2 sentences explaining what the task accomplishes)
- "depends_on" (a list of all previous tasks where their output might be required for this current task)
- "skip_conditions" (string) explain when this task can be skipped based on the output of previous tasks. If there are no previous tasks, then this can be empty
- "completionCriteria" (array of string(s) listing ALL steps and information that must be gathered/completed for this task)

# Guidelines for completionCriteria
The completionCriteria should be comprehensive and include ALL items that need to be completed or collected for this task. Think of it as a checklist of everything that must happen. For example:

If the task is about configuring an S3 bucket, completionCriteria might include:
- "User provided bucket name"
- "User selected AWS region for the bucket"
- "User specified versioning configuration (enabled/disabled)"
- "User specified encryption settings (SSE-S3, SSE-KMS, or none)"
- "User specified public access block settings"
- "User specified lifecycle rules if applicable"

If the task is about collecting EC2 information:
- "Listed all EC2 instances in the target region"
- "Retrieved instance IDs, types, and current state"
- "Identified instances based on selection criteria"
- "User confirmed which instances to include"

Provider context:
- Cloud provider: ${providerContext.label}
- Resource examples: ${providerContext.resourceExamples}
- For Azure tasks, use Azure terms such as subscriptions, tenants, resource groups, virtual machines, network security groups, storage accounts, Log Analytics workspaces, and diagnostic settings.

Each criterion should be specific and actionable. Include:
1. All user inputs/selections that need to be gathered
2. All AWS resources that need to be discovered or listed
3. All configuration options that need to be specified
4. All validations or confirmations needed

# Guidelines for description
- Provide a concise description (1-2 sentences) explaining what this task accomplishes
- Mention what the user will be doing or deciding in this task if applicable
- Use language addressed to someone reading the plan (e.g., "In this task, you will..." or "This task identifies...")

# Guidelines for depends_on
- Review all previous tasks and include each task id whose output can be relevant in the current task
- If multiple previous tasks provide similar output, include all instead of just one in the depends_on field

# Other guidelines:
- The update should be for the current task only, but take into account the full plan summary.
- Do not output commentary—return only the updated task JSON.

# WEB SEARCH POLICY
• Tools available: \`web_search\`.
• Call \`web_search\` before finalizing to verify ${providerContext.label} terminology, feature names, defaults, and safety caveats.
• Prefer **${providerContext.docsSource}**; reputable third parties only when needed.
• Do **not** include links/citations in the final JSON.

`;
  const user   = `# Plan Summary
${planSummary}

# Current Task
${JSON.stringify(task, null, 2)}

${notes && notes.length > 0 ? `## Update in accordance with the following notes:\n${notes}` : '' }

Return updated task JSON with title, description, depends_on, skip_conditions, and completionCriteria fields.`;
  
  const resp   = await callModel({
    messages: [
      { role: "system", content: sys },
      { role: "user",   content: user   }
    ],
    tools: WEB_SEARCH_TOOLS,
    json: false
  });
  const upd = safeJSON(getText(resp), {});
  // Remove userExplanation and executionPlan if they were generated
  delete upd.userExplanation;
  delete upd.executionPlan;
  return upd;
}

/* ------------------------------------------------------------------ */
/* generatePermissions(planObj [, planId ])                           */
/* ------------------------------------------------------------------ */
/* • Reads every executionPlan step, calls model + tools, and returns
   a write-only IAM policy JSON.                                      */
/* • Also drops the doc into planObj.requiredPermissions and persists
   it to disk if planId is supplied.                                  */
export async function generatePermissions(planObj, planId = null) {
  log("INFO", "Generating IAM permissions");

  const permSystem = `
# TASK
Create a thorough list of **non-read IAM actions** required to execute the
entire plan.  Assume the operator already has full ReadOnlyAccess.

# REQUIREMENTS
• Review every task's title, description, and completionCriteria to infer all the required write actions
  (e.g. \`ec2:ModifyInstanceAttribute\`, \`iam:CreateRole\`).  
• Use \`aws_knoweldge_base\` to confirm any additional permissions (service-
  linked roles, KMS, etc.).  
• Remove any purely read/list/describe actions; include only create, update,
 delete, copy, tag, put, etc.  
• Group actions by AWS service: each service gets its own **Statement**
 with a unique \`Sid\`.  
• Use \`"Resource": "*"\` for every statement (the UI will scope-down later).  
• Sort \`Action\` arrays **alphabetically** inside each statement.  
• Return **only** the policy JSON—no commentary, no markdown.
• If there are no write permissions required for the plan, then return a policy with an empty statement array

# WEB SEARCH POLICY
• Tools available: \`web_search\`.
• You **must** call \`web_search\` to verify actions for service-linked roles, KMS, and any implicit dependencies.
• Prefer **docs.aws.amazon.com** and AWS reference pages; use reputable third parties only if necessary.
• Do not include citations.

 # OUTPUT SHAPE
 {
   "Version": "2012-10-17",
   "Statement": [
     {
       "Sid": "LambdaWrite",
       "Effect": "Allow",
       "Action": [
         "lambda:CreateFunction",
         "lambda:UpdateFunctionCode"
       ],
       "Resource": "*"
     },
     {
       "Sid": "DynamoDBWrite",
       "Effect": "Allow",
       "Action": [
         "dynamodb:RestoreTableFromBackup",
         "dynamodb:TagResource"
       ],
       "Resource": "*"
     }
   ]
 }

`;
  const permUser   = `Here is the final plan JSON:\n${JSON.stringify(
                       planObj.plan, null, 2)}`;

  const permResp   = await callModel({
    messages: [
      { role: "system", content: permSystem },
      { role: "user",   content: permUser   }
    ],
    tools: WEB_SEARCH_TOOLS,
    json: false
  });

  const policyDoc  = safeJSON(getText(permResp),
                     { Version: "2012-10-17", Statement: [] });
  // Return only the policy document; do not mutate or write the plan
  return policyDoc;
}


// ———————————————— Main Orchestration ————————————————

export async function main({
  planId,
  planDescription,
  newSkeleton = true,
  newPlan = true,
  getDefaultValues = true,
  getPermissions = true
}) {
  // 1️⃣ Skeleton
  let plan;
  if (newSkeleton) {
    plan = await generateSkeleton(planId, planDescription);
    // interactive approve loop
    while (true) {
      log("[SKELETON]", "draft:", plan);
      const ans = await getUserInput("Approve skeleton? (y/n): ");
      if (ans.toLowerCase().startsWith("y")) break;
      const notes = await getUserInput("Notes for skeleton update: ");
      // regenerate with notes
      const updUser = `Below is skeleton:\n${JSON.stringify(plan, null,2)}\n\nNotes:\n${notes}`;
      const resp = await callModel({ messages: [{ role:"user", content: updUser }] });
      plan = safeJSON(getText(resp), { plan }).plan;
    }
    writeJSONToFile(`plan_skeletons/${planId}.json`, plan);
  } else {
    plan = readJSONFromFile(`plan_skeletons/${planId}.json`) || [];
  }

  // 2️⃣ Expand tasks
  let planFinal = plan.map(phase => ({
    ...phase,
    tasks: phase.tasks.map(t => ({ ...t }))
  }));

  if (newPlan) {
    // produce planSummary string once
    const planSummary = planFinal
      .map(p => `# Phase ${p.title}:\n${p.tasks.map(t=>`## Task (${t.id}): ${t.title}`).join("\n")}`)
      .join("\n\n");

    for (const phase of planFinal) {
      for (const task of phase.tasks) {
        // Generate task settings (title, description, depends_on, skip_conditions, completionCriteria)
        const settings = await generateTaskSettings(task, planSummary);
        Object.assign(task, settings);

        // interactive approval
        while (true) {
          log("[SETTINGS]", task.id, settings);
          const ok = await getUserInput("Approve task settings? (y/n): ");
          if (ok.toLowerCase().startsWith("y")) break;
          const notes = await getUserInput("Notes to update settings: ");
          const upd = await generateTaskSettings({ ...task, ...settings }, planSummary, notes);
          Object.assign(task, upd);
        }

        writeJSONToFile(`plans_final/${planId}.json`, planFinal);
      }
    }
  }

  // 3️⃣ Overview, skip conditions, defaults, permissions
  const overview = await createPlanOverview(planFinal, planDescription);
  const skipUpd  = safeJSON(await updateSkipConditions(overview), { updates: {} }).updates;
  for (const phase of overview.plan) {
    for (const t of phase.tasks) {
      if (skipUpd[t.id]) t.skip_conditions = skipUpd[t.id];
    }
  }
  writeJSONToFile(`plans_final/${planId}.json`, overview);

  if (getDefaultValues) {
    await createPlanDefaultValues(planId, overview, planDescription);
  }
  if (getPermissions) {
    await generatePermissions(overview, planId);
  }

  log("[DONE]", "Blueprint build complete");
}


/**
 * Unified API: generateOrUpdateSkeleton
 * - Generates a new skeleton or updates an existing one (via notes + existingPlan context)
 * - Inputs:
 *    { planId, planDescription, existingPlan?, skeletonSettings? { phases, notes } }
 * - Returns: Skeleton array of phases with tasks
 */
export async function generateOrUpdateSkeleton({
  planId,
  planTitle,
  planDescription,
  cloudProvider = "aws",
  existingPlan = [],
  skeletonSettings = {
    phases: { assessment: true, summary: false, configuration: true, validation: true },
    notes: ""
  }
}) {
  const hasExisting = Array.isArray(existingPlan) && existingPlan.length > 0;
  const notes = skeletonSettings?.notes || "";
  if (hasExisting && !notes.trim()) {
    return applyCloudProviderToPlan(existingPlan, cloudProvider);
  }
  const combinedDescription = hasExisting
    ? `Update the following plan skeleton based on the user's notes.\n\nExisting Skeleton:\n${JSON.stringify(existingPlan, null, 2)}\n\nOriginal Plan Title:\n${planTitle}\n\nOriginal Plan Description:\n${planDescription}\n\nUser Notes:\n${notes}`
    : planDescription;

  const skeleton = await generateSkeleton(planId, combinedDescription, skeletonSettings, cloudProvider);
  if (!Array.isArray(skeleton) || (skeleton.length === 0 && hasExisting)) {
    return existingPlan;
  }
  return applyCloudProviderToPlan(skeleton, cloudProvider);
}

/**
 * Unified API: updateTasksBatch
 * - Updates task settings for one or more tasks in a single model call.
 * - If a subset of tasks is provided, also review and adjust all subsequent tasks if needed.
 * - Inputs: { plan, tasks: [{ phaseIndex, taskIndex, notes? }], notes? }
 * - Returns: { plan }
 */
export async function updateTasksBatch({ plan, tasks = [], notes = "", skeletonSettings = null, cloudProvider = "aws" }) {
  const providerContext = getCloudProviderContext(cloudProvider);
  const summary = Array.isArray(plan)
    ? plan.map(p => `# Phase ${p.title}:\n${(p.tasks||[]).map(t => `## Task (${t.id}): ${t.title}`).join("\n")}`).join("\n\n")
    : "";

  const dmText = skeletonSettings?.deploymentMethod || 'cli';
  const cfnExists = skeletonSettings?.cloudFormationStackExists;

  const sys = `You are a ${providerContext.label} plan editor. Update the provided plan tasks in one pass.

RULES
1) For each selected task, update all task fields:
   - title (short, action-oriented, 6-10 words; DO NOT change if already set)
   - description (1 sentence; keep if already set; add only if missing)
   - completionCriteria (comprehensive array listing ALL steps and information that must be gathered/completed)

2) The completionCriteria should be comprehensive and include ALL items that need to be completed or collected for the task. For example:
   - Use ${providerContext.label} resource terminology and configuration options.
   - AWS examples: S3 bucket name, region, versioning, encryption settings, public access settings, lifecycle rules; EC2 instance IDs, types, states, selection criteria, user confirmation.
   - Azure examples: resource group, subscription, virtual machine IDs/names, diagnostic setting names, Log Analytics workspaces, network security groups, backup vaults, policy assignments.
   Each criterion should be specific and actionable.

But do not include items that are not relevant to the overall goal of the plan.

3) Validate configuration options using web_search to make sure the latest configuration options are used. Do not include links in the output.
4) The deployment method (${providerContext.cliName}, CloudFormation, Bicep, Terraform, etc.) should not be referenced in the task titles or descriptions, but rather the task should be about the desired outcome and the agent will determine the best way to achieve it.
5) Include "cloudProvider": "${providerContext.provider}" on every task.

OUTPUT
• Return only JSON with the full updated plan array in the same shape as input: { "plan": [ { title, tasks: [...] } ] }`;

  const userMsg = `# Current Plan\n${JSON.stringify(plan, null, 2)}\n\n# Tasks To Update\n${JSON.stringify(tasks, null, 2)}\n\n# Plan Summary\n${summary}\n\n# Notes (optional)\n${notes || ""}\n\nReturn only JSON { "plan": [...] }.`;

  const resp = await callModel({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: userMsg }
    ],
    tools: WEB_SEARCH_TOOLS,
    json: false
  });

  const updated = safeJSON(getText(resp), { plan });
  const nextPlan = applyCloudProviderToPlan(Array.isArray(updated?.plan) ? updated.plan : plan, cloudProvider);
  const hasSameShape =
    Array.isArray(plan) &&
    Array.isArray(nextPlan) &&
    plan.length === nextPlan.length &&
    plan.every((phase, idx) => Array.isArray(phase?.tasks) && Array.isArray(nextPlan[idx]?.tasks) && phase.tasks.length === nextPlan[idx].tasks.length);

  if (!hasSameShape) return { plan: nextPlan };

  const merged = nextPlan.map((phase, pIdx) => {
    const originalPhase = plan[pIdx];
    const tasksMerged = phase.tasks.map((task, tIdx) => {
      const originalTask = originalPhase.tasks[tIdx] || {};
      const keepTitle =
        typeof originalTask.title === "string" && originalTask.title.trim().length > 0;
      const keepDescription =
        typeof originalTask.description === "string" && originalTask.description.trim().length > 0;
      const keepExecutionPlan =
        Array.isArray(originalTask.executionPlan) && originalTask.executionPlan.length > 0;
      const keepCompletionCriteria =
        Array.isArray(originalTask.completionCriteria) && originalTask.completionCriteria.length > 0;
      const keepUserExplanation =
        Array.isArray(originalTask.userExplanation) && originalTask.userExplanation.length > 0;
      const keepSkipConditions =
        typeof originalTask.skip_conditions === "string" && originalTask.skip_conditions.trim().length > 0;
      const keepMaxTurns =
        Number.isFinite(Number.parseInt(String(originalTask.maxTurns ?? ""), 10));
      return {
        ...task,
        ...(keepTitle ? { title: originalTask.title } : {}),
        ...(keepDescription ? { description: originalTask.description } : {}),
        ...(keepExecutionPlan ? { executionPlan: originalTask.executionPlan } : {}),
        ...(keepCompletionCriteria ? { completionCriteria: originalTask.completionCriteria } : {}),
        ...(keepUserExplanation ? { userExplanation: originalTask.userExplanation } : {}),
        ...(keepSkipConditions ? { skip_conditions: originalTask.skip_conditions } : {}),
        ...(keepMaxTurns ? { maxTurns: originalTask.maxTurns } : {})
      };
    });
    return { ...phase, tasks: tasksMerged };
  });

  return { plan: merged };
}

/**
 * updateTasksSerial
 * - Sequentially generates settings for every task in order
 * - Inputs: { plan, notes? }
 * - Returns: { plan } with updated tasks
 */
export async function updateTasksSerial({ plan, notes = "", cloudProvider = "aws" }) {
  const phases = applyCloudProviderToPlan(Array.isArray(plan) ? plan.map(p => ({
    ...p,
    tasks: Array.isArray(p?.tasks) ? p.tasks.map(t => ({ ...t })) : []
  })) : [], cloudProvider);

  // Build a single plan summary for better context
  const planSummary = phases
    .map(p => `# Phase ${p.title}:\n${(p.tasks||[]).map(t => `## Task (${t.id}): ${t.title}`).join("\n")}`)
    .join("\n\n");

  for (const phase of phases) {
    for (const task of phase.tasks) {
      const preservedTitle = typeof task.title === "string" && task.title.trim().length ? task.title : null;
      const preservedDescription = typeof task.description === "string" && task.description.trim().length ? task.description : null;
      // Generate/update task settings (title, description, depends_on, skip_conditions, completionCriteria)
      const settings = await generateTaskSettings(task, planSummary, notes, cloudProvider);
      Object.assign(task, settings);
      if (preservedTitle) task.title = preservedTitle;
      if (preservedDescription) task.description = preservedDescription;
      task.cloudProvider = task.cloudProvider || normalizeBlueprintCloudProvider(cloudProvider);
    }
  }

  return { plan: phases };
}

/**
 * Unified API: updatePlanSettings
 * - Combines overview generation, default values form, and permissions policy into one step.
 * - Inputs: { planId?, planObj: { plan }, planDescription }
 * - Returns: { planObj } with description/overview, planSettings.defaultValues, and requiredPermissions.policy populated
 */
export async function updatePlanSettings({ planId = null, planObj, planDescription, cloudProvider = "aws" }) {
  const normalizedCloudProvider = normalizeBlueprintCloudProvider(
    cloudProvider || planObj?.cloudProvider || planObj?.plan?.[0]?.tasks?.[0]?.cloudProvider
  );
  const providerPlanObj = {
    ...planObj,
    cloudProvider: normalizedCloudProvider,
    plan: applyCloudProviderToPlan(planObj?.plan, normalizedCloudProvider)
  };
  // 1) Overview text for the current plan
  const overview = await createPlanOverview(providerPlanObj.plan, planDescription, normalizedCloudProvider); // { title, description }

  // 2) Default Values form for the current plan
  const defaultValues = await createPlanDefaultValues(planId || null, providerPlanObj, planDescription, normalizedCloudProvider);

  // 3) Required write permissions policy for the current plan
  // const policy = await generatePermissions(planObj, planId || null);

  // Return only outputs; do not mutate or write the plan
  return { overview, defaultValues, policy: null };
}

export const runSkillGenerationFlow = runBlueprintGenerationFlow;
export const normalizeSkillCloudProvider = normalizeBlueprintCloudProvider;
