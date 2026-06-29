import { tool } from "@openai/agents";
import { z } from "zod";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { logStart, logEnd } from "../util/logging.mjs";
import { getUserId } from "../util/run-context.mjs";
import globals from "@cloudagent/core/global-variables";

const lambdaClient = new LambdaClient({ region: globals.AWS_REGION });
const AWS_CLI_LAMBDA_ARN = globals.AWS_CLI_LAMBDA_ARN;

export async function executeCliCommand({ command, accountId, authProfile }) {
  console.log("execute cli", command, accountId, authProfile);
  const params = {
    FunctionName: AWS_CLI_LAMBDA_ARN,
    Payload: Buffer.from(JSON.stringify({ command, accountId, authProfile }))
  };

  try {
    const result = await lambdaClient.send(new InvokeCommand(params));
    console.log(result);
    const payload = result.Payload ? Buffer.from(result.Payload).toString() : "{}";
    const response = JSON.parse(payload);

    if (response.statusCode === 200) {
      console.log("Success:", response.output);
    } else {
      console.error("Error:", response.output);
      return {
        statusCode: 400,
        output: response.output?.stderr || response.output
      };
    }

    return response;
  } catch (error) {
    console.error("Error invoking Lambda:", error);
    return { statusCode: 400, output: "Error invoking Lambda function." };
  }
}

export default executeCliCommand;

export function createAwsCliReadOnlyTool({ accountsService, executeCommand = executeCliCommand } = {}) {
  if (!accountsService?.getPermissionProfileDefaults || !accountsService?.getAccountDefaults) {
    throw new Error(
      "accountsService.getPermissionProfileDefaults and accountsService.getAccountDefaults are required"
    );
  }

  return tool({
    name: "aws_cli_readonly",
    description:
      "Execute a READ-ONLY AWS CLI command in the target environment. Use for discovery (describe/list/get) before planning changes.",
    parameters: z.object({
      command: z.string().describe("An AWS CLI command starting with a read-only verb (describe/list/get/head/query/scan)."),
      accountId: z.string().nullable().optional().describe("Target AWS accountId where the command will run."),
      permissionProfileId: z
        .string()
        .nullable()
        .optional()
        .describe("Target permission profile record ID. Preferred when available."),
    }).strict(),
    async execute({ command, accountId, permissionProfileId }, runContext) {
      logStart("aws_cli_readonly", { accountId, permissionProfileId, command });

      const userId = getUserId(runContext);
      const defaults = permissionProfileId
        ? await accountsService.getPermissionProfileDefaults(userId, permissionProfileId)
        : await accountsService.getAccountDefaults(userId, accountId);
      const { authProfile } = defaults;
      const recordContextEvent = runContext?.context?.recordContextEvent;
      const resolvedAccountId = accountId || authProfile?.awsAccountId || null;

      const execInput = { command, accountId: resolvedAccountId, authProfile };
      const emitExecutionEvent = (output) => {
        if (typeof recordContextEvent !== "function") return;
        recordContextEvent({
          type: "tool_execution",
          sourceTool: "aws_cli_readonly",
          input: { command, accountId: resolvedAccountId, permissionProfileId: permissionProfileId || null },
          output
        });
      };
      try {
        const result = await executeCommand(execInput);
        const out = {
          ok: true,
          input: { command, accountId: resolvedAccountId, permissionProfileId: permissionProfileId || null },
          result,
        };
        emitExecutionEvent(out);
        logEnd("aws_cli_readonly", out);
        return out;
      } catch (e) {
        const out = {
          ok: false,
          error: String(e?.message || e),
          input: { command, accountId: resolvedAccountId, permissionProfileId: permissionProfileId || null },
        };
        emitExecutionEvent(out);
        logEnd("aws_cli_readonly", out);
        return out;
      }
    }
  });
}
