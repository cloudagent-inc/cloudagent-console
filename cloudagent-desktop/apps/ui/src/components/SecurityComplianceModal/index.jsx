import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDispatch } from 'react-redux';
import { updateWorkloadDefinition } from '../../features/workload/workloadSlice';
import { updateAgentPermissionProfile } from '../../features/agent/agentSlice';
import toast from 'react-hot-toast';
import SecurityRulesTab from '../SecurityCompliance/SecurityRulesTab';
import {
  securityPresets,
  securityRulesConfig,
  securityRulesConfigByService,
  createSecurityRulesStructure,
  applySecurityPreset,
  getCategoryRules,
  countUniqueEnabledRules,
  areAllUniqueRulesEnabled,
  allUniqueRuleIds,
} from '../SecurityCompliance/securityRulesUtils';

function SecurityComplianceModal({ isOpen, onClose, workload, formData, setFormData, groupBy, setGroupBy }) {
  const dispatch = useDispatch();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      // If this modal was opened for a Cloud Environment (permission profile),
      // the synthetic workloadId is `permission_<recordId>`
      const isPermissionProfile =
        typeof workload?.workloadId === 'string' &&
        workload.workloadId.startsWith('permission_');

      // Also treat plain permission objects (with recordId) as cloud environments
      const isPermissionObject = !!workload?.recordId && !workload?.workloadId;

      if (isPermissionProfile || isPermissionObject) {
        const recordId = isPermissionProfile
          ? workload.workloadId.replace('permission_', '')
          : String(workload.recordId);

        // Preserve existing auth profile to avoid it being nulled by backend
        const existingAuth = typeof workload?.authProfile === 'string'
          ? JSON.parse(workload.authProfile)
          : (workload?.authProfile || {});
        const authType = existingAuth.authType || 'role';

        const profilePayload = {
          recordId,
          // Keep name/description if present so UI remains consistent
          name: workload?.name || workload?.workloadName || 'Cloud Environment',
          description: workload?.description || '',
          // Include existing auth details so backend does not null them out
          awsAccountId: existingAuth.awsAccountId || '',
          authType,
          roleName: authType === 'role' ? (existingAuth.roleName || '') : '',
          externalId: authType === 'role' ? (existingAuth.externalId || '') : '',
          accessKeyId: authType !== 'role' ? (existingAuth.accessKeyId || '') : '',
          secretAccessKey: authType !== 'role' ? (existingAuth.secretAccessKey || '') : '',
          sessionToken: authType !== 'role' ? (existingAuth.sessionToken || '') : '',
          stackArn: existingAuth.stackArn || '',
          // Update rules/preferences
          deploymentPreferences: JSON.stringify(
            safeParseJson(workload?.deploymentPreferences, {})
          ),
          securityRules: JSON.stringify(securityRules || {}),
        };

        await dispatch(updateAgentPermissionProfile(profilePayload)).unwrap();
        toast.success('Saved security & compliance to cloud environment');
      } else {
        const payload = {
          workloadId: workload?.workloadId,
          workloadName: workload?.workloadName,
          description: workload?.description || '',
          environments: Array.isArray(workload?.environments) ? workload.environments : [],
          deploymentPreferences: safeParseJson(workload?.deploymentPreferences, {}),
          securityRules: securityRules,
        };
        await dispatch(updateWorkloadDefinition(payload)).unwrap();
        toast.success('Saved security & compliance');
      }
      if (onClose) onClose();
    } catch (e) {
      console.error('Failed to save security rules:', e);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };
  
  // ----- Helpers and derived configs (ported from WorkloadModal) -----
  const safeParseJson = (jsonLike, defaultValue) => {
    if (!jsonLike) return defaultValue;
    if (typeof jsonLike === 'object') return jsonLike;
    try {
      return JSON.parse(jsonLike);
    } catch {
      return defaultValue;
    }
  };

  // Local fallback state if parent doesn't provide one
  const [internalSecurityRules, setInternalSecurityRules] = useState(() =>
    createSecurityRulesStructure(safeParseJson(workload?.securityRules, {}))
  );
  const [internalGroupBy, setInternalGroupBy] = useState('category');
  const securityRules = formData?.securityRules ?? internalSecurityRules;
  const setSecurityRules = (next) => {
    if (setFormData) {
      setFormData((prev) => ({ ...prev, securityRules: next }));
    } else {
      setInternalSecurityRules(next);
    }
  };
  const currentGroupBy = groupBy ?? internalGroupBy;
  const setCurrentGroupBy = setGroupBy ?? setInternalGroupBy;

  const totalRuleCount = allUniqueRuleIds.size;
  const enabledRuleCount = countUniqueEnabledRules(securityRules || {});
  const allRulesEnabled = areAllUniqueRulesEnabled(securityRules || {});

  const handleApplyPreset = (presetKey) => {
    const current = securityRules || {};
    const newSecurityRules = applySecurityPreset(presetKey, current);
    setSecurityRules(newSecurityRules);
  };

  const handleGroupByChange = (value) => {
    setCurrentGroupBy(value);
  };

  const handleToggleAllRules = () => {
    if (!securityRules) return;
    const next = {
      categories: { ...securityRules.categories },
      rules: { ...securityRules.rules },
    };
    const shouldEnable = !allRulesEnabled;
    Object.keys(next.rules).forEach((id) => {
      next.rules[id] = { ...(next.rules[id] || {}), enabled: shouldEnable };
    });
    Object.keys(next.categories).forEach((categoryKey) => {
      const ids = getCategoryRules(categoryKey);
      const all = ids.length > 0 && ids.every((id) => next.rules[id]?.enabled === true);
      next.categories[categoryKey] = {
        ...(next.categories[categoryKey] || {}),
        enable_all: all,
      };
    });
    setSecurityRules(next);
  };

  const handleToggleCategoryEnable = (categoryKey, checked) => {
    if (!securityRules) return;
    const next = {
      categories: { ...securityRules.categories },
      rules: { ...securityRules.rules },
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
    setSecurityRules(next);
  };

  const handleToggleCategoryExpand = (categoryKey) => {
    if (!securityRules) return;
    const next = {
      categories: { ...securityRules.categories },
      rules: { ...securityRules.rules },
    };
    if (next.categories[categoryKey]) {
      next.categories[categoryKey] = {
        ...next.categories[categoryKey],
        _expanded: !next.categories[categoryKey]._expanded,
      };
    }
    setSecurityRules(next);
  };

  const handleToggleRule = (categoryKey, ruleKey, checked) => {
    if (!securityRules) return;
    const next = {
      categories: { ...securityRules.categories },
      rules: {
        ...securityRules.rules,
        [ruleKey]: { ...(securityRules.rules?.[ruleKey] || {}), enabled: checked },
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
    setSecurityRules(next);
  };

  // Reinitialize local state when a different workload or permission profile is opened (local mode)
  React.useEffect(() => {
    if (!setFormData && isOpen && (workload?.workloadId || workload?.recordId)) {
      const contextId = workload?.workloadId || `permission_${workload?.recordId}`;
      const raw = workload?.securityRules;
      const parsed = safeParseJson(raw, {});
      const rebuilt = createSecurityRulesStructure(parsed);
      setInternalSecurityRules(rebuilt);
    }
  }, [isOpen, workload?.workloadId, workload?.recordId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 bg-white flex flex-col">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            Security & Compliance - {workload?.workloadName}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="space-y-6 px-6 py-6">
            <SecurityRulesTab
              securityPresets={securityPresets}
              totalRuleCount={totalRuleCount}
              securityRules={securityRules}
              onApplyPreset={handleApplyPreset}
              countEnabled={enabledRuleCount}
              currentGroupBy={currentGroupBy}
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
          </div>
        </ScrollArea>

        {/* Persistent Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-white">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SecurityComplianceModal;
