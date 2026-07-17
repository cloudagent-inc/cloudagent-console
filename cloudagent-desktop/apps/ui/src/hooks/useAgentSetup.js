import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setIsRegionModalOpen } from '../features/agent/agentSlice';
import { generateRandomString } from '../helpers/shared';
import { toLogObject } from '../helpers/logUtils';

function parseMaybeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') return value;
  return fallback;
}

export function useAgentSetup() {
  const dispatch = useDispatch();
  const { isRegionModalOpen } = useSelector((state) => state.agent);

  const [setupState, setSetupState] = useState({
    isPermissionsModalOpen: false,
    authProfile: {
      validated: false,
      authType: 'role',
      roleName: `CloudAgentAccessRole-${generateRandomString(6)}`,
      externalId: generateRandomString(6),
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      authProfileName: '',
    },
    accountId: '',

    globalSettings: {},

    planId: '',
    recordId: '',
    planDetails: null,
    title: '',
    inputSummary: '',
    requiredPermissions: {},
    prefillPermissionProfileId: null,
    prefillPermissionProfileName: null,

    isReconnecting: false,
    shouldAutocontinue: false,
    isEditing: false,
    editingPermission: null,
    presetDescription: '',
    authType: 'role',
    initialManualStep: 0,
  });

  const initializeFromExistingData = useCallback((existingData) => {
    if (!existingData) return;

    const parsedAuth = parseMaybeJson(existingData.authProfile, {});
    const parsedLog = toLogObject(existingData.log);

    setSetupState((prev) => ({
      ...prev,
      authProfile: {
        ...prev.authProfile,
        ...parsedAuth,
        validated: true,
      },
      accountId: parsedAuth.accountId || '',
      globalSettings: parsedLog.globalSettings || {},
      isReconnecting: true,
    }));
  }, []);

  const initializeFromPlanData = useCallback((planData) => {
    setSetupState((prev) => ({
      ...prev,
      planId: planData.planId,
      planDetails: planData.planDetails,
      title: planData.title,
      inputSummary: planData.inputSummary,
      requiredPermissions: planData.requiredPermissions,
      shouldAutocontinue: planData.shouldAutocontinue || false,
    }));
  }, []);

  const startSetup = useCallback(() => {
    setSetupState((prev) => ({
      ...prev,
      isPermissionsModalOpen: true,
    }));
  }, []);

  const handlePermissionsComplete = useCallback(
    (permissionData) => {
      setSetupState((prev) => ({
        ...prev,
        isPermissionsModalOpen: false,
        authProfile: {
          ...prev.authProfile,
          ...permissionData,
          validated: true,
        },
        accountId: permissionData.accountId || '',
      }));

      dispatch(setIsRegionModalOpen(true));
    },
    [dispatch]
  );

  const handleSettingsComplete = useCallback(
    (settingsData) => {
      const updatedGlobalSettings = {
        ...setupState.globalSettings,
        ...settingsData,
      };

      setSetupState((prev) => ({
        ...prev,
        globalSettings: updatedGlobalSettings,
      }));

      dispatch(setIsRegionModalOpen(false));

      return {
        authProfile: setupState.authProfile,
        globalSettings: updatedGlobalSettings,
        accountId: setupState.accountId,
        planId: setupState.planId,
        title: setupState.title,
      };
    },
    [setupState, dispatch]
  );

  const cancelSetup = useCallback(() => {
    setSetupState((prev) => ({
      ...prev,
      isPermissionsModalOpen: false,
    }));
    dispatch(setIsRegionModalOpen(false));
  }, [dispatch]);

  const resetSetup = useCallback(() => {
    setSetupState({
      isPermissionsModalOpen: false,
      authProfile: {
        validated: false,
        authType: 'role',
        roleName: `CloudAgentAccessRole-${generateRandomString(6)}`,
        externalId: generateRandomString(6),
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        authProfileName: '',
      },
      accountId: '',
      globalSettings: {},
      planId: '',
      recordId: '',
      planDetails: null,
      title: '',
      inputSummary: '',
      requiredPermissions: {},
      prefillPermissionProfileId: null,
      prefillPermissionProfileName: null,
      isReconnecting: false,
      shouldAutocontinue: false,
      isEditing: false,
      editingPermission: null,
      presetDescription: '',
      authType: 'role',
      initialManualStep: 0,
    });
  }, []);

  return {
    setupState,
    isRegionModalOpen,

    initializeFromExistingData,
    initializeFromPlanData,
    startSetup,
    handlePermissionsComplete,
    handleSettingsComplete,
    cancelSetup,
    resetSetup,
    setSetupState,

    isSetupComplete:
      setupState.authProfile.validated &&
      Object.keys(setupState.globalSettings).length > 0,
    isPermissionsComplete: setupState.authProfile.validated,
  };
}
