#!/usr/bin/env python3
"""AWS Backup assessment via CloudAgent MCP aws_cli_readonly."""
import json
import urllib.request
from collections import Counter
from datetime import datetime, timezone, timedelta

MCP_URL = "http://127.0.0.1:65422/mcp"
PROFILE = "profile-8b000c93-6acb-4492-b87f-138db43b6c7e"
ACCOUNT = "025825898506"
REGION = "us-east-1"
END = datetime(2026, 6, 29, 15, 45, 42, tzinfo=timezone.utc)
START = END - timedelta(days=30)
START_STR = START.strftime("%Y-%m-%dT%H:%M:%SZ")
END_STR = END.strftime("%Y-%m-%dT%H:%M:%SZ")
SUCCESS_STATUSES = {"COMPLETED"}


def mcp_init():
    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "backup-assessment", "version": "1.0"},
            },
        }).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "X-CloudAgent-Client": "local-mcp",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        sid = resp.headers.get("Mcp-Session-Id")
        resp.read()
    notify = urllib.request.Request(
        MCP_URL,
        data=json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": sid,
            "X-CloudAgent-Client": "local-mcp",
        },
        method="POST",
    )
    with urllib.request.urlopen(notify) as resp:
        resp.read()
    return sid


def aws_cli(session_id, command):
    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps({
            "jsonrpc": "2.0", "id": 2, "method": "tools/call",
            "params": {
                "name": "aws_cli_readonly",
                "arguments": {
                    "command": command,
                    "accountId": ACCOUNT,
                    "permissionProfileId": PROFILE,
                },
            },
        }).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": session_id,
            "X-CloudAgent-Client": "local-mcp",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read())
    text = body["result"]["content"][0]["text"]
    data = json.loads(text)
    if not data.get("ok"):
        raise RuntimeError(f"AWS CLI failed: {command}\n{data.get('stderr', data)}")
    out = data.get("stdout", "").strip()
    return json.loads(out) if out else {}


def paginate(session_id, service, list_key):
    items = []
    token = None
    pages = 0
    while True:
        cmd = (
            f"aws backup {service} --region {REGION} "
            f"--by-created-after {START_STR} --by-created-before {END_STR} "
            f"--max-results 50 --output json"
        )
        if token:
            cmd += f" --next-token {token}"
        data = aws_cli(session_id, cmd)
        items.extend(data.get(list_key, []))
        pages += 1
        token = data.get("NextToken")
        if not token:
            break
    return items, pages


def is_non_success(status):
    return status not in SUCCESS_STATUSES


def backup_detail(job):
    state = job.get("State")
    return {
        "jobType": "backup",
        "jobId": job.get("BackupJobId"),
        "status": state,
        "creationDate": job.get("CreationDate"),
        "startTime": job.get("StartBy"),
        "completionDate": job.get("CompletionDate"),
        "resourceArn": job.get("ResourceArn"),
        "recoveryPointArn": job.get("RecoveryPointArn"),
        "sourceBackupVaultName": job.get("BackupVaultName"),
        "destinationBackupVaultName": "N/A (backup jobs)",
        "destinationRegion": "N/A (backup jobs)",
        "destinationAccountId": "N/A (backup jobs)",
        "restoreTargetDetails": "N/A (backup jobs)",
        "failureMessage": job.get("StatusMessage") or job.get("MessageCategory") or (f"State: {state}" if is_non_success(state) else None),
        "resourceType": job.get("ResourceType"),
    }


def restore_detail(job):
    status = job.get("Status")
    return {
        "jobType": "restore",
        "jobId": job.get("RestoreJobId"),
        "status": status,
        "creationDate": job.get("CreationDate"),
        "startTime": job.get("CreationDate"),
        "completionDate": job.get("CompletionDate"),
        "resourceArn": job.get("RecoveryPointArn") or job.get("CreatedResourceArn"),
        "recoveryPointArn": job.get("RecoveryPointArn"),
        "sourceBackupVaultName": "Not returned by list-restore-jobs",
        "destinationBackupVaultName": "N/A (restore jobs)",
        "destinationRegion": job.get("DestinationRegion") or "Not returned",
        "destinationAccountId": "Not returned",
        "restoreTargetDetails": {
            "createdResourceArn": job.get("CreatedResourceArn"),
            "resourceType": job.get("ResourceType"),
            "validationStatus": job.get("ValidationStatus"),
            "percentDone": job.get("PercentDone"),
        },
        "failureMessage": job.get("StatusMessage") or (f"Status: {status}" if is_non_success(status) else None),
    }


def copy_detail(job):
    state = job.get("State") or job.get("Status")
    return {
        "jobType": "copy",
        "jobId": job.get("CopyJobId"),
        "status": state,
        "creationDate": job.get("CreationDate"),
        "startTime": job.get("StartBy"),
        "completionDate": job.get("CompletionDate"),
        "resourceArn": job.get("ResourceArn"),
        "recoveryPointArn": job.get("SourceRecoveryPointArn"),
        "sourceBackupVaultName": job.get("SourceBackupVaultName"),
        "destinationBackupVaultName": job.get("DestinationBackupVaultArn") or job.get("DestinationBackupVaultName"),
        "destinationRegion": job.get("DestinationRegion"),
        "destinationAccountId": job.get("DestinationAccountId") or "Not returned",
        "restoreTargetDetails": "N/A (copy jobs)",
        "failureMessage": job.get("Message") or job.get("MessageCategory") or (f"State: {state}" if is_non_success(state) else None),
    }


def analyze(jobs, status_fn, detail_fn):
    breakdown = Counter(status_fn(j) or "UNKNOWN" for j in jobs)
    non_success = [detail_fn(j) for j in jobs if is_non_success(status_fn(j))]
    return breakdown, non_success


def main():
    sid = mcp_init()
    identity = aws_cli(sid, "aws sts get-caller-identity --output json")
    backup_jobs, bp = paginate(sid, "list-backup-jobs", "BackupJobs")
    restore_jobs, rp = paginate(sid, "list-restore-jobs", "RestoreJobs")
    copy_jobs, cp = paginate(sid, "list-copy-jobs", "CopyJobs")

    b_breakdown, b_non = analyze(backup_jobs, lambda j: j.get("State"), backup_detail)
    r_breakdown, r_non = analyze(restore_jobs, lambda j: j.get("Status"), restore_detail)
    c_breakdown, c_non = analyze(copy_jobs, lambda j: j.get("State") or j.get("Status"), copy_detail)

    result = {
        "assessment": {
            "accountId": ACCOUNT,
            "region": REGION,
            "permissionProfileId": PROFILE,
            "reviewWindow": {"start": START_STR, "end": END_STR},
            "assessedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "callerIdentity": identity,
        },
        "backupJobs": {
            "totalCount": len(backup_jobs),
            "pagesFetched": bp,
            "statusBreakdown": dict(b_breakdown),
            "nonSuccessCount": len(b_non),
            "successCount": len(backup_jobs) - len(b_non),
            "nonSuccessJobs": b_non,
        },
        "restoreJobs": {
            "totalCount": len(restore_jobs),
            "pagesFetched": rp,
            "statusBreakdown": dict(r_breakdown),
            "nonSuccessCount": len(r_non),
            "successCount": len(restore_jobs) - len(r_non),
            "nonSuccessJobs": r_non,
        },
        "copyJobs": {
            "totalCount": len(copy_jobs),
            "pagesFetched": cp,
            "statusBreakdown": dict(c_breakdown),
            "nonSuccessCount": len(c_non),
            "successCount": len(copy_jobs) - len(c_non),
            "nonSuccessJobs": c_non,
        },
        "summary": {
            "totalJobsReviewed": len(backup_jobs) + len(restore_jobs) + len(copy_jobs),
            "totalNonSuccessJobs": len(b_non) + len(r_non) + len(c_non),
            "allJobsSuccessful": not (b_non or r_non or c_non),
            "nonSuccessByType": {"backup": len(b_non), "restore": len(r_non), "copy": len(c_non)},
        },
    }

    out = "/Users/abdul/dev/cloudagent/cloudagent-desktop/apps/desktop/.cloudagent/cursor-runs/2026-06-29T15-45-42-077Z-agent-run-e98868f9-cb8c-4a45-b75a-a1c736f089ec/aws-backup-assessment.json"
    with open(out, "w") as f:
        json.dump(result, f, indent=2, default=str)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
