import React, { useMemo, useState } from 'react';
import Govenance from '@/components/Workload/Govenance';
import Architecture from '@/components/Workload/Architecture';
import SecurityRulesTab from '@/components/SecurityCompliance/SecurityRulesTab';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  securityPresets,
  securityRulesConfig,
  securityRulesConfigByService,
  getCategoryRules,
  countUniqueEnabledRules,
  areAllUniqueRulesEnabled,
  allUniqueRuleIds,
  applySecurityPreset,
} from '@/components/SecurityCompliance/securityRulesUtils';

const deploymentPresets = {
  'Production App/Environment': {
    architecturePreferences: {
      instanceSize: 'Large',
      databasePreference: 'Aurora',
      nosqlPreference: 'DynamoDB',
      staticWebsite: 'Cloudfront + S3',
      dynamicWebsite: 'ECS + ALB',
    },
  },
  'Sandbox/Testing': {
    architecturePreferences: {
      instanceSize: 'Small',
      databasePreference: 'MySQL',
      nosqlPreference: 'No Preference',
      staticWebsite: 'Amplify',
      dynamicWebsite: 'EC2 + ALB',
    },
  },
};

function SettingsStep({ formData, setFormData }) {
  const [groupBy, setGroupBy] = useState('category');

  const totalRuleCount = allUniqueRuleIds.size;
  const enabledRuleCount = useMemo(
    () => countUniqueEnabledRules(formData.securityRules),
    [formData.securityRules]
  );
  const allRulesEnabled = useMemo(
    () => areAllUniqueRulesEnabled(formData.securityRules),
    [formData.securityRules]
  );

  const applyPreset = (presetName) => {
    const preset = deploymentPresets[presetName];
    if (!preset) return;
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        architecturePreferences: {
          ...prev.deploymentPreferences.architecturePreferences,
          ...preset.architecturePreferences,
        },
      },
    }));
  };

  const handleGroupByChange = (mode) => {
    setGroupBy(mode);
  };

  const handleToggleAllRules = (checked) => {
    if (!formData.securityRules) return;
    const next = {
      categories: { ...formData.securityRules.categories },
      rules: { ...formData.securityRules.rules },
    };
    allUniqueRuleIds.forEach((ruleId) => {
      next.rules[ruleId] = { enabled: checked };
    });
    Object.keys(next.categories).forEach((categoryKey) => {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        enable_all: checked,
      };
    });
    setFormData((prev) => ({ ...prev, securityRules: next }));
  };

  const handleApplyPreset = (presetKey) => {
    const next = applySecurityPreset(presetKey, formData.securityRules);
    setFormData((prev) => ({ ...prev, securityRules: next }));
  };

  const handleToggleCategoryEnable = (categoryKey, checked) => {
    if (!formData.securityRules) return;
    const next = {
      categories: { ...formData.securityRules.categories },
      rules: { ...formData.securityRules.rules },
    };
    const ids = getCategoryRules(categoryKey);
    ids.forEach((id) => {
      next.rules[id] = { ...(next.rules[id] || {}), enabled: checked };
    });
    if (next.categories[categoryKey]) {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        enable_all: checked,
      };
    }
    setFormData((prev) => ({ ...prev, securityRules: next }));
  };

  const handleToggleCategoryExpand = (categoryKey) => {
    if (!formData.securityRules) return;
    const next = {
      categories: { ...formData.securityRules.categories },
      rules: { ...formData.securityRules.rules },
    };
    if (next.categories[categoryKey]) {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        _expanded: !next.categories[categoryKey]._expanded,
      };
    }
    setFormData((prev) => ({ ...prev, securityRules: next }));
  };

  const handleToggleRule = (categoryKey, ruleKey, checked) => {
    if (!formData.securityRules) return;
    const next = {
      categories: { ...formData.securityRules.categories },
      rules: {
        ...formData.securityRules.rules,
        [ruleKey]: { ...(formData.securityRules.rules?.[ruleKey] || {}), enabled: checked },
      },
    };
    const ids = getCategoryRules(categoryKey);
    const all = ids.length > 0 && ids.every((id) => (id === ruleKey ? checked : next.rules[id]?.enabled === true));
    if (next.categories[categoryKey]) {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        enable_all: all,
      };
    }
    setFormData((prev) => ({ ...prev, securityRules: next }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Optional settings are grouped below and start collapsed so you can skip anything you do not need.
      </div>

      <Accordion type="multiple" className="space-y-4">
        <AccordionItem value="governance" className="rounded-lg border border-slate-200 bg-white px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="text-left">
              <div className="text-base font-semibold text-slate-900">Governance</div>
              <div className="text-xs text-slate-500">
                Change approvals, notifications, regions, tags, and VPC controls.
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <Govenance formData={formData} setFormData={setFormData} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="architecture" className="rounded-lg border border-slate-200 bg-white px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="text-left">
              <div className="text-base font-semibold text-slate-900">Architecture preferences</div>
              <div className="text-xs text-slate-500">
                Capture preferred compute, database, and website patterns.
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <Architecture
              formData={formData}
              setFormData={setFormData}
              applyPreset={applyPreset}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="security" className="rounded-lg border border-slate-200 bg-white px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="text-left">
              <div className="text-base font-semibold text-slate-900">Security settings</div>
              <div className="text-xs text-slate-500">
                {enabledRuleCount} of {totalRuleCount} rules enabled.
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <SecurityRulesTab
              securityPresets={securityPresets}
              totalRuleCount={totalRuleCount}
              securityRules={formData.securityRules}
              onApplyPreset={handleApplyPreset}
              countEnabled={enabledRuleCount}
              currentGroupBy={groupBy}
              onToggleGroupBy={handleGroupByChange}
              allEnabled={allRulesEnabled}
              onToggleEnableAll={handleToggleAllRules}
              securityRulesConfig={securityRulesConfig}
              securityRulesConfigByService={securityRulesConfigByService}
              getCategoryRules={getCategoryRules}
              onToggleCategoryEnable={handleToggleCategoryEnable}
              onToggleCategoryExpand={handleToggleCategoryExpand}
              onToggleRule={handleToggleRule}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default SettingsStep;
