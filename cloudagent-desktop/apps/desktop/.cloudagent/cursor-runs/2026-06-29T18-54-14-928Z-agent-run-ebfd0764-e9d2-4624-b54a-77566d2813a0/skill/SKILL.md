# CloudAgent Cursor Agent Blueprint

Use this skill when running this CloudAgent blueprint through Cursor Agent.

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

Collect AWS Backup backup jobs created in the last 30 days in account 025825898506 and region us-east-1, and identify any jobs with failed, expired, aborted, completed-with-issues, or other non-success statuses.

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

- Use cli_session_command_execute to set the AWS CLI region to us-east-1 for this assessment session.
- Use cli_session_command_execute to calculate and apply the default review window without prompting the user because execution_preferences.useDefaultValuesWithoutConfirmation is true: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time.
- Use cli_session_command_execute to call AWS Backup APIs via aws backup list-backup-jobs in account 025825898506 and region us-east-1 for jobs created within the default 30-day review window.
- Use cli_session_command_execute to inspect returned backup jobs and isolate any job whose status is not the expected success state, including failed, expired, aborted, completed-with-issues, or other non-success values returned by AWS Backup.
- Use cli_session_command_execute to gather detailed fields for each non-success backup job, including job ID, status, state/message fields, protected resource identifier, vault details if present, timestamps, and diagnostic failure information.
- Document explicit not-applicable values for destination vault, destination region, destination account, and restore target details when AWS Backup does not provide those fields for backup jobs.
- Prepare structured output for the summary task, including total reviewed backup jobs, total non-success backup jobs, and a normalized row set of failed or non-success backup job details.

**Max Turns**

50

#### 2. Review restore jobs from past 30 days

**Id**

review_restore_jobs_past_month

**Description**

Collect AWS Backup restore jobs created in the last 30 days in account 025825898506 and region us-east-1, and identify any jobs with failed, expired, aborted, completed-with-issues, or other non-success statuses.

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

- Use cli_session_command_execute to set the AWS CLI region to us-east-1 for this assessment session.
- Use cli_session_command_execute to calculate and apply the default review window without prompting the user because execution_preferences.useDefaultValuesWithoutConfirmation is true: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time.
- Use cli_session_command_execute to call AWS Backup APIs via aws backup list-restore-jobs in account 025825898506 and region us-east-1 for jobs created within the default 30-day review window.
- Use cli_session_command_execute to inspect returned restore jobs and isolate any job whose status is not the expected success state, including failed, expired, aborted, completed-with-issues, or other non-success values returned by AWS Backup.
- Use cli_session_command_execute to gather detailed fields for each non-success restore job, including restore job ID, source recovery point or protected resource identifiers, source vault if present, destination metadata if present, restore target details, timestamps, and diagnostic failure information.
- Document explicit not-applicable or not-returned values for destination vault, destination region, or destination account fields when AWS Backup does not provide them for a restore job.
- Prepare structured output for the summary task, including total reviewed restore jobs, total non-success restore jobs, and a normalized row set of failed or non-success restore job details.

**Max Turns**

50

#### 3. Review copy jobs from past 30 days

**Id**

review_copy_jobs_past_month

**Description**

Collect AWS Backup copy jobs created in the last 30 days in account 025825898506 and region us-east-1, and identify any jobs with failed, expired, aborted, completed-with-issues, or other non-success statuses.

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

- Use cli_session_command_execute to set the AWS CLI region to us-east-1 for this assessment session.
- Use cli_session_command_execute to calculate and apply the default review window without prompting the user because execution_preferences.useDefaultValuesWithoutConfirmation is true: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time.
- Use cli_session_command_execute to call AWS Backup APIs via aws backup list-copy-jobs in account 025825898506 and region us-east-1 for jobs created within the default 30-day review window.
- Use cli_session_command_execute to inspect returned copy jobs and isolate any job whose status is not the expected success state, including failed, expired, aborted, completed-with-issues, or other non-success values returned by AWS Backup.
- Use cli_session_command_execute to gather detailed fields for each non-success copy job, including copy job ID, source recovery point or protected resource identifiers, source and destination vaults, destination region, destination account if present, timestamps, and diagnostic failure information.
- Document explicit not-applicable values for restore target details when AWS Backup does not provide them for copy jobs.
- Prepare structured output for the summary task, including total reviewed copy jobs, total non-success copy jobs, and a normalized row set of failed or non-success copy job details.

**Max Turns**

50

### 2. Summary

#### 1. Summarize backup restore and copy results

**Id**

summarize_backup_restore_copy_job_results

**Description**

Summarize the backup, restore, and copy job review results for the last 30 days in account 025825898506 and region us-east-1, and state whether any non-success jobs were found or all jobs were successful.

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

- Use the outputs produced by the three prior assessment tasks; no additional discovery outside account 025825898506 and region us-east-1 is needed.
- Validate that each prior task used the default review window without prompting the user because execution_preferences.useDefaultValuesWithoutConfirmation is true: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time.
- Aggregate reviewed-job counts and non-success-job counts across backup, restore, and copy job types.
- Build a single combined table of all non-success jobs with normalized columns for job type, job ID, resource identifier, source vault, destination vault, destination region, destination account, restore target details, timestamps, and failure diagnostics.
- Mark fields as not applicable or not returned where appropriate for the specific job type so the final table is unambiguous.
- Summarize recurring failure reasons or patterns if any non-success jobs were identified, or explicitly state that no non-success jobs were found if the combined result set is empty.
- Produce the final assessment summary for the user.

**Max Turns**

50
