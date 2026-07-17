import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import {
  getGuardrailCoverage,
  mappedGuardrailCount,
  summarizeEnabledGuardrailCoverage,
} from './guardrailCoverage';

function SecurityRulesTab({
  securityPresets,
  totalRuleCount,
  securityRules,
  onApplyPreset,
  countEnabled,
  currentGroupBy,
  onToggleGroupBy,
  allEnabled,
  onToggleEnableAll,
  securityRulesConfig,
  securityRulesConfigByService,
  getCategoryRules,
  onToggleCategoryEnable,
  onToggleCategoryExpand,
  onToggleRule,
}) {
  if (!securityRules) {
    return null;
  }

  const activeConfig =
    currentGroupBy === 'service' ? securityRulesConfigByService : securityRulesConfig;
  const guardrailSummary = summarizeEnabledGuardrailCoverage(securityRules);

  return (
    <div className="space-y-6">
      {/* Hint Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Important:</strong> These security rules will be applied when making new
              changes to your workload. They help enforce security best practices during
              deployments and updates.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-emerald-950">Active validator coverage</h3>
            <p className="mt-1 text-xs text-emerald-800">
              Enabled policies backed by executable guardrails are highlighted below.{' '}
              {mappedGuardrailCount} policies are currently mapped.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
              CloudFormation Guard · {guardrailSummary.cloudformation} enabled
            </span>
            <span className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-800">
              Trivy · {guardrailSummary.trivy} enabled
            </span>
          </div>
        </div>
      </div>

      {/* Security Presets Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Setup - Security Presets</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose a preset that matches your environment to get started quickly, then customize
          individual rules below.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(securityPresets).map(([presetKey, preset]) => (
            <button
              key={presetKey}
              type="button"
              className="border border-gray-300 rounded-lg p-4 text-left hover:border-primary-500 transition-colors bg-white"
              onClick={() => onApplyPreset(presetKey)}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900">{preset.name}</h4>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {preset.rules === 'all' ? `${totalRuleCount} rules` : `${preset.rules.length} rules`}
                </span>
              </div>
              <p className="text-sm text-gray-600">{preset.description}</p>
              <div className="mt-3 text-sm text-primary-600 font-medium">Apply Preset →</div>
            </button>
          ))}
        </div>
      </div>

      {/* Divider with Custom Rules Indicator */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center">
          <div className="bg-white px-4 py-2 border border-gray-300 rounded-full">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                />
              </svg>
              <span className="font-medium">Advanced: Customize Individual Rules</span>
            </div>
          </div>
        </div>
      </div>

      {/* Header with enabled rules count, grouping toggle, and enable all button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Enabled Rules:</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {countEnabled}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Group by:</span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onToggleGroupBy('category')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                currentGroupBy === 'category'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Category
            </button>
            <button
              type="button"
              onClick={() => onToggleGroupBy('service')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                currentGroupBy === 'service'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Service
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleEnableAll}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            allEnabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {allEnabled ? 'Disable All' : 'Enable All'}
        </button>
      </div>

      {/* Security Rules Categories */}
      {Object.entries(activeConfig).map(([categoryKey, categoryConfig]) => {
        if (!securityRules.categories || !securityRules.categories[categoryKey]) {
          return null;
        }

        const enabledCount = getCategoryRules(categoryKey).filter(
          (ruleId) => securityRules.rules[ruleId]?.enabled === true
        ).length;

        return (
          <div key={categoryKey}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{categoryConfig.label}</h3>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`${categoryKey}_enable_all`}
                  checked={securityRules.categories[categoryKey].enable_all || false}
                  onCheckedChange={(checked) => onToggleCategoryEnable(categoryKey, checked)}
                  className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                />
                <Label htmlFor={`${categoryKey}_enable_all`} className="font-medium">
                  {securityRules.categories[categoryKey].enable_all ? 'Disable All' : 'Enable All'}
                </Label>
              </div>
            </div>

            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => onToggleCategoryExpand(categoryKey)}
                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Customize Rules</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {enabledCount} enabled
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform ${
                    securityRules.categories[categoryKey]._expanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {securityRules.categories[categoryKey]._expanded && (
                <div className="space-y-2 border-t px-4 py-4">
                  {Object.entries(categoryConfig.rules).map(([ruleKey, ruleData]) => {
                    const enabled = securityRules.rules[ruleKey]?.enabled === true;
                    const coverage = getGuardrailCoverage(ruleKey);
                    const isGuardrailBacked = coverage.cloudformation || coverage.trivy;
                    return (
                      <div
                        key={ruleKey}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
                          enabled && isGuardrailBacked
                            ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                            : enabled
                              ? 'border-blue-200 bg-blue-50/50'
                              : 'border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <Switch
                          id={ruleKey}
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            onToggleRule(categoryKey, ruleKey, checked)
                          }
                          className="mt-0.5 data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                        />
                        <Label htmlFor={ruleKey} className="min-w-0 flex-1 cursor-pointer">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">{ruleData.title}</div>
                            {coverage.cloudformation && (
                              <span
                                title="Enforced by CloudFormation Guard"
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                  enabled
                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                    : 'border-gray-200 bg-gray-100 text-gray-500'
                                }`}
                              >
                                CF Guard
                              </span>
                            )}
                            {coverage.trivy && (
                              <span
                                title="Evaluated by Trivy"
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                  enabled
                                    ? 'border-violet-300 bg-violet-100 text-violet-800'
                                    : 'border-gray-200 bg-gray-100 text-gray-500'
                                }`}
                              >
                                Trivy
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{ruleData.description}</div>
                          <div className="text-xs text-blue-600 mt-1">
                            Service: {ruleData.serviceName}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SecurityRulesTab;
