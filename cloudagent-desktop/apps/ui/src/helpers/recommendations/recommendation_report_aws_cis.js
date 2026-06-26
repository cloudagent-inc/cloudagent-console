import {
  THREE_MONTHS_MS,
  safeParseJson,
  normalizePermissionProfiles,
  normalizeAccountScans,
} from './utils';

const RULE_ID = 'cis_report';
const CIS_REPORT_ID = 'report_compliance_aws_cis_v3_0_0';
const CIS_REPORT_ID_PATTERN = 'compliance_aws_cis_v3_0_0';

/**
 * Checks if a reportId matches the CIS report pattern
 * Handles different formats like "report_compliance_aws_cis_v3_0_0" or "compliance_aws_cis_v3_0_0_0"
 */
const isCisReport = (reportId) => {
  if (!reportId || typeof reportId !== 'string') {
    return false;
  }
  // Check if reportId contains the CIS pattern (case-insensitive)
  return reportId.toLowerCase().includes(CIS_REPORT_ID_PATTERN.toLowerCase());
};

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
    return 'No CIS Benchmarks report has run in the past 90 days.';
  }

  const accountList = [
    ...new Set(missingProfiles.map((profile) => profile.accountId)),
  ]
    .filter(Boolean)
    .sort();

  if (!accountList.length) {
    return 'No CIS Benchmarks report has run in the past 90 days for your connected environments.';
  }

  if (accountList.length === 1) {
    return `No CIS Benchmarks report has run in the past 90 days for account ${accountList[0]}.`;
  }

  if (accountList.length === 2) {
    return `No CIS Benchmarks report has run in the past 90 days for accounts ${accountList[0]} and ${accountList[1]}.`;
  }

  const allButLast = accountList.slice(0, -1).join(', ');
  const last = accountList[accountList.length - 1];

  return `No CIS Benchmarks report has run in the past 90 days for accounts ${allButLast}, and ${last}.`;
};

const createCisReportRecommendation = ({ now, missingProfiles }) => {
  const evaluatedAt = now.toISOString();
  const reason = createReason(missingProfiles);
  const targetResources = mapMissingProfilesToTargets(missingProfiles);

  return {
    recommendationId: 'local_rule.cis_report',
    id: 'local_rule.cis_report',
    ruleId: RULE_ID,
    title: 'Run CIS Benchmarks Report',
    status: 'open',
    priority: 85,
    metadata: {
      priority: 85,
      domain: 'Security',
      category: 'Compliance',
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
      reportId: CIS_REPORT_ID,
      label: 'Run CIS Benchmarks Report',
      sourceBlueprintId: CIS_REPORT_ID,
    },
    action: {
      type: 'report',
      reportId: CIS_REPORT_ID,
    },
    targetResources,
    notes:
      'Refresh your compliance baseline by running the AWS CIS v3.0 report. This updates your security posture with the latest findings.',
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
  };
};

export const evaluateCisReportRule = (userProfile, now = new Date()) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  const accountScans = normalizeAccountScans(userProfile);
  const permissionProfiles = normalizePermissionProfiles(userProfile);

  // Don't make recommendations if there are no cloud environments (permission profiles)
  if (!permissionProfiles || permissionProfiles.length === 0) {
    return [];
  }

  const cutoffTime = now.getTime() - THREE_MONTHS_MS;
  const accountsWithRecentReport = new Set();
  let hasAnyRecentReport = false;

  // Check accountScans for recent reports (reports are now stored in accountScans, not agentHistory)
  accountScans.forEach((scan) => {
    // Only process scans that are reports matching the CIS report pattern
    if (!scan.reportId || !isCisReport(scan.reportId)) {
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
    createCisReportRecommendation({
      now,
      missingProfiles,
    }),
  ];
};

export const cisReportRuleId = RULE_ID;
