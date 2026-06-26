# Assess AWS Backup Job Failures and Summarize Next Steps

Use this skill when running this CloudAgent blueprint through Codex CLI.

## Instructions

- Read `session-context.json` before acting. It contains the selected environment, workload, regions, preferences, local scan/report context, and the blueprint plan.
- Use `session-context.json.environment.authProfile` to understand the selected AWS account/profile and region.
- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.
- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.
- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool.
- Keep all work scoped to the selected environment, workload, regions, and preflight context.
- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.
- Return concise Markdown with Findings, Evidence, Actions Taken, and Result.
- Do not claim AWS or local changes were made unless you actually performed them.
## Blueprint Title
Assess AWS Backup Job Failures and Summarize Next Steps
## Description
- Review AWS Backup activity within scope to identify failed backup, copy, and restore jobs. Collect failure details for affected jobs and produce a concise summary for user review, including recommended next steps.
## Cloud Provider
aws
## Plan Settings
```json
{
  "defaultValues": "## Assessment\n\nEnter the assessment scope below.\n\n__input_field__ {\"fieldType\":\"input\",\"label\":\"Target scope\",\"default_value\":\"\"} __input_field_end__\n\n## Summary\n\nIndicate whether additional AWS-only investigation is needed.\n\n__input_field__ {\"fieldType\":\"radio_group\",\"label\":\"Additional AWS-only investigation needed\",\"default_value\":\"No\",\"options\":[{\"label\":\"Yes\"},{\"label\":\"No\"}]} __input_field_end__\n\nAdd any follow-up remediation tasks.\n\n__input_field__ {\"fieldType\":\"input\",\"label\":\"Follow-up remediation tasks\",\"default_value\":\"\"} __input_field_end__",
  "planOverview": {
    "title": "Review AWS Backup activity within scope to identify failed backup, copy, and restore jobs. Collect failure details for affected jobs and produce a concise summary for user review, including recommended next steps.",
    "description": "## Overview\n\nReview AWS Backup activity within the defined scope to identify failed and expired backup jobs, failed and expired copy jobs, and failed restore jobs. The process gathers key job metadata such as timestamps, resource associations, backup vault details, recovery point references, and failure messages so you can quickly understand what failed and where. It also organizes the findings into a concise summary, highlights recurring failure patterns across accounts, Regions, resources, or backup vaults, and prepares recommended next steps for further investigation or remediation.\n\n## Execution Details\n\n### Phase 1: Assessment\n\nAssess AWS Backup job activity across the target scope to build a complete view of failure events.\n\n- Review **backup jobs** with `FAILED` or `EXPIRED` status and capture details such as job identifiers, status, failure messages, creation and completion times, associated **Backup vaults**, **Recovery points**, **Resource ARNs**, resource types, and related **Backup plan** or **Backup rule** metadata where available.\n- Review **copy jobs** with `FAILED` or `EXPIRED` status and collect source and destination information, including source and destination **Backup vault ARNs**, **Recovery point ARNs**, related resources, timing details, and any cross-account or cross-Region destination attributes.\n- Review **restore jobs** with `FAILED` status and gather recovery-related context such as the **Recovery point ARN**, target resource details, validation information, progress indicators, and completion timing where available.\n- For all affected jobs, retrieve additional AWS Backup metadata to better explain the failure cause, then group findings by patterns such as repeated failure messages, resource types, vaults, accounts, or Regions to determine whether issues are isolated or recurring.\n\n### Phase 2: Summary\n\nPrepare the findings for user review and decision-making.\n\n- Produce a consolidated summary of failed **backup**, **copy**, and **restore** jobs across the approved scope.\n- Present the user with the key failure details, including job IDs, statuses, timestamps, resource associations, vault details, recovery point references, and status messages.\n- Highlight repeated failure trends and provide recommended next steps for deeper AWS investigation or remediation.\n- Guide the user through reviewing whether the collected findings are sufficient or whether additional follow-up actions should be added."
  },
  "skeletonSettings": {
    "phases": {
      "assessment": true,
      "summary": true,
      "configuration": false,
      "validation": false
    },
    "deploymentMethod": "cli",
    "cloudFormationStackExists": null,
    "notes": "",
    "planType": "Review"
  }
}
```
## Blueprint Plan

### 1. Assessment

#### 1. List failed backup jobs in scope

**Id**

list-failed-backup-jobs

**Description**

Identify AWS Backup backup jobs with a failed or expired status within the selected AWS account and Region scope and review their timestamps and resource associations.

**Cloud Provider**

aws

**Completion Criteria**

- Query AWS Backup backup jobs in AWS account 025825898506 and Region us-east-1 using job status filters for FAILED and EXPIRED.
- Capture each failed or expired backup job's BackupJobId.
- Capture the job Status for each returned backup job.
- Capture the StateMessage or equivalent failure status message for each returned backup job when available.
- Capture the CreationDate and CompletionDate for each returned backup job when available.
- Capture the BackupVaultName associated with each returned backup job.
- Capture the RecoveryPointArn created or attempted by each returned backup job when available.
- Capture the ResourceArn associated with each returned backup job.
- Capture the ResourceType for each returned backup job.
- Capture the BackupPlanId and BackupRuleId for each returned backup job when available.
- Capture the BackupSizeInBytes or equivalent size field when available.
- Capture initiation method details such as CreatedBy or lifecycle metadata when available.
- Confirm the results are limited to AWS account 025825898506 in us-east-1.
- Produce a consolidated list of all failed and expired backup jobs with timestamps and resource associations.

**Execution Plan**

- Use cli_session_command_execute to run AWS CLI commands against AWS account 025825898506 in Region us-east-1 to list AWS Backup backup jobs with status FAILED.
- Use cli_session_command_execute to run AWS CLI commands against AWS account 025825898506 in Region us-east-1 to list AWS Backup backup jobs with status EXPIRED.
- Use cli_session_command_execute to retrieve any needed per-job details for returned backup jobs so BackupJobId, Status, StateMessage, CreationDate, CompletionDate, BackupVaultName, RecoveryPointArn, ResourceArn, ResourceType, BackupPlanId, BackupRuleId, BackupSizeInBytes, and CreatedBy-related metadata are captured when available.
- Use cli_session_command_execute to consolidate and verify that all returned backup jobs are scoped only to AWS account 025825898506 and Region us-east-1.
- Summarize the failed and expired backup jobs into a single reviewable list for the user.

**Max Turns**

50

**Status**

not-run

#### 2. List failed copy jobs in scope

**Id**

list-failed-copy-jobs

**Description**

Identify AWS Backup copy jobs with a failed or expired status within the selected AWS account and Region scope and review their timestamps and destination details.

**Cloud Provider**

aws

**Completion Criteria**

- Query AWS Backup copy jobs in AWS account 025825898506 and Region us-east-1 using job status filters for FAILED and EXPIRED.
- Capture each failed or expired copy job's CopyJobId.
- Capture the job Status for each returned copy job.
- Capture the StatusMessage or equivalent failure status message for each returned copy job when available.
- Capture the CreationDate, CompletionDate, and StartBy for each returned copy job when available.
- Capture the SourceBackupVaultArn or source vault details for each returned copy job when available.
- Capture the DestinationBackupVaultArn or destination vault details for each returned copy job.
- Capture the SourceRecoveryPointArn and DestinationRecoveryPointArn for each returned copy job when available.
- Capture the ResourceArn associated with each returned copy job when available.
- Capture the ResourceType for each returned copy job when available.
- Capture the ParentJobId or related backup job reference when available.
- Capture cross-account or cross-Region destination attributes when present.
- Confirm the results are limited to AWS account 025825898506 in us-east-1.
- Produce a consolidated list of all failed and expired copy jobs with timestamps and destination details.

**Execution Plan**

- Use cli_session_command_execute to run AWS CLI commands against AWS account 025825898506 in Region us-east-1 to list AWS Backup copy jobs with status FAILED.
- Use cli_session_command_execute to run AWS CLI commands against AWS account 025825898506 in Region us-east-1 to list AWS Backup copy jobs with status EXPIRED.
- Use cli_session_command_execute to retrieve any needed per-job details for returned copy jobs so CopyJobId, Status, StatusMessage, CreationDate, CompletionDate, StartBy, source and destination vault details, source and destination recovery point ARNs, ResourceArn, ResourceType, ParentJobId, and cross-account or cross-Region attributes are captured when available.
- Use cli_session_command_execute to consolidate and verify that all returned copy jobs are scoped only to AWS account 025825898506 and Region us-east-1.
- Summarize the failed and expired copy jobs into a single reviewable list for the user.

**Max Turns**

50

**Status**

not-run

#### 3. List failed restore jobs in scope

**Id**

list-failed-restore-jobs

**Description**

Identify AWS Backup restore jobs with a failed status within the selected AWS account and Region scope and review their timestamps and recovery target details.

**Cloud Provider**

aws

**Completion Criteria**

- Query AWS Backup restore jobs in AWS account 025825898506 and Region us-east-1 using a job status filter for FAILED.
- Capture each failed restore job's RestoreJobId.
- Capture the job Status for each returned restore job.
- Capture the StatusMessage or equivalent failure status message for each returned restore job when available.
- Capture the CreationDate, CompletionDate, and ExpectedCompletionTimeMinutes when available.
- Capture the RecoveryPointArn used by each failed restore job.
- Capture the BackupVaultName associated with the recovery point when available.
- Capture the ResourceType for each failed restore job.
- Capture the CreatedResourceArn for each failed restore job when available.
- Capture the PercentDone or equivalent progress field when available.
- Capture the ValidationStatus and ValidationStatusMessage when available.
- Capture restore metadata or target configuration details that identify the intended recovery target when available.
- Confirm the results are limited to AWS account 025825898506 in us-east-1.
- Produce a consolidated list of all failed restore jobs with timestamps and recovery target details.

**Execution Plan**

- Use cli_session_command_execute to run AWS CLI commands against AWS account 025825898506 in Region us-east-1 to list AWS Backup restore jobs with status FAILED.
- Use cli_session_command_execute to retrieve any needed per-job details for returned restore jobs so RestoreJobId, Status, StatusMessage, CreationDate, CompletionDate, ExpectedCompletionTimeMinutes, RecoveryPointArn, BackupVaultName, ResourceType, CreatedResourceArn, PercentDone, ValidationStatus, ValidationStatusMessage, and restore target metadata are captured when available.
- Use cli_session_command_execute to consolidate and verify that all returned restore jobs are scoped only to AWS account 025825898506 and Region us-east-1.
- Summarize the failed restore jobs into a single reviewable list for the user.

**Max Turns**

50

**Status**

not-run

#### 4. Collect failure details for affected jobs

**Id**

collect-failure-details-for-jobs

**Description**

Retrieve status messages and related metadata for each failed backup, copy, and restore job to support review of the failure causes within the selected AWS account and Region.

**Cloud Provider**

aws

**Completion Criteria**

- For every failed or expired backup job identified in AWS account 025825898506 and Region us-east-1, retrieve detailed job metadata from AWS Backup.
- For every failed or expired copy job identified in AWS account 025825898506 and Region us-east-1, retrieve detailed job metadata from AWS Backup.
- For every failed restore job identified in AWS account 025825898506 and Region us-east-1, retrieve detailed job metadata from AWS Backup.
- Capture the failure message field for each job, including StateMessage or StatusMessage as applicable to the job type.
- Capture the job identifier, job type, status, creation time, completion time, and owning account or scope context for each affected job.
- Capture the associated BackupVaultName or vault ARN for each affected job when available.
- Capture the associated RecoveryPointArn, source recovery point, or destination recovery point for each affected job when available.
- Capture the associated ResourceArn and ResourceType for each affected job when available.
- Capture related backup plan, backup rule, parent job, or restore target metadata when available and relevant to the failure review.
- Group affected jobs by failure message pattern, resource type, vault, account, or Region when this helps identify repeated failure causes.
- Identify whether failures are isolated or recurring by noting repeated resources, repeated plans, or repeated destinations among affected jobs.
- Produce a summarized failure review that maps each affected job to its primary failure details and related AWS Backup metadata.

**Execution Plan**

- Use cli_session_command_execute to run AWS CLI detail-retrieval commands for each failed or expired backup, copy, and restore job identified in AWS account 025825898506 and Region us-east-1.
- Use cli_session_command_execute to capture failure messages, identifiers, job types, statuses, timestamps, account and Region context, vault references, recovery point references, resource references, and related plan, rule, parent job, or restore target metadata when available.
- Use cli_session_command_execute to compare affected jobs and group them by repeated failure message pattern, resource type, vault, repeated resource, repeated plan, repeated destination, account, or Region when useful for diagnosis.
- Prepare a summarized failure review mapping each affected job to its primary failure details and related AWS Backup metadata for user review.

**Max Turns**

50

**Status**

not-run

### 2. Summary

#### 1. User: Review failure summary and next steps

**Id**

user-review-failure-summary-and-next-steps

**Description**

Review the consolidated list of failed AWS Backup jobs and close the requested failure review unless follow-up remediation is explicitly requested.

**Cloud Provider**

aws

**Completion Criteria**

- Review the consolidated summary of failed and expired backup jobs, failed and expired copy jobs, and failed restore jobs for AWS account 025825898506 in us-east-1.
- Review the captured job identifiers, statuses, timestamps, resource associations, vault details, recovery point references, and failure messages for affected jobs.
- Apply the provided default value additional_aws-only_investigation_needed=No without prompting because useDefaultValuesWithoutConfirmation is true.
- Confirm that no additional AWS-only investigation is needed unless the user explicitly overrides the default.
- Approve the reviewed findings as complete for the requested failure review or specify follow-up remediation tasks to add to the plan.

**Execution Plan**

- Present the consolidated failure summary to the user for review.
- Because execution_preferences.useDefaultValuesWithoutConfirmation is true, apply the default value additional_aws-only_investigation_needed=No and do not prompt the user for that decision.
- If the user does not override the default, close the review as complete with no additional AWS-only investigation.
- No tool is required unless the user requests follow-up remediation or deeper investigation.

**Max Turns**

50

**Status**

not-run
