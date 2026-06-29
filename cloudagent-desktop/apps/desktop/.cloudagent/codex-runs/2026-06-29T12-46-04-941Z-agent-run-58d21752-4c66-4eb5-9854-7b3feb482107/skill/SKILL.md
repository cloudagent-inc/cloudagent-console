# CloudAgent Codex CLI Blueprint

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
## Blueprint Plan

### 1. Assessment

#### 1. Review AWS Backup backup, restore, and copy jobs from past 30 days

**Id**

review_backup_restore_copy_jobs_past_month

**Description**

Collect AWS Backup backup, restore, and copy jobs created in the last 30 days in account 025825898506 and region us-east-1, identify any jobs with non-success statuses, and capture the identifying and diagnostic details needed for final reporting. This is a read-only assessment using the direct AWS CLI path.

**Completion Criteria**

- Listed AWS Backup backup jobs, restore jobs, and copy jobs created between the default review window start timestamp of 30 days before assessment time and the default review window end timestamp of assessment time in account 025825898506 and region us-east-1
- Used the default review window values without prompting because useDefaultValuesWithoutConfirmation is true
- Retrieved for each backup, restore, and copy job the job ID, status, creation time, start time, completion time, and any other relevant timestamps returned by AWS Backup
- Identified all backup, restore, and copy jobs with non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state
- For each non-success backup job, recorded the job type as backup
- For each non-success restore job, recorded the job type as restore
- For each non-success copy job, recorded the job type as copy
- For each non-success job, recorded the job ID
- For each non-success backup job, recorded the protected resource ARN or other resource identifier
- For each non-success restore job, recorded the source recovery point ARN, protected resource ARN, or other resource identifier returned by AWS Backup
- For each non-success copy job, recorded the source recovery point ARN, protected resource ARN, or other resource identifier returned by AWS Backup
- For each non-success job, recorded the source backup vault if applicable
- For each non-success job, recorded the destination backup vault if applicable or explicitly noted that no destination backup vault applies
- For each non-success job, recorded the destination AWS Region if applicable or explicitly noted that no destination Region applies or was not returned
- For each non-success job, recorded the destination AWS account if applicable or explicitly noted that no destination account applies or was not returned
- For each non-success restore job, recorded restore target details, including target resource type and any returned target identifiers or restore metadata that indicate where the restore was intended to land
- For backup and copy jobs, explicitly noted when restore target details do not apply
- For each non-success job, recorded the failure message, status reason, or equivalent diagnostic field returned by AWS Backup
- Preserved enough identifying, routing, target, and diagnostic detail for each non-success job to support final aggregation across backup, restore, and copy job types
- Confirmed whether any non-success backup, restore, or copy jobs were found during the 30-day review window
- If no non-success jobs were found for a given job type, documented that all reviewed jobs of that type were successful or had no non-success statuses in scope

**Execution Plan**

- Use cli_session_command_execute to run AWS CLI read-only commands in account 025825898506 and region us-east-1 because configuration_mode is aws_cli and delivery target is direct_cloud
- Use the provided default value review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time without prompting because execution_preferences.useDefaultValuesWithoutConfirmation is true
- Use cli_session_command_execute to calculate or format the assessment-time window boundaries in UTC for consistent AWS Backup job filtering and reporting
- Use cli_session_command_execute to call aws backup list-backup-jobs in us-east-1 and page through results as needed, limiting analysis to jobs created within the last 30 days
- Use cli_session_command_execute to call aws backup list-restore-jobs in us-east-1 and page through results as needed, limiting analysis to jobs created within the last 30 days
- Use cli_session_command_execute to call aws backup list-copy-jobs in us-east-1 and page through results as needed, limiting analysis to jobs created within the last 30 days
- Use cli_session_command_execute to normalize the returned job records, filter for non-success statuses, and extract required fields including job IDs, statuses, timestamps, resource identifiers, vault details, destination region/account details, restore target details where applicable, and diagnostic messages
- Use cli_session_command_execute to explicitly mark fields as not applicable when AWS Backup does not return destination or restore-target data for that job type
- Use cli_session_command_execute to produce structured intermediate results for backup, restore, and copy jobs that can be consumed by the summary task
- Report the assessment findings for backup, restore, and copy jobs, including whether any non-success jobs were found

**Max Turns**

50

### 2. Summary

#### 1. Summarize backup restore and copy results

**Id**

summarize_backup_restore_copy_job_results

**Description**

Summarize the AWS Backup backup, restore, and copy job review results for the last 30 days in account 025825898506 and region us-east-1 and state whether any non-success jobs were found or all jobs were successful.

**Completion Criteria**

- Collected the review outputs from the combined backup, restore, and copy job assessment task covering the last 30 days
- Validated that the summary period matches the assessment task and is stated as the last 30 days
- Consolidated the counts of reviewed backup jobs, restore jobs, and copy jobs
- Consolidated the counts of non-success backup jobs, non-success restore jobs, and non-success copy jobs
- Aggregated all non-success jobs identified across backup, restore, and copy reviews into a single combined result set
- Produced a clear table of all non-success jobs found across the three job types
- Included in the failed or non-success jobs table, for each row, the job type
- Included in the failed or non-success jobs table, for each row, the job ID
- Included in the failed or non-success jobs table, for each row, the resource ARN or other resource identifier
- Included in the failed or non-success jobs table, for each row, the source backup vault if applicable
- Included in the failed or non-success jobs table, for each row, the destination backup vault if applicable
- Included in the failed or non-success jobs table, for each row, the destination AWS Region if applicable
- Included in the failed or non-success jobs table, for each row, the destination AWS account if applicable
- Included in the failed or non-success jobs table, for each row, the restore target details if applicable
- Included in the failed or non-success jobs table, for each row, the failure message, status reason, or equivalent diagnostic detail
- Included in the failed or non-success jobs table, for each row, the relevant timestamps preserved by the assessment task, such as creation, start, and completion times where available
- Clearly distinguished fields that are not applicable for a given job type instead of leaving their meaning ambiguous
- Summarized the main failure patterns or recurring causes observed across non-success jobs, if any were present in the assessment outputs
- Explicitly stated when no failed or non-success jobs were found across all reviewed backup, restore, and copy jobs
- If no failed or non-success jobs were found, explicitly stated that all reviewed jobs were successful or had no non-success statuses in scope
- Produced a final summary that is internally consistent with the detailed findings from the assessment task

**Execution Plan**

- Use cli_session_command_execute outputs from the assessment task as the source data for the final summary because this is a read-only aws_cli workflow
- Validate that the summary window uses the provided default values of 30 days before assessment time through assessment time without prompting because execution_preferences.useDefaultValuesWithoutConfirmation is true
- Aggregate reviewed-job counts and non-success-job counts by job type from the assessment outputs
- Combine all non-success backup, restore, and copy jobs into one final results table with consistent columns and explicit not-applicable markers
- Summarize recurring failure reasons or patterns if present in the diagnostics collected during assessment
- Produce the final user-facing summary for account 025825898506 in region us-east-1, explicitly stating whether any non-success jobs were found

**Max Turns**

50
