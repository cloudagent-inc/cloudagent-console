import rulesData from '@/helpers/rules.json';

const groupRulesByCategory = (rules) => {
  const grouped = {};
  (rules || []).forEach((rule) => {
    const category = rule.category || 'General';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(rule);
  });
  return grouped;
};

const groupRulesByService = (rules) => {
  const grouped = {};
  (rules || []).forEach((rule) => {
    const serviceName = rule.serviceName || 'General';
    if (!grouped[serviceName]) grouped[serviceName] = [];
    grouped[serviceName].push(rule);
  });
  return grouped;
};

const createSecurityRulesConfig = (rulesByGroup) => {
  const config = {};
  Object.keys(rulesByGroup).forEach((group) => {
    const groupKey = group
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    config[groupKey] = { label: group, rules: {} };
    rulesByGroup[group].forEach((rule) => {
      config[groupKey].rules[rule.id] = {
        title: rule.title,
        description: rule.description,
        serviceName: rule.serviceName,
      };
    });
  });
  return config;
};

const rulesByCategory = groupRulesByCategory(rulesData);
const rulesByService = groupRulesByService(rulesData);

export const securityRulesConfig = createSecurityRulesConfig(rulesByCategory);
export const securityRulesConfigByService = createSecurityRulesConfig(rulesByService);

export const allUniqueRuleIds = (() => {
  const ids = new Set();
  (rulesData || []).forEach((r) => ids.add(r.id));
  return ids;
})();

export const securityPresets = {
  none: {
    name: 'No Security Rules',
    description: 'No security rules applied',
    rules: [],
  },
  relaxed: {
    name: 'Relaxed Sandbox',
    description: 'No clear text passwords',
    rules: [
      'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
      'CLOUDTRAIL_ENABLED',
      'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
      'RDS_SNAPSHOTS_PUBLIC_PROHIBITED',
    ],
  },
  basic: {
    name: 'Basic Security',
    description: 'Adds no public access restrictions',
    rules: [
      'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
      'CLOUDTRAIL_ENABLED',
      'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
      'RDS_SNAPSHOTS_PUBLIC_PROHIBITED',
      'EC2_SECURITY_GROUP_ATTACHED_TO_ENI',
      'S3_BUCKET_PUBLIC_ACCESS_PROHIBITED',
      'RDS_INSTANCE_PUBLIC_ACCESS_CHECK',
      'REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK',
    ],
  },
  development: {
    name: 'Development Environments',
    description: 'Adds logging and encryption in-transit',
    rules: [
      'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
      'CLOUDTRAIL_ENABLED',
      'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
      'RDS_SNAPSHOTS_PUBLIC_PROHIBITED',
      'EC2_SECURITY_GROUP_ATTACHED_TO_ENI',
      'S3_BUCKET_PUBLIC_ACCESS_PROHIBITED',
      'RDS_INSTANCE_PUBLIC_ACCESS_CHECK',
      'REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK',
      'CLOUDTRAIL_LOG_FILE_VALIDATION_ENABLED',
      'S3_BUCKET_LOGGING_ENABLED',
      'VPC_FLOW_LOGS_ENABLED',
      'ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK',
      'S3_BUCKET_SSL_REQUESTS_ONLY',
      'RDS_IN_TRANSIT_ENCRYPTION_ENABLED',
    ],
  },
  production: {
    name: 'Production',
    description: 'Adds backup, encryption at-rest, resiliency',
    rules: [
      'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
      'CLOUDTRAIL_ENABLED',
      'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
      'RDS_SNAPSHOTS_PUBLIC_PROHIBITED',
      'EC2_SECURITY_GROUP_ATTACHED_TO_ENI',
      'S3_BUCKET_PUBLIC_ACCESS_PROHIBITED',
      'RDS_INSTANCE_PUBLIC_ACCESS_CHECK',
      'REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK',
      'CLOUDTRAIL_LOG_FILE_VALIDATION_ENABLED',
      'S3_BUCKET_LOGGING_ENABLED',
      'VPC_FLOW_LOGS_ENABLED',
      'ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK',
      'S3_BUCKET_SSL_REQUESTS_ONLY',
      'RDS_IN_TRANSIT_ENCRYPTION_ENABLED',
      'RDS_DB_INSTANCE_BACKUP_ENABLED',
      'DYNAMODB_POINT_IN_TIME_RECOVERY_ENABLED',
      'S3_BUCKET_CROSS_REGION_REPLICATION_ENABLED',
      'RDS_STORAGE_ENCRYPTED',
      'S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED',
      'EBS_OPTIMIZED_INSTANCE',
      'RDS_MULTI_AZ_SUPPORT',
      'ELB_CROSS_ZONE_LOAD_BALANCING_ENABLED',
      'AUTO_SCALING_GROUP_ELB_HEALTH_CHECK_REQUIRED',
    ],
  },
  all: {
    name: 'All Best Practices',
    description: 'Complete security coverage with all available rules',
    rules: 'all',
  },
};

export const getCategoryRules = (categoryKey) => {
  const category = securityRulesConfig[categoryKey];
  if (category) return Object.keys(category.rules);
  const service = securityRulesConfigByService[categoryKey];
  if (service) return Object.keys(service.rules);
  return [];
};

export const createSecurityRulesStructure = (existingSecurityRules = null) => {
  const categories = {};
  Object.keys(securityRulesConfig).forEach((categoryKey) => {
    categories[categoryKey] = { enable_all: false, _expanded: false };
  });
  Object.keys(securityRulesConfigByService).forEach((serviceKey) => {
    if (!categories[serviceKey]) {
      categories[serviceKey] = { enable_all: false, _expanded: false };
    }
  });

  const rules = {};
  allUniqueRuleIds.forEach((ruleId) => {
    rules[ruleId] = { enabled: false };
  });

  if (existingSecurityRules) {
    if (existingSecurityRules.enabledRuleIds) {
      existingSecurityRules.enabledRuleIds.forEach((ruleId) => {
        if (rules[ruleId]) rules[ruleId].enabled = true;
      });
    } else if (existingSecurityRules.rules) {
      Object.keys(existingSecurityRules.rules).forEach((ruleId) => {
        if (rules[ruleId] && existingSecurityRules.rules[ruleId]) {
          rules[ruleId] = {
            ...rules[ruleId],
            ...existingSecurityRules.rules[ruleId],
          };
        }
      });
    } else {
      Object.keys(existingSecurityRules).forEach((categoryKey) => {
        if (typeof existingSecurityRules[categoryKey] === 'object') {
          Object.keys(existingSecurityRules[categoryKey]).forEach((key) => {
            if (
              key !== 'enable_all' &&
              key !== '_expanded' &&
              existingSecurityRules[categoryKey][key]?.enabled === true
            ) {
              if (rules[key]) rules[key].enabled = true;
            }
          });
        }
      });
    }

    if (existingSecurityRules.categories) {
      Object.keys(existingSecurityRules.categories).forEach((categoryKey) => {
        if (categories[categoryKey]) {
          categories[categoryKey] = {
            ...categories[categoryKey],
            ...existingSecurityRules.categories[categoryKey],
          };
        }
      });
    }
  }

  return { categories, rules };
};

export const sanitizeSecurityRulesForStorage = (securityRules = {}) => {
  const normalized = createSecurityRulesStructure(securityRules);
  const categories = {};
  Object.keys(normalized.categories || {}).forEach((categoryKey) => {
    const { _expanded, ...category } = normalized.categories[categoryKey] || {};
    categories[categoryKey] = category;
  });
  return {
    categories,
    rules: { ...(normalized.rules || {}) },
  };
};

export const getGlobalWorkloadSecurityRules = (settings = {}) => {
  const source = settings?.workloadRules?.securityRules || settings?.globalWorkloadRules?.securityRules;
  return createSecurityRulesStructure(source || {});
};

export const buildGlobalWorkloadRulesSettings = (
  settings = {},
  securityRules = {},
  deploymentPreferences = null
) => {
  const currentWorkloadRules =
    settings?.workloadRules && typeof settings.workloadRules === 'object'
      ? settings.workloadRules
      : {};
  return {
    ...(settings && typeof settings === 'object' ? settings : {}),
    workloadRules: {
      ...currentWorkloadRules,
      schemaVersion: 1,
      ...(deploymentPreferences && typeof deploymentPreferences === 'object'
        ? { deploymentPreferences }
        : {}),
      securityRules: sanitizeSecurityRulesForStorage(securityRules),
      updatedAt: new Date().toISOString(),
    },
  };
};

export const countUniqueEnabledRules = (securityRules) => {
  if (!securityRules || !securityRules.rules) return 0;
  return Object.keys(securityRules.rules).filter(
    (ruleId) => securityRules.rules[ruleId]?.enabled === true
  ).length;
};

export const areAllUniqueRulesEnabled = (securityRules) => {
  if (!securityRules || !securityRules.rules) return false;
  const enabledRuleIds = Object.keys(securityRules.rules).filter(
    (ruleId) => securityRules.rules[ruleId]?.enabled === true
  );
  return enabledRuleIds.length === allUniqueRuleIds.size && allUniqueRuleIds.size > 0;
};

export const applySecurityPreset = (presetKey, securityRules) => {
  const preset = securityPresets[presetKey];
  if (!preset || !securityRules) return securityRules;

  const next = {
    categories: { ...securityRules.categories },
    rules: { ...securityRules.rules },
  };

  Object.keys(next.rules).forEach((ruleId) => {
    next.rules[ruleId] = { enabled: false };
  });

  if (preset.rules === 'all') {
    Object.keys(next.rules).forEach((ruleId) => {
      next.rules[ruleId] = { enabled: true };
    });
  } else {
    preset.rules.forEach((ruleId) => {
      if (next.rules[ruleId]) {
        next.rules[ruleId] = { enabled: true };
      }
    });
  }

  Object.keys(next.categories).forEach((categoryKey) => {
    const categoryRuleIds = getCategoryRules(categoryKey);
    const all = categoryRuleIds.length > 0 && categoryRuleIds.every((ruleId) => next.rules[ruleId]?.enabled === true);
    next.categories[categoryKey] = {
      ...next.categories[categoryKey],
      enable_all: all,
    };
  });

  return next;
};
