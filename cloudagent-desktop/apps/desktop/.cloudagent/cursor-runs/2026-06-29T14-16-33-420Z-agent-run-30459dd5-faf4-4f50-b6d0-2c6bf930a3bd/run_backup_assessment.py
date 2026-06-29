#!/usr/bin/env python3
"""AWS Backup assessment - reads creds from session-context or env."""
import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
SESSION_CTX = os.path.join(BASE, "session-context.json")
REGION = "us-east-1"
START = "2026-05-30T00:00:00Z"
END = "2026-06-29T23:59:59Z"
ACCOUNT = "025825898506"
SUCCESS_STATUSES = {"COMPLETED"}


def load_env():
    if os.environ.get("AWS_ACCESS_KEY_ID"):
        return
    with open(SESSION_CTX) as f:
        auth = json.load(f)["executionContext"]["environment"]["authProfile"]
    os.environ["AWS_ACCESS_KEY_ID"] = auth["accessKeyId"]
    os.environ["AWS_SECRET_ACCESS_KEY"] = auth["secretAccessKey"]
    os.environ["AWS_SESSION_TOKEN"] = auth["sessionToken"]
    os.environ["AWS_DEFAULT_REGION"] = auth.get("region", REGION)
    os.environ["AWS_REGION"] = auth.get("region", REGION)


def aws_json(args):
    cmd = ["aws"] + args + ["--output", "json"]
    r = subprocess.run(cmd, capture_output=True, text=True, env=os.environ)
    if r.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{r.stderr}")
    return json.loads(r.stdout) if r.stdout.strip() else {}


def paginate(service_cmd, list_key, extra_args):
    all_items = []
    next_token = None
    pages = 0
    while True:
        args = list(service_cmd) + list(extra_args)
        if next_token:
            args += ["--next-token", next_token]
        data = aws_json(args)
        all_items.extend(data.get(list_key, []))
        pages += 1
        next_token = data.get("NextToken")
        if not next_token:
            break
    return all_items, pages


def is_non_success(status):
    return status not in SUCCESS_STATUSES


def backup_detail(job):
    state = job.get("State")
    return {
        "jobType": "backup",
        "jobId": job.get("BackupJobId"),
        "status": state,
        "state": state,
        "statusMessage": job.get("StatusMessage"),
        "messageCategory": job.get("MessageCategory"),
        "creationDate": job.get("CreationDate"),
        "startTime": job.get("StartBy"),
        "completionDate": job.get("CompletionDate"),
        "resourceArn": job.get("ResourceArn"),
        "recoveryPointArn": job.get("RecoveryPointArn"),
        "sourceBackupVaultName": job.get("BackupVaultName"),
        "destinationBackupVaultName": None,
        "destinationRegion": None,
        "destinationAccountId": None,
        "restoreTargetDetails": "not_applicable",
        "failureMessage": job.get("StatusMessage") or job.get("MessageCategory") or (f"State: {state}" if is_non_success(state) else None),
        "percentDone": job.get("PercentDone"),
        "resourceType": job.get("ResourceType"),
        "iamRoleArn": job.get("IamRoleArn"),
        "createdBy": job.get("CreatedBy"),
    }


def restore_detail(job):
    status = job.get("Status")
    return {
        "jobType": "restore",
        "jobId": job.get("RestoreJobId"),
        "status": status,
        "state": status,
        "statusMessage": job.get("StatusMessage"),
        "creationDate": job.get("CreationDate"),
        "startTime": job.get("CreationDate"),
        "completionDate": job.get("CompletionDate"),
        "resourceArn": job.get("RecoveryPointArn") or job.get("CreatedResourceArn"),
        "recoveryPointArn": job.get("RecoveryPointArn"),
        "sourceBackupVaultName": None,
        "destinationBackupVaultName": None,
        "destinationRegion": job.get("DestinationRegion"),
        "destinationAccountId": None,
        "restoreTargetDetails": {
            "createdResourceArn": job.get("CreatedResourceArn"),
            "resourceType": job.get("ResourceType"),
            "validationStatus": job.get("ValidationStatus"),
            "percentDone": job.get("PercentDone"),
        },
        "failureMessage": job.get("StatusMessage") or (f"Status: {status}" if is_non_success(status) else None),
        "iamRoleArn": job.get("IamRoleArn"),
        "percentDone": job.get("PercentDone"),
    }


def copy_detail(job):
    state = job.get("State") or job.get("Status")
    return {
        "jobType": "copy",
        "jobId": job.get("CopyJobId"),
        "status": state,
        "state": job.get("State"),
        "statusMessage": job.get("Message"),
        "messageCategory": job.get("MessageCategory"),
        "creationDate": job.get("CreationDate"),
        "startTime": job.get("StartBy"),
        "completionDate": job.get("CompletionDate"),
        "resourceArn": job.get("ResourceArn"),
        "recoveryPointArn": job.get("SourceRecoveryPointArn"),
        "sourceBackupVaultName": job.get("SourceBackupVaultName"),
        "destinationBackupVaultName": job.get("DestinationBackupVaultArn") or job.get("DestinationBackupVaultName"),
        "destinationRegion": job.get("DestinationRegion"),
        "destinationAccountId": job.get("DestinationAccountId"),
        "restoreTargetDetails": "not_applicable",
        "failureMessage": job.get("Message") or job.get("MessageCategory") or (f"State: {state}" if is_non_success(state) else None),
        "iamRoleArn": job.get("IamRoleArn"),
    }


def analyze(jobs, status_fn, detail_fn):
    breakdown = Counter(status_fn(j) or "UNKNOWN" for j in jobs)
    non_success = [detail_fn(j) for j in jobs if is_non_success(status_fn(j))]
    return breakdown, non_success


def main():
    load_env()
    identity = aws_json(["sts", "get-caller-identity"])
    time_args = ["--region", REGION, "--by-created-after", START, "--by-created-before", END]

    backup_jobs, backup_pages = paginate(["backup", "list-backup-jobs"], "BackupJobs", time_args)
    restore_jobs, restore_pages = paginate(["backup", "list-restore-jobs"], "RestoreJobs", time_args)
    copy_jobs, copy_pages = paginate(["backup", "list-copy-jobs"], "CopyJobs", time_args)

    b_breakdown, b_non = analyze(backup_jobs, lambda j: j.get("State"), backup_detail)
    r_breakdown, r_non = analyze(restore_jobs, lambda j: j.get("Status"), restore_detail)
    c_breakdown, c_non = analyze(copy_jobs, lambda j: j.get("State") or j.get("Status"), copy_detail)

    result = {
        "assessment": {
            "accountId": ACCOUNT,
            "region": REGION,
            "reviewWindow": {"start": START, "end": END},
            "assessedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "callerIdentity": identity,
        },
        "backupJobs": {
            "totalCount": len(backup_jobs),
            "pagesFetched": backup_pages,
            "statusBreakdown": dict(b_breakdown),
            "nonSuccessCount": len(b_non),
            "successCount": len(backup_jobs) - len(b_non),
            "nonSuccessJobs": b_non,
        },
        "restoreJobs": {
            "totalCount": len(restore_jobs),
            "pagesFetched": restore_pages,
            "statusBreakdown": dict(r_breakdown),
            "nonSuccessCount": len(r_non),
            "successCount": len(restore_jobs) - len(r_non),
            "nonSuccessJobs": r_non,
        },
        "copyJobs": {
            "totalCount": len(copy_jobs),
            "pagesFetched": copy_pages,
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
        "rawJobCounts": {
            "backupJobs": len(backup_jobs),
            "restoreJobs": len(restore_jobs),
            "copyJobs": len(copy_jobs),
        },
    }

    out_path = os.path.join(BASE, "aws-backup-assessment.json")
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2, default=str)
    json.dump(result, sys.stdout, indent=2, default=str)
    print(file=sys.stdout)


if __name__ == "__main__":
    main()
