import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkloadDeploymentSettings from '@/components/Workload/DeploymentSettings';
import Govenance from '@/components/Workload/Govenance';
import Architecture from '@/components/Workload/Architecture';
import SecurityRulesTab from '@/components/SecurityCompliance/SecurityRulesTab';
import {
  allUniqueRuleIds,
  applySecurityPreset,
  areAllUniqueRulesEnabled,
  buildGlobalWorkloadRulesSettings,
  countUniqueEnabledRules,
  getCategoryRules,
  getGlobalWorkloadSecurityRules,
  securityPresets,
  securityRulesConfig,
  securityRulesConfigByService,
} from '@/components/SecurityCompliance/securityRulesUtils';
import {
  getGlobalWorkloadDeploymentPreferences,
} from '@/features/workload/workloadCreationUtils';
import { updateUserSettings } from '@/features/auth/authSlice';
import { getGithubConnections } from '@/helpers/github';
import { getRegionOptions } from '@/helpers/shared';

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

function AwsIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label="AWS"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="10" fill="#232F3E" />
      <text
        x="24"
        y="25"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="0"
        textAnchor="middle"
      >
        aws
      </text>
      <path
        d="M16 31c5.4 3.2 10.9 3.3 16.5.1"
        fill="none"
        stroke="#FF9900"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d="M31.7 29.2l3.1.7-2.1 2.4"
        fill="none"
        stroke="#FF9900"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function DeploymentSettingsPage() {
  const dispatch = useDispatch();
  const userProfile = useSelector((state) => state.auth?.userProfile);
  const userSettings = userProfile?.settings || {};
  const [formData, setFormData] = useState(() => ({
    deploymentPreferences: getGlobalWorkloadDeploymentPreferences(userSettings),
    securityRules: getGlobalWorkloadSecurityRules(userSettings),
  }));
  const [groupBy, setGroupBy] = useState('category');
  const [activeTab, setActiveTab] = useState('deployment');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      deploymentPreferences: getGlobalWorkloadDeploymentPreferences(userSettings),
      securityRules: getGlobalWorkloadSecurityRules(userSettings),
    });
  }, [userSettings]);

  const githubConnections = useMemo(
    () => getGithubConnections(userProfile),
    [userProfile]
  );
  const awsRegionOptions = useMemo(() => getRegionOptions(), []);
  const securityRules = formData.securityRules;
  const totalRuleCount = allUniqueRuleIds.size;
  const enabledRuleCount = useMemo(
    () => countUniqueEnabledRules(securityRules),
    [securityRules]
  );
  const allRulesEnabled = useMemo(
    () => areAllUniqueRulesEnabled(securityRules),
    [securityRules]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextSettings = buildGlobalWorkloadRulesSettings(
        userSettings,
        formData.securityRules,
        formData.deploymentPreferences
      );
      await dispatch(updateUserSettings({ settings: nextSettings })).unwrap();
      toast.success('Deployment settings saved');
    } catch (error) {
      console.error('Failed to save deployment settings:', error);
      toast.error(error?.message || 'Failed to save deployment settings');
    } finally {
      setIsSaving(false);
    }
  };

  const applyArchitecturePreset = (presetName) => {
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

  const updateSecurityRules = (nextRules) => {
    setFormData((prev) => ({ ...prev, securityRules: nextRules }));
  };

  const handleApplyPreset = (presetKey) => {
    updateSecurityRules(applySecurityPreset(presetKey, securityRules));
  };

  const handleToggleAllRules = () => {
    const next = {
      categories: { ...(securityRules?.categories || {}) },
      rules: { ...(securityRules?.rules || {}) },
    };
    const shouldEnable = !allRulesEnabled;
    allUniqueRuleIds.forEach((ruleId) => {
      next.rules[ruleId] = { ...(next.rules[ruleId] || {}), enabled: shouldEnable };
    });
    Object.keys(next.categories).forEach((categoryKey) => {
      next.categories[categoryKey] = {
        ...(next.categories[categoryKey] || {}),
        enable_all: shouldEnable,
      };
    });
    updateSecurityRules(next);
  };

  const handleToggleCategoryEnable = (categoryKey, checked) => {
    const next = {
      categories: { ...(securityRules?.categories || {}) },
      rules: { ...(securityRules?.rules || {}) },
    };
    getCategoryRules(categoryKey).forEach((id) => {
      next.rules[id] = { ...(next.rules[id] || {}), enabled: checked };
    });
    if (next.categories[categoryKey]) {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        enable_all: checked,
      };
    }
    updateSecurityRules(next);
  };

  const handleToggleCategoryExpand = (categoryKey) => {
    const next = {
      categories: { ...(securityRules?.categories || {}) },
      rules: { ...(securityRules?.rules || {}) },
    };
    if (next.categories[categoryKey]) {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        _expanded: !next.categories[categoryKey]._expanded,
      };
    }
    updateSecurityRules(next);
  };

  const handleToggleRule = (categoryKey, ruleKey, checked) => {
    const next = {
      categories: { ...(securityRules?.categories || {}) },
      rules: {
        ...(securityRules?.rules || {}),
        [ruleKey]: { ...(securityRules?.rules?.[ruleKey] || {}), enabled: checked },
      },
    };
    const ids = getCategoryRules(categoryKey);
    const all = ids.length > 0 && ids.every((id) =>
      id === ruleKey ? checked : next.rules[id]?.enabled === true
    );
    if (next.categories[categoryKey]) {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        enable_all: all,
      };
    }
    updateSecurityRules(next);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader className="border-b p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <AwsIcon className="mt-1 h-11 w-11 flex-shrink-0" />
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                  AWS cloud environments
                </div>
                <h1 className="text-2xl text-primary-800 font-[500]">
                  AWS Deployment Settings
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-gray-600">
                  These defaults are copied into each new AWS cloud environment and workload.
                  Existing AWS environments and workloads keep their current settings and can be
                  edited directly.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full shrink-0 whitespace-nowrap sm:w-auto sm:min-w-[148px]"
            >
              {isSaving ? 'Saving...' : 'Save Defaults'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">
          <TabsTrigger value="deployment" className="py-2">Deployment</TabsTrigger>
          <TabsTrigger value="governance" className="py-2">Governance</TabsTrigger>
          <TabsTrigger value="architecture" className="py-2">Architecture</TabsTrigger>
          <TabsTrigger value="security" className="py-2">Security Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="deployment" className="mt-0">
          <Card className="bg-white">
            <CardHeader className="border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">Deployment</h2>
            </CardHeader>
            <CardContent className="p-6">
              <WorkloadDeploymentSettings
                formData={formData}
                setFormData={setFormData}
                awsRegionOptions={awsRegionOptions}
                githubConnections={githubConnections}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="mt-0">
          <Card className="bg-white">
            <CardHeader className="border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">Governance</h2>
            </CardHeader>
            <CardContent className="p-6">
              <Govenance formData={formData} setFormData={setFormData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="architecture" className="mt-0">
          <Card className="bg-white">
            <CardHeader className="border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">Architecture</h2>
            </CardHeader>
            <CardContent className="p-6">
              <Architecture
                formData={formData}
                setFormData={setFormData}
                applyPreset={applyArchitecturePreset}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <Card className="bg-white">
            <CardHeader className="border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">Security Rules</h2>
            </CardHeader>
            <CardContent className="p-6">
              <SecurityRulesTab
                securityPresets={securityPresets}
                totalRuleCount={totalRuleCount}
                securityRules={securityRules}
                onApplyPreset={handleApplyPreset}
                countEnabled={enabledRuleCount}
                currentGroupBy={groupBy}
                onToggleGroupBy={setGroupBy}
                allEnabled={allRulesEnabled}
                onToggleEnableAll={handleToggleAllRules}
                securityRulesConfig={securityRulesConfig}
                securityRulesConfigByService={securityRulesConfigByService}
                getCategoryRules={getCategoryRules}
                onToggleCategoryEnable={handleToggleCategoryEnable}
                onToggleCategoryExpand={handleToggleCategoryExpand}
                onToggleRule={handleToggleRule}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
