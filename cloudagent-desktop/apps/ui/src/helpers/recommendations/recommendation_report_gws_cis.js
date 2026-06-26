import {
  THREE_MONTHS_MS,
  safeParseJson,
  normalizePermissionProfiles,
  normalizeAccountScans,
} from './utils';

const RULE_ID = 'gws_cis_report';
const GWS_CIS_REPORT_ID = 'report_compliance_gws_cis_v1_2';
const GWS_CIS_REPORT_ID_PATTERN = 'compliance_gws_cis_v1_2';

/**
 * Checks if a reportId matches the Google Workspace CIS report pattern
 * Handles different formats like "report_compliance_gws_cis_v1_2" or "compliance_gws_cis_v1_2"
 */
const isGwsCisReport = (reportId) => {
  if (!reportId || typeof reportId !== 'string') {
    return false;
  }
  // Check if reportId contains the GWS CIS pattern (case-insensitive)
  return reportId.toLowerCase().includes(GWS_CIS_REPORT_ID_PATTERN.toLowerCase());
};

/**
 * Checks if a scan or profile is for Google Workspace
 */
const isGoogleWorkspace = (item) => {
  if (!item) {
    return false;
  }
  const cloudProvider = item.cloudProvider?.toLowerCase();
  return cloudProvider === 'google_workspace' || cloudProvider === 'gws';
};

const deriveDomain = (value) => {
  if (!value) {
    return null;
  }

  const parsed = safeParseJson(value);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return (
    parsed.domain ||
    parsed.workspaceDomain ||
    parsed.googleWorkspaceDomain ||
    null
  );
};

const mapMissingProfilesToTargets = (profiles) =>
  profiles.map((profile) => {
    const displayName =
      profile.name ||
      (profile.domain ? `Google Workspace: ${profile.domain}` : 'Google Workspace');

    return {
      type: 'permission_profile',
      resourceType: 'google_workspace',
      domain: profile.domain,
      permissionProfileId: profile.recordId || null,
      permissionProfileName: profile.name || null,
      displayName,
      resourceId: profile.domain || profile.recordId || null,
      status: 'missing_recent_report',
      cloudProvider: 'platform',
    };
  });

const createReason = (missingProfiles) => {
  if (!missingProfiles.length) {
    return 'No Google Workspace CIS Benchmarks report has run in the past 90 days.';
  }

  const domainList = [
    ...new Set(missingProfiles.map((profile) => profile.domain)),
  ]
    .filter(Boolean)
    .sort();

  if (!domainList.length) {
    return 'No Google Workspace CIS Benchmarks report has run in the past 90 days for your connected environments.';
  }

  if (domainList.length === 1) {
    return `No Google Workspace CIS Benchmarks report has run in the past 90 days for domain ${domainList[0]}.`;
  }

  if (domainList.length === 2) {
    return `No Google Workspace CIS Benchmarks report has run in the past 90 days for domains ${domainList[0]} and ${domainList[1]}.`;
  }

  const allButLast = domainList.slice(0, -1).join(', ');
  const last = domainList[domainList.length - 1];

  return `No Google Workspace CIS Benchmarks report has run in the past 90 days for domains ${allButLast}, and ${last}.`;
};

const createGwsCisReportRecommendation = ({ now, missingProfiles }) => {
  const evaluatedAt = now.toISOString();
  const reason = createReason(missingProfiles);
  const targetResources = mapMissingProfilesToTargets(missingProfiles);

  return {
    recommendationId: 'local_rule.gws_cis_report',
    id: 'local_rule.gws_cis_report',
    ruleId: RULE_ID,
    title: 'Run Google Workspace CIS Benchmarks Report',
    status: 'open',
    priority: 85,
    metadata: {
      priority: 85,
      domain: 'Security',
      category: 'Compliance',
      ruleId: RULE_ID,
      generatedBy: 'local_rule_engine',
      evaluatedAt,
      domainsWithoutRecentReport: [
        ...new Set(missingProfiles.map((profile) => profile.domain)),
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
      reportId: GWS_CIS_REPORT_ID,
      label: 'Run Google Workspace CIS Benchmarks Report',
      sourceBlueprintId: GWS_CIS_REPORT_ID,
    },
    action: {
      type: 'report',
      reportId: GWS_CIS_REPORT_ID,
    },
    targetResources,
    notes:
      'Refresh your compliance baseline by running the Google Workspace CIS v1.2 report. This updates your security posture with the latest findings.',
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
  };
};

export const evaluateGwsCisReportRule = (userProfile, now = new Date()) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  const accountScans = normalizeAccountScans(userProfile);
  const permissionProfiles = normalizePermissionProfiles(userProfile);

  // Filter to only Google Workspace profiles
  const gwsProfiles = permissionProfiles.filter(isGoogleWorkspace);

  // Don't make recommendations if there are no Google Workspace profiles
  if (!gwsProfiles || gwsProfiles.length === 0) {
    return [];
  }

  const cutoffTime = now.getTime() - THREE_MONTHS_MS;
  const domainsWithRecentReport = new Set();

  // Check accountScans for recent Google Workspace CIS reports
  accountScans.forEach((scan) => {
    // Only process scans that are Google Workspace and match the GWS CIS report pattern
    if (!isGoogleWorkspace(scan)) {
      return;
    }

    if (!scan.reportId || !isGwsCisReport(scan.reportId)) {
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

    // Get domain from scan - try multiple possible field names
    const domain = scan.domain || scan.accountId || null;

    if (domain) {
      domainsWithRecentReport.add(String(domain).toLowerCase());
    }
  });

  const missingProfiles = gwsProfiles.reduce((acc, profile) => {
    const parsedAuthProfile = safeParseJson(profile.authProfile);
    const authProfileDomain = deriveDomain(parsedAuthProfile);
    if (!authProfileDomain) {
      return acc;
    }

    const domainKey = String(authProfileDomain).toLowerCase();
    if (domainsWithRecentReport.has(domainKey)) {
      return acc;
    }

    acc.push({
      domain: authProfileDomain,
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

  if (missingProfiles.length === 0) {
    return [];
  }

  return [
    createGwsCisReportRecommendation({
      now,
      missingProfiles,
    }),
  ];
};

export const gwsCisReportRuleId = RULE_ID;

