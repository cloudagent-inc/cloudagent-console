# Security Policy

CloudAgent Console is currently an early-preview project. Security reports are
welcome and should be handled privately.

## Supported Versions

Security fixes are applied to the active development branch and the latest
published early-preview release.

## Reporting a Vulnerability

Please do not open a public GitHub issue for suspected vulnerabilities.

Use GitHub private vulnerability reporting if it is enabled for the repository.
If private reporting is not available, contact the project maintainers directly
with a concise report and avoid sharing exploit details publicly.

Helpful report details include:

- Affected component or file path.
- Reproduction steps.
- Impact and required privileges.
- Whether cloud credentials, local files, MCP tools, agent execution, or package
  installation are involved.
- Suggested mitigation, if known.

## Sensitive Data

Do not include live credentials, OpenAI keys, AWS account IDs, customer data,
private infrastructure names, or unsanitized logs in public issues, pull
requests, screenshots, or discussions.

CloudAgent Console is designed to run locally and may store local preferences,
cloud environment metadata, scanner results, and agent runtime data on the
user's machine. Treat exported data, logs, and screenshots as sensitive unless
they have been reviewed and sanitized.
