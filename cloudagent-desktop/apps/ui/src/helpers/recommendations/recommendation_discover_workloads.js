import { toArray } from './utils';

const RULE_ID = 'discover_workloads';

const createDiscoverWorkloadsRecommendation = ({ now }) => {
  const evaluatedAt = now.toISOString();
  const reason = 'No workloads have been discovered or created. Discover workloads to track and manage your cloud resources.';

  return {
    recommendationId: 'local_rule.discover_workloads',
    id: 'local_rule.discover_workloads',
    ruleId: RULE_ID,
    title: 'Discover Workloads',
    status: 'open',
    priority: 95,
    metadata: {
      priority: 95,
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
      path: '/dashboard/workloads',
    },
    action: {
      type: 'platform',
      path: '/dashboard/workloads',
    },
    targetResources: [],
    notes:
      'Discover workloads to organize and track your cloud resources. Workloads help you manage resources by application, service, or team.',
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
  };
};

export const evaluateDiscoverWorkloadsRule = (
  userProfile,
  now = new Date()
) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  const workloads = toArray(userProfile.workloads);

  // If there are no workloads, recommend discovering workloads
  if (workloads.length === 0) {
    return [
      createDiscoverWorkloadsRecommendation({
        now,
      }),
    ];
  }

  // Check if all workloads contain "PermissionProfile-" in their name
  const allWorkloadsArePermissionProfiles = workloads.every((workload) => {
    const workloadName = workload?.workloadName || '';
    return typeof workloadName === 'string' && workloadName.includes('PermissionProfile-');
  });

  // If all workloads are PermissionProfile- prefixed, recommend discovering workloads
  if (allWorkloadsArePermissionProfiles) {
    return [
      createDiscoverWorkloadsRecommendation({
        now,
      }),
    ];
  }

  // Otherwise, no recommendation needed
  return [];
};

export const discoverWorkloadsRuleId = RULE_ID;
