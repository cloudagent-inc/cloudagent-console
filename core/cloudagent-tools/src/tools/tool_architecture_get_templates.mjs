import { tool } from "@openai/agents";
import { z } from "zod";

import { logStart, logEnd } from "../util/logging.mjs";

const ArchitectureIdEnum = z.enum([
  "static_website",
  "web_app_ecs_fargate",
  "rds_mysql_with_secret",
  "vpc_two_az"
]);

export function createArchitectureTemplatesTool({ templates }) {
  if (!templates) throw new Error("createArchitectureTemplatesTool requires a templates map");

  return tool({
    name: "architecture_templates",
    description:
      "Fetch a standard CloudFormation template by ID (static_website, web_app_ecs_fargate, rds_mysql_with_secret, vpc_two_az).",
    parameters: z.object({
      templateId: ArchitectureIdEnum,
      format: z.enum(["yaml", "json"]).nullable().optional()
    }).strict(),

    async execute({ templateId, format }) {
      logStart("architecture_templates", { templateId, format });

      const entry = templates[templateId];
      if (!entry) {
        const out = { error: true, message: `Unknown templateId: ${templateId}` };
        logEnd("architecture_templates", out);
        return out;
      }

      const selectedFormat = (format || "yaml").toLowerCase();
      const out = {
        templateId,
        title: entry.title,
        recommendedStackName: entry.recommendedStackName,
        format: selectedFormat,
        templateBody: entry.yaml
      };
      logEnd("architecture_templates", { templateId, format: selectedFormat, size: out.templateBody.length });
      return out;
    }
  });
}
