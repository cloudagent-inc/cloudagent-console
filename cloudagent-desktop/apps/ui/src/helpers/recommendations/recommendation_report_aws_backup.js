import {
  THIRTY_DAYS_MS,
  safeParseJson,
  normalizePermissionProfiles,
  normalizeAccountScans,
} from './utils';

const RULE_ID = 'backup_status_report';
const BACKUP_REPORT_ID = 'report_aws_backup';

const deriveAccountId = (value) => {
  if (!value) {
    return null;
  }

  const parsed = safeParseJson(value);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return (
    parsed.awsAccountId ||
    parsed.accountId ||
    parsed.AwsAccountId ||
    parsed.AWSAccountId ||
    null
  );
};

const mapMissingProfilesToTargets = (profiles) =>
  profiles.map((profile) => {
    const displayName =
      profile.name ||
      (profile.accountId ? `Account ${profile.accountId}` : 'AWS Account');

    return {
      type: 'permission_profile',
      resourceType: 'aws_account',
      accountId: profile.accountId,
      permissionProfileId: profile.recordId || null,
      permissionProfileName: profile.name || null,
      displayName,
      resourceId: profile.accountId || profile.recordId || null,
      status: 'missing_recent_report',
      cloudProvider: 'platform',
    };
  });

const createReason = (missingProfiles) => {
  if (!missingProfiles.length) {
    return 'No Backup Status report has run in the past 30 days.';
  }

  const accountList = [
    ...new Set(missingProfiles.map((profile) => profile.accountId)),
  ]
    .filter(Boolean)
    .sort();

  if (!accountList.length) {
    return 'No Backup Status report has run in the past 30 days for your connected environments.';
  }

  if (accountList.length === 1) {
    return `No Backup Status report has run in the past 30 days for account ${accountList[0]}.`;
  }

  if (accountList.length === 2) {
    return `No Backup Status report has run in the past 30 days for accounts ${accountList[0]} and ${accountList[1]}.`;
  }

  const allButLast = accountList.slice(0, -1).join(', ');
  const last = accountList[accountList.length - 1];

  return `No Backup Status report has run in the past 30 days for accounts ${allButLast}, and ${last}.`;
};

const createBackupStatusRecommendation = ({ now, missingProfiles }) => {
  const evaluatedAt = now.toISOString();
  const reason = createReason(missingProfiles);
  const targetResources = mapMissingProfilesToTargets(missingProfiles);

  return {
    recommendationId: 'local_rule.backup_status_report',
    id: 'local_rule.backup_status_report',
    ruleId: RULE_ID,
    title: 'Run Backup Status Report',
    status: 'open',
    priority: 75,
    metadata: {
      priority: 75,
      domain: 'Operations & Reliability',
      category: 'Backup & Recovery',
      ruleId: RULE_ID,
      generatedBy: 'local_rule_engine',
      evaluatedAt,
      accountsWithoutRecentReport: [
        ...new Set(missingProfiles.map((profile) => profile.accountId)),
      ].filter(Boolean),
      permissionProfileIds: missingProfiles
        .map((profile) => profile.recordId)
        .filter(Boolean),
    },
    source: [
      {
        type: 'local_rule',
        ruleId: RULE_ID,
        label: 'Local recommendation rule',
        evaluatedAt,
        reason,
      },
    ],
    recommendedAction: {
      type: 'report',
      reportId: BACKUP_REPORT_ID,
      label: 'Run Backup Status Report',
      sourceBlueprintId: BACKUP_REPORT_ID,
    },
    action: {
      type: 'report',
      reportId: BACKUP_REPORT_ID,
    },
    targetResources,
    notes:
      'Review backup coverage across AWS resources to confirm protection and address gaps.',
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
  };
};

export const evaluateBackupStatusReportRule = (
  userProfile,
  now = new Date()
) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  const accountScans = normalizeAccountScans(userProfile);
  const permissionProfiles = normalizePermissionProfiles(userProfile);

  // Don't make recommendations if there are no cloud environments (permission profiles)
  if (!permissionProfiles || permissionProfiles.length === 0) {
    return [];
  }

  const cutoffTime = now.getTime() - THIRTY_DAYS_MS;
  const accountsWithRecentReport = new Set();
  let hasAnyRecentReport = false;

  // Check accountScans for recent reports (reports are now stored in accountScans, not agentHistory)
  accountScans.forEach((scan) => {
    // Only process scans that are reports matching the backup status report ID
    if (!scan.reportId || scan.reportId !== BACKUP_REPORT_ID) {
      return;
    }

    // Skip failed scans
    if (scan.status === 'FAILED' || scan.status === 'failed') {
      return;
    }

    // Use lastUpdateTime or latestAssessmentDate as the report date
    const reportDate = new Date(scan.lastUpdateTime || scan.latestAssessmentDate);
    if (Number.isNaN(reportDate.getTime())) {
      return;
    }

    if (reportDate.getTime() < cutoffTime) {
      return;
    }

    hasAnyRecentReport = true;

    // Get accountId from scan
    const accountId = scan.accountId || null;

    if (accountId) {
      accountsWithRecentReport.add(String(accountId));
    }
  });

  const missingProfiles = permissionProfiles.reduce((acc, profile) => {
    const parsedAuthProfile = safeParseJson(profile.authProfile);
    const authProfileAccountId = deriveAccountId(parsedAuthProfile);
    if (!authProfileAccountId) {
      return acc;
    }

    const accountKey = String(authProfileAccountId);
    if (accountsWithRecentReport.has(accountKey)) {
      return acc;
    }

    acc.push({
      accountId: accountKey,
      recordId: profile.recordId || profile.id || null,
      name:
        profile.name ||
        profile.profileName ||
        (parsedAuthProfile && typeof parsedAuthProfile === 'object'
          ? parsedAuthProfile.authProfileName || parsedAuthProfile.name
          : null) ||
        null,
    });

    return acc;
  }, []);

  // Recommend if:
  // 1. There are profiles without recent reports, OR
  // 2. No recent reports have been run at all (covers case where profiles exist but accountIds couldn't be extracted)
  const shouldRecommend =
    missingProfiles.length > 0 || !hasAnyRecentReport;

  if (!shouldRecommend) {
    return [];
  }

  return [
    createBackupStatusRecommendation({
      now,
      missingProfiles,
    }),
  ];
};

export const backupStatusReportRuleId = RULE_ID;
