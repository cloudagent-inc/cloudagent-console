import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Govenance from "@/components/Workload/Govenance";
import SourceControlGovernanceCard from "@/components/SourceControlGovernance/SourceControlGovernanceCard";
import Architecture from "@/components/Workload/Architecture";
import SecurityRulesTab from "@/components/SecurityRules/SecurityRulesTab";
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
} from "@/components/SecurityRules/securityRulesUtils";
import {
  getGlobalWorkloadDeploymentPreferences,
  sanitizeGlobalWorkloadDeploymentPreferences,
} from "@/features/workload/workloadCreationUtils";
import { updateUserSettings } from "@/features/auth/authSlice";

const IAC_METHOD_OPTIONS = [
  {
    value: "cloudformation",
    label: "CloudFormation",
    description:
      "Use AWS CloudFormation templates as the default change format.",
  },
  {
    value: "terraform",
    label: "Terraform",
    description: "Use Terraform configuration and plan checks by default.",
  },
  {
    value: "opentofu",
    label: "OpenTofu",
    description: "Use OpenTofu configuration and plan checks by default.",
  },
];

const deploymentPresets = {
  "Production App/Environment": {
    architecturePreferences: {
      instanceSize: "Large",
      databasePreference: "Aurora",
      nosqlPreference: "DynamoDB",
      staticWebsite: "Cloudfront + S3",
      dynamicWebsite: "ECS + ALB",
    },
  },
  "Sandbox/Testing": {
    architecturePreferences: {
      instanceSize: "Small",
      databasePreference: "MySQL",
      nosqlPreference: "No Preference",
      staticWebsite: "Amplify",
      dynamicWebsite: "EC2 + ALB",
    },
  },
};

export default function WorkloadStandardsPage() {
  const dispatch = useDispatch();
  const userProfile = useSelector((state) => state.auth?.userProfile);
  const userSettings = userProfile?.settings || {};
  const [formData, setFormData] = useState(() => ({
    deploymentPreferences: getGlobalWorkloadDeploymentPreferences(userSettings),
    securityRules: getGlobalWorkloadSecurityRules(userSettings),
  }));
  const [groupBy, setGroupBy] = useState("category");
  const [activeTab, setActiveTab] = useState("delivery");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      deploymentPreferences:
        getGlobalWorkloadDeploymentPreferences(userSettings),
      securityRules: getGlobalWorkloadSecurityRules(userSettings),
    });
  }, [userSettings]);

  const securityRules = formData.securityRules;
  const totalRuleCount = allUniqueRuleIds.size;
  const enabledRuleCount = useMemo(
    () => countUniqueEnabledRules(securityRules),
    [securityRules],
  );
  const allRulesEnabled = useMemo(
    () => areAllUniqueRulesEnabled(securityRules),
    [securityRules],
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextSettings = buildGlobalWorkloadRulesSettings(
        userSettings,
        formData.securityRules,
        sanitizeGlobalWorkloadDeploymentPreferences(
          formData.deploymentPreferences,
        ),
      );
      await dispatch(updateUserSettings({ settings: nextSettings })).unwrap();
      toast.success("Workload standards saved");
    } catch (error) {
      console.error("Failed to save workload standards:", error);
      toast.error(error?.message || "Failed to save workload standards");
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
      next.rules[ruleId] = {
        ...(next.rules[ruleId] || {}),
        enabled: shouldEnable,
      };
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
        [ruleKey]: {
          ...(securityRules?.rules?.[ruleKey] || {}),
          enabled: checked,
        },
      },
    };
    const ids = getCategoryRules(categoryKey);
    const all =
      ids.length > 0 &&
      ids.every((id) =>
        id === ruleKey ? checked : next.rules[id]?.enabled === true,
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
        <CardHeader className="border-b p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="text-2xl text-primary-800 font-[500]">
                Workload Standards
              </h1>
              
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full shrink-0 whitespace-nowrap sm:w-auto sm:min-w-[148px]"
            >
              {isSaving ? "Saving..." : "Save Defaults"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">
          <TabsTrigger value="delivery" className="py-2">
            Delivery
          </TabsTrigger>
          <TabsTrigger value="governance" className="py-2">
            Governance
          </TabsTrigger>
          <TabsTrigger value="architecture" className="py-2">
            Architecture
          </TabsTrigger>
          <TabsTrigger value="security" className="py-2">
            Security Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="delivery" className="mt-0">
          <Card className="bg-white">
            <CardHeader className="border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Delivery default
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Choose the IaC method copied into new workloads and
                environments. Repository, branch, IaC location, state, and
                pipeline settings are configured on each workload.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-gray-900">
                  Default infrastructure-as-code method
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {IAC_METHOD_OPTIONS.map((option) => {
                    const selected =
                      formData.deploymentPreferences.method === option.value;
                    const inputId = `global-iac-method-${option.value}`;
                    return (
                      <Label
                        key={option.value}
                        htmlFor={inputId}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                          selected
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name="globalDefaultIacMethod"
                          value={option.value}
                          checked={selected}
                          onChange={() =>
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                method: option.value,
                              },
                            }))
                          }
                          className="mt-1 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-900">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs font-normal text-gray-500">
                            {option.description}
                          </span>
                        </span>
                      </Label>
                    );
                  })}
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="mt-0">
          <Card className="bg-white">
            <CardHeader className="border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Governance
              </h2>
            </CardHeader>
            <CardContent className="space-y-8 p-6">
              <Govenance formData={formData} setFormData={setFormData} />
              <div className="border-t pt-6">
                <SourceControlGovernanceCard
                  level="global"
                  value={formData.deploymentPreferences.github}
                  onChange={(nextGithub) =>
                    setFormData((prev) => ({
                      ...prev,
                      deploymentPreferences: {
                        ...prev.deploymentPreferences,
                        github: nextGithub,
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="architecture" className="mt-0">
          <Card className="bg-white">
            <CardHeader className="border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Architecture
              </h2>
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
              <h2 className="text-lg font-semibold text-gray-900">
                Security Policies
              </h2>
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
