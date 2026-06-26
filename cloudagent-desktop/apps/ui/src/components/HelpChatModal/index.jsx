import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, Send, Menu, Plus, ExternalLink, Cloud, Layers, PanelRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icons } from '../icons';
import DiagramChatPreview from '../DiagramChatPreview';
import Markdown from 'markdown-to-jsx';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import {
  listRecentChats,
  startChat as startChatThunk,
  appendChatMessages as appendChatMessagesThunk,
  getChatRecord,
  setCurrentChatId,
} from '@/features/chat/chatSlice';
import { sendChatMessage, prepareReportFile } from '@/api/chatApi';
import { queryGetAgentConnection } from '@/api/eventQueries';
import { buildReportEntryKey, findAccountScan } from '@/helpers/accountScans';
import { filterCloudEnvironments } from '@/helpers/shared';
import { toLogObject } from '@/helpers/logUtils';



// Returns a user-friendly label for a given tool and state
const getToolStatusLabel = (toolName, isActive) => {
  switch (toolName) {
    case 'permission_profile_list':
      return 'Fetching Permission Profiles';
    case 'aws_cli_readonly':
      return 'Running AWS CLI (Read-Only Mode)';
    case 'azure_cli_readonly':
      return 'Running Azure CLI (Read-Only Mode)';
    case 'aws_cfn_operations':
      return 'Accessing AWS CloudFormation';
    case 'list_workloads':
      return 'Fetching Workloads';
    case 'update_workload':
      return 'Updating Workload';
    case 'architecture_templates':
        return 'Reviewing Reference Architectures';
    case 'get_deployment_preferences_summary':
        return 'Reviewing Deployment Preferences';
    case 'list_report_history':
      return 'Listing Reports';
    case 'prepare_report_file':
      return isActive ? 'Loading Report for Analysis' : 'Report Ready for Analysis';
    case 'update_session_context':
      return isActive ? 'Updating Session Context' : 'Context Updated';
    case 'diagram_spec':
      return isActive ? 'Building Diagram' : 'Diagram Ready';
    case 'run_blueprint_background':
      return isActive ? 'Starting Blueprint Run' : 'Blueprint Run Started';
    case 'list_blueprints':
      return isActive ? 'Listing Blueprints' : 'Blueprints Listed';
    default:
      return isActive ? `Using ${toolName}...` : `Used ${toolName}`;
  }
};

const HelpChatModal = ({ onClose, initialMessage = '', autoSendMessage = '', preloadReport = null }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState(initialMessage);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: '',
      timestamp: new Date()
    }
  ]);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState([]);
  const [completedTools, setCompletedTools] = useState([]);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isContextVisible, setIsContextVisible] = useState(true);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [selectedWorkloadId, setSelectedWorkloadId] = useState('');
  const [sessionContext, setSessionContext] = useState({
    environments: [],
    workloads: [],
    reports: [],
    fetched: [],
    notes: ''
  });
  const sessionContextRef = useRef({
    environments: [],
    workloads: [],
    reports: [],
    fetched: [],
    notes: ''
  });
  const [pendingContextSuggestions, setPendingContextSuggestions] = useState([]);
  const [contextNotifications, setContextNotifications] = useState([]);
  const [selectedReportScanId, setSelectedReportScanId] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [lastResponseId, setLastResponseId] = useState(null);
  const [blueprintRunStatus, setBlueprintRunStatus] = useState({});
  const lastAutoSentRef = useRef(null);
  const lastPreloadKeyRef = useRef(null);
  const persistTimerRef = useRef(null);
  const lastPersistedContextRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const recentChatIds = useSelector(state => state.chat?.recentChatIds || []);
  const chatsById = useSelector(state => state.chat?.chatsById || {});
  const { isAuthenticated, loading } = useSelector(state => state.auth);
  const userProfile = useSelector(state => state.auth?.userProfile || {});
  const availableEnvironments = filterCloudEnvironments(userProfile?.agentPermissionProfiles || []);
  const availableWorkloads = userProfile?.workloads || [];
  const accountScans = userProfile?.reportHistory || [];

  const splitDiagramBlocks = (content) => {
    if (!content) return [{ type: 'text', content: '' }];
    const START_TOKEN = '<<CLOUD_DIAGRAM_SPEC>>';
    const END_TOKEN = '<<END_CLOUD_DIAGRAM_SPEC>>';
    const segments = [];
    let cursor = 0;

    while (cursor < content.length) {
      const startIndex = content.indexOf(START_TOKEN, cursor);
      if (startIndex === -1) {
        segments.push({ type: 'text', content: content.slice(cursor) });
        break;
      }

      if (startIndex > cursor) {
        segments.push({ type: 'text', content: content.slice(cursor, startIndex) });
      }

      const endIndex = content.indexOf(END_TOKEN, startIndex + START_TOKEN.length);
      if (endIndex === -1) {
        segments.push({ type: 'diagram_pending' });
        break;
      }

      const raw = content.slice(startIndex + START_TOKEN.length, endIndex).trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.spec) {
            segments.push({ type: 'diagram', payload: parsed });
          } else {
            segments.push({ type: 'diagram_error' });
          }
        } catch {
          segments.push({ type: 'diagram_error' });
        }
      } else {
        segments.push({ type: 'diagram_error' });
      }

      cursor = endIndex + END_TOKEN.length;
    }

    return segments;
  };

  const splitBlueprintBlocks = (content) => {
    if (!content) return [{ type: 'text', content: '' }];
    const START_TOKEN = '<<BLUEPRINT_RUN>>';
    const END_TOKEN = '<<END_BLUEPRINT_RUN>>';
    const segments = [];
    let cursor = 0;

    while (cursor < content.length) {
      const startIndex = content.indexOf(START_TOKEN, cursor);
      if (startIndex === -1) {
        segments.push({ type: 'text', content: content.slice(cursor) });
        break;
      }

      if (startIndex > cursor) {
        segments.push({ type: 'text', content: content.slice(cursor, startIndex) });
      }

      const endIndex = content.indexOf(END_TOKEN, startIndex + START_TOKEN.length);
      if (endIndex === -1) {
        segments.push({ type: 'blueprint_pending' });
        break;
      }

      const raw = content.slice(startIndex + START_TOKEN.length, endIndex).trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            segments.push({ type: 'blueprint_run', payload: parsed });
          } else {
            segments.push({ type: 'blueprint_error' });
          }
        } catch {
          segments.push({ type: 'blueprint_error' });
        }
      } else {
        segments.push({ type: 'blueprint_error' });
      }

      cursor = endIndex + END_TOKEN.length;
    }

    return segments;
  };

  const deriveBlueprintStatus = (record) => {
    const logData = toLogObject(record?.log);
    const logs = Array.isArray(logData.logs) ? logData.logs : [];
    const status = record?.status || logs[logs.length - 1]?.status || 'pending';
    const currentPhase = Number.isFinite(logData.currentPhase) ? logData.currentPhase : null;
    const currentTask = Number.isFinite(logData.currentTask) ? logData.currentTask : null;
    let entry = null;
    if (currentPhase != null && currentTask != null) {
      entry = logs.find((log) => log.phaseIndex === currentPhase && log.taskIndex === currentTask) || null;
    }
    if (!entry && logs.length) entry = logs[logs.length - 1];
    const message =
      status === 'waiting_on_user_input'
        ? (entry?.output || entry?.task_output || '')
        : '';
    return {
      status,
      message,
      lastUpdated: logData.lastUpdated || null,
      title: record?.title || null
    };
  };

  const fetchBlueprintRunStatus = useCallback(async (recordId) => {
    if (!recordId) return;
    setBlueprintRunStatus((prev) => ({
      ...prev,
      [recordId]: { ...(prev[recordId] || {}), loading: true }
    }));
    try {
      const client = generateClient();
      const response = await client.graphql({
        query: queryGetAgentConnection,
        variables: { recordId }
      });
      const record = response?.data?.getAgentConnection || null;
      const derived = deriveBlueprintStatus(record);
      setBlueprintRunStatus((prev) => ({
        ...prev,
        [recordId]: { ...(prev[recordId] || {}), ...derived, loading: false }
      }));
    } catch (error) {
      setBlueprintRunStatus((prev) => ({
        ...prev,
        [recordId]: {
          ...(prev[recordId] || {}),
          loading: false,
          error: error?.message || String(error)
        }
      }));
    }
  }, []);

  const buildConversationTitle = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${month}-${day}-${year} ${hours}:${minutes}`;
  };

  useEffect(() => {
    sessionContextRef.current = sessionContext;
  }, [sessionContext]);

  const normalizeContext = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') return raw;
    return null;
  };

  const mergeByKey = (current = [], incoming = [], getKey) => {
    const out = Array.isArray(current) ? [...current] : [];
    const indexByKey = new Map();
    out.forEach((item, idx) => {
      const key = getKey(item);
      if (key) indexByKey.set(key, idx);
    });
    (Array.isArray(incoming) ? incoming : []).forEach((item) => {
      const key = getKey(item);
      if (!key) {
        out.push(item);
        return;
      }
      if (indexByKey.has(key)) {
        out[indexByKey.get(key)] = { ...out[indexByKey.get(key)], ...item };
      } else {
        out.push(item);
        indexByKey.set(key, out.length - 1);
      }
    });
    return out;
  };

  const mergeSessionContext = (prev, patch) => {
    const next = { ...prev };
    if (!patch || typeof patch !== 'object') return next;
    if (Array.isArray(patch.environments)) {
      next.environments = mergeByKey(prev.environments, patch.environments, (e) => e?.permissionProfileId || e?.id);
    }
    if (Array.isArray(patch.workloads)) {
      next.workloads = mergeByKey(prev.workloads, patch.workloads, (w) => w?.workloadId || w?.id);
    }
    if (Array.isArray(patch.reports)) {
      next.reports = mergeByKey(prev.reports, patch.reports, (r) => r?.fileId || r?.scanId || r?.reportId);
    }
    if (Array.isArray(patch.fetched)) {
      const mergedFetched = [...(prev.fetched || []), ...patch.fetched];
      next.fetched = mergedFetched.slice(-30);
    }
    if (typeof patch.notes === 'string') {
      next.notes = patch.notes;
    }
    return next;
  };

  const hasNonEmptyContext = (ctx) => {
    if (!ctx) return false;
    if (Array.isArray(ctx.environments) && ctx.environments.length) return true;
    if (Array.isArray(ctx.workloads) && ctx.workloads.length) return true;
    if (Array.isArray(ctx.reports) && ctx.reports.length) return true;
    if (Array.isArray(ctx.fetched) && ctx.fetched.length) return true;
    if (typeof ctx.notes === 'string' && ctx.notes.trim()) return true;
    return false;
  };

  const buildContextNotice = (patch) => {
    if (!patch || typeof patch !== 'object') return 'Context updated';
    if (Array.isArray(patch.reports) && patch.reports.length > 0) {
      const title = patch.reports[0]?.title || patch.reports[0]?.reportId;
      return title ? `Context updated: report ${title}` : 'Context updated: report added';
    }
    if (Array.isArray(patch.environments) && patch.environments.length > 0) {
      const name = patch.environments[0]?.name || patch.environments[0]?.permissionProfileId;
      return name ? `Context updated: environment ${name}` : 'Context updated: environment added';
    }
    if (Array.isArray(patch.workloads) && patch.workloads.length > 0) {
      const name = patch.workloads[0]?.workloadName || patch.workloads[0]?.workloadId;
      return name ? `Context updated: workload ${name}` : 'Context updated: workload added';
    }
    if (typeof patch.notes === 'string' && patch.notes.trim()) {
      return 'Context updated: notes changed';
    }
    return 'Context updated';
  };

  const pushContextNotification = (text) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setContextNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setContextNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const addSuggestion = (payload, patch) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notice = payload?.notice || buildContextNotice(patch);
    setPendingContextSuggestions(prev => [...prev, { id, patch, notice }]);
    pushContextNotification(notice);
  };

  const parseAuthProfile = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) || {};
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') return raw;
    return {};
  };

  const findProfileByRecordId = (recordId) => {
    if (!recordId) return null;
    const fromAvailable = (availableEnvironments || []).find((p) => p.recordId === recordId);
    if (fromAvailable) return fromAvailable;
    return (userProfile?.agentPermissionProfiles || []).find((p) => p.recordId === recordId) || null;
  };

  const findProfileByAccountIdentifier = (accountIdentifier) => {
    if (!accountIdentifier) return null;
    const target = String(accountIdentifier);
    const profiles = userProfile?.agentPermissionProfiles || [];
    for (const profile of profiles) {
      if (!profile?.authProfile) continue;
      const authProfile = parseAuthProfile(profile.authProfile);
      const awsAccountId = authProfile.awsAccountId || authProfile.accountId;
      if (awsAccountId && String(awsAccountId) === target) {
        return profile;
      }
      if (authProfile.domain && String(authProfile.domain) === target) {
        return profile;
      }
    }
    return null;
  };

  const resolveEnvironmentProfilesForWorkload = (workload) => {
    const envValues = Array.isArray(workload?.environments) ? workload.environments : [];
    if (envValues.length === 0) return [];
    const out = [];
    const seen = new Set();

    envValues.forEach((envValue) => {
      if (!envValue) return;
      let profile = null;

      if (typeof envValue === 'object') {
        const recordId = envValue.permissionProfileId || envValue.recordId || null;
        if (recordId) {
          profile = findProfileByRecordId(recordId);
        } else if (envValue.accountId) {
          profile = findProfileByAccountIdentifier(envValue.accountId);
        }
      } else {
        const raw = String(envValue);
        const direct = findProfileByRecordId(raw);
        if (direct) {
          profile = direct;
        } else {
          const accountId = raw.includes(':') ? raw.split(':')[0] : raw;
          profile = findProfileByAccountIdentifier(accountId);
        }
      }

      if (!profile) return;
      const profileId = profile.recordId || profile.id || profile.permissionProfileId;
      if (!profileId || seen.has(profileId)) return;
      seen.add(profileId);
      out.push({
        permissionProfileId: profileId,
        name: profile.name || profileId,
        cloudProvider: profile.type || profile.cloudProvider || null
      });
    });

    return out;
  };

  const applyContextUpdate = useCallback((payload) => {
    const normalized = normalizeContext(payload);
    let patch = normalized?.patch || normalized?.context || normalized;
    if (!patch) return;
    if (Array.isArray(patch.workloads)) {
      const envProfiles = [];
      patch.workloads.forEach((item) => {
        const workloadId = typeof item === 'string' ? item : item?.workloadId || item?.id;
        if (!workloadId) return;
        const workload = availableWorkloads.find((w) => w.workloadId === workloadId);
        if (!workload) return;
        const envs = resolveEnvironmentProfilesForWorkload(workload);
        if (envs.length) {
          envProfiles.push(...envs);
        }
      });
      if (envProfiles.length) {
        patch = {
          ...patch,
          environments: mergeByKey(patch.environments || [], envProfiles, (e) => e?.permissionProfileId || e?.id)
        };
      }
    }
    const mode = normalized?.mode || 'apply';
    if (mode === 'suggest') {
      addSuggestion(normalized, patch);
      return;
    }
    setSessionContext(prev => {
      const next = mergeSessionContext(prev, patch);
      sessionContextRef.current = next;
      return next;
    });
    pushContextNotification(normalized?.notice || buildContextNotice(patch));
  }, [
    availableWorkloads,
    buildContextNotice,
    mergeSessionContext,
    mergeByKey,
    normalizeContext,
    pushContextNotification,
    resolveEnvironmentProfilesForWorkload,
    addSuggestion
  ]);

  const applySuggestion = (id, patch) => {
    setSessionContext(prev => {
      const next = mergeSessionContext(prev, patch);
      sessionContextRef.current = next;
      return next;
    });
    setPendingContextSuggestions(prev => prev.filter(s => s.id !== id));
    pushContextNotification('Context updated');
  };

  const dismissSuggestion = (id) => {
    setPendingContextSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const showQuickTips = messages.length === 1 && messages[0]?.type === 'assistant';

  const closeModal = () => {
    if (onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };

  const addEnvironmentById = () => {
    if (!selectedEnvironmentId) return;
    const env = availableEnvironments.find((p) => p.recordId === selectedEnvironmentId);
    if (!env) return;
    setSessionContext(prev => {
      const next = mergeSessionContext(prev, {
        environments: [
          {
            permissionProfileId: env.recordId,
            name: env.name,
            cloudProvider: env.type || env.cloudProvider || null
          }
        ]
      });
      sessionContextRef.current = next;
      return next;
    });
    setSelectedEnvironmentId('');
  };

  const addWorkloadById = () => {
    if (!selectedWorkloadId) return;
    const workload = availableWorkloads.find((w) => w.workloadId === selectedWorkloadId);
    if (!workload) return;
    setSessionContext(prev => {
      const envProfiles = resolveEnvironmentProfilesForWorkload(workload);
      const next = mergeSessionContext(prev, {
        workloads: [
          {
            workloadId: workload.workloadId,
            workloadName: workload.workloadName || workload.name || 'Workload'
          }
        ],
        ...(envProfiles.length ? { environments: envProfiles } : {})
      });
      sessionContextRef.current = next;
      return next;
    });
    setSelectedWorkloadId('');
  };

  const removeEnvironment = (permissionProfileId) => {
    setSessionContext(prev => {
      const next = {
        ...prev,
        environments: (prev.environments || []).filter(e => e.permissionProfileId !== permissionProfileId)
      };
      sessionContextRef.current = next;
      return next;
    });
  };

  const removeWorkload = (workloadId) => {
    setSessionContext(prev => {
      const next = {
        ...prev,
        workloads: (prev.workloads || []).filter(w => w.workloadId !== workloadId)
      };
      sessionContextRef.current = next;
      return next;
    });
  };

  const removeReport = (key) => {
    setSessionContext(prev => {
      const next = {
        ...prev,
        reports: (prev.reports || []).filter(r => (r.fileId || r.scanId || r.reportId) !== key)
      };
      sessionContextRef.current = next;
      return next;
    });
  };

  const resolvePermissionProfileIdForScan = (scan) => {
    if (!scan) return null;
    if (scan.permissionProfileId) return scan.permissionProfileId;
    if (scan.parentId) return scan.parentId;
    if (!scan.accountId) return null;
    const scanAccountId = String(scan.accountId);
    const scanCloudProvider = scan.cloudProvider || 'aws';
    for (const profile of (userProfile?.agentPermissionProfiles || [])) {
      if (!profile.authProfile) continue;
      const authProfile = parseAuthProfile(profile.authProfile);
      if (scanCloudProvider === 'google_workspace' && authProfile.provider === 'google_workspace') {
        if (authProfile.domain && String(authProfile.domain) === scanAccountId) {
          return profile.recordId || profile.id || profile.permissionProfileId || null;
        }
      }
      const profileAccountId = authProfile.awsAccountId || authProfile.accountId;
      if (profileAccountId && String(profileAccountId) === scanAccountId) {
        return profile.recordId || profile.id || profile.permissionProfileId || null;
      }
    }
    return null;
  };

  const buildEnvironmentPatch = (permissionProfileId) => {
    if (!permissionProfileId) return null;
    const env = availableEnvironments.find((p) => p.recordId === permissionProfileId);
    return {
      environments: [
        {
          permissionProfileId: env?.recordId || permissionProfileId,
          name: env?.name || permissionProfileId,
          cloudProvider: env?.type || env?.cloudProvider || null
        }
      ]
    };
  };

  const resolveEnvName = (scan) => {
    if (!scan) return null;
    // First try direct permissionProfileId / parentId match
    const directId = scan.permissionProfileId || scan.parentId;
    if (directId) {
      const directMatch = (userProfile?.agentPermissionProfiles || []).find(p => p.recordId === directId);
      if (directMatch?.name) return directMatch.name;
    }
    // Fallback: match by accountId (same logic as /dashboard/reports)
    if (!scan.accountId) return null;
    const scanAccountId = String(scan.accountId);
    const scanCloudProvider = scan.cloudProvider || 'aws';
    for (const profile of (userProfile?.agentPermissionProfiles || [])) {
      if (!profile.authProfile) continue;
      let authProfile = {};
      if (typeof profile.authProfile === 'string') {
        try { authProfile = JSON.parse(profile.authProfile) || {}; } catch { continue; }
      } else if (typeof profile.authProfile === 'object') {
        authProfile = profile.authProfile;
      }
      if (scanCloudProvider === 'google_workspace' && authProfile.provider === 'google_workspace') {
        if (authProfile.domain && String(authProfile.domain) === scanAccountId) return profile.name || null;
      }
      const profileAccountId = authProfile.awsAccountId || authProfile.accountId;
      if (profileAccountId && String(profileAccountId) === scanAccountId) return profile.name || null;
    }
    return scanAccountId;
  };

  const resolveEnvAccountId = (permissionProfileId) => {
    if (!permissionProfileId) return null;
    const profile = (userProfile?.agentPermissionProfiles || []).find(p => p.recordId === permissionProfileId);
    if (!profile) return null;
    if (typeof profile.authProfile === 'string') {
      try {
        const parsed = JSON.parse(profile.authProfile || '{}');
        return parsed.awsAccountId || null;
      } catch {
        return null;
      }
    }
    const authProfile = profile.authProfile || {};
    return authProfile.awsAccountId || null;
  };

  const selectedEnvironment = (sessionContext.environments || [])[0] || null;
  const selectedEnvironmentAccountId = selectedEnvironment?.permissionProfileId
    ? resolveEnvAccountId(selectedEnvironment.permissionProfileId)
    : null;

  const availableReports = (accountScans || [])
    .filter((scan) => scan?.reportId)
    .filter((scan) => {
      if (!selectedEnvironment) return true;
      if (scan.permissionProfileId && scan.permissionProfileId === selectedEnvironment.permissionProfileId) return true;
      if (scan.parentId && scan.parentId === selectedEnvironment.permissionProfileId) return true;
      if (selectedEnvironmentAccountId && scan.accountId === selectedEnvironmentAccountId) return true;
      return false;
    })
    .sort((a, b) => {
      const aTime = Date.parse(a?.lastUpdateTime || a?.updatedAt || '') || 0;
      const bTime = Date.parse(b?.lastUpdateTime || b?.updatedAt || '') || 0;
      return bTime - aTime;
    });

  const applyReportContextUpdate = (resp, { report, resolvedPermissionProfileId } = {}) => {
    let nextContext = sessionContextRef.current;
    let patch = resp?.contextPatch || null;
    if (!patch && resp?.fileId) {
      patch = {
        reports: [
          {
            reportId: resp.reportId || report?.reportId,
            scanId: resp.scanId || report?.scanId,
            permissionProfileId: resp.permissionProfileId || resolvedPermissionProfileId || null,
            title: resp.title || report?.title || null,
            fileId: resp.fileId,
            loadedAt: new Date().toISOString()
          }
        ],
        fetched: [
          {
            type: 'report_loaded',
            label: resp.title ? `Loaded report ${resp.title}` : `Loaded report ${resp.reportId || report?.reportId}`,
            timestamp: new Date().toISOString()
          }
        ]
      };
    }
    if (resolvedPermissionProfileId) {
      const envPatch = buildEnvironmentPatch(resolvedPermissionProfileId);
      if (envPatch) {
        patch = patch ? { ...patch, ...envPatch } : envPatch;
      }
    }
    if (patch) {
      nextContext = mergeSessionContext(nextContext, patch);
      setSessionContext(nextContext);
      sessionContextRef.current = nextContext;
    }
    pushContextNotification(resp?.contextNotice || 'Context updated: report loaded');
    return nextContext;
  };

  const handleAddReportToContext = async () => {
    if (!selectedReportScanId || reportLoading) return;
    const report = availableReports.find(
      (r) => buildReportEntryKey(r) === selectedReportScanId
    );
    if (!report) return;
    setReportLoading(true);
    try {
      const resolvedPermissionProfileId =
        selectedEnvironment?.permissionProfileId || resolvePermissionProfileIdForScan(report) || undefined;
      const resp = await prepareReportFile({
        scanId: report.scanId,
        reportId: report.reportId,
        permissionProfileId: resolvedPermissionProfileId
      });
      applyReportContextUpdate(resp, { report, resolvedPermissionProfileId });
    } catch (err) {
      console.error('Failed to prepare report file:', err);
      pushContextNotification('Failed to load report');
    } finally {
      setReportLoading(false);
      setSelectedReportScanId('');
    }
  };

  // Generate a unique session ID
  const generateSessionId = () => {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const persistSessionContext = useCallback(async (nextContext) => {
    if (!isAuthenticated || loading) return null;
    const ctx = nextContext || sessionContextRef.current;
    if (!hasNonEmptyContext(ctx) && !currentRecordId) return null;
    let recordId = currentRecordId;
    let effectiveSessionId = sessionId;
    try {
      if (!effectiveSessionId) {
        effectiveSessionId = generateSessionId();
        setSessionId(effectiveSessionId);
      }
      let existingMetadata = {};
      if (recordId && chatsById[recordId]?.metadata) {
        try {
          existingMetadata = typeof chatsById[recordId].metadata === 'string'
            ? JSON.parse(chatsById[recordId].metadata)
            : (chatsById[recordId].metadata || {});
        } catch {}
      }
      if (!recordId) {
        const started = await dispatch(
          startChatThunk({
            sessionId: effectiveSessionId,
            title: buildConversationTitle(),
            metadata: { ...existingMetadata, source: 'HelpChatModal', sessionContext: ctx }
          })
        ).unwrap();
        recordId = started.recordId;
        setCurrentRecordId(recordId);
        dispatch(setCurrentChatId(recordId));
        return recordId;
      }
      await dispatch(
        startChatThunk({
          recordId,
          sessionId: effectiveSessionId,
          title: chatsById[recordId]?.title || buildConversationTitle(),
          metadata: { ...existingMetadata, source: 'HelpChatModal', sessionContext: ctx }
        })
      ).unwrap();
      return recordId;
    } catch (error) {
      console.error('Failed to persist session context:', error);
      return null;
    }
  }, [chatsById, currentRecordId, dispatch, hasNonEmptyContext, isAuthenticated, loading, sessionId]);

  // Initialize session on component mount
  useEffect(() => {
    if (!sessionId) {
      setSessionId(generateSessionId());
    }
  }, [sessionId]);

  // Persist session context to chat record so it survives reopen
  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const ctx = sessionContextRef.current;
    if (!hasNonEmptyContext(ctx) && !currentRecordId) return;
    const serialized = JSON.stringify(ctx);
    if (serialized === lastPersistedContextRef.current) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      lastPersistedContextRef.current = serialized;
      persistSessionContext(ctx);
    }, 400);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [sessionContext, currentRecordId, isAuthenticated, loading, persistSessionContext]);

  // Load recent chats when modal opens (only if authenticated)
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      dispatch(listRecentChats({ limit: 10 }));
    }
  }, [isOpen, isAuthenticated, dispatch]);

  // Fetch chat list when history pane is opened (only if authenticated)
  useEffect(() => {
    if (isHistoryVisible && isAuthenticated) {
      dispatch(listRecentChats({ limit: 50 }));
    }
  }, [isHistoryVisible, isAuthenticated, dispatch]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Observe recent chat ids/state to verify list results
  useEffect(() => {
    const count = Array.isArray(recentChatIds) ? recentChatIds.length : 0;
  }, [recentChatIds]);

  // Auto-send initial message if provided
  const initialMessageSentRef = React.useRef(false);
  useEffect(() => {
    if (initialMessage && initialMessage.trim() && !initialMessageSentRef.current && isAuthenticated && !loading) {
      initialMessageSentRef.current = true;
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        handleSendMessage();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [initialMessage, isAuthenticated, loading]);

  // Auto-focus input when modal opens (authenticated users only)
  useEffect(() => {
    if (isOpen && isAuthenticated && !loading && !initialMessage) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isAuthenticated, loading, initialMessage]);

  // Preload a report into context if provided by the caller
  useEffect(() => {
    if (!preloadReport || !isOpen) return;
    if (!isAuthenticated || loading) return;
    const key = [
      preloadReport.scanId || '',
      preloadReport.reportId || '',
      preloadReport.permissionProfileId || ''
    ].join(':');
    if (lastPreloadKeyRef.current === key) return;
    const existingReports = sessionContextRef.current?.reports || [];
    const alreadyLoaded = existingReports.some((r) => {
      if (
        preloadReport.scanId
        && r.scanId === preloadReport.scanId
        && preloadReport.reportId
        && r.reportId
      ) {
        return r.reportId === preloadReport.reportId;
      }

      if (preloadReport.reportId && r.reportId === preloadReport.reportId) {
        return !preloadReport.scanId || !r.scanId;
      }

      return false;
    });
    if (alreadyLoaded) {
      lastPreloadKeyRef.current = key;
      return;
    }
    lastPreloadKeyRef.current = key;
    const run = async () => {
      setReportLoading(true);
      try {
        const scanRecord = findAccountScan(accountScans || [], {
          scanId: preloadReport.scanId,
          reportId: preloadReport.reportId,
        });
        const resolvedPermissionProfileId =
          preloadReport.permissionProfileId ||
          resolvePermissionProfileIdForScan(scanRecord) ||
          undefined;
        const resp = await prepareReportFile({
          scanId: preloadReport.scanId,
          reportId: preloadReport.reportId,
          permissionProfileId: resolvedPermissionProfileId
        });
        applyReportContextUpdate(resp, {
          report: scanRecord || preloadReport,
          resolvedPermissionProfileId
        });
      } catch (error) {
        console.error('Failed to preload report:', error);
        pushContextNotification('Failed to load report');
      } finally {
        setReportLoading(false);
      }
    };
    run();
  }, [accountScans, applyReportContextUpdate, isAuthenticated, isOpen, loading, preloadReport, resolvePermissionProfileIdForScan]);


  

  // Start a new chat session
  const handleNewChat = () => {
    const freshContext = {
      environments: [],
      workloads: [],
      reports: [],
      fetched: [],
      notes: ''
    };
    setMessages([
      {
        id: 1,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        tools: [],
        activeTools: []
      }
    ]);
    setSessionId(generateSessionId());
    setMessage('');
    setActiveTools([]);
    setCompletedTools([]);
    setCurrentRecordId(null);
    setLastResponseId(null);
    setSessionContext(freshContext);
    sessionContextRef.current = freshContext;
    setSelectedEnvironmentId('');
    setSelectedWorkloadId('');
    setPendingContextSuggestions([]);
    setContextNotifications([]);
    lastPersistedContextRef.current = null;

    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    dispatch(startChatThunk({ sessionId: newSessionId, title: buildConversationTitle(), metadata: { source: 'HelpChatModal', sessionContext: freshContext } }))
      .unwrap()
      .then(chat => {
        setCurrentRecordId(chat.recordId);
        dispatch(setCurrentChatId(chat.recordId));
        // Focus input after new chat is created
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      })
      .catch(() => {});
  };

  const sendMessage = useCallback(async (rawMessage) => {
    const trimmed = (rawMessage || '').trim();
    if (!trimmed || isLoading) return;
    if (rawMessage === message) {
      setMessage('');
    }
    const userMessage = trimmed;
    setIsLoading(true);
    const nextSessionId = sessionId || generateSessionId();
    if (!sessionId) {
      setSessionId(nextSessionId);
    }
    // Add user message to chat
    const userMessageObj = {
      id: messages.length + 1,
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessageObj]);

    // Create a placeholder message for streaming updates
    const assistantMessageId = messages.length + 2;
    const initialAssistantMessage = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      tools: [],
      activeTools: []
    };
    
    setMessages(prev => [...prev, initialAssistantMessage]);
    setActiveTools([]);

    try {
      // Ensure a backend chat record exists before sending
      let recordId = currentRecordId;
      if (!recordId) {
        const started = await dispatch(
          startChatThunk({
            sessionId: nextSessionId,
            title: buildConversationTitle(),
            metadata: { source: 'HelpChatModal', sessionContext: sessionContextRef.current }
          })
        ).unwrap();
        recordId = started.recordId;
        setCurrentRecordId(recordId);
        dispatch(setCurrentChatId(recordId));
      }

      // Send message to backend with streaming callback
      const contextForSend = sessionContextRef.current;
      const result = await sendChatMessage(
        {
          sessionId: nextSessionId,
          message: userMessage,
          previousResponseId: lastResponseId,
          sessionContext: contextForSend,
        },
        {
          onToken: (fullResponse) => {
            // Update the assistant message with streaming content
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { 
                      ...msg, 
                      content: fullResponse, 
                      isStreaming: true
                    }
                  : msg
              )
            );
          },
          onToolCall: (toolName) => {
            setMessages(prev => prev.map(msg => {
              if (msg.id !== assistantMessageId) return msg;
              const current = msg.activeTools || [];
              return current.includes(toolName) ? msg : { ...msg, activeTools: [...current, toolName] };
            }));
          },
          onToolResult: (toolName) => {
            setMessages(prev => prev.map(msg => {
              if (msg.id !== assistantMessageId) return msg;
              const active = (msg.activeTools || []).filter(t => t !== toolName);
              const done = (msg.tools || []).includes(toolName) ? (msg.tools || []) : [ ...(msg.tools || []), toolName ];
              return { ...msg, activeTools: active, tools: done };
            }));
          },
          onFinal: (fullResponse, responseId) => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { 
                      ...msg, 
                      content: fullResponse, 
                      isStreaming: false
                    }
                  : msg
              )
            );
            if (responseId) {
              setLastResponseId(responseId);
            }
          },
          onContextUpdate: (payload) => {
            applyContextUpdate(payload);
          },
          onDone: () => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
          },
        }
      );

      // Mark streaming as complete
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

      // Persist messages to AppSync
      const assistantText = (result && result.message) || '';
      const responseIdFromServer = (result && result.responseId) || null;
      if (responseIdFromServer) {
        setLastResponseId(responseIdFromServer);
      }
      try {
        // Merge existing metadata with new responseId
        const existingMetadataRaw = (chatsById[recordId] && chatsById[recordId].metadata) || null;
        let existingMetadata = {};
        if (existingMetadataRaw) {
          try { existingMetadata = typeof existingMetadataRaw === 'string' ? JSON.parse(existingMetadataRaw) : (existingMetadataRaw || {}); } catch {}
        }
        const metadataToSave = {
          ...existingMetadata,
          responseId: responseIdFromServer || existingMetadata.responseId || null,
          sessionContext: contextForSend,
        };

        await dispatch(
          appendChatMessagesThunk({
            recordId: recordId,
            messages: [
              { role: 'user', content: userMessage },
              { role: 'assistant', content: assistantText },
            ],
            metadata: metadataToSave,
          })
        ).unwrap();
      } catch (err) {
        console.error('Failed to append chat messages:', err);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Replace the streaming message with error message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                content: 'Sorry, I\'m having trouble connecting to the server right now. Please try again later.',
                isStreaming: false 
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      // Refocus input after sending message
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [
    chatsById,
    currentRecordId,
    dispatch,
    isLoading,
    lastResponseId,
    message,
    messages.length,
    sessionId,
    sessionContext,
    applyContextUpdate
  ]);

  const handleSendMessage = () => {
    sendMessage(message);
  };

  useEffect(() => {
    const trimmed = (autoSendMessage || '').trim();
    if (!trimmed || !isOpen) return;
    if (!isAuthenticated || loading) return;
    if (lastAutoSentRef.current === trimmed) return;
    if (isLoading) return;
    lastAutoSentRef.current = trimmed;
    sendMessage(trimmed);
  }, [autoSendMessage, isAuthenticated, isLoading, isOpen, loading, sendMessage]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeModal();
        }
      }}
    >
      <DialogContent className="w-screen h-screen max-w-none p-0 gap-0 bg-white flex flex-col rounded-none">
        {!isAuthenticated && !loading ? (
          // Full modal authentication prompt
          <>
            <div className="p-4 flex justify-between border-b border-gray-200">
              <div className="flex items-center gap-2 text-primary-600 font-medium">
                <Icons.chatStar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                CloudAgent
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex items-center justify-center min-h-full p-8">
                <div className="space-y-6 max-w-2xl mx-auto w-full">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
                      <Icons.chatStar className="w-10 h-10 text-primary-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-semibold text-gray-900">CloudAgent Chat</h3>
                      <p className="text-lg text-gray-600">
                        Use chat to explore AWS best practices, build new workloads, review infrastructure health, run reports — or any of the other functionality CloudAgent offers.
                      </p>
                    </div>
                  </div>

                  {/* Call to action */}
                  <div className="text-center space-y-4">
                    <div className="space-y-3">
                      <Button 
                        onClick={() => {
                          onClose?.();
                          navigate('/signup');
                        }}
                        className="w-full text-lg py-3"
                        size="lg"
                      >
                        Sign Up for Free
                      </Button>
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            onClose?.();
                            navigate('/login');
                          }}
                          className="flex-1"
                          size="lg"
                        >
                          Sign In
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => {
                            onClose?.();
                            navigate('/pricing');
                          }}
                          className="flex-1 text-primary-600 hover:text-primary-700"
                          size="lg"
                        >
                          View Pricing
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center justify-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>

                  {/* Example chat requests */}
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 text-center">
                      Try asking things like:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { icon: '🏗️', text: 'Generate architecture diagrams' },
                        { icon: '🔍', text: 'List workloads & highlight risks' },
                        { icon: '☁️', text: 'Build new cloud environments' },
                        { icon: '💻', text: 'List my compute resources' },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700"
                        >
                          <span className="text-base">{item.icon}</span>
                          <span className="text-sm">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : loading ? (
          // Full modal loading state
          <>
            <div className="p-4 flex justify-between border-b border-gray-200">
              <div className="flex items-center gap-2 text-primary-600 font-medium">
                <Icons.chatStar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                CloudAgent
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          </>
        ) : (
          // Authenticated chat interface
          <>
            <div className="p-4 flex justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = !isHistoryVisible;
                    setIsHistoryVisible(next);
                  }}
                  className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2 text-primary-600 font-medium">
                  <Icons.chatStar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                  CloudAgent
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isHistoryVisible && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNewChat}
                    className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
                    title="New Chat"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex h-full overflow-hidden ">
              {isHistoryVisible && (
                <div className="w-64 flex flex-col border-r border-gray-200">
                  <ScrollArea className="flex-1">
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
                        <span>History</span>
                      </div>

                      <div className="space-y-1">
                        {recentChatIds.map((id) => {
                          const chat = chatsById[id];
                          if (!chat) return null;
                          const title = chat.title || 'Untitled chat';
                          return (
                            <Button
                              key={id}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-primary-600 hover:bg-gray-100 h-8 font-normal"
                              onClick={async () => {
                                try {
                                  let fetched = chat;
                                  if (!fetched.messages || fetched.messages.length === 0) {
                                    fetched = await dispatch(getChatRecord({ recordId: id })).unwrap();
                                  }
                                  setCurrentRecordId(id);
                                  dispatch(setCurrentChatId(id));
                                  const mapped = (fetched?.messages || []).map((m, idx) => ({
                                    id: idx + 1,
                                    type: m.role === 'user' ? 'user' : 'assistant',
                                    content: m.content,
                                    timestamp: new Date(m.createdAt || Date.now()),
                                  }));
                                  if (mapped.length > 0) setMessages(mapped);
                                  // Initialize lastResponseId from chat metadata if present
                                  try {
                                    const mdRaw = fetched?.metadata;
                                    const md = typeof mdRaw === 'string' ? JSON.parse(mdRaw) : mdRaw;
                                    setLastResponseId(md?.responseId || null);
                                    if (md?.sessionContext) {
                                      const normalized = normalizeContext(md.sessionContext);
                                      if (normalized) {
                                        setSessionContext(normalized);
                                        sessionContextRef.current = normalized;
                                      }
                                    }
                                    setPendingContextSuggestions([]);
                                  } catch {}
                                } catch (e) {
                                  console.error('Failed to load chat:', e);
                                }
                              }}
                            >
                              {title}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="p-3">
                    <Button className="w-full" onClick={handleNewChat}>New chat</Button>
                  </div>
                </div>
              )}

              <div className="flex-1 flex h-full overflow-hidden">
                <div className="flex-1 flex border rounded-[20px] m-3 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-primary-600 text-sm">
                      {(currentRecordId && chatsById[currentRecordId]?.title) || 'New Chat'}
                    </span>
                  </div>
                  {!isContextVisible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsContextVisible(true)}
                      className="h-8 px-2 text-gray-500 hover:text-gray-700 gap-1.5"
                      title="Show session context"
                    >
                      <PanelRight className="h-4 w-4" />
                      <span className="text-xs">Context</span>
                    </Button>
                  )}
                </div>

                {contextNotifications.length > 0 && (
                  <div className="px-4 pb-2">
                    <div className="space-y-2">
                      {contextNotifications.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700"
                        >
                          {note.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {showQuickTips && (
                      <div className="space-y-3">
                        <div className="text-center space-y-1">
                          <p className="text-sm text-gray-500">
                            Your AI assistant for cloud infrastructure
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { icon: '🏗️', label: 'Generate diagrams', prompt: 'Generate a diagram for a basic VPC setup' },
                            { icon: '🔍', label: 'List workloads & risks', prompt: 'List my workloads and highlight any risks' },
                            { icon: '☁️', label: 'Build new cloud environments', prompt: 'Help me build a new cloud environment' },
                            { icon: '💻', label: 'List compute resources', prompt: 'List my compute resources across my cloud environments' },
                          ].map((item, i) => (
                            <button
                              key={i}
                              onClick={() => setMessage(item.prompt)}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors text-left group"
                            >
                              <span className="text-base">{item.icon}</span>
                              <span className="text-sm text-gray-600 group-hover:text-gray-900">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((msg, index) => {
                      // Skip rendering the empty initial assistant placeholder message
                      if (index === 0 && msg.type === 'assistant' && !msg.content) {
                        return null;
                      }
                      return (
                    <div key={msg.id} className="space-y-2">
                      {/* Tool badges */}
                      {((msg.tools && msg.tools.length > 0) || (msg.activeTools && msg.activeTools.length > 0)) && (
                        <div className="flex flex-wrap gap-2 ml-2">
                          {/* Active tools (blue - currently running) */}
                          {msg.activeTools && msg.activeTools.map((toolName, index) => (
                            <div 
                              key={`active-${index}`}
                              className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
                            >
                              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                              {getToolStatusLabel(toolName, true)}
                            </div>
                          ))}
                          
                          {/* Completed tools (green - finished) */}
                          {msg.tools && msg.tools.map((toolName, index) => (
                            <div 
                              key={`completed-${index}`}
                              className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium"
                            >
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              {getToolStatusLabel(toolName, false)}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Message content */}
                      <Card 
                        className={`p-4 ${
                          msg.type === 'user' 
                            ? 'bg-primary-50 ml-8 border-blue-200' 
                            : 'bg-white border-primary-200'
                        }`}
                      >
                        {msg.type === 'user' ? (
                          // User messages - keep as plain text
                          <p className="text-gray-800 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        ) : (
                          // Assistant messages - markdown formatting + suggestion bubbles
                          <div className="text-gray-800 max-w-none">
                            {msg.content && (
                              <div className="space-y-3">
                                {splitBlueprintBlocks(msg.content).map((segment, idx) => {
                                  if (segment.type === 'blueprint_pending') {
                                    return (
                                      <div
                                        key={`blueprint-pending-${msg.id}-${idx}`}
                                        className="rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center gap-2"
                                      >
                                        <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                                        Blueprint run starting...
                                      </div>
                                    );
                                  }
                                  if (segment.type === 'blueprint_error') {
                                    return (
                                      <div
                                        key={`blueprint-error-${msg.id}-${idx}`}
                                        className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700"
                                      >
                                        Blueprint status unavailable.
                                      </div>
                                    );
                                  }
                                  if (segment.type === 'blueprint_run') {
                                    const payload = segment.payload || {};
                                    const recordId =
                                      payload.recordId || payload.agentRunId || payload.runId || '';
                                    const cached = recordId ? blueprintRunStatus[recordId] || {} : {};
                                    const status =
                                      cached.status || payload.status || 'running';
                                    const title =
                                      cached.title || payload.title || 'Blueprint run';
                                    const message =
                                      status === 'waiting_on_user_input'
                                        ? (cached.message || payload.message || '')
                                        : '';
                                    const loading = Boolean(cached.loading);
                                    const statusLower = String(status || '').toLowerCase();
                                    const statusBadgeClass =
                                      statusLower === 'waiting_on_user_input'
                                        ? 'bg-amber-100 text-amber-800'
                                        : statusLower === 'complete'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : statusLower === 'failed'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-blue-100 text-blue-700';
                                    const statusLabel = statusLower.replace(/_/g, ' ') || 'running';

                                    return (
                                      <div
                                        key={`blueprint-run-${msg.id}-${idx}`}
                                        className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 space-y-3"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold">
                                              Blueprint Run
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900">
                                              {title}
                                            </div>
                                          </div>
                                          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass}`}>
                                            {statusLabel}
                                          </div>
                                        </div>

                                        {statusLower === 'waiting_on_user_input' && (
                                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                              Input Needed
                                            </div>
                                            <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                              {message || 'The blueprint run is waiting for input.'}
                                            </div>
                                          </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={loading || !recordId}
                                            onClick={() => fetchBlueprintRunStatus(recordId)}
                                          >
                                            {loading ? 'Refreshing…' : 'Refresh'}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-blue-700"
                                            onClick={() => recordId && navigate(`/dashboard/agent/${recordId}`)}
                                          >
                                            View progress
                                            <ExternalLink className="w-4 h-4 ml-2" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (segment.type === 'text') {
                                    if (!segment.content || !segment.content.trim()) {
                                      return null;
                                    }
                                    return splitDiagramBlocks(segment.content).map((sub, subIdx) => {
                                      if (sub.type === 'diagram') {
                                        return (
                                          <DiagramChatPreview
                                            key={`diagram-${msg.id}-${idx}-${subIdx}`}
                                            payload={sub.payload}
                                            onCloseChat={closeModal}
                                          />
                                        );
                                      }
                                      if (sub.type === 'diagram_pending') {
                                        return (
                                          <div
                                            key={`diagram-pending-${msg.id}-${idx}-${subIdx}`}
                                            className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 flex items-center gap-2"
                                          >
                                            <span className="inline-block h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                                            Loading diagram...
                                          </div>
                                        );
                                      }
                                      if (sub.type === 'diagram_error') {
                                        return (
                                          <div
                                            key={`diagram-error-${msg.id}-${idx}-${subIdx}`}
                                            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
                                          >
                                            Diagram preview unavailable.
                                          </div>
                                        );
                                      }
                                      if (!sub.content || !sub.content.trim()) {
                                        return null;
                                      }
                                      return (
                                        <div key={`text-${msg.id}-${idx}-${subIdx}`} className="prose prose-sm">
                                          <Markdown
                                            options={{
                                              overrides: {
                                                h1: { props: { className: 'text-lg font-bold mb-2 mt-4' } },
                                                h2: { props: { className: 'text-base font-bold mb-2 mt-3' } },
                                                h3: { props: { className: 'text-sm font-bold mb-1 mt-2' } },
                                                p: { props: { className: 'mb-2 last:mb-0' } },
                                                ul: { props: { className: 'list-disc pl-5 mb-2 space-y-1' } },
                                                ol: { props: { className: 'list-decimal pl-5 mb-2 space-y-1' } },
                                                li: { props: { className: 'text-gray-800' } },
                                                code: { props: { className: 'bg-gray-100 px-1 py-0.5 rounded text-sm font-mono' } },
                                                pre: { props: { className: 'bg-gray-100 p-3 rounded overflow-x-auto mb-2' } },
                                                blockquote: { props: { className: 'border-l-4 border-gray-300 pl-4 italic mb-2' } }
                                              }
                                            }}
                                          >
                                            {sub.content}
                                          </Markdown>
                                        </div>
                                      );
                                    });
                                  }

                                  return null;
                                })}
                              </div>
                            )}
                            {msg.suggestions && msg.suggestions.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-sm text-gray-500">Here are some things I can help with in CloudAgent and your connected cloud environments:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {msg.suggestions.map((suggestion, i) => {
                                    const prompts = [
                                      'Generate a diagram for a basic VPC setup',
                                      'List my workloads and highlight any risks',
                                      'Help me build a new cloud environment',
                                      'List my compute resources across my cloud environments',
                                    ];
                                    return (
                                      <button
                                        key={i}
                                        onClick={() => setMessage(prompts[i] || suggestion)}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors text-left group"
                                      >
                                        <span className="text-base">{['🏗️', '🔍', '☁️', '💻'][i] || '💡'}</span>
                                        <span className="text-sm text-gray-600 group-hover:text-gray-900 line-clamp-2">{suggestion}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {msg.isStreaming && (
                              <span className="inline-block w-2 h-5 bg-primary-600 ml-1 animate-pulse"></span>
                            )}
                          </div>
                        )}
                        {msg.content === '' && msg.isStreaming && (
                          <p className="text-gray-500 italic">
                            <span className="animate-pulse">Assistant is thinking...</span>
                          </p>
                        )}
                      </Card>
                    </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4">
                  <div className="flex gap-3 border rounded-[8px] p-2">
                    <Input
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about CloudAgent or your cloud environments"
                      className="border-none outline-none py-2 focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:outline-none"
                      wrapperClassName="flex-1"
                    />
                    <Button
                      size="md"
                      onClick={handleSendMessage}
                      disabled={!message.trim() || isLoading}
                      className=" disabled:bg-gray-300"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isLoading ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
                {isContextVisible && (
                  <>
                  <div className="w-px bg-gray-200 my-4" />
                  <div className="w-72 sm:w-80 flex flex-col bg-gray-50/40">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700">Session Context</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsContextVisible(false)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                        title="Hide context"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Cloud className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Environments</span>
                          </div>
                          {(sessionContext.environments || []).length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center mb-2">
                              <p className="text-xs text-gray-400">No environments added</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5 mb-2">
                              {(sessionContext.environments || []).map((env) => (
                                <div
                                  key={env.permissionProfileId}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                                    <span className="text-xs text-gray-700 truncate">{env.name || env.permissionProfileId}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeEnvironment(env.permissionProfileId)}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                            onClick={() => setIsEnvironmentModalOpen(true)}
                          >
                            <Plus className="h-3 w-3" />
                            Add environment
                          </button>
                          <button
                            type="button"
                            className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            onClick={() => {
                              onClose?.();
                              navigate('/dashboard/cloud-setup');
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Set up new environment
                          </button>

                          {/* Add Environment Modal */}
                          {isEnvironmentModalOpen && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
                              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                  <h3 className="text-sm font-semibold text-gray-800">Add Environment to Context</h3>
                                  <button
                                    type="button"
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                    onClick={() => {
                                      setIsEnvironmentModalOpen(false);
                                      setSelectedEnvironmentId('');
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="px-5 pt-3 pb-1">
                                  {availableEnvironments.length === 0 ? (
                                    <div className="text-center py-8">
                                      <Cloud className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                      <p className="text-sm text-gray-500">No environments available</p>
                                      <p className="text-xs text-gray-400 mt-1">Set up a cloud environment to get started.</p>
                                      <button
                                        type="button"
                                        className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
                                        onClick={() => {
                                          setIsEnvironmentModalOpen(false);
                                          onClose?.();
                                          navigate('/dashboard/cloud-setup');
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Go to Cloud Setup
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-gray-50 text-gray-500 text-left sticky top-0">
                                            <th className="px-3 py-2 font-medium">Name</th>
                                            <th className="px-3 py-2 font-medium">Type</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {availableEnvironments.map((env) => {
                                            const isSelected = selectedEnvironmentId === env.recordId;
                                            const alreadyAdded = (sessionContext.environments || []).some(e => e.permissionProfileId === env.recordId);
                                            return (
                                              <tr
                                                key={env.recordId}
                                                className={`border-t border-gray-100 transition-colors ${
                                                  alreadyAdded
                                                    ? 'opacity-40 cursor-default'
                                                    : isSelected
                                                    ? 'bg-primary-50 cursor-pointer'
                                                    : 'hover:bg-gray-50 cursor-pointer'
                                                }`}
                                                onClick={() => {
                                                  if (!alreadyAdded) setSelectedEnvironmentId(env.recordId);
                                                }}
                                              >
                                                <td className="px-3 py-2.5">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    {isSelected && !alreadyAdded && <div className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                                                    <span className={`truncate ${isSelected && !alreadyAdded ? 'text-primary-700 font-medium' : 'text-gray-700'}`}>
                                                      {env.name || env.recordId}
                                                    </span>
                                                    {alreadyAdded && <span className="text-[10px] text-gray-400 ml-1">(added)</span>}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-500 capitalize">
                                                  {env.type || 'AWS'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setIsEnvironmentModalOpen(false);
                                      setSelectedEnvironmentId('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      addEnvironmentById();
                                      setIsEnvironmentModalOpen(false);
                                    }}
                                    disabled={!selectedEnvironmentId}
                                  >
                                    Add Environment
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Layers className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Workloads</span>
                          </div>
                          {(sessionContext.workloads || []).length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center mb-2">
                              <p className="text-xs text-gray-400">No workloads added</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5 mb-2">
                              {(sessionContext.workloads || []).map((w) => (
                                <div
                                  key={w.workloadId}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                                    <span className="text-xs text-gray-700 truncate">{w.workloadName || w.workloadId}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeWorkload(w.workloadId)}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                            onClick={() => setIsWorkloadModalOpen(true)}
                          >
                            <Plus className="h-3 w-3" />
                            Add workload
                          </button>
                          <button
                            type="button"
                            className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            onClick={() => {
                              onClose?.();
                              navigate('/dashboard/workloads');
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Create new workload
                          </button>

                          {/* Add Workload Modal */}
                          {isWorkloadModalOpen && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
                              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                  <h3 className="text-sm font-semibold text-gray-800">Add Workload to Context</h3>
                                  <button
                                    type="button"
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                    onClick={() => {
                                      setIsWorkloadModalOpen(false);
                                      setSelectedWorkloadId('');
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="px-5 pt-3 pb-1">
                                  {availableWorkloads.length === 0 ? (
                                    <div className="text-center py-8">
                                      <Layers className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                      <p className="text-sm text-gray-500">No workloads available</p>
                                      <p className="text-xs text-gray-400 mt-1">Create a workload to get started.</p>
                                      <button
                                        type="button"
                                        className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
                                        onClick={() => {
                                          setIsWorkloadModalOpen(false);
                                          onClose?.();
                                          navigate('/dashboard/workloads');
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Go to Workloads
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-gray-50 text-gray-500 text-left sticky top-0">
                                            <th className="px-3 py-2 font-medium">Name</th>
                                            <th className="px-3 py-2 font-medium">Description</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {availableWorkloads.map((workload) => {
                                            const isSelected = selectedWorkloadId === workload.workloadId;
                                            const alreadyAdded = (sessionContext.workloads || []).some(w => w.workloadId === workload.workloadId);
                                            return (
                                              <tr
                                                key={workload.workloadId}
                                                className={`border-t border-gray-100 transition-colors ${
                                                  alreadyAdded
                                                    ? 'opacity-40 cursor-default'
                                                    : isSelected
                                                    ? 'bg-primary-50 cursor-pointer'
                                                    : 'hover:bg-gray-50 cursor-pointer'
                                                }`}
                                                onClick={() => {
                                                  if (!alreadyAdded) setSelectedWorkloadId(workload.workloadId);
                                                }}
                                              >
                                                <td className="px-3 py-2.5">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    {isSelected && !alreadyAdded && <div className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                                                    <span className={`truncate ${isSelected && !alreadyAdded ? 'text-primary-700 font-medium' : 'text-gray-700'}`}>
                                                      {workload.workloadName || workload.workloadId}
                                                    </span>
                                                    {alreadyAdded && <span className="text-[10px] text-gray-400 ml-1">(added)</span>}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-500 truncate max-w-[180px]">
                                                  {workload.description || '—'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setIsWorkloadModalOpen(false);
                                      setSelectedWorkloadId('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      addWorkloadById();
                                      setIsWorkloadModalOpen(false);
                                    }}
                                    disabled={!selectedWorkloadId}
                                  >
                                    Add Workload
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {pendingContextSuggestions.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500">Suggested Context</div>
                            <div className="mt-2 space-y-2">
                              {pendingContextSuggestions.map((suggestion) => (
                                <div
                                  key={suggestion.id}
                                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                                >
                                  <div className="font-medium">{suggestion.notice || 'Suggested update'}</div>
                                  <div className="mt-2 flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => applySuggestion(suggestion.id, suggestion.patch)}
                                    >
                                      Apply
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => dismissSuggestion(suggestion.id)}
                                    >
                                      Dismiss
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <FileText className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reports</span>
                          </div>
                          {(sessionContext.reports || []).length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center mb-2">
                              <p className="text-xs text-gray-400">No reports loaded</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5 mb-2">
                              {(sessionContext.reports || []).map((report) => {
                                const reportKey = report.fileId || report.scanId || report.reportId;
                                return (
                                  <div
                                    key={reportKey}
                                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                      <span className="text-xs text-gray-700 truncate">{report.title || report.reportId}</span>
                                    </div>
                                    <button
                                      type="button"
                                      className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removeReport(reportKey)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                            onClick={() => setIsReportModalOpen(true)}
                          >
                            <Plus className="h-3 w-3" />
                            Add report
                          </button>

                          {/* Add Report Modal */}
                          {isReportModalOpen && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
                              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                  <h3 className="text-sm font-semibold text-gray-800">Add Report to Context</h3>
                                  <button
                                    type="button"
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                    onClick={() => {
                                      setIsReportModalOpen(false);
                                      setSelectedReportScanId('');
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="px-5 pt-3 pb-1">
                                  {selectedEnvironment && (
                                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 mb-3">
                                      <Cloud className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                      Showing reports for: <span className="font-medium text-gray-700">{selectedEnvironment.name || selectedEnvironment.permissionProfileId}</span>
                                    </div>
                                  )}
                                  {availableReports.length === 0 ? (
                                    <div className="text-center py-8">
                                      <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                      <p className="text-sm text-gray-500">No reports available</p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        {selectedEnvironment
                                          ? 'No reports found for the selected environment.'
                                          : 'Run a scan to generate reports.'}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-gray-50 text-gray-500 text-left sticky top-0">
                                            <th className="px-3 py-2 font-medium">Report</th>
                                            <th className="px-3 py-2 font-medium">Environment</th>
                                            <th className="px-3 py-2 font-medium">Date</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {availableReports.map((report) => {
                                            const reportKey = buildReportEntryKey(report);
                                            const isSelected = selectedReportScanId === reportKey;
                                            const envName = resolveEnvName(report);
                                            const dateRaw = report.lastUpdateTime || report.latestAssessmentDate || report.updatedAt;
                                            const dateLabel = dateRaw
                                              ? new Date(dateRaw).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                              : '—';
                                            return (
                                              <tr
                                                key={reportKey}
                                                className={`cursor-pointer border-t border-gray-100 transition-colors ${
                                                  isSelected
                                                    ? 'bg-primary-50'
                                                    : 'hover:bg-gray-50'
                                                }`}
                                                onClick={() => setSelectedReportScanId(reportKey)}
                                              >
                                                <td className="px-3 py-2.5">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                                                    <span className={`truncate ${isSelected ? 'text-primary-700 font-medium' : 'text-gray-700'}`}>
                                                      {report.title || report.reportId}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-500 truncate max-w-[120px]">
                                                  {envName || '—'}
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                                                  {dateLabel}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setIsReportModalOpen(false);
                                      setSelectedReportScanId('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      await handleAddReportToContext();
                                      setIsReportModalOpen(false);
                                    }}
                                    disabled={!selectedReportScanId || reportLoading}
                                  >
                                    {reportLoading ? (
                                      <>
                                        <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                                        Loading...
                                      </>
                                    ) : (
                                      'Add Report'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-medium text-gray-500">Fetched This Session</div>
                          <div className="flex flex-col gap-1 mt-2">
                            {(sessionContext.fetched || []).length === 0 && (
                              <span className="text-xs text-gray-400">No fetched items yet</span>
                            )}
                            {(sessionContext.fetched || []).slice(-6).map((item, idx) => (
                              <div key={`${item.type || 'event'}-${idx}`} className="text-xs text-gray-600">
                                {item.label || item.type}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-gray-500">Notes</div>
                          <textarea
                            className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                            rows={2}
                            value={sessionContext.notes || ''}
                            onChange={(e) =>
                              setSessionContext(prev => {
                                const next = {
                                  ...prev,
                                  notes: e.target.value
                                };
                                sessionContextRef.current = next;
                                return next;
                              })
                            }
                            placeholder="Optional notes for this session"
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                  </>
                )}
              </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HelpChatModal;
