import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  Download,
  HelpCircle,
  Shield,
  Package,
  ChevronDown,
  Clock,
  Settings2,
  Calendar,
  Loader2,
  Bot,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import InfoModal from '../../components/InfoModal';
import { Icons } from '../../components/icons';
import {
  recordAgentConnection,
  setIsRegionModalOpen,
  toggleAutoplay,
} from '../../features/agent/agentSlice';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Markdown from 'markdown-to-jsx';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Switch } from '@/components/ui/switch';
import { createWorkflow } from '../../features/workflow/workflowSlice';
import { fetchBlueprintById } from '../../features/blueprint/blueprintSlice';
import { useAgentSetup } from '../../hooks/useAgentSetup';
import { SettingsSummary } from '../Agent/Agent';
import { createAgentConnection } from '../../api/agent';
import { buildReportRoute } from '../../helpers/accountScans';
import { toLogObject } from '../../helpers/logUtils';
import { useSEO } from '../../hooks/useSEO';
import { buildRecommendationExecutionContext } from '../../helpers/recommendations/remediationTargets';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '../../hooks/useAnalytics';
import { IS_PUBLIC_SITE } from '../../config/appConfig';
import { isLocalRuntime } from '../../runtime/cloudAgentRuntime';

const parsePermissionAuthProfile = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse permission profile authProfile', error);
      return {};
    }
  }

  if (typeof value === 'object') {
    return value;
  }

  return {};
};

const normalizeExecutionCredits = (value, fallback = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeBlueprintRunMode = (value) => {
  const normalized = String(value || 'cloudagent').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['codex', 'codex_cli', 'openai_codex'].includes(normalized)) return 'codex';
  if (['claude', 'claude_code', 'claude_cli', 'anthropic_claude'].includes(normalized)) return 'claude';
  if (['cursor', 'cursor_agent', 'cursor_cli', 'cursor_ai'].includes(normalized)) return 'cursor';
  return 'cloudagent';
};

const getHistoryRunMode = (history) => {
  const parsedLog = toLogObject(history?.log);
  return normalizeBlueprintRunMode(
    history?.executionMode ||
      history?.runner ||
      parsedLog?.executionMode ||
      parsedLog?.runner
  );
};

const isEmptySkillValue = (value) => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptySkillValue);
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

const parseSkillValue = (value, fallback = value) => {
  if (typeof value !== 'string') return value ?? fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const stringifySkillValue = (value) => {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'string')) {
      return value.map((item) => `- ${item}`).join('\n');
    }
    return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  }
  if (value && typeof value === 'object') {
    return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  }
  return String(value);
};

const appendSkillSection = (lines, heading, value, level = 2) => {
  if (isEmptySkillValue(value)) return;
  lines.push('', `${'#'.repeat(level)} ${heading}`, '', stringifySkillValue(value));
};

const formatSkillLabel = (key) =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const taskToSkillMarkdown = (task = {}, index = 0) => {
  const lines = [];
  const title = task.title || task.name || task.id || task.task_id || `Task ${index + 1}`;
  lines.push(`#### ${index + 1}. ${title}`, '');

  const ignored = new Set(['title', 'name']);
  Object.entries(task).forEach(([key, value]) => {
    if (ignored.has(key) || isEmptySkillValue(value)) return;
    lines.push(`**${formatSkillLabel(key)}**`, '', stringifySkillValue(value), '');
  });

  return lines.join('\n').trim();
};

const planToSkillMarkdown = (planPayload = {}) => {
  const phases = Array.isArray(planPayload?.plan)
    ? planPayload.plan
    : Array.isArray(planPayload?.phases)
      ? planPayload.phases
      : [];

  if (!phases.length) return '';

  const lines = ['## Blueprint Plan'];
  phases.forEach((phase, phaseIndex) => {
    const phaseTitle = phase?.title || phase?.name || phase?.id || `Phase ${phaseIndex + 1}`;
    lines.push('', `### ${phaseIndex + 1}. ${phaseTitle}`);

    if (!isEmptySkillValue(phase?.description)) {
      lines.push('', stringifySkillValue(phase.description));
    }

    const tasks = Array.isArray(phase?.tasks) ? phase.tasks : [];
    tasks.forEach((task, taskIndex) => {
      lines.push('', taskToSkillMarkdown(task, taskIndex));
    });
  });

  return lines.join('\n').trim();
};

const buildCodexSkillMarkdown = (blueprint = {}) => {
  const title = blueprint?.title || 'CloudAgent Codex Blueprint';
  const lines = [
    `# ${title}`,
    '',
    'Use this skill when running this CloudAgent blueprint through Codex CLI.',
    '',
    '## Instructions',
    '',
    '- Read `session-context.json` before acting. It contains the selected environment, workload, regions, preferences, local scan/report context, and the blueprint plan.',
    '- Use `session-context.json.environment.authProfile` to understand the selected AWS account/profile and region.',
    '- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.',
    '- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.',
    '- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool.',
    '- Keep all work scoped to the selected environment, workload, regions, and preflight context.',
    '- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.',
    '- Return concise Markdown with Findings, Evidence, Actions Taken, and Result.',
    '- Do not claim AWS or local changes were made unless you actually performed them.',
  ];

  appendSkillSection(lines, 'Blueprint Title', title);
  appendSkillSection(lines, 'Description', parseSkillValue(blueprint.description, []));
  appendSkillSection(lines, 'Cloud Provider', blueprint.cloudProvider);
  appendSkillSection(lines, 'Required Permissions', parseSkillValue(blueprint.requiredPermissions, {}));
  appendSkillSection(lines, 'Plan Settings', parseSkillValue(blueprint.planSettings, {}));

  const planMarkdown = planToSkillMarkdown(blueprint);
  if (planMarkdown) {
    lines.push('', planMarkdown);
  }

  return `${lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
};

const skillFileName = (title = 'cloudagent-blueprint') => {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${slug || 'cloudagent-blueprint'}-SKILL.md`;
};

export default function Library({ isBluePrint = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  /**
   * Location state parameters (when navigated from recommendations remediation modal):
   * - fromRecommendation: {
   *     source: 'recommendations',            // string identifier of the origin
   *     recommendationId: string | null,     // recommendation record identifier
   *     blueprintId: string,                 // blueprint to load
   *     accountId: string | null,            // AWS account associated with the permission profile
   *     permissionProfileId: string,         // recordId/id of the saved permission profile to preselect
   *     permissionProfileName: string | null,// friendly name for UI hints
   *     permissionProfile: object | null,    // full profile payload (fallback when id lookup fails)
   *     targetRegions: string[],             // region defaults to seed into global settings
   *     targetResources: array,              // raw recommendation target resources (for future context)
   *     recommendationRunTarget: object|null,// selected workload/environment target and resource preview
   *     autoStart: boolean                   // whether to auto-open the run blueprint flow
   *   }
   */
  const { type } = useParams();
  const { userProfile, isAuthenticated } = useSelector((state) => state.auth);
  const { autoplay } = useSelector((state) => state.agent);
  const { currentBlueprint, loading: blueprintLoading } = useSelector(
    (state) => state.blueprint
  );
  const recommendationContextRef = useRef(
    location.state?.fromRecommendation || null
  );
  const hasAppliedRecommendationRef = useRef(false);
  const isDashboardLibraryRoute = location.pathname.startsWith('/dashboard/library/');
  const isLocalMode = isLocalRuntime();

  useEffect(() => {
    if (location.state?.fromRecommendation) {
      recommendationContextRef.current = location.state.fromRecommendation;
      hasAppliedRecommendationRef.current = false;
    }
  }, [location.state?.fromRecommendation]);

  const availableCredits =
    (userProfile?.agentCredits?.adhocCredits || 0) +
      (userProfile?.agentCredits?.monthlyBaseCredits || 0) || 0;

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [blueprintRunMode, setBlueprintRunMode] = useState('cloudagent');
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState({
    title: '',
    description: [],
    plan: [],
    type: '',
  });
  const planCredits = normalizeExecutionCredits(plan.credits ?? plan.creditCost, 1);
  const { planId, recordId } = useParams();
  const {
    setupState,
    initializeFromPlanData,
    setSetupState,
  } = useAgentSetup();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);

    const safeParseJSON = (value, fallback) => {
      if (value == null) return fallback;
      if (typeof value === 'object') return value;
      if (typeof value !== 'string') return fallback;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    };

    const normalizeDescription = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        const parsed = safeParseJSON(value, null);
        if (Array.isArray(parsed)) return parsed;
        return [value];
      }
      return [];
    };

    const fetchData = async () => {
      if (isBluePrint && recordId) {
        setLoading(true);
        try {
          const result = await dispatch(fetchBlueprintById(recordId)).unwrap();
          const parsedPlan = safeParseJSON(result.plan, {});
          const parsedRequiredPermissions = safeParseJSON(result.requiredPermissions, {});
          const parsedPlanSettings = safeParseJSON(result.planSettings, {});
          setPlan({
            title: result.title,
            description: normalizeDescription(result.description),
            plan: Array.isArray(parsedPlan?.plan) ? parsedPlan.plan : [],
            type: 'blueprint',
            requiredPermissions: parsedRequiredPermissions || {},
            planSettings: parsedPlanSettings || {},
            credits: result.credits,
            recordId: result.recordId,
            userId: result.userId,
          });
        } catch (error) {
          console.error('Error fetching blueprint:', error);
        } finally {
          setLoading(false);
        }
      } else if (planId) {
        try {
          const response = await fetch(
            `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${planId}.json`
          );
          const data = await response.json();
          setPlan(data);
        } catch (error) {
          console.error('Error fetching plan:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [planId, recordId, isBluePrint, dispatch]);

  // Determine page type for SEO
  const isReport = type === 'report' || type === 'assessment';
  const isBlueprint = type === 'blueprint' || isBluePrint;
  const seoEnabled = (isReport || isBlueprint) && plan.title;

  // Determine the target cloudProvider for filtering permission profiles
  // This comes from the plan/blueprint or defaults to 'aws'
  const targetCloudProvider = useMemo(() => {
    // Check plan.cloudProvider first (top-level)
    if (plan.cloudProvider) {
      console.log('[Library] Using top-level cloudProvider:', plan.cloudProvider);
      return plan.cloudProvider;
    }
    // Check first task's cloudProvider
    const planArray = Array.isArray(plan.plan) ? plan.plan : [];
    const cloudProvider = planArray.length > 0 && planArray[0]?.tasks?.length > 0
      ? (planArray[0].tasks[0].cloudProvider || 'aws')
      : 'aws';
    
    console.log('[Library] Derived targetCloudProvider:', {
      cloudProvider,
      planTitle: plan.title,
      planType: plan.type,
      topLevelCloudProvider: plan.cloudProvider,
      firstTaskCloudProvider: planArray[0]?.tasks?.[0]?.cloudProvider,
      planArrayLength: planArray.length,
      firstPhaseTasksLength: planArray[0]?.tasks?.length,
    });
    
    return cloudProvider;
  }, [plan]);

  // Generate SEO description based on plan type and content
  const getSEODescription = () => {
    if (!plan.title) return null;
    
    if (isReport) {
      // For reports, use description or create one based on title
      if (plan.description && Array.isArray(plan.description) && plan.description.length > 0) {
        const desc = plan.description.join(' ').substring(0, 155);
        return `${desc}${desc.length >= 155 ? '...' : ''}`;
      }
      return `View detailed cloud security and compliance assessment report: ${plan.title}. Analyze your cloud infrastructure security posture, compliance status, and get actionable recommendations.`;
    }
    
    if (isBlueprint) {
      // For blueprints, use description or create one based on title
      if (plan.description && Array.isArray(plan.description) && plan.description.length > 0) {
        const desc = plan.description.join(' ').substring(0, 155);
        return `${desc}${desc.length >= 155 ? '...' : ''}`;
      }
      return `Deploy and execute cloud automation blueprint: ${plan.title}. Automate your cloud infrastructure management, security compliance, and cost optimization with AI-powered agents.`;
    }
    
    return null;
  };

  // Update SEO meta tags
  useSEO({
    title: seoEnabled ? plan.title : null,
    description: seoEnabled ? getSEODescription() : null,
    type: isBlueprint ? 'article' : 'website',
    enabled: seoEnabled,
  });

  useEffect(() => {
    if (!isBluePrint) return;
    if (hasAppliedRecommendationRef.current) return;

    const recommendationContext = recommendationContextRef.current;
    if (!recommendationContext) return;

    if (!plan?.recordId) return;

    const {
      permissionProfileId,
      permissionProfile,
      accountId: contextAccountId,
      targetRegions = [],
      autoStart,
      prefilledFormValues,
    } = recommendationContext;

    const savedProfile =
      (permissionProfileId &&
        userProfile?.agentPermissionProfiles?.find(
          (permission) =>
            permission?.recordId === permissionProfileId ||
            permission?.id === permissionProfileId
        )) ||
      permissionProfile ||
      null;

    const parsedAuthProfile = savedProfile
      ? parsePermissionAuthProfile(savedProfile.authProfile)
      : null;

    initializeFromPlanData({
      planId: plan.recordId,
      planDetails: plan.plan,
      title: plan.title,
      inputSummary: plan.planSettings?.defaultValues,
      requiredPermissions: plan.requiredPermissions || {},
      shouldAutocontinue: true,
    });

    setSetupState((prev) => {
      const nextGlobalSettings = {
        ...prev.globalSettings,
      };
      const recommendedWorkloadValue = recommendationContext?.recommendationRunTarget?.workloadId
        ? `workload-${recommendationContext.recommendationRunTarget.workloadId}`
        : null;

      // Merge pre-filled form values if available
      if (prefilledFormValues) {
        // Merge select_aws_regions (use prefilled if available, otherwise use targetRegions)
        if (prefilledFormValues.select_aws_regions && Array.isArray(prefilledFormValues.select_aws_regions)) {
          nextGlobalSettings.select_aws_regions = prefilledFormValues.select_aws_regions;
        } else if (Array.isArray(targetRegions) && targetRegions.length > 0) {
          nextGlobalSettings.select_aws_regions = targetRegions;
        }

        // Merge additional_instructions
        if (prefilledFormValues.additional_instructions) {
          nextGlobalSettings.additional_instructions = prefilledFormValues.additional_instructions;
        }

        // Merge default_values (form field values)
        if (prefilledFormValues.default_values && typeof prefilledFormValues.default_values === 'object') {
          nextGlobalSettings.default_values = {
            ...prev.globalSettings.default_values,
            ...prefilledFormValues.default_values,
          };
        }
      } else {
        // Fallback to targetRegions if no prefilled values
        if (Array.isArray(targetRegions) && targetRegions.length > 0) {
          nextGlobalSettings.select_aws_regions = targetRegions;
        }
      }

      if (recommendedWorkloadValue) {
        nextGlobalSettings.selected_workload_or_stack = recommendedWorkloadValue;
      }

      return {
        ...prev,
        recordId: plan.recordId || prev.recordId,
        accountId:
          contextAccountId ||
          parsedAuthProfile?.awsAccountId ||
          prev.accountId,
        globalSettings: nextGlobalSettings,
        prefillPermissionProfileId:
          permissionProfileId ||
          savedProfile?.recordId ||
          savedProfile?.id ||
          prev.prefillPermissionProfileId,
        prefillPermissionProfileName:
          savedProfile?.name ||
          recommendationContext.permissionProfileName ||
          prev.prefillPermissionProfileName ||
          null,
        authProfile: parsedAuthProfile
          ? {
              ...prev.authProfile,
              ...parsedAuthProfile,
              authProfileName:
                savedProfile?.name ||
                parsedAuthProfile.authProfileName ||
                prev.authProfile.authProfileName,
              validated: false,
            }
          : prev.authProfile,
      };
    });

    hasAppliedRecommendationRef.current = true;

    if (autoStart) {
      if (isLocalMode || availableCredits >= planCredits) {
        setShowRunModal(true);
      } else {
        toast.error('This desktop build does not include hosted billing or credit purchases.');
      }
    }
  }, [
    availableCredits,
    initializeFromPlanData,
    isBluePrint,
    isLocalMode,
    plan,
    planCredits,
    setSetupState,
    userProfile,
  ]);

  useEffect(() => {
    if (isBluePrint) return;
    if (type !== 'report' && type !== 'assessment') return;
    if (hasAppliedRecommendationRef.current) return;

    const recommendationContext = recommendationContextRef.current;
    if (!recommendationContext) return;

    if (!plan?.plan || plan.plan.length === 0) {
      return;
    }

    const {
      permissionProfileId,
      permissionProfile,
      accountId: contextAccountId,
      targetRegions = [],
      autoStart,
    } = recommendationContext;

    const savedProfile =
      (permissionProfileId &&
        userProfile?.agentPermissionProfiles?.find(
          (perm) =>
            perm?.recordId === permissionProfileId ||
            perm?.id === permissionProfileId
        )) ||
      permissionProfile ||
      null;

    const parsedAuthProfile =
      savedProfile && savedProfile.authProfile
        ? parsePermissionAuthProfile(savedProfile.authProfile)
        : null;

    initializeFromPlanData({
      planId,
      planDetails: plan.plan,
      title: plan.title,
      inputSummary: plan.planSettings?.defaultValues,
      requiredPermissions: plan.requiredPermissions || {},
      shouldAutocontinue: true,
    });

    setSetupState((prev) => {
      const nextGlobalSettings = {
        ...prev.globalSettings,
      };
      const recommendedWorkloadValue = recommendationContext?.recommendationRunTarget?.workloadId
        ? `workload-${recommendationContext.recommendationRunTarget.workloadId}`
        : null;

      if (Array.isArray(targetRegions) && targetRegions.length > 0) {
        nextGlobalSettings.select_aws_regions = targetRegions;
      }

      if (recommendedWorkloadValue) {
        nextGlobalSettings.selected_workload_or_stack = recommendedWorkloadValue;
      }

      return {
        ...prev,
        accountId:
          contextAccountId ||
          parsedAuthProfile?.awsAccountId ||
          parsedAuthProfile?.accountId ||
          prev.accountId,
        globalSettings: nextGlobalSettings,
        prefillPermissionProfileId:
          savedProfile?.recordId ||
          savedProfile?.id ||
          prev.prefillPermissionProfileId,
        prefillPermissionProfileName:
          savedProfile?.name ||
          recommendationContext.permissionProfileName ||
          prev.prefillPermissionProfileName,
        authProfile: parsedAuthProfile
          ? {
              ...prev.authProfile,
              ...parsedAuthProfile,
              authProfileName:
                savedProfile?.name ||
                parsedAuthProfile.authProfileName ||
                prev.authProfile.authProfileName,
              validated: false,
            }
          : prev.authProfile,
      };
    });

    hasAppliedRecommendationRef.current = true;

    if (autoStart) {
      const totalCredits =
        (userProfile?.agentCredits?.adhocCredits || 0) +
        (userProfile?.agentCredits?.monthlyBaseCredits || 0);

      if (isLocalMode || totalCredits >= planCredits) {
        setShowRunModal(true);
      } else {
        toast.error('This desktop build does not include hosted billing or credit purchases.');
      }
    }
  }, [
    initializeFromPlanData,
    isBluePrint,
    isLocalMode,
    plan,
    planCredits,
    planId,
    setSetupState,
    type,
    userProfile,
  ]);

  // Handle library blueprints (from /library/blueprint/:planId route)
  useEffect(() => {
    if (isBluePrint) return; // Skip if custom blueprint
    if (type !== 'blueprint') return; // Only handle blueprint type
    if (hasAppliedRecommendationRef.current) return;

    const recommendationContext = recommendationContextRef.current;
    if (!recommendationContext) return;

    if (!plan?.plan || plan.plan.length === 0) {
      return;
    }

    const {
      permissionProfileId,
      permissionProfile,
      accountId: contextAccountId,
      targetRegions = [],
      autoStart,
      prefilledFormValues,
    } = recommendationContext;

    const savedProfile =
      (permissionProfileId &&
        userProfile?.agentPermissionProfiles?.find(
          (perm) =>
            perm?.recordId === permissionProfileId ||
            perm?.id === permissionProfileId
        )) ||
      permissionProfile ||
      null;

    const parsedAuthProfile =
      savedProfile && savedProfile.authProfile
        ? parsePermissionAuthProfile(savedProfile.authProfile)
        : null;

    initializeFromPlanData({
      planId,
      planDetails: plan.plan,
      title: plan.title,
      inputSummary: plan.planSettings?.defaultValues,
      requiredPermissions: plan.requiredPermissions || {},
      shouldAutocontinue: true,
    });

    setSetupState((prev) => {
      const nextGlobalSettings = {
        ...prev.globalSettings,
      };
      const recommendedWorkloadValue = recommendationContext?.recommendationRunTarget?.workloadId
        ? `workload-${recommendationContext.recommendationRunTarget.workloadId}`
        : null;

      // Merge pre-filled form values if available
      if (prefilledFormValues) {
        // Merge select_aws_regions (use prefilled if available, otherwise use targetRegions)
        if (prefilledFormValues.select_aws_regions && Array.isArray(prefilledFormValues.select_aws_regions)) {
          nextGlobalSettings.select_aws_regions = prefilledFormValues.select_aws_regions;
        } else if (Array.isArray(targetRegions) && targetRegions.length > 0) {
          nextGlobalSettings.select_aws_regions = targetRegions;
        }

        // Merge additional_instructions
        if (prefilledFormValues.additional_instructions) {
          nextGlobalSettings.additional_instructions = prefilledFormValues.additional_instructions;
        }

        // Merge default_values (form field values)
        if (prefilledFormValues.default_values && typeof prefilledFormValues.default_values === 'object') {
          nextGlobalSettings.default_values = {
            ...prev.globalSettings.default_values,
            ...prefilledFormValues.default_values,
          };
        }
      } else {
        // Fallback to targetRegions if no prefilled values
        if (Array.isArray(targetRegions) && targetRegions.length > 0) {
          nextGlobalSettings.select_aws_regions = targetRegions;
        }
      }

      if (recommendedWorkloadValue) {
        nextGlobalSettings.selected_workload_or_stack = recommendedWorkloadValue;
      }

      return {
        ...prev,
        accountId:
          contextAccountId ||
          parsedAuthProfile?.awsAccountId ||
          parsedAuthProfile?.accountId ||
          prev.accountId,
        globalSettings: nextGlobalSettings,
        prefillPermissionProfileId:
          savedProfile?.recordId ||
          savedProfile?.id ||
          prev.prefillPermissionProfileId,
        prefillPermissionProfileName:
          savedProfile?.name ||
          recommendationContext.permissionProfileName ||
          prev.prefillPermissionProfileName,
        authProfile: parsedAuthProfile
          ? {
              ...prev.authProfile,
              ...parsedAuthProfile,
              authProfileName:
                savedProfile?.name ||
                parsedAuthProfile.authProfileName ||
                prev.authProfile.authProfileName,
              validated: false,
            }
          : prev.authProfile,
      };
    });

    hasAppliedRecommendationRef.current = true;

    if (autoStart) {
      const totalCredits =
        (userProfile?.agentCredits?.adhocCredits || 0) +
        (userProfile?.agentCredits?.monthlyBaseCredits || 0);

      if (isLocalMode || totalCredits >= planCredits) {
        setShowRunModal(true);
      } else {
        toast.error('This desktop build does not include hosted billing or credit purchases.');
      }
    }
  }, [
    initializeFromPlanData,
    isBluePrint,
    isLocalMode,
    plan,
    planCredits,
    planId,
    setSetupState,
    type,
    userProfile,
  ]);

  // const handleConnectAgent = async () => {
  //   setLoading(true);
  //   try {
  //     if (type === 'report' || type === 'assessment') {
  //       navigate(`/report/new`, {
  //         state: {
  //           planId: planId,
  //           shouldAutocontinue: true,
  //         },
  //       });
  //     } else {
  //       navigate(`/agent/new`, {
  //         state: {
  //           planId: isBluePrint ? plan.title : planId,
  //           recordId: recordId,
  //           isBluePrint: isBluePrint,
  //           plan: plan,
  //           shouldAutocontinue: true,
  //         },
  //       });
  //     }
  //     toast.success('Agent connected successfully!');
  //   } catch (error) {
  //     toast.error('Failed to connect to agent');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const openBlueprintRunModal = () => {
    initializeFromPlanData({
      planId: isBluePrint ? recordId : planId,
      planDetails: plan.plan,
      title: plan.title,
      inputSummary: plan.planSettings?.defaultValues,
      requiredPermissions: plan.requiredPermissions || {},
      shouldAutocontinue: true,
    });
    setShowConfirmModal(false);
    setShowRunModal(true);
  };

  const openReportRunModal = () => {
    initializeFromPlanData({
      planId: planId,
      planDetails: plan.plan,
      title: plan.title,
      inputSummary: plan.planSettings?.defaultValues,
      requiredPermissions: plan.requiredPermissions || {},
      shouldAutocontinue: true,
    });
    setShowConfirmModal(false);
    setShowRunModal(true);
  };

  const handleDownloadCodexSkill = () => {
    try {
      const markdown = buildCodexSkillMarkdown(plan);
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = skillFileName(plan.title);
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Codex skill downloaded');
    } catch (error) {
      console.error('Failed to download Codex skill:', error);
      toast.error('Failed to download Codex skill');
    }
  };

  const handleReportRunFromModal = async (settings, { authProfile, accountId, selectedPermissionProfileId }) => {
    setLoading(true);
    try {
      const recommendationContext = recommendationContextRef.current;
      const contextForNavigation = recommendationContext
        ? {
            ...recommendationContext,
            planId,
            reportId:
              recommendationContext.reportId ||
              recommendationContext.sourceBlueprintId ||
              planId,
            sourceBlueprintId:
              recommendationContext.sourceBlueprintId ||
              recommendationContext.reportId ||
              planId,
          }
        : null;

      setShowRunModal(false);

      navigate(`/dashboard/reports/new`, {
        state: {
          planId: planId,
          shouldAutocontinue: true,
          readyToRun: true,
          cloudProvider: targetCloudProvider,
          authProfile: authProfile,
          accountId: accountId,
          globalSettings: settings,
          parentId: selectedPermissionProfileId,
          ...(contextForNavigation
            ? { fromRecommendation: contextForNavigation }
            : {}),
        },
      });
    } catch (error) {
      toast.error('Failed to start report');
      console.error('Error starting report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAgent = () => {
    if (type === 'report' || type === 'assessment') {
      openReportRunModal();
    } else {
      openBlueprintRunModal();
    }
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
  };

  const onSetupComplete = async (completeSetupData) => {
    setLoading(true);
    try {
      const normalizedAuthProfile = {
        ...(completeSetupData.authProfile || {}),
        validated: true,
      };

      if (completeSetupData.accountId && normalizedAuthProfile.provider !== 'google_workspace') {
        normalizedAuthProfile.awsAccountId =
          normalizedAuthProfile.awsAccountId || completeSetupData.accountId;
      }

      const recommendationContext = recommendationContextRef.current;
      const recommendationExecutionContext =
        buildRecommendationExecutionContext(recommendationContext);
      const selectedExecutionMode = isLocalMode && isBlueprint
        ? normalizeBlueprintRunMode(completeSetupData.executionMode || completeSetupData.runner || blueprintRunMode)
        : 'cloudagent';
      const blueprintLog = isBluePrint
        ? {
            logs: [],
            currentPhase: 0,
            currentTask: 0,
            lastUpdated: new Date().toISOString(),
            isBluePrint: true,
            blueprintId: recordId,
            executionMode: selectedExecutionMode,
            runner: selectedExecutionMode,
            globalSettings: completeSetupData.globalSettings || {},
            authProfileName:
              normalizedAuthProfile.authProfileName ||
              normalizedAuthProfile.name ||
              completeSetupData.authProfile?.authProfileName ||
              '',
          }
        : null;

      const connectionResponse = await createAgentConnection({
        itemId: isBluePrint ? recordId : planId,
        title: plan.title,
        agentType: 'agent',
        executionMode: selectedExecutionMode,
        runner: selectedExecutionMode,
        ...(isBluePrint && recordId ? { parentId: recordId } : {}),
        authProfile: normalizedAuthProfile,
        globalSettings: completeSetupData.globalSettings || {},
        ...(blueprintLog ? { log: blueprintLog, updatedBlueprint: plan } : {}),
        ...(recommendationExecutionContext
          ? { recommendationContext: recommendationExecutionContext }
          : {}),
      });

      const createdRecordId =
        connectionResponse?.record?.recordId || connectionResponse?.recordId;

      if (!createdRecordId) {
        throw new Error('Unable to create agent connection: recordId missing');
      }

      navigate(`/dashboard/agent/${createdRecordId}`, {
        state: {
          isBluePrint: isBluePrint,
          plan: plan,
          shouldAutocontinue: true,
          initialGlobalSettings: completeSetupData.globalSettings || {},
          authProfile: normalizedAuthProfile,
          accountId: completeSetupData.accountId || '',
          cloudProvider: targetCloudProvider, // Pass cloudProvider for PermissionsModal filtering
          executionMode: selectedExecutionMode,
          runner: selectedExecutionMode,
          ...(recommendationContext
            ? { fromRecommendation: recommendationContext }
            : {}),
          ...(isBluePrint && { recordId: recordId }),
        },
      });
    } catch (error) {
      console.error('Setup failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="px-6">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Button
                  variant="link"
                  onClick={() => {
                    navigate(
                      isDashboardLibraryRoute
                        ? '/dashboard/blueprints/library'
                        : IS_PUBLIC_SITE ? '/libraries' : '/dashboard/blueprints/library'
                    );
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  {plan.title}
                </Button>
              </div>
            </div>
            {type === 'report' || type === 'assessment' ? null : (
              <div className="flex items-center">
                <ActionButtons
                  {...{
                    autoplay,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Progress Bar */}
      <Progress value={33} className="h-2 bg-primary-200" />
      {loading && (
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600"></div>
        </div>
      )}
      {!loading && (
        <div className="">
          <div className="flex flex-col md:flex-row ">
            {/* Sidebar */}
            <div className="w-full md:w-1/4 min-h-[100%] md:min-h-[100vh]">
              <div className="bg-white p-6 h-[100%]">
                <div className="pl-4">
                  {plan.plan.map((phase, index) => (
                    <div key={index} className="mb-4">
                      <h3 className="font-medium text-primary-800">
                        {index + 1}. {phase.title}
                      </h3>
                      <ul className="mt-2 space-y-2 pl-5">
                        {phase.tasks.map((task, taskIndex) => (
                          <li key={taskIndex} className="text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                              {task.title}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="w-full md:w-3/4 p-4 md:p-8">
              <div className="bg-white shadow rounded-lg">
                <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-100 p-6">
                  <AgentHistorySection
                    userProfile={userProfile}
                    planId={planId}
                    isAuthenticated={isAuthenticated}
                    plan={plan}
                    type={type}
                    onConnectAgent={(e, history) => {
                      if (!isAuthenticated) {
                        navigate('/login', { state: { from: '/library' } });
                        return;
                      }
                      if (history) {
                        // Check if it's a report - either from reportHistory or agentHistory.
                        const isReport = history.source === 'reportHistory' || 
                                        history.agentType === 'report' || 
                                        history.agentType === 'assessment';
                        
                        if (isReport) {
                          const reportRoute = buildReportRoute(history) || `/report/${history.scanId || history.recordId}`;
                          navigate(reportRoute, {
                            state: {
                              isReconnecting: true,
                              reportId: history.reportId || null,
                            },
                          });
                        } else {
                          // Parse log to check if it's a custom blueprint
                          const parsedLog = toLogObject(history?.log);
                          const isBluePrint = parsedLog?.isBluePrint || false;
                          const blueprintId = parsedLog?.blueprintId || null;
                          const runMode = getHistoryRunMode(history);
                          
                          navigate(`/dashboard/agent/${history.recordId}`, {
                            state: {
                              isReconnecting: true,
                              isBluePrint: isBluePrint,
                              executionMode: runMode,
                              runner: runMode,
                              ...(isBluePrint && { recordId: blueprintId }),
                            },
                          });
                        }
                        return;
                      }

                      const totalCredits =
                        (userProfile?.agentCredits?.adhocCredits || 0) +
                        (userProfile?.agentCredits?.monthlyBaseCredits || 0);

                      if (isLocalMode || totalCredits >= planCredits) {
                        if (type === 'report' || type === 'assessment') {
                          openReportRunModal();
                        } else {
                          openBlueprintRunModal();
                        }
                      } else {
                        toast.error('This desktop build does not include hosted billing or credit purchases.');
                      }
                    }}
                  />
                </div>
                <div className="p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <h1 className="text-2xl font-[500] text-primary-800">
                      {plan.title}
                    </h1>
                    {isBlueprint && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadCodexSkill}
                        className="shrink-0"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download as Codex Skill
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4 text-gray-700">
                    <Markdown
                      className="space-y-4"
                      options={{
                        overrides: {
                          h2: {
                            props: {
                              className:
                                'text-lg font-medium my-4 text-primary-800',
                            },
                          },
                          h3: {
                            props: {
                              className: 'text-lg font-medium mb-2',
                            },
                          },
                          p: {
                            props: {
                              className: 'text-gray-600',
                            },
                          },
                          div: {
                            props: {
                              className: 'space-y-4',
                            },
                          },
                          ul: {
                            props: {
                              className:
                                'list-disc pl-6 space-y-2 text-gray-600',
                            },
                          },
                          code: {
                            props: {
                              className:
                                'font-mono bg-gray-100 rounded px-1 letterSpacing[1px]',
                              style: { whiteSpace: 'pre-line' },
                            },
                          },
                          a: {
                            props: {
                              className: 'text-blue-600 hover:underline',
                              target: '_blank',
                            },
                          },
                        },
                      }}
                    >
                      {plan.description.join('\n\n')}
                    </Markdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLocalMode && (type === 'report' || type === 'assessment') && (
        <InfoModal
          title="Run Report"
          description={`This Report will cost ${planCredits} Credits and you will be able to access this Report instantly! This purchase cannot be refunded.`}
          cancelText="Cancel"
          okText="Run Report"
          isOpen={showConfirmModal}
          onConfirm={handleConnectAgent}
          onClose={handleCancel}
          icon={<Icons.agent className="h-6 w-6 text-red-500" />}
          additionalInfo={`Your new balance will be ${
            availableCredits >= planCredits ? availableCredits - planCredits : 0
          } Credits.`}
          loading={loading}
        />
      )}

      {showRunModal && (
        <SettingsSummary
          isOpen={showRunModal}
          defaultValues={setupState.globalSettings}
          inputSummary={setupState.inputSummary}
          onSubmit={(settings, environmentContext = {}) => {
            const nextAccountId =
              environmentContext.accountId || setupState.accountId || '';
            const nextAuthProfile = environmentContext.authProfile
              ? {
                  ...environmentContext.authProfile,
                  validated: true,
                }
              : setupState.authProfile;

            if (type === 'report' || type === 'assessment') {
              handleReportRunFromModal(settings, {
                authProfile: nextAuthProfile,
                accountId: nextAccountId,
                selectedPermissionProfileId:
                  environmentContext.selectedPermissionProfileId || null,
              });
            } else {
              setSetupState((prev) => ({
                ...prev,
                accountId: nextAccountId,
                authProfile: nextAuthProfile,
                globalSettings: settings,
              }));

              onSetupComplete({
                authProfile: nextAuthProfile,
                accountId: nextAccountId,
                globalSettings: settings,
                executionMode: normalizeBlueprintRunMode(blueprintRunMode),
                runner: normalizeBlueprintRunMode(blueprintRunMode),
                selectedPermissionProfileId:
                  environmentContext.selectedPermissionProfileId || null,
              });
            }
          }}
          isReconnecting={false}
          onClose={() => setShowRunModal(false)}
          isAgent={true}
          isReport={type === 'report' || type === 'assessment'}
          planId={isBluePrint ? recordId : planId}
          blueprintId={isBluePrint ? recordId : planId}
          recordId={isBluePrint ? recordId : planId}
          cloudProvider={targetCloudProvider}
          showEnvironmentSelection={true}
          prefillPermissionProfileId={setupState.prefillPermissionProfileId}
          prefillPermissionProfileName={setupState.prefillPermissionProfileName}
          requiredPermissions={setupState.requiredPermissions}
          creditsCost={isLocalMode ? null : planCredits}
          availableCredits={isLocalMode ? null : availableCredits}
          recommendationTarget={recommendationContextRef.current?.recommendationRunTarget || null}
          buttonText={type === 'report' || type === 'assessment' ? 'Run Report' : 'Run Blueprint'}
        >
          {isLocalMode && isBlueprint ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Run with</div>
                <div className="text-xs text-gray-500">
                  Choose the runtime for this launch. The blueprint itself stays the same.
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  {
                    value: 'cloudagent',
                    label: 'CloudAgent',
                    description: 'Use the CloudAgent local agent runner.',
                    icon: Sparkles,
                  },
                  {
                    value: 'codex',
                    label: 'Codex CLI',
                    description: 'Hand off this blueprint to Codex with CloudAgent context.',
                    icon: TerminalSquare,
                  },
                  {
                    value: 'claude',
                    label: 'Claude Code',
                    description: 'Hand off this blueprint to Claude Code with CloudAgent context.',
                    icon: Bot,
                  },
                  {
                    value: 'cursor',
                    label: 'Cursor Agent',
                    description: 'Hand off this blueprint to Cursor Agent with CloudAgent context.',
                    icon: TerminalSquare,
                  },
                ].map((option) => {
                  const Icon = option.icon;
                  const selected = blueprintRunMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBlueprintRunMode(option.value)}
                      className={`rounded-lg border px-4 py-3 text-left transition-all ${
                        selected
                          ? 'border-primary-400 bg-primary-50 text-primary-950 shadow-sm ring-2 ring-primary-100'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-primary-200 hover:bg-primary-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-sm font-semibold">{option.label}</span>
                          <span className="mt-1 block text-xs text-gray-600">{option.description}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </SettingsSummary>
      )}
    </div>
  );
}

export const ActionButtons = ({ autoplay, setPermissionModal }) => {
  const dispatch = useDispatch();
  return (
    <>
      <div className="hidden md:flex items-center">
        <div className="border-r border-blue-100 px-2 flex items-center gap-2 pr-4">
          <span className="text-sm text-gray-600">Autoplay Tasks</span>
          <Switch
            checked={autoplay}
            onCheckedChange={() => dispatch(toggleAutoplay())}
            className="data-[state=checked]:bg-primary-600"
          />
        </div>
        <div className="border-r border-blue-100 pr-2 pl-2">
          <Button variant="ghost" className="text-primary-600" disabled>
            <Download className="h-4 w-4 mr-2" />
            Download History
          </Button>
        </div>
        <div className="border-r border-blue-100 px-2">
          <Button
            variant="ghost"
            className="text-primary-600"
            onClick={() => dispatch(setIsRegionModalOpen(true))}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
        <div className="border-blue-100 px-2">
          <Button variant="ghost" className="text-primary-600" disabled>
            <Shield className="h-4 w-4 mr-2" />
            Permissions
          </Button>
        </div>
        {/* <div className="px-2">
          <Button
            variant="ghost"
            className={`${isComplete ? 'text-green-600' : 'text-primary-600'}`}
            onClick={markAgentComplete}
            disabled={isComplete}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isComplete ? 'Completed' : 'Mark Complete'}
          </Button>
        </div> */}
      </div>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              className="cursor-not-allowed opacity-60"
              disabled
            >
              <Download className="h-4 w-4 mr-2" />
              Download History
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <HelpCircle className="h-4 w-4 mr-2" />
              Request Support
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-not-allowed opacity-60"
              disabled
            >
              <div className="flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Permissions
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

const AgentHistorySection = ({
  userProfile,
  planId,
  isAuthenticated,
  onConnectAgent,
  plan,
  type,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isScheduling, setIsScheduling] = useState(false);
  const planCredits = normalizeExecutionCredits(plan?.credits ?? plan?.creditCost, 1);

  // Get agent history, excluding report runs tracked in reportHistory.
  const agentHistoryItems = userProfile?.agentHistory
    ?.filter((history) => history.itemId === planId && history.agentType !== 'report')
    .map(history => ({ ...history, source: 'agentHistory' })) || [];

  // Get report runs from reportHistory.
  const reportScans = userProfile?.reportHistory
    ?.filter((scan) => scan.reportId === planId)
    .map(scan => ({
      // Normalize reportHistory to match agentHistory structure.
      recordId: scan.scanId,
      scanId: scan.scanId,
      itemId: scan.reportId,
      agentType: 'report',
      purchaseDate: scan.lastUpdateTime || scan.latestAssessmentDate,
      status: scan.status === 'SUCCESSFUL' || scan.status === 'PARTIAL_SUCCESS' ? 'complete' : 
              scan.status === 'FAILED' ? 'failed' : 'running',
      source: 'reportHistory',
      title: scan.title,
    })) || [];

  // Combine both sources and sort
  const agentHistory = [...agentHistoryItems, ...reportScans].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    const dateA = new Date(a.purchaseDate || a.lastUpdateTime || 0);
    const dateB = new Date(b.purchaseDate || b.lastUpdateTime || 0);
    return dateB - dateA;
  });

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleScheduleReport = async () => {
    if (!isAuthenticated) {
      return;
    }
    setIsScheduling(true);

    try {
      const workflowData = {
        nodes: JSON.stringify([
          {
            id: 'start',
            type: 'startNode',
            name: 'Start',
            inputFrom: [],
            position: { x: 20, y: 10 },
            triggerType: 'scheduled',
            schedule: {
              triggerType: 'scheduled',
              type: 'daily',
              time: '09:00',
            },
          },
          {
            id: 'assess',
            type: type === 'blueprint' ? 'cloudTask' : 'reportTask',
            name: `Run ${plan.title || 'Report'}`,
            inputFrom: ['start'],
            position: { x: 20, y: 280 },
            blueprintId: [planId],
            logic: [],
          },
          {
            id: 'communicate',
            type: 'communication',
            name: 'Summarize Findings in an Email',
            inputFrom: ['assess'],
            position: { x: 20, y: 550 },
            logic: [],
          },
          {
            id: 'end',
            type: 'endNode',
            name: 'End',
            inputFrom: ['communicate'],
            position: { x: 20, y: 820 },
          },
        ]),
        title: plan.title,
        description: plan.title,
        schedule: JSON.stringify({
          triggerType: 'scheduled',
          type: 'daily',
          time: '09:00',
        }),
      };

      const response = await dispatch(createWorkflow(workflowData)).unwrap();
      analytics.track(ANALYTICS_EVENTS.WORKFLOW_CREATED, {
        route: getAnalyticsRoute(),
      });
      navigate(`/workflow/${response.workflowId}`);
      toast.success('Workflow scheduled successfully!');
    } catch (error) {
      console.error('Failed to schedule workflow:', error);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-3 justify-between w-[100%]">
      <div className="flex items-center text-primary-600 bg-primary-50 px-4 p-2 rounded-[26px] w-full md:w-fit">
        <Package className="h-5 w-5 mr-2" />
        <span>{`${planCredits} Credits`}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button className="w-full md:w-fit" onClick={onConnectAgent}>
          {isAuthenticated
            ? type === 'report' || type === 'assessment'
              ? 'Run Report'
              : 'Run Blueprint'
            : 'Sign In to Connect'}
        </Button>
        <Button
          className="w-full md:w-fit"
          variant="outline"
          onClick={handleScheduleReport}
          disabled={!isAuthenticated || isScheduling}
        >
          {isScheduling ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 mr-2" />
              {type === 'report' || type === 'assessment'
                ? 'Schedule Report'
                : 'Schedule Agent'}
            </>
          )}
        </Button>
        {agentHistory?.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full md:w-fit border-primary-100 text-primary-600 hover:bg-primary-50"
              >
                <Clock className="mr-2 h-4 w-4" />
                Last Runs
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[240px] max-h-[400px] overflow-y-auto"
            >
              {agentHistory?.map((history) => (
                <DropdownMenuItem
                  key={history.recordId || history.scanId}
                  className="flex flex-col items-start py-2 cursor-pointer"
                  onClick={(e) => onConnectAgent(e, history)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Clock className="h-4 w-4 text-primary-500" />
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">
                        {formatDate(history.purchaseDate || history.lastUpdateTime)}
                      </span>
                    </div>
                    {(history.status === 'running' || 
                      (history.source === 'reportHistory' && 
                       history.status !== 'complete' && 
                       history.status !== 'failed')) && (
                      <span className="ml-auto text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};
