import { useCallback, useEffect, useState } from 'react';
import { settingsClient } from '@/api/clients/settingsClient';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

export function useAgentReadiness({ enabled = true } = {}) {
  const [readinessStatus, setReadinessStatus] = useState(null);
  const [isReadinessLoading, setIsReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState(null);
  const isLocalMode = isLocalRuntime();

  const refreshReadiness = useCallback(async () => {
    if (!enabled || !isLocalMode) {
      setReadinessStatus(null);
      setReadinessError(null);
      setIsReadinessLoading(false);
      return null;
    }

    setIsReadinessLoading(true);
    setReadinessError(null);
    try {
      const response = await settingsClient.getPreferencesStatus();
      const nextStatus = response?.status || response || null;
      setReadinessStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      setReadinessError(error);
      return null;
    } finally {
      setIsReadinessLoading(false);
    }
  }, [enabled, isLocalMode]);

  useEffect(() => {
    if (!enabled || !isLocalMode) {
      setReadinessStatus(null);
      setReadinessError(null);
      setIsReadinessLoading(false);
      return undefined;
    }

    let mounted = true;
    const load = async () => {
      setIsReadinessLoading(true);
      setReadinessError(null);
      try {
        const response = await settingsClient.getPreferencesStatus();
        if (!mounted) return;
        setReadinessStatus(response?.status || response || null);
      } catch (error) {
        if (!mounted) return;
        setReadinessError(error);
      } finally {
        if (mounted) setIsReadinessLoading(false);
      }
    };

    load();
    const handleSettingsUpdated = () => {
      load();
    };
    window.addEventListener('cloudagent:local-runtime-settings-updated', handleSettingsUpdated);
    window.addEventListener('cloudagent:openai-settings-updated', handleSettingsUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('cloudagent:local-runtime-settings-updated', handleSettingsUpdated);
      window.removeEventListener('cloudagent:openai-settings-updated', handleSettingsUpdated);
    };
  }, [enabled, isLocalMode]);

  return {
    readinessStatus,
    isReadinessLoading,
    readinessError,
    refreshReadiness,
    isLocalMode,
  };
}
