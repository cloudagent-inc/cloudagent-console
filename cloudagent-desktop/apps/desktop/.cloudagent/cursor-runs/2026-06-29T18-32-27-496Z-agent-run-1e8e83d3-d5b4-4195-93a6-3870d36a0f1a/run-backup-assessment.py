#!/usr/bin/env python3
"""Fetch AWS Backup jobs via CloudAgent MCP and analyze non-success statuses."""
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone

MCP_URL = "http://127.0.0.1:62706/mcp"
ACCOUNT_ID = "025825898506"
PERMISSION_PROFILE_ID = "profile-8b000c93-6acb-4492-b87f-138db43b6c7e"
REGION = "us-east-1"
REVIEW_START = "2026-05-30T18:32:36Z"
REVIEW_END = "2026-06-29T18:32:36Z"
CREATED_AFTER = "2026-05-30"
CREATED_BEFORE = "2026-06-30"
SUCCESS_STATUSES = {"COMPLETED"}


def mcp_session():
    init = subprocess.run(
        [
            "curl", "-s", "-i", "-X", "POST", MCP_URL,
            "-H", "Content-Type: application/json",
            "-H", "Accept: application/json, text/event-stream",
            "-d", json.dumps({
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "cursor-agent", "version": "1.0"},
                },
            }),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    session_id = None
    for line in init.stdout.splitlines():
        if line.lower().startswith("mcp-session-id:"):
            session_id = line.split(":", 1)[1].strip()
            break
    if not session_id:
        raise RuntimeError("Failed to obtain MCP session ID")
    subprocess.run(
        [
            "curl", "-s", "-X", "POST", MCP_URL,
            "-H", "Content-Type: application/json",
            "-H", "Accept: application/json, text/event-stream",
            "-H", f"Mcp-Session-Id: {session_id}",
            "-d", json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}),
        ],
        capture_output=True,
        check=True,
    )
    return session_id


def aws_cli(session_id, command):
    result = subprocess.run(
        [
            "curl", "-s", "-X", "POST", MCP_URL,
            "-H", "Content-Type: application/json",
            "-H", "Accept: application/json, text/event-stream",
            "-H", f"Mcp-Session-Id: {session_id}",
            "-d", json.dumps({
                "jsonrpc": "2.0", "id": 2, "method": "tools/call",
                "params": {
                    "name": "aws_cli_readonly",
                    "arguments": {
                        "command": command,
                        "accountId": ACCOUNT_ID,
                        "permissionProfileId": PERMISSION_PROFILE_ID,
                    },
                },
            }),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    if "error" in payload:
        raise RuntimeError(payload["error"])
    structured = payload["result"].get("structuredContent") or json.loads(payload["result"]["content"][0]["text"])
    if not structured.get("ok"):
        raise RuntimeError(f"Command failed: {command}\n{structured.get('stderr', '')}")
    return json.loads(structured["stdout"]) if structured["stdout"].strip() else {}


def paginate_list(session_id, list_cmd_prefix, result_key, max_results=50):
    all_items = []
    next_token = None
    while True:
        cmd = f"{list_cmd_prefix} --max-results {max_results}"
        if next_token:
            cmd += f" --next-token {json.dumps(next_token)}"
        cmd += " --output json"
        data = aws_cli(session_id, cmd)
        items = data.get(result_key, [])
        all_items.extend(items)
        next_token = data.get("NextToken")
        if not next_token:
            break
    return all_items


def in_review_window(creation_date):
    if not creation_date:
        return False
    dt = datetime.fromisoformat(creation_date.replace("Z", "+00:00"))
    start = datetime.fromisoformat(REVIEW_START.replace("Z", "+00:00"))
    end = datetime.fromisoformat(REVIEW_END.replace("Z", "+00:00"))
    return start <= dt <= end


def normalize_backup_job(job):
    return {
        "job_type": "backup",
        "job_id": job.get("BackupJobId"),
        "status": job.get("State") or job.get("Status"),
        "resource_arn": job.get("ResourceArn"),
        "source_vault": job.get("BackupVaultName"),
        "destination_vault": "N/A (backup jobs have no destination vault)",
        "destination_region": "N/A",
        "destination_account": "N/A",
        "restore_target_details": "N/A (does not apply to backup jobs)",
        "failure_message": job.get("StatusMessage") or job.get("Message") or "",
        "creation_date": job.get("CreationDate"),
        "start_time": job.get("StartBy") or job.get("StartTime"),
        "completion_date": job.get("CompletionDate"),
    }


def normalize_restore_job(job):
    metadata = job.get("CreatedBy") or {}
    restore_metadata = job.get("RestoreMetadata") or {}
    return {
        "job_type": "restore",
        "job_id": job.get("RestoreJobId"),
        "status": job.get("Status"),
        "resource_arn": job.get("ResourceType") and job.get("CreatedResourceArn") or job.get("RecoveryPointArn") or job.get("CreatedResourceArn"),
        "source_vault": metadata.get("BackupVaultName") or job.get("RecoveryPointArn", "").split(":backup-vault:")[-1].split("/")[0] if job.get("RecoveryPointArn") else None,
        "destination_vault": "N/A (restore jobs do not use destination vault)",
        "destination_region": job.get("DestinationRecoveryPointArn", "").split(":")[3] if job.get("DestinationRecoveryPointArn") else restore_metadata.get("destinationRegion") or "Not returned",
        "destination_account": job.get("AccountId") or "Not returned",
        "restore_target_details": json.dumps({
            "ResourceType": job.get("ResourceType"),
            "CreatedResourceArn": job.get("CreatedResourceArn"),
            "RecoveryPointArn": job.get("RecoveryPointArn"),
            "RestoreMetadata": restore_metadata,
        }) if any([job.get("ResourceType"), job.get("CreatedResourceArn"), restore_metadata]) else "Not returned",
        "failure_message": job.get("StatusMessage") or job.get("Message") or "",
        "creation_date": job.get("CreationDate"),
        "start_time": job.get("StartTime") or job.get("StartBy"),
        "completion_date": job.get("CompletionDate"),
    }


def normalize_copy_job(job):
    return {
        "job_type": "copy",
        "job_id": job.get("CopyJobId"),
        "status": job.get("State") or job.get("Status"),
        "resource_arn": job.get("ResourceArn") or job.get("SourceRecoveryPointArn"),
        "source_vault": job.get("SourceBackupVaultName"),
        "destination_vault": job.get("DestinationBackupVaultName"),
        "destination_region": job.get("DestinationBackupVaultArn", "").split(":")[3] if job.get("DestinationBackupVaultArn") else job.get("DestinationBackupVaultArn"),
        "destination_account": (job.get("DestinationBackupVaultArn") or "").split(":")[4] if job.get("DestinationBackupVaultArn") else "Not returned",
        "restore_target_details": "N/A (does not apply to copy jobs)",
        "failure_message": job.get("StatusMessage") or job.get("Message") or "",
        "creation_date": job.get("CreationDate"),
        "start_time": job.get("StartTime") or job.get("StartBy"),
        "completion_date": job.get("CompletionDate"),
    }


def main():
    session_id = mcp_session()
    caller = aws_cli(session_id, "aws sts get-caller-identity --output json")

    backup_jobs = paginate_list(
        session_id,
        f"aws backup list-backup-jobs --region {REGION} --by-created-after {CREATED_AFTER} --by-created-before {CREATED_BEFORE}",
        "BackupJobs",
    )
    restore_jobs = paginate_list(
        session_id,
        f"aws backup list-restore-jobs --region {REGION} --by-created-after {CREATED_AFTER} --by-created-before {CREATED_BEFORE}",
        "RestoreJobs",
    )
    copy_jobs = paginate_list(
        session_id,
        f"aws backup list-copy-jobs --region {REGION} --by-created-after {CREATED_AFTER} --by-created-before {CREATED_BEFORE}",
        "CopyJobs",
    )

    backup_in_window = [j for j in backup_jobs if in_review_window(j.get("CreationDate"))]
    restore_in_window = [j for j in restore_jobs if in_review_window(j.get("CreationDate"))]
    copy_in_window = [j for j in copy_jobs if in_review_window(j.get("CreationDate"))]

    def non_success(jobs, status_key="State"):
        out = []
        for j in jobs:
            status = j.get(status_key) or j.get("Status") or j.get("State")
            if status not in SUCCESS_STATUSES:
                out.append(j)
        return out

    ns_backup = non_success(backup_in_window)
    ns_restore = non_success(restore_in_window, "Status")
    ns_copy = non_success(copy_in_window)

    result = {
        "caller_identity": caller,
        "review_window": {
            "start": REVIEW_START,
            "end": REVIEW_END,
            "account_id": ACCOUNT_ID,
            "region": REGION,
        },
        "counts": {
            "backup_jobs_reviewed": len(backup_in_window),
            "restore_jobs_reviewed": len(restore_in_window),
            "copy_jobs_reviewed": len(copy_in_window),
            "non_success_backup_jobs": len(ns_backup),
            "non_success_restore_jobs": len(ns_restore),
            "non_success_copy_jobs": len(ns_copy),
        },
        "status_counts": {
            "backup": dict(Counter((j.get("State") or j.get("Status") or "UNKNOWN") for j in backup_in_window)),
            "restore": dict(Counter((j.get("Status") or "UNKNOWN") for j in restore_in_window)),
            "copy": dict(Counter((j.get("State") or j.get("Status") or "UNKNOWN") for j in copy_in_window)),
        },
        "non_success_jobs": (
            [normalize_backup_job(j) for j in ns_backup]
            + [normalize_restore_job(j) for j in ns_restore]
            + [normalize_copy_job(j) for j in ns_copy]
        ),
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
