# CloudAgent Cursor Agent Blueprint

Use this skill when running this CloudAgent blueprint through Cursor Agent.

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

#### 1. Review AWS Backup backup restore and copy jobs from past 30 days

**Id**

review_aws_backup_jobs_past_30_days

**Description**

Use the authenticated AWS CLI in account 025825898506 and region us-east-1 to review AWS Backup backup jobs, restore jobs, and copy jobs created between the default review window start timestamp of 30 days before assessment time and the default review window end timestamp of assessment time, then identify all jobs with non-success statuses and capture the identifying and diagnostic details needed for reporting.

**Completion Criteria**

- Used the authenticated AWS CLI to review AWS Backup jobs in account 025825898506 and region us-east-1.
- Applied the default review window without prompting because useDefaultValuesWithoutConfirmation is true: review_window_start_timestamp = 30 days before assessment time and review_window_end_timestamp = assessment time.
- Listed AWS Backup backup jobs created within the last 30 days in scope.
- Retrieved each backup job's job ID, job status, state or message fields, creation time, start time, completion time, and other relevant timestamps returned by AWS Backup.
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
- Listed AWS Backup restore jobs created within the last 30 days in scope.
- Retrieved each restore job's job ID, status, creation time, start time, completion time, and other relevant timestamps returned by AWS Backup.
- Identified all restore jobs with non-success statuses, including failed, expired, aborted, completed-with-issues, or any other status outside the expected success state.
- For each non-success restore job, recorded the job type as restore.
- For each non-success restore job, recorded the restore job ID.
- For each non-success restore job, recorded the source recovery point ARN, protected resource ARN, or other resource identifier returned by AWS Backup.
- For each non-success restore job, recorded the source backup vault if available.
- For each non-success restore job, recorded the destination backup vault if applicable or explicitly noted that no destination vault applies.
- For each non-success restore job, recorded the destination AWS Region if available from restore metadata or explicitly noted if not applicable or not returned.
- For each non-success restore job, recorded the destination AWS account if available or explicitly noted if not applicable or not returned.
- For each non-success restore job, recorded restore target details, including target resource type and any returned target identifiers or restore metadata indicating the intended target.
- For each non-success restore job, recorded the failure message, status reason, or equivalent diagnostic field returned by AWS Backup.
- Listed AWS Backup copy jobs created within the last 30 days in scope.
- Retrieved each copy job's job ID, status, creation time, start time, completion time, and other relevant timestamps returned by AWS Backup.
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
- Preserved enough identifying, source or destination, target, and diagnostic detail for each non-success job to support final aggregation across backup, restore, and copy job failures.
- Confirmed whether any non-success backup jobs, restore jobs, or copy jobs were found during the 30-day review window.
- If no non-success jobs were found for a given job type, documented that all reviewed jobs of that type were successful or had no non-success statuses in scope.

**Execution Plan**

- Use cli_session_command_execute to confirm the active AWS identity and region context for the authenticated session in account 025825898506, scoped to region us-east-1.
- Use cli_session_command_execute to compute and apply the default review window without prompting because useDefaultValuesWithoutConfirmation is true: start time = 30 days before assessment time, end time = assessment time.
- Use cli_session_command_execute to call AWS Backup list-backup-jobs for us-east-1 with the computed time window, handling pagination as needed, and collect all backup jobs created in scope.
- Use cli_session_command_execute to inspect the returned backup job records and filter for any status outside the expected success state, including failed, expired, aborted, completed-with-issues, or other non-success outcomes.
- Use cli_session_command_execute to normalize and record for each non-success backup job: job type, job ID, protected resource identifier, source vault if available, destination vault applicability, destination Region applicability, destination account applicability, restore target applicability, timestamps, and diagnostic message or status reason.
- Use cli_session_command_execute to call AWS Backup list-restore-jobs for us-east-1 with the computed time window, handling pagination as needed, and collect all restore jobs created in scope.
- Use cli_session_command_execute to inspect the returned restore job records and filter for any status outside the expected success state, including failed, expired, aborted, completed-with-issues, or other non-success outcomes.
- Use cli_session_command_execute to normalize and record for each non-success restore job: job type, job ID, source recovery point or protected resource identifier, source vault if available, destination vault applicability, destination Region, destination account, intended restore target details, timestamps, and diagnostic message or status reason.
- Use cli_session_command_execute to call AWS Backup list-copy-jobs for us-east-1 with the computed time window, handling pagination as needed, and collect all copy jobs created in scope.
- Use cli_session_command_execute to inspect the returned copy job records and filter for any status outside the expected success state, including failed, expired, aborted, completed-with-issues, or other non-success outcomes.
- Use cli_session_command_execute to normalize and record for each non-success copy job: job type, job ID, source recovery point or protected resource identifier, source vault, destination vault, destination Region, destination account if returned, restore target applicability, timestamps, and diagnostic message or status reason.
- Use cli_session_command_execute to preserve the reviewed counts and the normalized non-success job dataset for use in the final summary task.

**Max Turns**

50

### 2. Summary

#### 1. Summarize AWS Backup backup restore and copy job review results

**Id**

summarize_aws_backup_job_review_results

**Description**

Summarize the AWS Backup backup, restore, and copy job review for the last 30 days in account 025825898506 and region us-east-1, consolidate counts and non-success findings, and clearly state whether any non-success jobs were found or whether all reviewed jobs were successful.

**Completion Criteria**

- Collected the review outputs from the AWS Backup backup, restore, and copy job assessment covering the last 30 days.
- Validated that the summary period matches the assessment window and is stated as the last 30 days.
- Consolidated the counts of reviewed backup jobs, restore jobs, and copy jobs.
- Consolidated the counts of non-success backup jobs, non-success restore jobs, and non-success copy jobs.
- Aggregated all non-success jobs identified across backup, restore, and copy reviews into a single combined result set.
- Produced a clear table of all non-success jobs found across the three job types.
- Included in the non-success jobs table, for each row, the job type.
- Included in the non-success jobs table, for each row, the job ID.
- Included in the non-success jobs table, for each row, the resource ARN or other resource identifier.
- Included in the non-success jobs table, for each row, the source backup vault if applicable.
- Included in the non-success jobs table, for each row, the destination backup vault if applicable.
- Included in the non-success jobs table, for each row, the destination AWS Region if applicable.
- Included in the non-success jobs table, for each row, the destination AWS account if applicable.
- Included in the non-success jobs table, for each row, the restore target details if applicable.
- Included in the non-success jobs table, for each row, the failure message, status reason, or equivalent diagnostic detail.
- Included in the non-success jobs table, for each row, the relevant timestamps preserved during assessment, such as creation, start, and completion times where available.
- Clearly distinguished fields that are not applicable for a given job type instead of leaving their meaning ambiguous.
- Summarized the main failure patterns or recurring causes observed across non-success jobs, if any were present.
- Explicitly stated when no failed or non-success jobs were found across all reviewed backup, restore, and copy jobs.
- If no failed or non-success jobs were found, explicitly stated that all reviewed jobs were successful or had no non-success statuses in scope.
- Produced a final summary that is internally consistent with the detailed findings from the assessment task.

**Execution Plan**

- Use cli_session_command_execute outputs from the assessment task to consolidate reviewed job counts and non-success job counts across backup, restore, and copy job types.
- Use cli_session_command_execute outputs from the assessment task to assemble a combined table of all non-success jobs with the preserved identifying, source or destination, target, timestamp, and diagnostic fields.
- No tool: prepare the final human-readable summary stating the review window, reviewed counts, any non-success jobs found, recurring failure patterns if present, and whether all reviewed jobs were successful when applicable.

**Max Turns**

50
