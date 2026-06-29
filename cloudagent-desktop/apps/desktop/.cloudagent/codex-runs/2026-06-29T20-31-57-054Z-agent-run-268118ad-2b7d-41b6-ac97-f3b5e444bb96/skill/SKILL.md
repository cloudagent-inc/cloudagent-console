# CloudAgent Codex CLI Blueprint

Use this skill when running this CloudAgent blueprint through Codex CLI.

## Instructions

- Read `session-context.json` before acting. It contains the selected environment, workload, regions, preferences, local scan/report context, and the blueprint plan.
- Use `session-context.json.environment.authProfile` to understand the selected AWS account/profile and region.
- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.

- If the blueprint plan says `cli_session_command_execute`, interpret that as a request to call CloudAgent MCP `aws_cli_readonly` with the specified read-only AWS CLI command. Do not treat `cli_session_command_execute` as a shell command.
- Available CloudAgent MCP tools for this run are `aws_cli_readonly`, `aws_cfn_operations`, `list_github_repos`, `read_github_file`, `create_github_branch`, `write_github_file`, and `create_github_pull_request` when the MCP server is configured.
- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.
- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool.
- Keep all work scoped to the selected environment, workload, regions, and preflight context.
- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.
- Return concise Markdown with Findings, Evidence, Actions Taken, and Result.
- Do not claim AWS or local changes were made unless you actually performed them.
## Blueprint Plan

### 1. Assessment

#### 1. Review backup jobs from past 30 days

**Id**

review_backup_jobs_past_month

**Description**

Collect AWS Backup backup jobs created in the last 30 days in account 025825898506 and region us-east-1, using the default review window start of 30 days before assessment time and end of assessment time without prompting because useDefaultValuesWithoutConfirmation is true, and identify any jobs with failed, expired, aborted, completed-with-issues, or other non-success statuses.

**Completion Criteria**

- Listed AWS Backup backup jobs created within the last 30 days in account 025825898506 and region us-east-1.
- Retrieved each backup job's job ID, job status, state/message fields, creation time, start time, completion time, and any other relevant timestamps available.
- Identified all backup jobs with non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state.
- For each non-success backup job, recorded the job type as backup.
- For each non-success backup job, recorded the backup job ID.
- For each non-success backup job, recorded the protected resource ARN or other resource identifier.
- For each non-success backup job, recorded the source backup vault if applicable.
- For each non-success backup job, recorded the destination backup vault if applicable or explicitly noted that no destination vault applies to backup jobs.
- For each non-success backup job, recorded the destination AWS Region if applicable or explicitly noted that no destination Region applies.
- For each non-success backup job, recorded the destination AWS account if applicable or explicitly noted that no destination account applies.
- For each non-success backup job, recorded restore target details if applicable or explicitly noted that restore target details do not apply to backup jobs.
- For each non-success backup job, recorded the failure message, status reason, or equivalent diagnostic field returned by AWS Backup.
- Preserved enough identifying and diagnostic detail for each non-success backup job to support final aggregation with restore and copy job failures.
- Confirmed whether any non-success backup jobs were found during the 30-day review window.
- If no non-success backup jobs were found, documented that all reviewed backup jobs were successful or had no non-success statuses in scope.

**Execution Plan**

- Use cli_session_command_execute to set the AWS CLI region to us-east-1 for this read-only assessment in account 025825898506.
- Use cli_session_command_execute to calculate and apply the default review window without prompting: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time, because execution_preferences.useDefaultValuesWithoutConfirmation is true.
- Use cli_session_command_execute to list AWS Backup backup jobs in us-east-1 created within the default 30-day review window.
- Use cli_session_command_execute to retrieve detailed fields for the returned backup jobs as needed, including job ID, state/status, message/reason fields, protected resource identifiers, backup vault information, and timestamps.
- Use cli_session_command_execute to filter the returned backup jobs to all non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state.
- Use cli_session_command_execute to format the non-success backup job findings into a structured result set that preserves identifying and diagnostic fields needed for final aggregation.
- No tool: document explicitly if no non-success backup jobs are found in the 30-day review window.

**Max Turns**

50

#### 2. Review restore jobs from past 30 days

**Id**

review_restore_jobs_past_month

**Description**

Collect AWS Backup restore jobs created in the last 30 days in account 025825898506 and region us-east-1, using the default review window start of 30 days before assessment time and end of assessment time without prompting because useDefaultValuesWithoutConfirmation is true, and identify any jobs with failed, expired, aborted, completed-with-issues, or other non-success statuses.

**Completion Criteria**

- Listed AWS Backup restore jobs created within the last 30 days in account 025825898506 and region us-east-1.
- Retrieved each restore job's job ID, status, creation time, start time, completion time, and any other relevant timestamps available.
- Identified all restore jobs with non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state.
- For each non-success restore job, recorded the job type as restore.
- For each non-success restore job, recorded the restore job ID.
- For each non-success restore job, recorded the source recovery point ARN, protected resource ARN, or other resource identifier returned by AWS Backup.
- For each non-success restore job, recorded the source backup vault if available.
- For each non-success restore job, recorded the destination backup vault if applicable or explicitly noted that no destination vault applies.
- For each non-success restore job, recorded the destination AWS Region if available from the restore metadata or explicitly noted if not applicable or not returned.
- For each non-success restore job, recorded the destination AWS account if available or explicitly noted if not applicable or not returned.
- For each non-success restore job, recorded restore target details, including target resource type and any returned target identifiers or restore metadata that indicate where the restore was intended to land.
- For each non-success restore job, recorded the failure message, status reason, or equivalent diagnostic field returned by AWS Backup.
- Preserved enough identifying, target, and diagnostic detail for each non-success restore job to support final aggregation with backup and copy job failures.
- Confirmed whether any non-success restore jobs were found during the 30-day review window.
- If no non-success restore jobs were found, documented that all reviewed restore jobs were successful or had no non-success statuses in scope.

**Execution Plan**

- Use cli_session_command_execute to set the AWS CLI region to us-east-1 for this read-only assessment in account 025825898506.
- Use cli_session_command_execute to calculate and apply the default review window without prompting: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time, because execution_preferences.useDefaultValuesWithoutConfirmation is true.
- Use cli_session_command_execute to list AWS Backup restore jobs in us-east-1 created within the default 30-day review window.
- Use cli_session_command_execute to retrieve detailed fields for the returned restore jobs as needed, including job ID, status, recovery point and protected resource identifiers, source vault details, destination metadata, restore target details, message/reason fields, and timestamps.
- Use cli_session_command_execute to filter the returned restore jobs to all non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state.
- Use cli_session_command_execute to format the non-success restore job findings into a structured result set that preserves identifying, target, and diagnostic fields needed for final aggregation.
- No tool: document explicitly if no non-success restore jobs are found in the 30-day review window.

**Max Turns**

50

#### 3. Review copy jobs from past 30 days

**Id**

review_copy_jobs_past_month

**Description**

Collect AWS Backup copy jobs created in the last 30 days in account 025825898506 and region us-east-1, using the default review window start of 30 days before assessment time and end of assessment time without prompting because useDefaultValuesWithoutConfirmation is true, and identify any jobs with failed, expired, aborted, completed-with-issues, or other non-success statuses.

**Completion Criteria**

- Listed AWS Backup copy jobs created within the last 30 days in account 025825898506 and region us-east-1.
- Retrieved each copy job's job ID, status, creation time, start time, completion time, and any other relevant timestamps available.
- Identified all copy jobs with non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state.
- For each non-success copy job, recorded the job type as copy.
- For each non-success copy job, recorded the copy job ID.
- For each non-success copy job, recorded the source recovery point ARN, protected resource ARN, or other resource identifier returned by AWS Backup.
- For each non-success copy job, recorded the source backup vault.
- For each non-success copy job, recorded the destination backup vault.
- For each non-success copy job, recorded the destination AWS Region.
- For each non-success copy job, recorded the destination AWS account if available from the job details or explicitly noted if not returned.
- For each non-success copy job, recorded restore target details if applicable or explicitly noted that restore target details do not apply to copy jobs.
- For each non-success copy job, recorded the failure message, status reason, or equivalent diagnostic field returned by AWS Backup.
- Preserved enough identifying, source/destination, and diagnostic detail for each non-success copy job to support final aggregation with backup and restore job failures.
- Confirmed whether any non-success copy jobs were found during the 30-day review window.
- If no non-success copy jobs were found, documented that all reviewed copy jobs were successful or had no non-success statuses in scope.

**Execution Plan**

- Use cli_session_command_execute to set the AWS CLI region to us-east-1 for this read-only assessment in account 025825898506.
- Use cli_session_command_execute to calculate and apply the default review window without prompting: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time, because execution_preferences.useDefaultValuesWithoutConfirmation is true.
- Use cli_session_command_execute to list AWS Backup copy jobs in us-east-1 created within the default 30-day review window.
- Use cli_session_command_execute to retrieve detailed fields for the returned copy jobs as needed, including job ID, status, recovery point and protected resource identifiers, source vault, destination vault, destination Region, destination account if returned, message/reason fields, and timestamps.
- Use cli_session_command_execute to filter the returned copy jobs to all non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state.
- Use cli_session_command_execute to format the non-success copy job findings into a structured result set that preserves identifying, source/destination, and diagnostic fields needed for final aggregation.
- No tool: document explicitly if no non-success copy jobs are found in the 30-day review window.

**Max Turns**

50

### 2. Summary

#### 1. Summarize backup restore and copy results

**Id**

summarize_backup_restore_copy_job_results

**Description**

Summarize the AWS Backup backup, restore, and copy job review results for the last 30 days in account 025825898506 and region us-east-1 and state whether any non-success jobs were found or all jobs were successful, using the default review window without prompting because useDefaultValuesWithoutConfirmation is true.

**Completion Criteria**

- Collected the review outputs from the backup, restore, and copy job assessment tasks covering the last 30 days.
- Validated that the summary period matches the assessment tasks and is stated as the last 30 days.
- Consolidated the counts of reviewed backup jobs, restore jobs, and copy jobs.
- Consolidated the counts of non-success backup jobs, non-success restore jobs, and non-success copy jobs.
- Aggregated all non-success jobs identified across backup, restore, and copy reviews into a single combined result set.
- Produced a clear table of all non-success jobs found across the three job types.
- Included in the failed or non-success jobs table, for each row, the job type.
- Included in the failed or non-success jobs table, for each row, the job ID.
- Included in the failed or non-success jobs table, for each row, the resource ARN or other resource identifier.
- Included in the failed or non-success jobs table, for each row, the source backup vault if applicable.
- Included in the failed or non-success jobs table, for each row, the destination backup vault if applicable.
- Included in the failed or non-success jobs table, for each row, the destination AWS Region if applicable.
- Included in the failed or non-success jobs table, for each row, the destination AWS account if applicable.
- Included in the failed or non-success jobs table, for each row, the restore target details if applicable.
- Included in the failed or non-success jobs table, for each row, the failure message, status reason, or equivalent diagnostic detail.
- Included in the failed or non-success jobs table, for each row, the relevant timestamps preserved by the assessment tasks, such as creation, start, and completion times where available.
- Clearly distinguished fields that are not applicable for a given job type instead of leaving their meaning ambiguous.
- Summarized the main failure patterns or recurring causes observed across non-success jobs, if any were present in the assessment outputs.
- Explicitly stated when no failed or non-success jobs were found across all reviewed backup, restore, and copy jobs.
- If no failed or non-success jobs were found, explicitly stated that all reviewed jobs were successful or had no non-success statuses in scope.
- Produced a final summary that is internally consistent with the detailed findings from all three assessment tasks.

**Execution Plan**

- No tool: collect the structured outputs from the backup, restore, and copy assessment tasks for account 025825898506 in region us-east-1.
- No tool: confirm the summary uses the default review window already applied without prompting: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time, because execution_preferences.useDefaultValuesWithoutConfirmation is true.
- No tool: consolidate total reviewed counts and non-success counts by job type.
- No tool: aggregate all non-success backup, restore, and copy jobs into one combined table with consistent columns for identifying, source/destination, target, diagnostic, and timestamp fields.
- No tool: explicitly mark fields as not applicable when they do not apply to a given job type.
- No tool: summarize recurring failure patterns if present, or explicitly state that no non-success jobs were found and that all reviewed jobs were successful or had no non-success statuses in scope.

**Max Turns**

50
