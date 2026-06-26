import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { sendWorkloadDiscoveryChat } from '@/api/workloadDiscoveryApi';
import {
  addBackgroundAssistantMessage,
  markBackgroundDiscoveryFinished,
  mergeBackgroundScanData,
  replaceBackgroundEnvironmentWorkloads,
  setBackgroundDiscoveryExecutionState,
  setBackgroundDiscoverySessionId,
  upsertBackgroundEnvironmentRun,
} from '@/features/workload/workloadDiscoverySlice';

const TOAST_ID = 'workload-discovery-background';

export default function WorkloadDiscoveryBackgroundRunner() {
  const dispatch = useDispatch();
  const activeRun = useSelector((state) => state.workloadDiscovery.activeRun);
  const mountedRef = useRef(true);
  const startedJobIdRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activeRun || activeRun.executionState !== 'queued' || !activeRun.jobId) return;
    if (startedJobIdRef.current === activeRun.jobId) return;
    startedJobIdRef.current = activeRun.jobId;

    const runDiscovery = async () => {
      dispatch(setBackgroundDiscoveryExecutionState('running'));
      toast.loading(
        `Discovering workloads for ${activeRun.environments.length} environment(s)...`,
        { id: TOAST_ID, duration: Infinity }
      );

      try {
        const runRequests = activeRun.environments.map(async (environmentMeta) => {
          const profileId = environmentMeta.profileId;
          const regions =
            Array.isArray(activeRun.selectedRegions) && activeRun.selectedRegions.length > 0
              ? activeRun.selectedRegions
              : environmentMeta.defaultRegions;
          await sendWorkloadDiscoveryChat(
            {
              cloudProvider: environmentMeta.cloudProvider || 'aws',
              permissionProfileId: environmentMeta.permissionProfileId || profileId,
              subscriptionId: environmentMeta.subscriptionId || undefined,
              services: activeRun.selectedServices,
              regions,
              environmentNotes: activeRun.environmentNotes || undefined,
              forceInventoryScan: activeRun.forceInventoryScan,
            },
            {
              onHello: (data) => {
                if (!mountedRef.current || !data?.sessionId) return;
                dispatch(
                  setBackgroundDiscoverySessionId({
                    profileId,
                    sessionId: data.sessionId,
                  })
                );
              },
              onScanStart: () => {
                if (!mountedRef.current) return;
                dispatch(
                  upsertBackgroundEnvironmentRun({
                    profileId,
                    patch: {
                      ...environmentMeta,
                      status: 'scanning',
                      progress: 'Scanning resources',
                    },
                  })
                );
              },
              onInventorySaved: (data) => {
                if (!mountedRef.current) return;
                dispatch(
                  upsertBackgroundEnvironmentRun({
                    profileId,
                    patch: {
                      inventorySource: data?.source || 'fresh',
                      inventoryGeneratedAt: data?.inventory?.generatedAt || null,
                    },
                  })
                );
              },
              onScanData: (data) => {
                if (!mountedRef.current) return;
                const scanResults = data?.scanResults || data;
                if (scanResults && (scanResults.accountId || scanResults.cloudformation)) {
                  dispatch(
                    mergeBackgroundScanData({
                      scanResults,
                      environmentMeta,
                    })
                  );
                }
              },
              onScanComplete: () => {
                if (!mountedRef.current) return;
                dispatch(
                  upsertBackgroundEnvironmentRun({
                    profileId,
                    patch: {
                      status: 'analyzing',
                      progress: 'Analyzing environment',
                    },
                  })
                );
              },
              onAgentStart: () => {
                if (!mountedRef.current) return;
                dispatch(
                  upsertBackgroundEnvironmentRun({
                    profileId,
                    patch: {
                      status: 'processing',
                      progress: 'Running workload discovery',
                    },
                  })
                );
              },
              onToolCall: (data) => {
                if (!mountedRef.current) return;
                const toolName = data.name || data.tool_name || 'tool';
                const formattedName = toolName
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (letter) => letter.toUpperCase());
                dispatch(
                  upsertBackgroundEnvironmentRun({
                    profileId,
                    patch: {
                      status: 'processing',
                      progress: `${formattedName}...`,
                    },
                  })
                );
              },
              onDiscoveryComplete: (data) => {
                if (!mountedRef.current || !Array.isArray(data?.workloads)) return;
                dispatch(
                  replaceBackgroundEnvironmentWorkloads({
                    profileId,
                    workloads: data.workloads,
                    environmentMeta,
                  })
                );
              },
              onFinal: (data) => {
                if (!mountedRef.current) return;
                if (data?.text) {
                  dispatch(
                    addBackgroundAssistantMessage({
                      content: data.text,
                      environmentMeta,
                    })
                  );
                }
                if (Array.isArray(data?.discovery?.workloads)) {
                  dispatch(
                    replaceBackgroundEnvironmentWorkloads({
                      profileId,
                      workloads: data.discovery.workloads,
                      environmentMeta,
                    })
                  );
                }
              },
              onDone: () => {
                if (!mountedRef.current) return;
                dispatch(
                  upsertBackgroundEnvironmentRun({
                    profileId,
                    patch: {
                      status: 'completed',
                      progress: 'Completed',
                    },
                  })
                );
              },
              onError: (data) => {
                if (!mountedRef.current) return;
                dispatch(
                  upsertBackgroundEnvironmentRun({
                    profileId,
                    patch: {
                      status: 'error',
                      progress: data?.error || 'Failed',
                      error: data?.error || 'Failed',
                    },
                  })
                );
              },
            }
          );
        });

        const settled = await Promise.allSettled(runRequests);
        if (!mountedRef.current) return;

        const failedCount = settled.filter((result) => result.status === 'rejected').length;
        const successCount = settled.length - failedCount;

        dispatch(
          markBackgroundDiscoveryFinished({
            executionState: successCount > 0 ? 'completed' : 'error',
            failedCount,
            error: successCount > 0 ? null : 'Failed to discover workloads',
          })
        );

        if (successCount > 0) {
          toast.success('Workload discovery is ready for review.', {
            id: TOAST_ID,
            duration: 6000,
          });
        } else {
          toast.error('Workload discovery failed.', {
            id: TOAST_ID,
            duration: 6000,
          });
        }
      } catch (error) {
        if (!mountedRef.current) return;
        dispatch(
          markBackgroundDiscoveryFinished({
            executionState: 'error',
            failedCount: activeRun.environments.length || 1,
            error: error?.message || 'Failed to discover workloads',
          })
        );
        toast.error(error?.message || 'Failed to discover workloads', {
          id: TOAST_ID,
          duration: 6000,
        });
      } finally {
        if (startedJobIdRef.current === activeRun.jobId) {
          startedJobIdRef.current = null;
        }
      }
    };

    runDiscovery();
  }, [activeRun?.jobId, activeRun?.executionState, dispatch]);

  return null;
}
