function isSchemaObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasSchemaShape(schema) {
  return Boolean(
    schema.type ||
      schema.$ref ||
      schema.const !== undefined ||
      Array.isArray(schema.enum) ||
      Array.isArray(schema.anyOf) ||
      Array.isArray(schema.oneOf) ||
      Array.isArray(schema.allOf)
  );
}

function inspectSchemaNode(schema, path, issues) {
  if (!isSchemaObject(schema)) {
    issues.push({ path, code: "schema_not_object" });
    return;
  }
  if (!hasSchemaShape(schema)) {
    issues.push({ path, code: "schema_missing_type" });
  }

  if (schema.type === "object" && isSchemaObject(schema.properties)) {
    const propertyNames = Object.keys(schema.properties);
    const required = Array.isArray(schema.required) ? schema.required : null;
    if (!required) {
      issues.push({ path: `${path}.required`, code: "object_required_missing" });
    } else {
      for (const propertyName of propertyNames) {
        if (!required.includes(propertyName)) {
          issues.push({
            path: `${path}.required`,
            code: "required_property_missing",
            property: propertyName
          });
        }
      }
    }
  }

  for (const [name, propertySchema] of Object.entries(schema.properties || {})) {
    inspectSchemaNode(propertySchema, `${path}.properties.${name}`, issues);
  }

  if (schema.items !== undefined) {
    inspectSchemaNode(schema.items, `${path}.items`, issues);
  }

  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    for (const [index, variant] of (schema[keyword] || []).entries()) {
      inspectSchemaNode(variant, `${path}.${keyword}[${index}]`, issues);
    }
  }

  for (const keyword of ["$defs", "definitions"]) {
    for (const [name, definition] of Object.entries(schema[keyword] || {})) {
      inspectSchemaNode(definition, `${path}.${keyword}.${name}`, issues);
    }
  }

  if (schema.propertyNames !== undefined) {
    issues.push({ path: `${path}.propertyNames`, code: "unsupported_property_names" });
  }

  if (schema.additionalProperties === true) {
    issues.push({ path: `${path}.additionalProperties`, code: "unrestricted_additional_properties" });
  } else if (isSchemaObject(schema.additionalProperties)) {
    if (!schema.additionalProperties.type) {
      issues.push({
        path: `${path}.additionalProperties`,
        code: "additional_properties_missing_type"
      });
    }
    inspectSchemaNode(schema.additionalProperties, `${path}.additionalProperties`, issues);
  }
}

export function collectOpenAiToolSchemaIssues(tools = []) {
  const issues = [];
  for (const agentTool of tools) {
    const toolName = String(agentTool?.name || "unnamed_tool");
    if (agentTool?.type !== "function") {
      issues.push({ tool: toolName, path: "type", code: "unsupported_tool_type" });
      continue;
    }
    if (agentTool.strict !== true) {
      issues.push({ tool: toolName, path: "strict", code: "tool_not_strict" });
    }
    const toolIssues = [];
    inspectSchemaNode(agentTool.parameters, "parameters", toolIssues);
    if (agentTool?.parameters?.type !== "object") {
      toolIssues.push({ path: "parameters", code: "root_schema_not_object" });
    }
    issues.push(...toolIssues.map((issue) => ({ tool: toolName, ...issue })));
  }
  return issues;
}

export function assertOpenAiToolSchemas(tools = []) {
  const issues = collectOpenAiToolSchemaIssues(tools);
  if (!issues.length) return tools;
  const summary = issues
    .map((issue) => `${issue.tool}:${issue.path} (${issue.code})`)
    .join(", ");
  throw new Error(`Invalid OpenAI function tool schema: ${summary}`);
}
