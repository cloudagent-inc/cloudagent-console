import { Agent, run, user, extractAllTextOutput } from "@openai/agents";
import { OpenAIResponsesModel, setDefaultOpenAIKey } from "@openai/agents-openai";
import OpenAI from "openai/index.mjs";
import globals from "@cloudagent/core/global-variables";

const OPENAI_MODEL = process.env.DIAGRAM_SPEC_MODEL || process.env.OPENAI_MODEL || globals.OPENAI_MODEL;
const OPENAI_TOKEN = process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY;

let cachedModel = null;
let cachedAgent = null;

function systemPrompt() {
  return [
    "You generate an editable cloud diagram spec as strict JSON (no markdown).",
    "Return ONLY a single JSON object that conforms to this shape:",
    "{ version:'1.0', layout:{mode:'manual'|'auto', direction?:'vertical'|'horizontal'}, nodes:[...], edges:[...] }",
    "",
    "Node fields:",
    "- id (string, unique)",
    "- kind (string) for AWS *resources* prefer the unique AWS icon catalog id (e.g. Res_Amazon-DynamoDB_Table_48 or Arch_Amazon-EC2_48).",
    "- For Azure resources prefer the Azure icon catalog id (format: Azure_<category>_<service>, e.g. Azure_compute_virtual-machines or Azure_storage_storage-accounts).",
    "- For GCP resources prefer the GCP icon catalog id (format: GCP_<service> for unique icons, or GCP_category_<category> for category containers).",
    "- Use full Azure service names in labels (e.g. 'Virtual Machine', 'Azure Kubernetes Service') so icon matching works; avoid abbreviations like 'VM' or 'AKS' unless also spelled out.",
    "- For AWS *containers* use semantic kinds like aws.account/aws.region/aws.vpc/aws.az/aws.subnet. Use 'generic.internet' when needed",
    "- If Provider is azure or gcp, avoid aws.* container kinds; use generic.group containers with style.variant='container' only when grouping is necessary.",
    "- label (string)",
    "- parentId (string, optional) to nest inside containers",
    "- style.variant = 'container' for containers like VPC/AZ/Subnet",
    "",
    "Edge fields:",
    "- id (string, unique)",
    "- source (node id), target (node id)",
    "- label (optional)",
    "- style: { dashed?: boolean, arrow?: boolean, route?: 'straight'|'step'|'smoothstep' }",
    "",
    "Rules:",
    "- Default edge style: solid (dashed=false), arrow=true, route='straight'.",
    "- Prefer fewer edges: only include connections that are obvious and essential; avoid speculative edges.",
    "- Prefer the main workload resources, not every sub-resource. Omit low-value supporting details unless they materially improve understanding.",
    "- Examples of details that are often safe to omit unless important: every listener, every route, every EBS volume, every attachment, every small helper object.",
    "- Keep the diagram uncluttered. If several sub-resources roll up cleanly into one higher-level resource or container, prefer the higher-level representation.",
    "- Use edges primarily to show the main direction of traffic or control flow. Do not draw every possible connection.",
    "- Containers are optional: use nesting when it helps clarity, but do not invent network containers unless requested or clearly implied.",
    "- Keep nodes <= 200 and edges <= 400.",
    "- All edges must reference existing node ids.",
    "- Resources should generally be inside an AWS account/container unless explicitly outside.",
    "- Only add VPC/AZ/Subnet containers when the user mentions VPC/subnets/AZs, or explicitly says resources run 'in a VPC' / private/public subnets. Otherwise, keep resources un-nested or only inside a single account container.",
    "- For containers, always set style.variant='container' and use an appropriate aws.* kind (e.g. aws.account, aws.region, aws.vpc, aws.az, aws.subnet).",
    "- IMPORTANT: parentId is ONLY for nesting inside container nodes (style.variant='container'). Never set parentId to a resource node (e.g. do not nest listeners under an ALB or tasks under an ECS cluster).",
    "- Do NOT include x/y/w/h positions; the frontend will lay out.",
    "- If the user asks to change layout orientation (horizontal vs vertical), set layout.direction accordingly and set layout.mode='auto' so the client recomputes layout.",
    "- If info is missing, make reasonable assumptions and keep labels short.",
  ].join("\n");
}

function requireOpenAIModel() {
  if (!OPENAI_TOKEN) throw new Error("OPENAI_TOKEN or OPENAI_API_KEY is not configured");
  setDefaultOpenAIKey(OPENAI_TOKEN);
  if (cachedModel) return cachedModel;
  const openaiClient = new OpenAI({ apiKey: OPENAI_TOKEN });
  cachedModel = new OpenAIResponsesModel(openaiClient, OPENAI_MODEL);
  return cachedModel;
}

export function getDiagramSpecAgent() {
  if (cachedAgent) return cachedAgent;
  const model = requireOpenAIModel();
  cachedAgent = new Agent({
    name: "diagram-spec-agent",
    instructions: systemPrompt(),
    model,
  });
  return cachedAgent;
}

export async function runDiagramSpecAgent({ history, message, maxTurns = 8 }) {
  const agent = getDiagramSpecAgent();
  const input = [...(history || []), user(String(message || "").trim())].filter(Boolean);
  const result = await run(agent, input, {
    maxTurns,
    runConfig: { tracingDisabled: true },
  });
  const text = result.finalOutput ?? extractAllTextOutput(result.history) ?? "";
  return { history: result.history, text: String(text || "") };
}
