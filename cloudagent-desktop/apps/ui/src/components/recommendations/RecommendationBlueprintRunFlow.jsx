import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { prefillBlueprintFormValues } from '@/api/ops';
import { createAgentConnection } from '@/api/agent';
import { runBackgroundAgent } from '@/api/apigw';
import { fetchBlueprints } from '@/features/skill/skillSlice';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import RecommendationBlueprintRunTargets from '@/components/recommendations/RecommendationBlueprintRunTargets';
import { SettingsSummary } from '@/pages/Agent/Agent';
import {
  buildRecommendationBlueprintRunTargets,
  buildRecommendationExecutionContext,
  buildRecommendationProfileEntries,
  serializeRecommendationRunTarget,
} from '@/helpers/recommendations/remediationTargets';

const safeJsonParse = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const couldBeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  if (!couldBeJson) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const toArray = (value) => {
  if (value == null) {
    return [];
  }

  const parsed = safeJsonParse(value);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed == null) {
    return [];
  }

  if (typeof parsed === 'object') {
    if (Array.isArray(parsed.active)) {
      return parsed.active;
    }

    if (Array.isArray(parsed.resources)) {
      return parsed.resources;
    }

    return [parsed];
  }

  return parsed ? [parsed] : [];
};

const parsePermissionAuthProfile = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const isBlueprintReady = (blueprint) => {
  if (!blueprint || !blueprint.status) {
    return false;
  }
  const status = String(blueprint.status).toLowerCase();
  return status === 'ready' || status === 'completed' || status === 'complete';
};

const extractFieldNames = (defaultValuesMarkdown) => {
  if (!defaultValuesMarkdown || typeof defaultValuesMarkdown !== 'string') {
    return {};
  }

  const fieldNames = {};
  const inputFieldRegex = /__input_field__(.*?)__input_field_end__/gs;
  const matches = [...defaultValuesMarkdown.matchAll(inputFieldRegex)];

  matches.forEach((match) => {
    try {
      const fieldProps = JSON.parse(match[1].trim());
      const label = fieldProps.label;
      const stateName = label.replace(/\s+/g, '_').toLowerCase();
      fieldNames[label] = stateName;
    } catch (error) {
      console.warn('[RecommendationBlueprintRunFlow] Failed to parse input field:', error);
    }
  });

  return fieldNames;
};

export default function RecommendationBlueprintRunFlow({
  open,
  recommendation,
  onClose,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userProfile } = useSelector((state) => state.auth);
  const { userSkills } = useSelector((state) => state.skill);

  const permissionProfiles = useMemo(
    () => toArray(userProfile?.agentPermissionProfiles),
    [userProfile?.agentPermissionProfiles]
  );

  const permissionProfilesById = useMemo(() => {
    const map = new Map();
    permissionProfiles.forEach((profile) => {
      if (!profile || typeof profile !== 'object') {
        return;
      }
      const identifier = profile.recordId || profile.id;
      if (identifier) {
        map.set(String(identifier), profile);
      }
    });
    return map;
  }, [permissionProfiles]);

  const permissionProfilesByAccount = useMemo(() => {
    const map = new Map();
    permissionProfiles.forEach((profile) => {
      if (!profile || typeof profile !== 'object') {
        return;
      }

      const parsedAuth = safeJsonParse(profile.authProfile);
      const awsAccountId =
        parsedAuth?.awsAccountId ||
        parsedAuth?.accountId ||
        parsedAuth?.AwsAccountId ||
        parsedAuth?.AWSAccountId ||
        null;

      if (awsAccountId) {
        const key = String(awsAccountId);
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(profile);
      }

      if (parsedAuth?.provider === 'google_workspace' && parsedAuth?.domain) {
        const domainKey = String(parsedAuth.domain);
        if (!map.has(domainKey)) {
          map.set(domainKey, []);
        }
        map.get(domainKey).push(profile);
      }
    });
    return map;
  }, [permissionProfiles]);

  const availableCredits =
    (userProfile?.agentCredits?.adhocCredits || 0) +
    (userProfile?.agentCredits?.monthlyBaseCredits || 0);

  const [blueprintRunLoading, setBlueprintRunLoading] = useState(null);
  const [runSettingsModalState, setRunSettingsModalState] = useState({
    isOpen: false,
    isCustomBlueprint: false,
    planId: null,
    blueprintRecordId: null,
    title: '',
    inputSummary: '',
    defaultValues: {},
    cloudProvider: 'aws',
    recommendationContext: null,
    recommendationTarget: null,
    prefillPermissionProfileId: null,
    prefillPermissionProfileName: null,
  });

  useEffect(() => {
    if (open && userProfile?.userId) {
      dispatch(fetchBlueprints({ count: 50 }));
    }
  }, [dispatch, open, userProfile?.userId]);

  useEffect(() => {
    if (!open && !runSettingsModalState.isOpen) {
      setBlueprintRunLoading(null);
    }
  }, [open, runSettingsModalState.isOpen]);

  const closeRunSettingsModal = () => {
    setRunSettingsModalState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const recommendedActionData = safeJsonParse(recommendation?.recommendedAction);
  const actionData = safeJsonParse(recommendation?.action);
  const libraryBlueprintId = recommendedActionData?.blueprintId || null;
  const customBlueprintId = actionData?.blueprintId || null;
  const blueprintId = libraryBlueprintId || customBlueprintId;
  const isLibraryBlueprint = Boolean(libraryBlueprintId);
  const blueprint = useMemo(
    () =>
      blueprintId && !isLibraryBlueprint
        ? (userSkills || []).find((item) => item.recordId === blueprintId)
        : null,
    [blueprintId, isLibraryBlueprint, userSkills]
  );

  const { resources, profileEntries } = useMemo(
    () =>
      buildRecommendationProfileEntries({
        recommendation,
        permissionProfiles,
        permissionProfilesById,
        permissionProfilesByAccount,
      }),
    [
      recommendation,
      permissionProfiles,
      permissionProfilesByAccount,
      permissionProfilesById,
    ]
  );

  const blueprintRunTargets = useMemo(
    () =>
      buildRecommendationBlueprintRunTargets({
        recommendation,
        permissionProfiles,
        permissionProfilesById,
        permissionProfilesByAccount,
      }),
    [
      recommendation,
      permissionProfiles,
      permissionProfilesByAccount,
      permissionProfilesById,
    ]
  );

  const openRecommendationBlueprintRunSettings = async ({
    runTarget,
    targetResources,
  }) => {
    const accountId = runTarget?.accountId || null;
    const profile = runTarget?.profile || null;
    if (!blueprintId || !profile) {
      console.warn('Cannot run blueprint without blueprintId and permission profile.');
      return;
    }

    const permissionProfileId = profile?.recordId || profile?.id;
    if (!permissionProfileId) {
      console.warn('Permission profile is missing record identifier.');
      return;
    }

    let planArray = [];
    let defaultValuesMarkdown = '';
    let resolvedPlanId = blueprintId;
    let isCustomBlueprint = false;

    if (isLibraryBlueprint) {
      const response = await fetch(
        `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${blueprintId}.json`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch library skill: ${response.status}`);
      }
      const libraryBlueprintData = await response.json();
      planArray = libraryBlueprintData?.plan || [];
      defaultValuesMarkdown = libraryBlueprintData?.planSettings?.defaultValues || '';
    } else {
      if (!blueprint) {
        throw new Error(`Skill with ID ${blueprintId} does not exist in your skills list.`);
      }
      if (!isBlueprintReady(blueprint)) {
        throw new Error(`Skill is not ready. Current status: ${blueprint.status || 'unknown'}`);
      }
      const blueprintPlan = safeJsonParse(blueprint.plan);
      const blueprintPlanSettings = safeJsonParse(blueprint.planSettings);
      planArray = blueprintPlan?.plan || blueprintPlan || [];
      defaultValuesMarkdown = blueprintPlanSettings?.defaultValues || '';
      resolvedPlanId = blueprint.recordId || blueprintId;
      isCustomBlueprint = true;
    }

    const fieldNames = extractFieldNames(defaultValuesMarkdown);
    let prefilledValues = null;

    try {
      const apiResult = await prefillBlueprintFormValues({
        plan: planArray,
        defaultValues: defaultValuesMarkdown,
        targetResources,
        fieldNames: Object.keys(fieldNames).length > 0 ? fieldNames : undefined,
      });
      prefilledValues = apiResult?.body?.details || null;
    } catch (error) {
      console.error('[RecommendationBlueprintRunFlow] Prefill failed:', error);
      toast.error('Failed to pre-fill blueprint defaults. Opening run settings with the base blueprint values.');
    }

    const targetRegions = [
      ...new Set(
        (Array.isArray(targetResources) ? targetResources : [])
          .map((resource) => (typeof resource === 'string' ? null : resource?.region))
          .filter(Boolean)
      ),
    ];
    const recommendedWorkloadValue = runTarget?.workloadId
      ? `workload-${runTarget.workloadId}`
      : null;

    setRunSettingsModalState({
      isOpen: true,
      isCustomBlueprint,
      planId: resolvedPlanId,
      blueprintRecordId: isCustomBlueprint ? resolvedPlanId : null,
      title: blueprint?.title || recommendation?.title || 'Run Skill',
      inputSummary: defaultValuesMarkdown,
      defaultValues: {
        ...(prefilledValues || {}),
        select_aws_regions:
          prefilledValues?.select_aws_regions || targetRegions || ['us-east-1'],
        selected_workload_or_stack:
          prefilledValues?.selected_workload_or_stack ||
          recommendedWorkloadValue ||
          undefined,
      },
      cloudProvider:
        runTarget?.cloudProvider ||
        targetResources?.find((resource) => resource?.cloudProvider)?.cloudProvider ||
        'aws',
      recommendationContext: {
        source: 'recommendations',
        recommendationRecordId:
          recommendation?.recordId ||
          (typeof recommendation?.recordKey === 'string' &&
          recommendation.recordKey.startsWith('RECOMMENDATION#')
            ? recommendation.recordKey.split('#', 2)[1] || null
            : null),
        recommendationId:
          recommendation?.recommendationId ||
          recommendation?.id ||
          recommendation?.recordId ||
          null,
        recordKey: recommendation?.recordKey || null,
        blueprintId: resolvedPlanId,
        accountId,
        permissionProfileId,
        permissionProfileName: profile?.name || null,
        permissionProfile: profile,
        targetRegions: prefilledValues?.select_aws_regions || targetRegions,
        targetResources,
        recommendationRunTarget: serializeRecommendationRunTarget(runTarget),
        autoStart: false,
        prefilledFormValues: prefilledValues,
      },
      recommendationTarget: serializeRecommendationRunTarget(runTarget),
      prefillPermissionProfileId: permissionProfileId,
      prefillPermissionProfileName: profile?.name || null,
    });
  };

  const handleTargetRun = async (runTarget) => {
    const targetResources =
      Array.isArray(runTarget?.resources) && runTarget.resources.length > 0
        ? runTarget.resources
        : resources;
    const loadingKey = runTarget?.key || runTarget?.accountId || null;
    setBlueprintRunLoading(loadingKey);
    try {
      await openRecommendationBlueprintRunSettings({
        runTarget,
        targetResources,
      });
      onClose?.();
    } catch (error) {
      console.error('[RecommendationBlueprintRunFlow] Failed to open run settings:', error);
      toast.error(error?.message || 'Failed to load skill run settings.');
    } finally {
      setBlueprintRunLoading(null);
    }
  };

  const handleRunSettingsSubmit = async (settings, environmentContext = {}) => {
    const modal = runSettingsModalState;
    const runMode = environmentContext.runMode || 'interactive';
    const selectedRunner = environmentContext.runner || environmentContext.executionMode || settings?.runner || settings?.executionMode || 'cloudagent';
    const nextAccountId =
      environmentContext.accountId ||
      modal.recommendationContext?.accountId ||
      '';
    const nextAuthProfile = environmentContext.authProfile
      ? {
          ...environmentContext.authProfile,
          validated: true,
        }
      : {
          ...parsePermissionAuthProfile(
            modal.recommendationContext?.permissionProfile?.authProfile
          ),
          validated: true,
        };
    const recommendationExecutionContext = buildRecommendationExecutionContext(
      modal.recommendationContext
    );

    try {
      if (runMode === 'background') {
        const inputSettings = {
          authProfile: nextAuthProfile,
          regions: settings.select_aws_regions || ['us-east-1'],
          proceed_with_default_values_without_prompt:
            settings.proceed_with_default_values_without_prompt,
          proceed_with_changes_without_confirmation:
            settings.proceed_with_changes_without_confirmation,
          additional_instructions: settings.additional_instructions,
          executionMode: selectedRunner,
          runner: selectedRunner,
          select_aws_regions: settings.select_aws_regions,
          default_values: settings.default_values,
          configuration_mode: settings.configuration_mode,
          selected_workload_or_stack: settings.selected_workload_or_stack,
          ...(Array.isArray(settings.azure_subscription_ids)
            ? {
                azure_subscription_ids: settings.azure_subscription_ids,
                subscriptionId: settings.subscriptionId || settings.azure_subscription_ids[0] || null,
              }
            : {}),
          ...(recommendationExecutionContext
            ? { recommendationContext: recommendationExecutionContext }
            : {}),
        };

        await runBackgroundAgent({
          userId: userProfile?.userId,
          planId: modal.planId,
          executionMode: selectedRunner,
          runner: selectedRunner,
          inputSettings,
        });
        closeRunSettingsModal();
      toast.success('Skill started in the background.');
        return;
      }

      const connectionResponse = await createAgentConnection({
        itemId: modal.isCustomBlueprint ? modal.blueprintRecordId : modal.planId,
        title: modal.title,
        agentType: 'agent',
        executionMode: selectedRunner,
        runner: selectedRunner,
        ...(modal.isCustomBlueprint && modal.blueprintRecordId
          ? { parentId: modal.blueprintRecordId }
          : {}),
        authProfile: nextAuthProfile,
        globalSettings: {
          ...(settings || {}),
          executionMode: selectedRunner,
          runner: selectedRunner,
        },
        ...(recommendationExecutionContext
          ? { recommendationContext: recommendationExecutionContext }
          : {}),
      });

      const createdRecordId =
        connectionResponse?.record?.recordId || connectionResponse?.recordId;

      if (!createdRecordId) {
        throw new Error('Unable to create agent connection: recordId missing');
      }

      closeRunSettingsModal();
      navigate(`/dashboard/agent/${createdRecordId}`, {
        state: {
          isBluePrint: modal.isCustomBlueprint,
          shouldAutocontinue: true,
          initialGlobalSettings: {
            ...(settings || {}),
            executionMode: selectedRunner,
            runner: selectedRunner,
          },
          executionMode: selectedRunner,
          runner: selectedRunner,
          authProfile: nextAuthProfile,
          accountId: nextAccountId,
          cloudProvider: modal.cloudProvider,
          ...(modal.recommendationContext
            ? { fromRecommendation: modal.recommendationContext }
            : {}),
          ...(modal.isCustomBlueprint && modal.blueprintRecordId
            ? { recordId: modal.blueprintRecordId }
            : {}),
        },
      });
    } catch (error) {
      console.error('[RecommendationBlueprintRunFlow] Failed to start skill run:', error);
      toast.error(error?.message || 'Failed to start skill run.');
    }
  };

  if (!recommendation && !runSettingsModalState.isOpen) {
    return null;
  }

  return (
    <>
      <Dialog
        open={Boolean(open && recommendation && !runSettingsModalState.isOpen)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose?.();
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl !bg-white border border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle>{recommendation?.title || 'Run Skill'}</DialogTitle>
            <DialogDescription>
              Select the workload or environment target for this skill run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Skill</p>
                <p className="text-base font-medium text-gray-900 mb-2">
                  {isLibraryBlueprint
                    ? 'Library Skill'
                    : blueprint?.title || 'Untitled Skill'}
                </p>
                {blueprintId ? (
                  <p className="text-xs text-gray-500 mb-2">
                    ID: <span className="font-mono">{blueprintId}</span>
                  </p>
                ) : null}
                {isLibraryBlueprint ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Ready
                  </Badge>
                ) : blueprint?.status ? (
                  <Badge variant="outline">{blueprint.status}</Badge>
                ) : null}
              </div>

              {blueprintId && (isLibraryBlueprint || blueprint) ? (
                <div className="border-t border-gray-200 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 uppercase">Run Target</p>
                    {blueprintRunTargets.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {blueprintRunTargets.length}{' '}
                        {blueprintRunTargets.length === 1 ? 'target' : 'targets'}
                      </Badge>
                    ) : null}
                  </div>
                  <RecommendationBlueprintRunTargets
                    targets={blueprintRunTargets}
                    canRun={Boolean(blueprintId)}
                    isBlueprintReady={isLibraryBlueprint || isBlueprintReady(blueprint)}
                    isLibraryBlueprint={isLibraryBlueprint}
                    blueprintExists={Boolean(isLibraryBlueprint || blueprint)}
                    blueprintStatus={blueprint?.status || ''}
                    loadingTargetKey={blueprintRunLoading}
                    onRun={handleTargetRun}
                  />
                </div>
              ) : (
                <Alert>
                  <AlertTitle>Skill Not Found</AlertTitle>
                  <AlertDescription className="mt-2">
                    The skill referenced by this recommendation is not available.
                  </AlertDescription>
                </Alert>
              )}

              {!blueprintId ? (
                <Alert>
                  <AlertTitle>No Skill Configured</AlertTitle>
                  <AlertDescription className="mt-2">
                    This recommendation does not currently reference a skill.
                  </AlertDescription>
                </Alert>
              ) : null}

              {blueprintId && !isLibraryBlueprint && blueprint && !isBlueprintReady(blueprint) ? (
                <Alert>
                  <AlertTitle>Skill Not Ready</AlertTitle>
                  <AlertDescription className="mt-2">
                    This skill cannot be run until it reaches a ready state.
                  </AlertDescription>
                </Alert>
              ) : null}

              {blueprintId &&
              (isLibraryBlueprint || blueprint) &&
              blueprintRunTargets.length === 0 &&
              profileEntries.length === 0 ? (
                <Alert>
                  <AlertTitle>No Eligible Targets</AlertTitle>
                  <AlertDescription className="mt-2">
                    No matching environments or workloads are available for this recommendation.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SettingsSummary
        isOpen={runSettingsModalState.isOpen}
        onClose={closeRunSettingsModal}
        onSubmit={handleRunSettingsSubmit}
        defaultValues={runSettingsModalState.defaultValues}
        inputSummary={runSettingsModalState.inputSummary}
        isBluePrint={true}
        isAgent={true}
        externalRunHandler={true}
        showEnvironmentSelection={true}
        planId={runSettingsModalState.planId || ''}
        blueprintId={
          runSettingsModalState.blueprintRecordId ||
          runSettingsModalState.planId ||
          ''
        }
        recordId={
          runSettingsModalState.blueprintRecordId ||
          runSettingsModalState.planId ||
          ''
        }
        cloudProvider={runSettingsModalState.cloudProvider}
        prefillPermissionProfileId={runSettingsModalState.prefillPermissionProfileId}
        prefillPermissionProfileName={runSettingsModalState.prefillPermissionProfileName}
        availableCredits={availableCredits}
        recommendationTarget={runSettingsModalState.recommendationTarget}
        buttonText="Run Skill"
      />
    </>
  );
}
