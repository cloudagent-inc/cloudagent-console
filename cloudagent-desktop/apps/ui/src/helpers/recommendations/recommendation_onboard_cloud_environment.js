import { normalizePermissionProfiles } from './utils';

const RULE_ID = 'onboard_cloud_environment';

const createOnboardCloudEnvironmentRecommendation = ({ now }) => {
  const evaluatedAt = now.toISOString();
  const reason = 'No cloud environments have been onboarded. Connect your first cloud environment to get started.';

  return {
    recommendationId: 'local_rule.onboard_cloud_environment',
    id: 'local_rule.onboard_cloud_environment',
    ruleId: RULE_ID,
    title: 'Onboard Cloud Environment',
    status: 'open',
    priority: 100,
    metadata: {
      priority: 100,
      domain: 'Platform',
      category: 'Platform Recommendations',
      ruleId: RULE_ID,
      generatedBy: 'local_rule_engine',
      evaluatedAt,
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
      type: 'platform',
      path: '/dashboard/cloud-setup',
    },
    action: {
      type: 'platform',
      path: '/dashboard/cloud-setup',
    },
    targetResources: [],
    notes:
      'Connect your first cloud environment to start monitoring security, compliance, and cost optimization.',
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
  };
};

export const evaluateOnboardCloudEnvironmentRule = (
  userProfile,
  now = new Date()
) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  const permissionProfiles = normalizePermissionProfiles(userProfile);

  // If there are permission profiles, don't recommend onboarding
  if (permissionProfiles && permissionProfiles.length > 0) {
    return [];
  }

  return [
    createOnboardCloudEnvironmentRecommendation({
      now,
    }),
  ];
};

export const onboardCloudEnvironmentRuleId = RULE_ID;
