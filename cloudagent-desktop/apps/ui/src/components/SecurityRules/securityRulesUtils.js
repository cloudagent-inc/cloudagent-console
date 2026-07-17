import rulesData from '@/helpers/rules.json';
import { DEFAULT_GUARDRAIL_CATALOG } from '@cloudagent/cloudagent-tools/services/default-guardrail-catalog';
import { securityPresets } from './securityRulePresets';

export { securityPresets } from './securityRulePresets';

const supportedRuleIds = new Set(DEFAULT_GUARDRAIL_CATALOG.rules.map((rule) => rule.id));

// rules.json remains the complete legacy/backlog inventory. Only policies
// backed by both local CloudFormation Guard and Trivy implementations are
// selectable until the remaining policies are normalized and implemented.
export const supportedSecurityRules = Object.freeze(
  (rulesData || []).filter((rule) => supportedRuleIds.has(rule.id)),
);

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

const rulesByCategory = groupRulesByCategory(supportedSecurityRules);
const rulesByService = groupRulesByService(supportedSecurityRules);

export const securityRulesConfig = createSecurityRulesConfig(rulesByCategory);
export const securityRulesConfigByService = createSecurityRulesConfig(rulesByService);

export const allUniqueRuleIds = (() => {
  const ids = new Set();
  supportedSecurityRules.forEach((r) => ids.add(r.id));
  return ids;
})();

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
