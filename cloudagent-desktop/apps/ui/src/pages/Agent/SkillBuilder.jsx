import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { getRegionOptions } from '@/helpers/shared';

import {
  XCircle,
  Edit3,
  CheckIcon,
  Download,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  ArrowLeft,
  Cloud,
  List,
  Code,
  MessageSquare,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  postPlanBuilderChat,
  postPlanBuilderGenerate,
  postPlanBuilderSave,
  resetPlanBuilderSession as resetPlanBuilderSessionAPI,
} from '@/api/planBuilder';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '@/hooks/useAnalytics';
// NOTE: Removed Redux selectors; userId is derived server-side from auth header

const DEFAULT_TASK_MAX_TURNS = 50;
const MAX_TASK_MAX_TURNS = 150;
const CLOUD_PROVIDER_OPTIONS = [
  { value: 'aws', label: 'AWS', description: 'Build a skill for AWS accounts and regions.' },
  { value: 'azure', label: 'Azure', description: 'Build a skill for Azure subscriptions and resource groups.' },
];

function normalizeBlueprintCloudProvider(value) {
  const normalized = String(value || 'aws').trim().toLowerCase();
  return normalized === 'azure' || normalized === 'az' ? 'azure' : 'aws';
}

// Stable child component to avoid remounts that steal focus
const PlanBuilderChatPanel = React.memo(function PlanBuilderChatPanel({
  chatOpen,
  setChatOpen,
  agentWarnings,
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  sendAgentMessage,
  step,
  chatInputRef,
  skeletonNotesRef,
  autoGenerate,
  setAutoGenerate,
  canClose = true,
}) {
  return (
    <div className="h-full overflow-hidden">
      <div className="flex flex-col h-full border border-gray-200 rounded-xl bg-white overflow-hidden min-h-0">
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div className="text-sm font-semibold text-gray-900">Plan Builder Assistant</div>
          {canClose ? (
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setChatOpen(false)}
            >
              Hide
            </button>
          ) : null}
        </div>
        {agentWarnings?.length ? (
          <div className="px-4 py-2 border-b bg-amber-50 text-amber-800 text-xs shrink-0">
            <div className="font-semibold mb-1">Warnings</div>
            <ul className="list-disc pl-4 space-y-1">
              {agentWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {chatMessages.length === 0 ? (
            <div className="text-sm text-gray-500">
              Ask to generate skeleton, update tasks, or finalize the plan.
            </div>
          ) : (
            chatMessages.map((m, idx) => (
              <div
                key={idx}
                className={
                  m.role === 'user'
                    ? 'self-end max-w-[85%] bg-blue-50 text-blue-900 px-3 py-2 rounded-lg ml-8'
                    : 'self-start max-w-[85%] bg-gray-100 text-gray-900 px-3 py-2 rounded-lg mr-8'
                }
              >
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            ))
          )}
          {chatLoading && (
            <div className="text-xs text-gray-500">Thinking…</div>
          )}
        </div>
        <div className="border-t px-3 py-2 shrink-0 bg-white">
          <div className="flex items-center bg-white border rounded-md px-3">
            <input
              className="flex-1 h-9 outline-none text-sm"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const msg = chatInput.trim();
                  if (msg) {
                    setChatInput('');
                    await sendAgentMessage(msg);
                  }
                }
              }}
              ref={chatInputRef}
            />
            <button
              className="ml-2 text-sm px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
              disabled={chatLoading || !chatInput.trim()}
              onClick={async () => {
                const msg = chatInput.trim();
                if (msg) {
                  setChatInput('');
                  await sendAgentMessage(msg);
                }
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these specific values change
  const shouldSkipRender = (
    prevProps.chatOpen === nextProps.chatOpen &&
    prevProps.chatInput === nextProps.chatInput &&
    prevProps.skeletonNotes === nextProps.skeletonNotes &&
    prevProps.step === nextProps.step &&
    prevProps.canClose === nextProps.canClose &&
    prevProps.chatLoading === nextProps.chatLoading &&
    prevProps.skeletonLoading === nextProps.skeletonLoading &&
    prevProps.autoGenerate === nextProps.autoGenerate &&
    prevProps.chatMessages.length === nextProps.chatMessages.length &&
    prevProps.agentWarnings?.length === nextProps.agentWarnings?.length
  );
  

  
  return shouldSkipRender;
});

export default function SkillBuilder({
  planId: initialPlanId = null,
  planData = null,
  mode = 'create',
}) {
  const isEditMode = mode === 'edit';
  const isCloneMode = mode === 'clone';
  const isCreateMode = !isEditMode && !isCloneMode;
  const persistChatDraft = isCreateMode;
  const [step, setStep] = useState(1);
  const [setupStep, setSetupStep] = useState('planType');

  const buildInitialPlanId = () => {
    if (isEditMode) {
      return (
        initialPlanId ||
        planData?.id ||
        `plan_${Date.now().toString(36)}`
      );
    }

    if (isCloneMode) {
      const sourceId =
        planData?.id ||
        planData?.recordId ||
        `plan_${Date.now().toString(36)}`;
      return `${sourceId}_copy_${Date.now().toString(36)}`;
    }

    return (
      initialPlanId ||
      planData?.id ||
      `plan_${Date.now().toString(36)}`
    );
  };

  // Seed objective from planData.title in edit mode so we can keep passing a description string to backend.
  const [objective, setObjective] = useState(
    isEditMode || isCloneMode ? planData?.title || '' : ''
  );

  const [skeleton, setSkeleton] = useState(
    planData
      ? Array.isArray(planData.plan)
        ? { ...planData, plan: planData.plan }
        : planData
      : null
    // true
  );

  // Normalize incoming description->string for backend calls
  const initialPlanDescription = planData
    ? Array.isArray(planData.description)
      ? planData.description.join('\n')
      : (planData.description ?? '')
    : '';

  // We keep a separate planDescription string the backend will use in prompts.
  const [planDescription, setPlanDescription] = useState(
    isEditMode || isCloneMode
      ? initialPlanDescription || planData?.title || ''
      : ''
  );

  const [cloudProvider, setCloudProvider] = useState(
    normalizeBlueprintCloudProvider(
      planData?.cloudProvider ||
      planData?.plan?.cloudProvider ||
      planData?.plan?.[0]?.tasks?.[0]?.cloudProvider
    )
  );

  const [planType, setPlanType] = useState('Review');
  const [phaseAssessment, setPhaseAssessment] = useState(true);
  const [phaseSummary, setPhaseSummary] = useState(true);
  const [phaseConfig, setPhaseConfig] = useState(false);
  const [phaseValidation, setPhaseValidation] = useState(false);
  const [phasesCustomNotes, setPhasesCustomNotes] = useState('');
  // 2️⃣ Add autoGenerate toggle state
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [hoveredPhase, setHoveredPhase] = useState(null);
  const [autoGenRunning, setAutoGenRunning] = useState(false);
  const [autoGenTaskId, setAutoGenTaskId] = useState(null);
  const [skeletonReviewed, setSkeletonReviewed] = useState(false);
  const [planId, setPlanId] = useState(
    buildInitialPlanId()
  );
  const [apiError, setApiError] = useState(null); // simple error banner
  const [skeletonNotes, setSkeletonNotes] = useState('');
  const [skeletonLoading, setSkeletonLoading] = useState(false);

  // Indicates we are calling /api/plan/finalize
  const [permGenLoading, setPermGenLoading] = useState(false);

  // Agent chat state (multi-turn Plan Builder)
  const [sessionId] = useState(() => `pb-${Date.now().toString(36)}`);
  const [planState, setPlanState] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]); // { role: 'user'|'assistant', content }
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [agentWarnings, setAgentWarnings] = useState([]);
  // userId no longer needed client-side for requests; backend derives from Cognito token
  const chatInputRef = useRef(null);
  const objectiveInputRef = useRef(null);
  const skeletonNotesRef = useRef(null);
  // Debug: log backend-provided blueprint identifiers whenever planState updates
  useEffect(() => {
    if (!planState) return;
  }, [planState]);
  const onSkeletonNotesChange = React.useCallback((e) => {
    setSkeletonNotes(e.target.value);
  }, []);

  useEffect(() => {
    if (!planData || (!isEditMode && !isCloneMode)) return;
    const loadedPlanState = buildLoadedPlanState(planData);
    const loadedCloudProvider = normalizeBlueprintCloudProvider(
      planData?.cloudProvider ||
      planData?.plan?.cloudProvider ||
      loadedPlanState?.cloudProvider
    );
    setCloudProvider(loadedCloudProvider);
    setStep(2);
    setPlanState(loadedPlanState);
    setSkeleton(normalizePlanStateForUI(loadedPlanState));
    if (isEditMode && planData?.recordId) {
      setRecordId(planData.recordId);
    }
    if (
      planData?.requiredPermissions &&
      Object.keys(planData.requiredPermissions || {}).length
    ) {
      setPermissionsPolicy(planData.requiredPermissions);
    }
    if (planData?.planSettings?.defaultValues) {
      setDefaultValues(planData.planSettings.defaultValues);
    }
    if (isEditMode) {
      setChatOpen(true);
    }
  }, [isCloneMode, isEditMode, planData, planId]);

  useEffect(() => {
    if (step === 1 && setupStep === 'objective' && !isEditMode) {
      const timer = window.setTimeout(() => objectiveInputRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
  }, [isEditMode, setupStep, step]);

  // STEP 3: per-task details
  const [taskIndex, setTaskIndex] = useState(0);
  const [currentTaskData, setCurrentTaskData] = useState(null);
  const [taskNotes, setTaskNotes] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [showTaskView, setShowTaskView] = useState(false);

  // Stage tracker & task substeps
  const totalTasks = getPlanArray().flatMap((p) => p.tasks).length || 0;
  const currentTaskNumber = taskIndex + 1;
  const [taskSubStep, setTaskSubStep] = useState('plan');
  const [currentTaskSettings, setCurrentTaskSettings] = useState(null);

  // Step 4: Permissions & Settings review
  const [limitToSpecificRegions, setLimitToSpecificRegions] = useState(false);
  const [permissionsPolicy, setPermissionsPolicy] = useState(null);
  const [permissionsNotes, setPermissionsNotes] = useState('');
  const awsRegions = useMemo(
    () => getRegionOptions().map((option) => option.value),
    []
  );
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [defaultValues, setDefaultValues] = useState(''); // markdown string
  const [planOverview, setPlanOverview] = useState(null);

  // editModalOpen now holds { open: boolean, meta: {} }
  const [editModalOpen, setEditModalOpen] = useState({ open: false, meta: {} });
  const [editField, setEditField] = useState(null); // e.g. 'skeletonTitle', 'taskPlan', etc.
  const [editValue, setEditValue] = useState('');
  const [editTaskDraft, setEditTaskDraft] = useState({
    title: '',
    description: '',
    completionCriteria: '',
    executionPlan: '',
    maxTurns: String(DEFAULT_TASK_MAX_TURNS),
  });
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [markdownEditOpen, setMarkdownEditOpen] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState('');
  const [viewMode, setViewMode] = useState('structured'); // 'structured' or 'markdown'
  const [markdownError, setMarkdownError] = useState('');

  const listRef = useRef(null);
  const navigate = useNavigate?.() || null;

  const handlePlanTypeChange = (value) => {
    setPlanType(value);
    if (value === 'Review') {
      setPhaseAssessment(true);
      setPhaseSummary(true);
      setPhaseConfig(false);
      setPhaseValidation(false);
    } else if (value === 'Configuration') {
      setPhaseConfig(true);
      if (phaseSummary) setPhaseSummary(false);
      if (!phaseValidation) setPhaseValidation(true);
    }
  };

  function getPlanArray() {
    if (!skeleton) return [];
    // if backend returns { plan: [...] }
    if (Array.isArray(skeleton.plan)) return skeleton.plan;
    // if backend returns [...] directly
    if (Array.isArray(skeleton)) return skeleton;
    return [];
  }

  function setPlanArray(updater) {
    setSkeleton((prev) => {
      const current = Array.isArray(prev.plan)
        ? prev.plan
        : Array.isArray(prev)
          ? prev
          : [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      setPlanState((state) => (state ? { ...state, cloudProvider, plan: next } : state));

      // keep the original shape
      if (Array.isArray(prev.plan)) return { ...prev, plan: next };
      return next; // plain array shape
    });
  }

  function blueprintToMarkdown() {
    const lines = [];
    const pushArraySection = (heading, values) => {
      const arr = toStringArray(values);
      if (!arr.length) return;
      lines.push(`### ${heading}`);
      arr.forEach((value) => lines.push(`- ${value}`));
      lines.push('');
    };

    getPlanArray().forEach((phase) => {
      lines.push(`# ${phase.title || 'Phase'}`);
      lines.push('');
      (phase.tasks || []).forEach((task) => {
        lines.push(`## ${task.title || 'Untitled Task'}`);
        if (task.description) {
          lines.push(task.description);
          lines.push('');
        }
        pushArraySection('Execution Plan', task.executionPlan);
        pushArraySection('Completion Criteria', task.completionCriteria);
        pushArraySection('User Explanation', task.userExplanation);
        if (task.skip_conditions) {
          lines.push('### Skip Conditions');
          lines.push(String(task.skip_conditions));
          lines.push('');
        }
        pushArraySection('Depends On', task.depends_on);
        lines.push('');
      });
    });

    return lines.join('\n').trimEnd() + '\n';
  }

  function handleDownloadMarkdown() {
    try {
      const markdown = blueprintToMarkdown();
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const title = getPlanTitle() || skeleton?.title || planData?.title;
      const slug = String(title || 'cloudagent-skill')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      link.href = url;
      link.download = `${slug || 'cloudagent-skill'}.md`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Skill markdown downloaded');
    } catch (error) {
      console.error('Failed to download markdown:', error);
      toast.error('Failed to download markdown');
    }
  }

  function parseBlueprintMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const phases = [];
    let currentPhase = null;
    let currentTask = null;
    let currentTaskSection = 'description';

    const normalizeSectionName = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const stripListMarker = (value) =>
      String(value || '').replace(/^\s*(?:[-*]|\d+\.)\s+/, '').trim();

    const finishTask = () => {
      if (!currentTask || !currentPhase) return;
      currentTask.description = currentTask.descriptionLines.join('\n').trim();
      if (currentTask.seenSections.executionPlan) {
        currentTask.executionPlan = currentTask.executionPlanLines
          .map(stripListMarker)
          .filter(Boolean);
      }
      if (currentTask.seenSections.completionCriteria) {
        currentTask.completionCriteria = currentTask.completionCriteriaLines
          .map(stripListMarker)
          .filter(Boolean);
      }
      if (currentTask.seenSections.userExplanation) {
        currentTask.userExplanation = currentTask.userExplanationLines
          .map(stripListMarker)
          .filter(Boolean);
      }
      if (currentTask.seenSections.dependsOn) {
        currentTask.depends_on = currentTask.dependsOnLines
          .map(stripListMarker)
          .filter(Boolean);
      }
      if (currentTask.seenSections.skipConditions) {
        currentTask.skip_conditions = currentTask.skipConditionLines.join('\n').trim();
      }
      delete currentTask.descriptionLines;
      delete currentTask.executionPlanLines;
      delete currentTask.completionCriteriaLines;
      delete currentTask.userExplanationLines;
      delete currentTask.dependsOnLines;
      delete currentTask.skipConditionLines;
      delete currentTask.seenSections;
      currentPhase.tasks.push(currentTask);
      currentTask = null;
      currentTaskSection = 'description';
    };

    const finishPhase = () => {
      finishTask();
      if (currentPhase) {
        phases.push(currentPhase);
        currentPhase = null;
      }
    };

    lines.forEach((rawLine) => {
      const line = rawLine.trimEnd();
      const phaseMatch = line.match(/^#\s+(?:Phase:\s*)?(.+)$/i);
      const taskMatch = line.match(/^##\s+(?:Task:\s*)?(.+)$/i);
      const taskSectionMatch = line.match(/^###\s+(.+)$/);

      if (taskSectionMatch && currentTask) {
        const sectionName = normalizeSectionName(taskSectionMatch[1]);
        const sectionMap = {
          'execution plan': 'executionPlan',
          'execution steps': 'executionPlan',
          'completion criteria': 'completionCriteria',
          'user explanation': 'userExplanation',
          'skip conditions': 'skipConditions',
          'depends on': 'dependsOn',
          dependencies: 'dependsOn',
        };
        currentTaskSection = sectionMap[sectionName] || 'description';
        if (currentTaskSection !== 'description') {
          currentTask.seenSections[currentTaskSection] = true;
        }
        return;
      }

      if (taskMatch) {
        if (!currentPhase) {
          currentPhase = { title: 'Phase', tasks: [] };
        }
        finishTask();
        currentTask = {
          title: taskMatch[1].trim() || 'Untitled Task',
          descriptionLines: [],
          executionPlanLines: [],
          completionCriteriaLines: [],
          userExplanationLines: [],
          dependsOnLines: [],
          skipConditionLines: [],
          seenSections: {},
        };
        currentTaskSection = 'description';
        return;
      }

      if (phaseMatch) {
        finishPhase();
        currentPhase = {
          title: phaseMatch[1].trim() || 'Phase',
          tasks: [],
        };
        return;
      }

      if (currentTask) {
        if (currentTaskSection === 'executionPlan') {
          currentTask.executionPlanLines.push(line);
        } else if (currentTaskSection === 'completionCriteria') {
          currentTask.completionCriteriaLines.push(line);
        } else if (currentTaskSection === 'userExplanation') {
          currentTask.userExplanationLines.push(line);
        } else if (currentTaskSection === 'dependsOn') {
          currentTask.dependsOnLines.push(line);
        } else if (currentTaskSection === 'skipConditions') {
          currentTask.skipConditionLines.push(line);
        } else {
          currentTask.descriptionLines.push(line);
        }
      }
    });

    finishPhase();

    if (!phases.length) {
      throw new Error('Add at least one phase using a "# Phase name" heading.');
    }

    return {
      plan: phases,
    };
  }

  function openMarkdownEditor() {
    setMarkdownDraft(blueprintToMarkdown());
    setMarkdownError('');
    setMarkdownEditOpen(true);
  }

  function applyMarkdownDraft() {
    try {
      const parsed = parseBlueprintMarkdown(markdownDraft);
      const existingPlan = getPlanArray();
      const nextPlan = parsed.plan.map((phase, pIdx) => ({
        ...(existingPlan[pIdx] || {}),
        title: phase.title,
        tasks: phase.tasks.map((task, tIdx) => {
          const existingTask = existingPlan[pIdx]?.tasks?.[tIdx] || {};
          return {
            ...existingTask,
            id:
              existingTask.id ||
              `task_${Date.now().toString(36)}_${pIdx}_${tIdx}`,
            title: task.title,
            description: task.description,
            ...(Object.prototype.hasOwnProperty.call(task, 'executionPlan')
              ? { executionPlan: task.executionPlan }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(task, 'completionCriteria')
              ? { completionCriteria: task.completionCriteria }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(task, 'userExplanation')
              ? { userExplanation: task.userExplanation }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(task, 'skip_conditions')
              ? { skip_conditions: task.skip_conditions }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(task, 'depends_on')
              ? { depends_on: task.depends_on }
              : {}),
            maxTurns: existingTask.maxTurns || DEFAULT_TASK_MAX_TURNS,
          };
        }),
      }));

      setSkeleton((prev) => {
        const nextSkeleton = {
          ...(prev && !Array.isArray(prev) ? prev : {}),
          plan: nextPlan,
        };
        return Array.isArray(prev) ? nextPlan : nextSkeleton;
      });
      setPlanState((state) => ({
        ...(state || {}),
        plan: nextPlan,
        skeleton: nextPlan,
      }));
      setMarkdownEditOpen(false);
      setMarkdownError('');
    } catch (error) {
      setMarkdownError(error?.message || 'Could not parse the markdown skill.');
    }
  }

  /* ----------------------------------------------------------------- */
  /*  Helpers                                  */
  /* ----------------------------------------------------------------- */

  async function resetPlanBuilderSession() {
    try {
      await resetPlanBuilderSessionAPI(sessionId);
    } catch (e) {
      console.warn('Reset endpoint not available, clearing client state only.');
    }
    setChatMessages([]);
    setAgentWarnings([]);
    setPlanState(null);
  }

  // Build the new API "message" payloads
  function buildMessageAction(action, args) {
    return { action, args };
  }

  // Normalize server planState into UI skeleton shape expected by this page
  function humanizePlanId(id) {
    if (!id) return '';
    return id
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function toStringArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length);
    }
    return [];
  }

  function normalizeTaskMaxTurns(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return DEFAULT_TASK_MAX_TURNS;
    return Math.min(MAX_TASK_MAX_TURNS, Math.max(1, parsed));
  }

  function normalizeTaskShape(task) {
    const executionPlanArr = toStringArray(task?.executionPlan);
    const completionCriteriaArr = toStringArray(task?.completionCriteria);
    const userExplanationArr = toStringArray(task?.userExplanation);
    const dependsOnArr = Array.isArray(task?.depends_on)
      ? task.depends_on
      : (task?.depends_on ? [task.depends_on] : []);
    return {
      ...task,
      executionPlan: executionPlanArr,
      completionCriteria: completionCriteriaArr,
      userExplanation: userExplanationArr,
      depends_on: dependsOnArr,
      maxTurns: normalizeTaskMaxTurns(task?.maxTurns),
    };
  }

  function normalizePlanArray(planArray) {
    if (!Array.isArray(planArray)) return [];
    return planArray.map((phase) => ({
      title: phase?.title || 'Phase',
      tasks: Array.isArray(phase?.tasks)
        ? phase.tasks.map((t) => normalizeTaskShape(t || {}))
        : [],
    }));
  }

  function normalizePlanStateForUI(serverState) {
    const rawPlanArray = Array.isArray(serverState?.plan) && serverState.plan.length
      ? serverState.plan
      : (Array.isArray(serverState?.skeleton) ? serverState.skeleton : []);
    const planArray = normalizePlanArray(rawPlanArray);
    const derivedTitle =
      serverState?.planTitle || serverState?.title || humanizePlanId(serverState?.planId);
    const derivedDescription = serverState?.planDescription || serverState?.description || '';
    return {
      title: derivedTitle || 'Plan',
      description: derivedDescription,
      cloudProvider: normalizeBlueprintCloudProvider(serverState?.cloudProvider),
      plan: planArray,
      requiredPermissions: serverState?.requiredPermissions || null,
      planSettings: serverState?.planSettings || (serverState?.planDefaultValues ? { defaultValues: serverState.planDefaultValues } : null),
      planOverview: serverState?.planOverview || null,
    };
  }

  function buildLoadedPlanState(loadedPlan) {
    const normalizedPlan = normalizePlanArray(
      Array.isArray(loadedPlan?.plan) ? loadedPlan.plan : []
    );
    const loadedDescription = Array.isArray(loadedPlan?.description)
      ? loadedPlan.description.join('\n')
      : (loadedPlan?.description ?? '');
    const nextState = {
      planId: loadedPlan?.recordId || loadedPlan?.id || planId,
      cloudProvider: normalizeBlueprintCloudProvider(
        loadedPlan?.cloudProvider || loadedPlan?.plan?.cloudProvider
      ),
      plan: normalizedPlan,
      skeleton: normalizedPlan,
    };
    if (typeof loadedPlan?.title === 'string' && loadedPlan.title.trim()) {
      nextState.planTitle = loadedPlan.title.trim();
    }
    if (typeof loadedDescription === 'string' && loadedDescription.trim()) {
      nextState.planDescription = loadedDescription.trim();
    }
    if (loadedPlan?.requiredPermissions) {
      nextState.requiredPermissions = loadedPlan.requiredPermissions;
    }
    if (loadedPlan?.planSettings) {
      nextState.planSettings = loadedPlan.planSettings;
    }
    return nextState;
  }

  /* ----------------------------------------------------------------- */
  /*  Skeleton via Agent (initial draft)                                */
  /* ----------------------------------------------------------------- */
  async function fetchSkeleton(description, settings) {
    const newId =
      planId ||
      description
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40) +
        '-' +
        Date.now().toString(36);
    const payload = {
      planId: newId,
      planDescription: description,
      cloudProvider,
      existingPlan: [],
      skeletonSettings: {
        phases: settings?.phases,
        notes: settings?.notes,
      },
    };
    const message = buildMessageAction('generate_or_update_skeleton', payload);
    const data = await postPlanBuilderChat({
      sessionId,
      message,
      planState: buildClientPlanState(),
      persistDraft: persistChatDraft,
      ...(recordId ? { recordId } : {}),
    });
    if (data?.recordId) setRecordId(data.recordId);
    setPlanId(newId);
    if (data?.planState) {
      applyPlanState(data.planState);
      if (Array.isArray(data?.warnings)) setAgentWarnings(data.warnings);
      return data.planState;
    }
    return null;
  }

  /* ----------------------------------------------------------------- */
  /*  Update skeleton via Agent (regenerate with notes)                 */
  /* ----------------------------------------------------------------- */
  async function submitSkeletonFeedback(notes) {
    const skSettings = buildSkeletonSettings();
    const payload = {
      planId,
      planDescription: getObjectiveDescription(),
      cloudProvider,
      existingPlan: getPlanArray(),
      skeletonSettings: {
        phases: skSettings.phases,
        notes: notes || '',
      },
    };
    const message = buildMessageAction('generate_or_update_skeleton', payload);
    const data = await postPlanBuilderChat({
      sessionId,
      message,
      planState: buildClientPlanState(),
      persistDraft: persistChatDraft,
      ...(recordId ? { recordId } : {}),
    });
    if (data?.recordId) setRecordId(data.recordId);
    if (data?.planState) {
      applyPlanState(data.planState);
      if (Array.isArray(data?.warnings)) setAgentWarnings(data.warnings);
      return data.planState;
    }
    return null;
  }

  /* ----------------------------------------------------------------- */
  /*  Update tasks via Agent – returns executionPlan[] in plan          */
  /* ----------------------------------------------------------------- */
  async function fetchExecutionPlan(phaseIdx, taskIdx, notes = '') {
    const payload = {
      plan: getPlanArray(),
      tasks: [{ phaseIndex: phaseIdx, taskIndex: taskIdx, notes }],
      notes: notes || '',
      cloudProvider,
    };
    const message = buildMessageAction('update_tasks_batch', payload);
    const body = {
      sessionId,
      message,
      planState: buildClientPlanState(),
      persistDraft: persistChatDraft,
      ...(recordId ? { recordId } : {}),
    };
    const data = await postPlanBuilderChat(body);
    if (data?.recordId) setRecordId(data.recordId);
    if (data?.planState) {
      applyPlanState(data.planState);
      if (Array.isArray(data?.warnings)) setAgentWarnings(data.warnings);
      const phases = data.planState?.plan || [];
      const task = phases?.[phaseIdx]?.tasks?.[taskIdx];
      if (!task) return [];
      const normalized = normalizeTaskShape(task);
      return Array.isArray(normalized.executionPlan) ? normalized.executionPlan : [];
    }
    return [];
  }

  /* ----------------------------------------------------------------- */
  /*  Update task settings via Agent – returns settings { … }           */
  /* ----------------------------------------------------------------- */
  async function fetchSettings(phaseIdx, taskIdx, notes = '') {
    const payload = {
      plan: getPlanArray(),
      tasks: [{ phaseIndex: phaseIdx, taskIndex: taskIdx, notes }],
      notes: notes || '',
      cloudProvider,
    };
    const message = buildMessageAction('update_tasks_batch', payload);
    const body = {
      sessionId,
      message,
      planState: buildClientPlanState(),
      persistDraft: persistChatDraft,
      ...(recordId ? { recordId } : {}),
    };
    const data = await postPlanBuilderChat(body);
    if (data?.recordId) setRecordId(data.recordId);
    if (data?.planState) {
      applyPlanState(data.planState);
      if (Array.isArray(data?.warnings)) setAgentWarnings(data.warnings);
      const phases = data.planState?.plan || [];
      const task = phases?.[phaseIdx]?.tasks?.[taskIdx] || {};
      const normalizedTask = normalizeTaskShape(task);
      const settings = {
        title: normalizedTask.title,
        description: normalizedTask.description,
        depends_on: normalizedTask.depends_on,
        skip_conditions: normalizedTask.skip_conditions,
        userExplanation: normalizedTask.userExplanation,
        completionCriteria: normalizedTask.completionCriteria,
      };
      return settings;
    }
    return {};
  }

  /* ----------------------------------------------------------------- */
  /*  Finalize via Agent – returns latest planState                      */
  /* ----------------------------------------------------------------- */
  async function finalizePlan() {
    const payload = {
      planId,
      planObj: { plan: getPlanArray() },
      planDescription: getPlanDescription(),
      cloudProvider,
    };
    const message = buildMessageAction('update_plan_settings', payload);
    const data = await postPlanBuilderChat({
      sessionId,
      message,
      planState: buildClientPlanState(),
      persistDraft: persistChatDraft,
      ...(recordId ? { recordId } : {}),
    });
    if (data?.recordId) setRecordId(data.recordId);
    if (data?.planState) {
      applyPlanState(data.planState);
      if (Array.isArray(data?.warnings)) setAgentWarnings(data.warnings);
      return data.planState;
    }
    return null;
  }

  /* ----------------------------------------------------------------- */
  /*  Utility to look up (phaseIdx, taskIdx) for currentTask()          */
  /* ----------------------------------------------------------------- */
  function getIndexes() {
    let count = 0;
    const phases = getPlanArray();
    for (let p = 0; p < phases.length; p++) {
      const len = phases[p].tasks.length;
      if (taskIndex < count + len) return { pIdx: p, tIdx: taskIndex - count };
      count += len;
    }
    return { pIdx: 0, tIdx: 0 };
  }

  const currentPhase = () => {
    const phases = getPlanArray();
    let count = 0;
    for (let i = 0; i < phases.length; i++) {
      if (taskIndex < count + phases[i].tasks.length) return i;
      count += phases[i].tasks.length;
    }
    return 0;
  };

  const currentTask = () => {
    const phases = getPlanArray();
    let count = 0;
    for (let i = 0; i < phases.length; i++) {
      const tasks = phases[i].tasks;
      if (taskIndex < count + tasks.length) return tasks[taskIndex - count];
      count += tasks.length;
    }
    return null;
  };

  function buildSkeletonSettings() {
    return {
      planType,
      phases: {
        assessment: phaseAssessment,
        summary: phaseSummary,
        configuration: phaseConfig,
        validation: phaseValidation,
      },
      notes: phasesCustomNotes,
    };
  }

  function getPlanDescription() {
    if (typeof planDescription === 'string' && planDescription.trim()) {
      return planDescription.trim();
    }
    if (Array.isArray(skeleton?.description)) return skeleton.description.join('\n');
    if (typeof skeleton?.description === 'string') return skeleton.description;
    return '';
  }

  function getObjectiveDescription() {
    if (typeof objective === 'string' && objective.trim()) {
      return objective.trim();
    }
    return getPlanDescription();
  }

  function getPlanTitle() {
    if (typeof planState?.planTitle === 'string' && planState.planTitle.trim()) {
      return planState.planTitle.trim();
    }
    if (typeof skeleton?.title === 'string' && skeleton.title.trim()) {
      return skeleton.title.trim();
    }
    return '';
  }

  // Build client-side planState snapshot to send to the agent
  function applyPlanState(nextPlanState) {
    if (!nextPlanState || typeof nextPlanState !== 'object') return;
    const nextCloudProvider = normalizeBlueprintCloudProvider(nextPlanState?.cloudProvider || cloudProvider);
    if (nextCloudProvider !== cloudProvider) {
      setCloudProvider(nextCloudProvider);
    }
    nextPlanState.cloudProvider = nextCloudProvider;
    delete nextPlanState.executionMode;
    delete nextPlanState.runner;
    setPlanState(nextPlanState);
    setSkeleton(normalizePlanStateForUI(nextPlanState));
    if (typeof nextPlanState?.planDescription === 'string' && nextPlanState.planDescription.trim()) {
      setPlanDescription(nextPlanState.planDescription);
    }
  }

  function buildClientPlanState() {
    const planArray = getPlanArray();
    const planTitleValue = getPlanTitle();
    const planDescriptionValue = getPlanDescription();
    const skeletonSettings = buildSkeletonSettings();
    const state = {
      planId,
      cloudProvider,
      ...(planDescriptionValue ? { planDescription: planDescriptionValue } : {}),
      skeleton: planArray,
      plan: planArray,
      skeletonSettings,
    };
    if (planTitleValue) {
      state.planTitle = planTitleValue;
    }
    if (permissionsPolicy) {
      state.requiredPermissions = { policy: permissionsPolicy };
    }
    if (defaultValues) {
      state.planSettings = { defaultValues };
    }
    return state;
  }

  async function handleSaveEdits() {
    try {
      setApiError(null);
      if (!recordId) throw new Error('Missing recordId');
      const payload = {
        recordId,
        cloudProvider,
        planState: buildClientPlanState(),
      };
      await postPlanBuilderSave(payload);
      try { toast.success('Skill updated'); } catch {}
      if (navigate) navigate('/dashboard/skills');
    } catch (e) {
      console.error('Save Skill error:', e);
      setApiError(e?.message || 'Failed to save skill');
      try { toast.error(e?.message || 'Failed to save skill'); } catch {}
    }
  }

  async function handleCompleteBlueprint() {
    try {
      const planArray = getPlanArray();
      const blueprintTitle = planState?.planTitle || skeleton?.title || '';
      const skeletonSettings = buildSkeletonSettings();
      const payload = {
        planId,
        planDescription: getPlanDescription(),
        cloudProvider,
        skeletonSettings,
        planState: {
          planTitle: blueprintTitle,
          cloudProvider,
          skeletonSettings,
          plan: planArray,
        },
      };
      if (recordId) {
        payload.recordId = recordId;
      }
      // Fire-and-forget: don't await the response
      try {
        // Avoid unhandled rejection errors
        void postPlanBuilderGenerate(payload).catch(() => {});
      } catch {}

      analytics.track(ANALYTICS_EVENTS.CUSTOM_BLUEPRINT_CREATED, {
        route: getAnalyticsRoute(),
      });

      if (navigate) navigate('/dashboard/skills');
      try {
        toast.success(isCloneMode ? 'Skill save started' : 'Skill generation started');
      } catch {}
    } catch (e) {
      console.error('Complete Skill error:', e);
      setApiError(e?.message || 'Failed to start skill generation');
      try { toast.error(e?.message || 'Failed to start skill generation'); } catch {}
    }
  }

  async function handleSaveAsNew() {
    try {
      setApiError(null);
      const payload = {
        cloudProvider,
        planState: buildClientPlanState(),
        ...(recordId ? { recordId } : {}),
      };
      const result = await postPlanBuilderSave(payload);
      if (result?.recordId) setRecordId(result.recordId);
      if (navigate) navigate('/dashboard/skills');
      try { toast.success('Skill saved'); } catch {}
    } catch (e) {
      console.error('Save as New error:', e);
      setApiError(e?.message || 'Failed to save skill');
      try { toast.error(e?.message || 'Failed to save skill'); } catch {}
    }
  }

  // Deprecated: buildOperationMessage – replaced by buildMessageAction

  function formatMessageForDisplay(msg) {
    if (typeof msg === 'string') return msg;
    if (msg && typeof msg === 'object') {
      const action = msg.action || 'action';
      const summaries = {
        generate_or_update_skeleton: 'Requested to generate skeleton',
        update_tasks_batch: 'Requested to generate task settings',
        update_plan_settings: 'Requested to update plan settings',
      };
      if (summaries[action]) return summaries[action];
      try {
        const args = msg.args ? JSON.stringify(msg.args) : '';
        return `[${action}] ${args}`.trim();
      } catch (e) {
        return `[${action}]`;
      }
    }
    return String(msg);
  }

  async function sendAgentMessage(message, displayOverride) {
    setApiError(null);
    setChatLoading(true);
    const displayContent = displayOverride ?? formatMessageForDisplay(message);
    setChatMessages((msgs) => [...msgs, { role: 'user', content: displayContent }]);
    try {
      const body = {
        sessionId,
        message,
        planState: buildClientPlanState(),
        persistDraft: persistChatDraft,
        ...(recordId ? { recordId } : {}),
      };
      const data = await postPlanBuilderChat(body);
      if (data?.recordId) setRecordId(data.recordId);
      if (data?.planState) {
        applyPlanState(data.planState);
        setPermissionsPolicy(
          data.planState?.requiredPermissions?.policy || data.planState?.requiredPermissions || null
        );
        setDefaultValues(
          data.planState?.planSettings?.defaultValues || data.planState?.planDefaultValues || ''
        );
        setPlanOverview(data.planState?.planOverview || null);
      }
      if (Array.isArray(data?.warnings)) setAgentWarnings(data.warnings);
      setChatMessages((msgs) => [
        ...msgs,
        { role: 'assistant', content: data?.response || '(no response)' },
      ]);
    } catch (e) {
      console.error('=== PLAN BUILDER CHAT ERROR ===');
      console.error('Error:', e);
      console.error('Error message:', e.message);
      console.error('================================');
      
      setApiError(e.message || 'Something went wrong. Please try again.');
      setChatMessages((msgs) => [
        ...msgs,
        { role: 'assistant', content: `Error: ${e.message}` },
      ]);
    } finally {
      setChatLoading(false);
      // No forced focus restoration to avoid caret jump issues
    }
  }

  function buildAllTaskPointers(filter) {
    const phases = getPlanArray();
    const pointers = [];
    for (let p = 0; p < phases.length; p++) {
      const tasks = phases[p]?.tasks || [];
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t] || {};
        if (!filter) {
          pointers.push({ phaseIndex: p, taskIndex: t });
        } else if (filter === 'missingExec') {
          if (!Array.isArray(task.executionPlan) || task.executionPlan.length === 0) {
            pointers.push({ phaseIndex: p, taskIndex: t });
          }
        } else if (filter === 'missingSettings') {
          const hasUser = Array.isArray(task.userExplanation) && task.userExplanation.length > 0;
          const hasComp = Array.isArray(task.completionCriteria) && task.completionCriteria.length > 0;
          const hasSkip = !!task.skip_conditions;
          if (!(hasUser && hasComp && hasSkip)) {
            pointers.push({ phaseIndex: p, taskIndex: t });
          }
        }
      }
    }
    return pointers;
  }

  // Quick actions for each stage using the agent
  const handleAgentGenerateSkeleton = async () => {
    setApiError(null);
    // Ensure we have a stable planId for this plan
    const baseDesc = getObjectiveDescription() || 'plan';
    const newId =
      planId ||
      baseDesc
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40) +
        '-' +
        Date.now().toString(36);
    if (!planId) setPlanId(newId);
    const skSettings = buildSkeletonSettings();
    const payload = {
      planId: newId,
      planDescription: getObjectiveDescription(),
      cloudProvider,
      existingPlan: [],
      skeletonSettings: {
        phases: skSettings.phases,
        notes: skSettings.notes,
      },
    };
    const msg = buildMessageAction('generate_or_update_skeleton', payload);
    setChatOpen(true);
    await sendAgentMessage(msg);
    setStep(2);
  };

  const handleAgentUpdateSkeleton = async () => {
    setApiError(null);
    const skSettings = buildSkeletonSettings();
    const payload = {
      planId,
      planDescription: getObjectiveDescription(),
      cloudProvider,
      existingPlan: getPlanArray(),
      skeletonSettings: {
        phases: skSettings.phases,
        notes: skeletonNotes || '',
      },
    };
    const msg = buildMessageAction('generate_or_update_skeleton', payload);
    await sendAgentMessage(msg, 'Requested to generate skeleton');
  };

  const handleAgentGenerateExecutionPlans = async () => {
    setApiError(null);
    const payload = {
      plan: getPlanArray(),
      tasks: buildAllTaskPointers('missingExec'),
      notes: '',
      cloudProvider,
    };
    const msg = buildMessageAction('update_tasks_batch', payload);
    await sendAgentMessage(msg, 'Requested to generate task settings');
  };

  const handleAgentGenerateTaskSettings = async () => {
    setApiError(null);
    const payload = {
      plan: getPlanArray(),
      tasks: buildAllTaskPointers('missingSettings'),
      notes: '',
      cloudProvider,
    };
    const msg = buildMessageAction('update_tasks_batch', payload);
    await sendAgentMessage(msg, 'Requested to generate task settings');
  };

  const handleAgentFinalize = async () => {
    setApiError(null);
    const payload = {
      planId,
      planObj: { plan: getPlanArray() },
      planDescription: getPlanDescription(),
      cloudProvider,
    };
    const msg = buildMessageAction('update_plan_settings', payload);
    await sendAgentMessage(msg, 'Requested to update plan settings');
    setStep(4);
  };

  // STEP 1 → generate skeleton
  const handleGenerate = async () => {
    setSkeletonLoading(true);
    setChatOpen(true);
    await handleAgentGenerateSkeleton();
    setSkeletonLoading(false);
    // scroll into view
    setTimeout(
      () => listRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    );
  };

  // 3️⃣ Helper for auto-generation
  async function runAutoGeneration() {
    if (!skeleton) return false;
    setAutoGenRunning(true);
    const phases = getPlanArray();
    for (let p = 0; p < phases.length; p++) {
      for (let t = 0; t < phases[p].tasks.length; t++) {
        const task = phases[p].tasks[t];
        setAutoGenTaskId(task.id); // show spinner next to this task
        if (!task.executionPlan?.length) {
          const ep = await fetchExecutionPlan(p, t).catch(setApiError);
          if (ep) {
            task.executionPlan = ep;
          }
        }
        if (
          !task.userExplanation?.length ||
          !task.completionCriteria?.length ||
          !task.skip_conditions
        ) {
          const st = await fetchSettings(p, t).catch(setApiError);
          if (st) {
            Object.assign(task, st);
          }
        }
      }
    }
    setAutoGenTaskId(null);
    setAutoGenRunning(false);
    setCompletedTasks(phases.flatMap((ph) => ph.tasks.map((t) => t.id)));
    return true;
  }

  // STEP 2: approve skeleton
  const handleApproveSkeleton = async () => {
    setSkeletonNotes('');
    setSkeletonReviewed(true);
    if (autoGenerate) {
      await runAutoGeneration();
      setStep(2);
    } else {
      setStep(3);
    }
  };

  const handleRejectSkeleton = async () => {
    setSkeletonLoading(true);
    const sk = await submitSkeletonFeedback(skeletonNotes);
    setSkeleton(sk);
    setSkeletonNotes('');
    setSkeletonLoading(false);
  };

  // STEP 3: iterate tasks
  useEffect(() => {
    if (showTaskView && skeleton) {
      loadTask();
    }
  }, [showTaskView, taskIndex, skeleton]);

  const loadTask = async () => {
    const { pIdx, tIdx } = getIndexes();
    setTaskLoading(true);
    try {
      const task = getPlanArray()[pIdx].tasks[tIdx];
      let ep = Array.isArray(task.executionPlan) ? task.executionPlan : toStringArray(task.executionPlan);
      if (!ep || !ep.length) {
        ep = await fetchExecutionPlan(pIdx, tIdx);
      }
      const merged = { ...task, executionPlan: ep };
      setCurrentTaskData(merged);
      setTaskSubStep('plan');
      setCurrentTaskSettings(null);
      setTaskLoading(false);
    } catch (e) {
      setTaskLoading(false);
      setApiError(e.message);
    }
  };

  // Two-phase approval: plan, then settings
  const handleApprovePlan = async () => {
    const { pIdx, tIdx } = getIndexes();

    const {
      userExplanation = [],
      completionCriteria = [],
      skip_conditions = '',
    } = currentTaskData;

    const haveSettings =
      userExplanation.length && completionCriteria.length && skip_conditions;

    if (haveSettings) {
      setCurrentTaskSettings({
        userExplanation,
        completionCriteria,
        skip_conditions,
      });
      setTaskSubStep('settings');
      return;
    }

    setTaskLoading(true);
    try {
      const settings = await fetchSettings(pIdx, tIdx);
      setCurrentTaskSettings(settings);
      setTaskSubStep('settings');
    } catch (e) {
      setApiError(e.message);
    } finally {
      setTaskLoading(false);
    }
  };

  const handleApproveSettings = async () => {
    const { pIdx, tIdx } = getIndexes();

    setCompletedTasks([...completedTasks, currentTaskData.id]);

    if (taskIndex + 1 < totalTasks) {
      setTaskIndex(taskIndex + 1);
      setTaskNotes('');
    } else {
      setStep(2);
      setTaskNotes('');
    }
  };

  const handleRejectPlan = async () => {
    const { pIdx, tIdx } = getIndexes();
    setTaskLoading(true);
    try {
      const newEP = await fetchExecutionPlan(pIdx, tIdx, taskNotes);
      setCurrentTaskData((d) => ({ ...d, executionPlan: newEP }));
      setTaskNotes('');
      setTaskLoading(false);
    } catch (e) {
      setTaskLoading(false);
      setApiError(e.message);
    }
  };

  const handleRejectSettings = async () => {
    const { pIdx, tIdx } = getIndexes();
    setTaskLoading(true);
    try {
      const upd = await fetchSettings(pIdx, tIdx, taskNotes);
      setCurrentTaskSettings(upd);
      setTaskNotes('');
      setTaskLoading(false);
    } catch (e) {
      setTaskLoading(false);
      setApiError(e.message);
    }
  };

  function allTasksComplete() {
    const skeleton = getPlanArray();
    if (!skeleton || skeleton.length === 0) return false;

    for (const phase of skeleton) {
      for (const task of phase.tasks) {
        if (!taskIsComplete(task)) return false;
      }
    }
    return true;
  }

  // --- SkeletonSidebar component ---

  const SkeletonSidebar = () => (
    <div className="w-80 pr-6 border-r border-gray-100">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900">
              Plan Overview
            </h3>
          </div>
          <div className="space-y-4">
            {getPlanArray().map((phase, pIdx) => (
              <div
                key={pIdx}
                className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 border border-gray-200/50 shadow-sm"
              >
                <h4 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  {phase.title}
                </h4>
                <div className="space-y-2">
                  {phase.tasks.map((task, tIdx) => {
                    const linearIdx =
                      getPlanArray()
                        .slice(0, pIdx)
                        .reduce((a, ph) => a + ph.tasks.length, 0) + tIdx;
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 text-xs py-1.5 px-2 rounded-lg hover:bg-white/60 transition-colors cursor-pointer ${
                          taskIndex === linearIdx ? 'font-semibold' : ''
                        }`}
                        onClick={() => {
                          setTaskIndex(linearIdx);
                          setTaskSubStep('plan');
                          setStep(3);
                        }}
                      >
                        {task.title || '(untitled)'}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // --- ChatPanel component - uses stable PlanBuilderChatPanel to avoid remounts ---
  const showSidebarChat = chatOpen && step >= 2;
  const chatPanelElement = React.useMemo(() => (
    <PlanBuilderChatPanel
      chatOpen={chatOpen}
      setChatOpen={setChatOpen}
      agentWarnings={agentWarnings}
      chatMessages={chatMessages}
      chatInput={chatInput}
      setChatInput={setChatInput}
      chatLoading={chatLoading}
      sendAgentMessage={sendAgentMessage}
      step={step}
      chatInputRef={chatInputRef}
      skeletonNotesRef={skeletonNotesRef}
      autoGenerate={autoGenerate}
      setAutoGenerate={setAutoGenerate}
      canClose
      showUpdateTasksButton={(() => {
        const phases = getPlanArray();
        if (!Array.isArray(phases) || phases.length === 0) return false;
        for (const ph of phases) {
          for (const t of ph.tasks || []) {
            const hasExec = Array.isArray(t.executionPlan) && t.executionPlan.length > 0;
            const hasUser = Array.isArray(t.userExplanation) && t.userExplanation.length > 0;
            const hasComp = Array.isArray(t.completionCriteria) && t.completionCriteria.length > 0;
            const hasSkip = !!t.skip_conditions;
            if (!(hasExec && hasUser && hasComp && hasSkip)) return true;
          }
        }
        return false;
      })()}
      showCompletePlanButton={(() => {
        const phases = getPlanArray();
        if (!Array.isArray(phases) || phases.length === 0) return false;
        for (const ph of phases) {
          for (const t of ph.tasks || []) {
            const hasExec = Array.isArray(t.executionPlan) && t.executionPlan.length > 0;
            if (!hasExec) return false;
          }
        }
        return true;
      })()}
      onUpdateAllTasks={async () => {
        const payload = {
          plan: getPlanArray(),
          tasks: buildAllTaskPointers(),
          notes: '',
          cloudProvider,
        };
        const msg = buildMessageAction('update_tasks_batch', payload);
        await sendAgentMessage(msg, 'Requested to generate task settings');
      }}
      onCompletePlan={async () => {
        const payload = {
          planId,
          planObj: { plan: getPlanArray() },
          planDescription: getPlanDescription(),
          cloudProvider,
        };
        const msg = buildMessageAction('update_plan_settings', payload);
        await sendAgentMessage(msg, 'Requested to update plan settings');
        setStep(4);
      }}
    />
  ), [chatOpen, chatInput, step, chatLoading, autoGenerate, chatMessages, agentWarnings, cloudProvider]);

  const showSettingsReview =
    step === 4 &&
    !isEditMode &&
    (permissionsPolicy || (defaultValues && defaultValues.trim().length));
  const currentBlueprintTitle = getPlanTitle() || skeleton?.title || 'Untitled Skill';
  const currentBlueprintDescription = getPlanDescription();
  const hasCompletedTaskDetails = getPlanArray().some((phase) =>
    (phase.tasks || []).some(
      (task) =>
        (Array.isArray(task?.executionPlan) && task.executionPlan.length > 0) ||
        (Array.isArray(task?.completionCriteria) &&
          task.completionCriteria.length > 0) ||
        (Array.isArray(task?.userExplanation) && task.userExplanation.length > 0) ||
        !!task?.skip_conditions
    )
  );
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/30 to-indigo-50/20">
      <div className="px-8 py-6 space-y-6 w-full max-w-screen-3xl mx-auto">
        {(isEditMode || isCloneMode) && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/skills')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        )}
        <div className={showSidebarChat ? 'grid grid-cols-1 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)] gap-8 items-start' : ''}>
          <div className={showSidebarChat ? 'min-w-0 space-y-8 xl:order-2' : 'space-y-8'}>
            {(step !== 2 && (planState?.planTitle || planState?.planDescription)) ? (
              <div className="p-4 rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {planState?.planTitle && (
                      <div className="text-base font-semibold text-gray-900">
                        {planState.planTitle}
                      </div>
                    )}
                    {planState?.planDescription && (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap mt-1">
                        {Array.isArray(planState.planDescription)
                          ? planState.planDescription.join('\n')
                          : planState.planDescription}
                      </div>
                    )}
                    <div className="mt-2 inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                      {cloudProvider === 'azure' ? 'Azure' : 'AWS'}
                    </div>
                  </div>
                  {!chatOpen && step >= 2 && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChatOpen(true)}
                      >
                        Open Chat
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          {step === 1 && !isEditMode && (
          <Card className="w-full max-w-6xl mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-6">
              {apiError && (
                <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
                  {apiError}
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
                Skill Builder
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {setupStep === 'planType' ? 'Choose a plan type' : 'Describe your objective'}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {setupStep === 'planType'
                  ? 'Start by choosing whether this skill should review an environment or make configuration changes.'
                  : 'Tell the assistant what you want the skill to accomplish.'}
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              {setupStep === 'planType' ? (
                <>
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-900">Cloud provider</Label>
                    <div className="flex flex-wrap gap-3">
                      {CLOUD_PROVIDER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setCloudProvider(option.value)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                            cloudProvider === option.value
                              ? 'border-primary-400 bg-primary-50 text-primary-950 shadow-sm ring-2 ring-primary-100'
                              : 'border-gray-200 bg-white text-gray-900 hover:border-primary-200 hover:bg-primary-50/50'
                          }`}
                        >
                          <Cloud className="h-4 w-4 shrink-0" />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[
                      { value: 'Review', label: 'Review', description: 'Inspect, assess, and summarize configuration without applying changes.' },
                      { value: 'Configuration', label: 'Configuration', description: 'Create steps that can make configuration changes and then validate them.' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handlePlanTypeChange(opt.value)}
                        className={`rounded-xl border px-5 py-5 text-left transition-all ${
                          planType === opt.value
                            ? 'border-primary-400 bg-primary-50 text-primary-950 shadow-sm ring-2 ring-primary-100'
                            : 'border-gray-200 bg-white text-gray-900 hover:border-primary-200 hover:bg-primary-50/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1 h-4 w-4 rounded-full border ${
                              planType === opt.value
                                ? 'border-primary-500 bg-primary-500 shadow-[0_0_0_3px] shadow-primary-100'
                                : 'border-gray-300 bg-white'
                            }`}
                            aria-hidden="true"
                          />
                          <span>
                            <span className="block text-base font-semibold">{opt.label}</span>
                            <span className="mt-1 block text-sm text-gray-600">{opt.description}</span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button
                      size="sm"
                      onClick={() => setSetupStep('objective')}
                    >
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-900">Objective</Label>
                    <Textarea
                      ref={objectiveInputRef}
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      rows={4}
                      placeholder={
                        cloudProvider === 'azure'
                          ? 'E.g. Review Azure Backup readiness for production virtual machines'
                          : 'E.g. Review our AWS Backup readiness for DynamoDB tables'
                      }
                      className="w-full text-base border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 resize-none"
                    />
                  </div>

                  <Accordion type="single" collapsible className="w-full rounded-lg border border-gray-200 bg-white/60">
                    <AccordionItem value="advanced" className="border-0 px-2 sm:px-4">
                      <AccordionTrigger className="text-sm font-semibold text-gray-900 py-3 hover:no-underline [&[data-state=open]]:pb-2">
                        Advanced
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-1">
                          <div>
                            <div className="text-sm font-medium text-gray-800">Phases</div>
                            <p className="text-xs text-gray-500">
                              These phases guide how the assistant structures the proposed steps.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(() => {
                              const isReview = planType === 'Review';
                              const isConfigType = planType === 'Configuration';
                              const phases = [
                                { key: 'phaseAssessment', label: 'Assessment', value: phaseAssessment, setter: setPhaseAssessment, disabled: isReview },
                                { key: 'phaseSummary', label: 'Summary', value: phaseSummary, setter: setPhaseSummary, disabled: isReview },
                                { key: 'phaseConfig', label: 'Configuration', value: phaseConfig || isConfigType, setter: setPhaseConfig, disabled: isReview || isConfigType },
                                { key: 'phaseValidation', label: 'Validation', value: isReview ? false : phaseValidation, setter: setPhaseValidation, disabled: isReview },
                              ];
                              return phases.map((p) => (
                                <button
                                  key={p.key}
                                  type="button"
                                  onClick={() => {
                                    if (p.disabled) return;
                                    p.setter(!p.value);
                                  }}
                                  className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                    p.value
                                      ? 'border-primary-300 bg-primary-50 text-primary-900'
                                      : 'border-gray-200 bg-white text-gray-900 hover:border-primary-200 hover:bg-primary-50/50'
                                  } ${p.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  <span
                                    className={`h-4 w-4 rounded-full border ${
                                      p.value
                                        ? 'border-primary-500 bg-primary-500 shadow-[0_0_0_3px] shadow-primary-100'
                                        : 'border-gray-300 bg-white'
                                    }`}
                                    aria-hidden="true"
                                  />
                                  <span className="text-sm font-medium">{p.label}</span>
                                </button>
                              ));
                            })()}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Additional instructions</Label>
                            <Textarea
                              value={phasesCustomNotes}
                              onChange={(e) => setPhasesCustomNotes(e.target.value)}
                              rows={3}
                              placeholder="Optional constraints, scope, or style preferences for the generated skill."
                              className="resize-none border-gray-200 focus:border-primary-500 focus:ring-primary-500/20"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={skeletonLoading}
                      onClick={() => setSetupStep('planType')}
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={!objective.trim() || skeletonLoading}
                      onClick={handleGenerate}
                    >
                      {skeletonLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Skeleton
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Review Skeleton */}
        {step === 2 && skeleton && (
            <Card
              ref={listRef}
              className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm"
            >
            <CardHeader className="pb-4">
              {apiError && (
                <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
                  {apiError}
                </div>
              )}
              {/* Title Row - Full Width */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 group">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl font-bold text-gray-900 break-words leading-tight">
                      {currentBlueprintTitle}
                    </CardTitle>
                  </div>
                  <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
                    {cloudProvider === 'azure' ? 'Azure' : 'AWS'}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-100"
                    onClick={() => {
                      setEditField('skeletonTitle');
                      setEditValue(currentBlueprintTitle);
                      setEditModalOpen({ open: true, meta: {} });
                    }}
                  >
                    <Edit3 size={16} className="text-gray-400" />
                  </button>
                </div>
                
                {/* Description */}
                <div className="flex items-start gap-2 group">
                  <p
                    className={`text-sm text-gray-500 flex-1 ${
                      descriptionExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
                    }`}
                  >
                    {currentBlueprintDescription || 'No description'}
                  </p>
                  {currentBlueprintDescription && currentBlueprintDescription.length > 80 ? (
                    <button
                      type="button"
                      className="text-xs text-primary-600 hover:text-primary-700 shrink-0"
                      onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                    >
                      {descriptionExpanded ? 'less' : 'more'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 shrink-0"
                    onClick={() => {
                      setEditField('skeletonDescription');
                      setEditValue(currentBlueprintDescription || '');
                      setEditModalOpen({ open: true, meta: {} });
                    }}
                  >
                    <Edit3 size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Actions Row */}
              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                {/* Left side - View Toggle */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('structured')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        viewMode === 'structured'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <List size={14} />
                      Structured
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('markdown')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        viewMode === 'markdown'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Code size={14} />
                      Markdown
                    </button>
                  </div>
                  {chatLoading && (
                    <div className="flex items-center text-xs text-gray-500">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Updating…
                    </div>
                  )}
                </div>

                {/* Right side - Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatOpen((open) => !open)}
                  >
                    <MessageSquare size={14} className="mr-2" />
                    {chatOpen ? 'Hide Chat' : 'Show Chat'}
                  </Button>
                  {hasCompletedTaskDetails ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadMarkdown}
                      disabled={chatLoading || !getPlanArray().length}
                    >
                      <Download size={14} className="mr-2" />
                      Download
                    </Button>
                  ) : null}
                  {viewMode === 'markdown' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openMarkdownEditor}
                      disabled={chatLoading}
                    >
                      <Edit3 size={14} className="mr-2" />
                      Edit Markdown
                    </Button>
                  ) : null}
                  {isEditMode && !chatLoading && (
                    <Button
                      size="sm"
                      disabled={!recordId}
                      onClick={handleSaveEdits}
                    >
                      Save Changes
                    </Button>
                  )}
                  {!isEditMode && !chatLoading && (
                    <Button
                      size="sm"
                      disabled={isCreateMode ? !recordId : false}
                      onClick={isCloneMode ? handleSaveAsNew : handleCompleteBlueprint}
                    >
                      {isCloneMode ? 'Save as New' : 'Complete Skill'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Info Banner */}
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-sm text-blue-800">
                  {hasCompletedTaskDetails ? (
                    <>
                      Review and update the completed skill below. You can edit task titles, descriptions, execution plans, and completion criteria directly, or use the chat to request changes.
                    </>
                  ) : (
                    <>
                      Review the proposed steps below. You can edit task titles and descriptions directly, or use the chat to request changes. When you're satisfied, click <strong>Complete Skill</strong> to generate the full execution details.
                    </>
                  )}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {/* Markdown View Mode */}
              {viewMode === 'markdown' ? (
                <div className="relative">
                  {chatLoading && (
                    <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
                      <div className="flex items-center text-sm text-gray-600">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
                      <span className="text-xs font-medium text-gray-600">Skill Markdown</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openMarkdownEditor}
                        disabled={chatLoading}
                        className="h-7 text-xs"
                      >
                        <Edit3 size={12} className="mr-1.5" />
                        Edit
                      </Button>
                    </div>
                    <ScrollArea className="h-[600px]">
                      <pre className="p-4 text-sm font-mono text-gray-700 whitespace-pre-wrap">
                        {blueprintToMarkdown()}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
              <div className="flex gap-8">
                {/* Hide plan list when viewing a task (step 3) */}
                {/* chat sheet floats; keep right column only */}
                <div className="relative flex-1">
                  {chatLoading && (
                    <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex items-center text-sm text-gray-600">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
                      </div>
                    </div>
                  )}
                  <div className={chatLoading ? 'space-y-6 pointer-events-none opacity-60' : 'space-y-6'}>
                    {/* Title & Description */}
                    {step !== 2 && (
                      <div className="bg-gradient-to-br from-primary-50 to-indigo-50 border border-primary-200 rounded-xl p-6 shadow-sm">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Label className="text-sm font-semibold text-primary-900 mb-2 block">
                                Project Title
                              </Label>
                              <p className="text-gray-900 font-semibold text-lg">
                                {skeleton.title}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditField('skeletonTitle');
                                setEditValue(skeleton.title);
                                setEditModalOpen({ open: true, meta: {} });
                              }}
                              className="text-primary-600 hover:text-primary-700"
                            >
                              <Edit3 size={16} />
                            </Button>
                          </div>
                          {!isEditMode && (
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <Label className="text-sm font-semibold text-primary-900 mb-2 block">
                                  Description
                                </Label>
                                <p className="text-gray-700 leading-relaxed">
                                  {Array.isArray(skeleton.description)
                                    ? skeleton.description.join('\n')
                                    : skeleton.description}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditField('skeletonDescription');
                                  setEditValue(
                                    Array.isArray(skeleton.description)
                                      ? skeleton.description.join('\n')
                                      : skeleton.description || ''
                                  );
                                  setEditModalOpen({ open: true, meta: {} });
                                }}
                                className="text-primary-600 hover:text-primary-700"
                              >
                                <Edit3 size={16} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {getPlanArray().map((phase, pIdx) => (
                        <div
                          key={pIdx}
                          className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <div className="w-3 h-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full"></div>
                                {phase.title}
                              </h3>
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditField('phase_title');
                                    setEditValue(phase.title);
                                    setEditModalOpen({
                                      open: true,
                                      meta: { pIdx },
                                    });
                                  }}
                                  className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                                >
                                  <Edit3 size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const planCopy = [...getPlanArray()];
                                    planCopy.splice(pIdx, 1);
                                    setPlanArray(planCopy);
                                  }}
                                  className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                >
                                  <XCircle size={14} />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="p-6">
                            <div className="space-y-3 mb-4">
                              {phase.tasks.map((task, tIdx) => {
                                const hasExecutionPlan =
                                  Array.isArray(task?.executionPlan) &&
                                  task.executionPlan.length > 0;
                                const hasCompletionCriteria =
                                  Array.isArray(task?.completionCriteria) &&
                                  task.completionCriteria.length > 0;
                                const hasCompletedDetails =
                                  hasExecutionPlan ||
                                  hasCompletionCriteria ||
                                  (Array.isArray(task?.userExplanation) &&
                                    task.userExplanation.length > 0) ||
                                  !!task?.skip_conditions;
                                return (
                                <div
                                  key={task.id}
                                  className="flex justify-between items-start group hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    {autoGenRunning &&
                                    autoGenTaskId === task.id ? (
                                      <Loader2
                                        size={16}
                                        className="animate-spin text-primary-500"
                                      />
                                    ) : completedTasks.includes(task.id) ||
                                      taskIsComplete(task) ? (
                                      <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                                        <CheckIcon
                                          size={12}
                                          className="text-white"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                                    )}
                                    <div className="flex flex-col">
                                      <span
                                        className={
                                          taskIsComplete(task)
                                            ? 'cursor-pointer hover:text-primary-600 font-medium transition-colors'
                                            : 'font-medium text-gray-900'
                                        }
                                        onClick={() => {
                                          if (!taskIsComplete(task)) return;
                                          const linearIdx =
                                            getPlanArray()
                                              .slice(0, pIdx)
                                              .reduce(
                                                (acc, ph) => acc + ph.tasks.length,
                                                0
                                              ) + tIdx;
                                          setTaskIndex(linearIdx);
                                          setTaskNotes('');
                                          setTaskSubStep('plan');
                                          setShowTaskView(true);
                                          setStep(3);
                                        }}
                                      >
                                        {task.title}
                                      </span>
                                      {task?.description ? (
                                        <span className="text-xs text-gray-500">
                                          {task.description}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditField(hasCompletedDetails ? 'task_details' : 'task_basic');
                                        setEditTaskDraft({
                                          title: task.title || '',
                                          description: task.description || '',
                                          completionCriteria: (task.completionCriteria || []).join('\n'),
                                          executionPlan: (task.executionPlan || []).join('\n'),
                                          maxTurns: String(
                                            normalizeTaskMaxTurns(task?.maxTurns)
                                          ),
                                        });
                                        setEditModalOpen({ open: true, meta: { pIdx, tIdx } });
                                      }}
                                      className="text-gray-500 hover:text-gray-700 h-7 w-7 p-0"
                                    >
                                      <Edit3 size={12} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const planCopy = [...getPlanArray()];
                                        planCopy[pIdx].tasks.splice(tIdx, 1);
                                        setPlanArray(planCopy);
                                      }}
                                      className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                                    >
                                      <XCircle size={12} />
                                    </Button>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-dashed border-gray-300 text-gray-600 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/50 transition-colors"
                              onClick={() => {
                                const planCopy = [...getPlanArray()];
                                planCopy[pIdx].tasks.push({
                                  id: `new_task_${Date.now()}`,
                                  title: 'New Task',
                                  description: '',
                                  maxTurns: DEFAULT_TASK_MAX_TURNS,
                                });
                                setPlanArray(planCopy);
                              }}
                            >
                              <Plus size={14} className="mr-2" />
                              Add Task
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed border-gray-300 text-gray-600 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/50 transition-colors h-12"
                        onClick={() => {
                          setPlanArray((arr) => [
                            ...arr,
                            { title: 'New Phase', tasks: [] },
                          ]);
                        }}
                      >
                        <Plus size={14} className="mr-2" />
                        Add Phase
                      </Button>
                    </div>
                  </div>
                </div>
                {/* chat panel column retained elsewhere */}
              </div>
              )}

              {/* Removed Generate Permissions & Settings button */}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Task Details (execution plan and settings) */}
        {step === 3 && (
          <Card ref={listRef} className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">3</span>
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Task Details
                </CardTitle>
                <div className="ml-auto flex items-center gap-3">
                  <Button variant="outline" onClick={() => { setShowTaskView(false); setStep(2); }}>
                    Back to Review
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {apiError && (
                <div className="mb-6 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
                  {apiError}
                </div>
              )}
              {taskLoading && (
                <div className="text-sm text-gray-600">Loading task…</div>
              )}
              {!taskLoading && currentTaskData && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-gray-900">{currentTaskData.title}</div>
                    <div className="text-xs text-gray-500">Task {currentTaskNumber} of {totalTasks}</div>
                  </div>

                  {taskSubStep === 'plan' && (
                    <div className="space-y-6">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">Execution Plan</Label>
                        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                          {(currentTaskData.executionPlan || []).length ? (
                            (currentTaskData.executionPlan || []).map((line, i) => (
                              <div key={i} className="text-sm text-gray-800">• {line}</div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No execution plan yet.</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-base font-semibold text-gray-900">Completion Criteria</Label>
                        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                          {(currentTaskData.completionCriteria || []).length ? (
                            (currentTaskData.completionCriteria || []).map((line, i) => (
                              <div key={i} className="text-sm text-gray-800">• {line}</div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No completion criteria yet.</div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3"></div>
                    </div>
                  )}

                  {taskSubStep === 'settings' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label className="text-base font-semibold text-gray-900">User Explanation</Label>
                          <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                            {(currentTaskSettings?.userExplanation || []).length ? (
                              (currentTaskSettings.userExplanation || []).map((line, i) => (
                                <div key={i} className="text-sm text-gray-800">• {line}</div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500">No user explanation yet.</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-base font-semibold text-gray-900">Completion Criteria</Label>
                          <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                            {(currentTaskSettings?.completionCriteria || []).length ? (
                              (currentTaskSettings.completionCriteria || []).map((line, i) => (
                                <div key={i} className="text-sm text-gray-800">• {line}</div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500">No completion criteria yet.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-base font-semibold text-gray-900">Skip Conditions</Label>
                        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4">
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">
                            {currentTaskSettings?.skip_conditions || 'None'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2"></div>

                      <div className="flex gap-3"></div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showSettingsReview && (
          <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-6">
              {apiError && (
                <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
                  {apiError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">
                    {step === 4 ? '4' : 'Edit'}
                  </span>
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {step === 4 ? 'Review Permissions & Settings' : 'Edit Permissions & Settings'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8">
                {/* Left column: policy & settings */}
                <div className="w-full space-y-6">
                  {permissionsPolicy ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg text-gray-900">
                          Permissions Policy
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditField('permissionsPolicy');
                            setEditValue(
                              JSON.stringify(permissionsPolicy, null, 2)
                            );
                            setEditModalOpen({ open: true, meta: {} });
                          }}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          <Edit3 size={16} />
                        </Button>
                      </div>
                      <ScrollArea className="h-64 w-full rounded-xl border border-gray-200 shadow-sm">
                        <pre className="bg-gray-900 text-gray-100 p-4 text-xs font-mono leading-relaxed">
                          {JSON.stringify(permissionsPolicy, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  ) : null}

                  <div className="space-y-6">
                    <h3 className="font-semibold text-lg text-gray-900">
                      Other Settings
                    </h3>

                    <div className="flex items-center space-x-3 p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/50 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id="limitRegions"
                        checked={limitToSpecificRegions}
                        onCheckedChange={() =>
                          setLimitToSpecificRegions(!limitToSpecificRegions)
                        }
                      />
                      <Label
                        htmlFor="limitRegions"
                        className="font-medium cursor-pointer text-gray-700"
                      >
                        Limit to specific regions
                      </Label>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-semibold text-gray-900">
                        Default Values
                      </Label>
                      <Textarea
                        value={defaultValues}
                        onChange={(e) => setDefaultValues(e.target.value)}
                        rows={6}
                        className="w-full font-mono text-sm border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 resize-none"
                        placeholder="Enter default configuration values..."
                      />
                    </div>
                  </div>
                </div>

                {null}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={markdownEditOpen} onOpenChange={setMarkdownEditOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-none h-[calc(100vh-2rem)] max-h-none bg-white p-0 flex flex-col">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Edit Skill as Markdown
              </DialogTitle>
              <p className="text-sm text-gray-500">
                Use `#` headings for phases and `##` headings for tasks. Text under each task becomes its description.
              </p>
            </DialogHeader>
            <div className="flex-1 min-h-0 p-6">
              {markdownError ? (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {markdownError}
                </div>
              ) : null}
              <Textarea
                value={markdownDraft}
                onChange={(e) => {
                  setMarkdownDraft(e.target.value);
                  if (markdownError) setMarkdownError('');
                }}
                className="h-full min-h-0 w-full resize-none border-gray-200 font-mono text-sm leading-6 focus:border-primary-500 focus:ring-primary-500/20"
                placeholder="# Phase name&#10;&#10;## Task title&#10;Task description&#10;&#10;### Execution Plan&#10;- Step one&#10;&#10;### Completion Criteria&#10;- Criterion one"
              />
            </div>
            <DialogFooter className="px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setMarkdownEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={applyMarkdownDraft}>
                Save Markdown
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editModalOpen.open}
          onOpenChange={(o) =>
            setEditModalOpen({ open: o, meta: editModalOpen.meta })
          }
        >
          <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-sm border-0 shadow-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Edit{' '}
                {editField
                  ?.replace(/([A-Z])/g, ' $1')
                  .replace(/_/g, ' ')
                  .replace(/^./, (str) => str.toUpperCase())}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 overflow-y-auto pr-3">
            <div className="py-4">
              {editField === 'task_basic' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">
                      Task Title
                    </Label>
                    <Input
                      value={editTaskDraft.title}
                      onChange={(e) =>
                        setEditTaskDraft((d) => ({
                          ...d,
                          title: e.target.value,
                        }))
                      }
                      className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">
                      Description
                    </Label>
                    <Textarea
                      value={editTaskDraft.description}
                      onChange={(e) =>
                        setEditTaskDraft((d) => ({
                          ...d,
                          description: e.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 resize-none"
                      placeholder="Describe what this task does"
                    />
                  </div>
                </div>
              ) : editField === 'task_details' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">
                      Task Title
                    </Label>
                    <Input
                      value={editTaskDraft.title}
                      onChange={(e) =>
                        setEditTaskDraft((d) => ({
                          ...d,
                          title: e.target.value,
                        }))
                      }
                      className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">
                      Description
                    </Label>
                    <Textarea
                      value={editTaskDraft.description}
                      onChange={(e) =>
                        setEditTaskDraft((d) => ({
                          ...d,
                          description: e.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 resize-none"
                      placeholder="Describe what this task does"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">
                      Completion Criteria
                    </Label>
                    <Textarea
                      value={editTaskDraft.completionCriteria}
                      onChange={(e) =>
                        setEditTaskDraft((d) => ({
                          ...d,
                          completionCriteria: e.target.value,
                        }))
                      }
                      rows={6}
                      className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 resize-none"
                      placeholder="One criterion per line"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">
                      Execution Plan (Optional)
                    </Label>
                    <Textarea
                      value={editTaskDraft.executionPlan}
                      onChange={(e) =>
                        setEditTaskDraft((d) => ({
                          ...d,
                          executionPlan: e.target.value,
                        }))
                      }
                      rows={6}
                      className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 resize-none"
                      placeholder="One line per step"
                    />
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="advanced" className="rounded-xl border border-gray-200 bg-gray-50/80 px-4">
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="text-left">
                          <span className="text-sm font-semibold text-gray-900">
                            Advanced Settings
                          </span>
                          <p className="mt-0.5 text-xs text-gray-500 font-normal">
                            Control the per-task agent turn budget
                          </p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            Max Turns
                          </Label>
                          <p className="text-xs text-gray-500">Default is 50. Maximum is 150.</p>
                          <Input
                            type="number"
                            min={1}
                            max={MAX_TASK_MAX_TURNS}
                            value={editTaskDraft.maxTurns}
                            onChange={(e) =>
                              setEditTaskDraft((d) => ({
                                ...d,
                                maxTurns: e.target.value,
                              }))
                            }
                            className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              ) : (
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={10}
                  className="w-full border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 resize-none"
                />
              )}
            </div>
            </ScrollArea>
            <DialogFooter className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setEditModalOpen({ open: false, meta: {} })}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // apply edits
                  const meta = editModalOpen.meta || {};
                  if (
                    editField === 'task_basic' &&
                    typeof meta.pIdx === 'number' &&
                    typeof meta.tIdx === 'number'
                  ) {
                    setPlanArray((prev) => {
                      const copy = [...prev];
                      const phase = { ...copy[meta.pIdx] };
                      const tasks = [...phase.tasks];
                      tasks[meta.tIdx] = {
                        ...tasks[meta.tIdx],
                        title: editTaskDraft.title || tasks[meta.tIdx]?.title || '',
                        description: editTaskDraft.description || '',
                      };
                      copy[meta.pIdx] = { ...phase, tasks };
                      return copy;
                    });
                  }
                  if (
                    editField === 'task_details' &&
                    typeof meta.pIdx === 'number' &&
                    typeof meta.tIdx === 'number'
                  ) {
                    const toLines = (value) =>
                      String(value || '')
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean);
                    setPlanArray((prev) => {
                      const copy = [...prev];
                      const phase = { ...copy[meta.pIdx] };
                      const tasks = [...phase.tasks];
                      tasks[meta.tIdx] = {
                        ...tasks[meta.tIdx],
                        title: editTaskDraft.title || tasks[meta.tIdx]?.title || '',
                        description: editTaskDraft.description || '',
                        completionCriteria: toLines(editTaskDraft.completionCriteria),
                        executionPlan: toLines(editTaskDraft.executionPlan),
                        maxTurns: normalizeTaskMaxTurns(editTaskDraft.maxTurns),
                      };
                      copy[meta.pIdx] = { ...phase, tasks };
                      return copy;
                    });
                  }
                  if (editField === 'skeletonTitle')
                    setSkeleton((s) => ({ ...s, title: editValue }));
                  if (editField === 'skeletonTitle') {
                    setPlanState((s) => (s ? { ...s, planTitle: editValue } : s));
                  }
                  if (editField === 'skeletonDescription')
                    setSkeleton((s) => ({ ...s, description: editValue }));
                  if (editField === 'skeletonDescription') {
                    setPlanDescription(editValue);
                    setPlanState((s) => (s ? { ...s, planDescription: editValue } : s));
                  }
                  if (editField === 'skeletonPlan')
                    setSkeleton((s) => ({ ...s, plan: JSON.parse(editValue) }));
                  if (
                    editField === 'phase_title' &&
                    typeof meta.pIdx === 'number'
                  ) {
                    setPlanArray((prev) => {
                      const copy = [...prev];
                      copy[meta.pIdx] = {
                        ...copy[meta.pIdx],
                        title: editValue,
                      };
                      return copy;
                    });
                  }
                  if (
                    editField === 'task_title' &&
                    typeof meta.pIdx === 'number' &&
                    typeof meta.tIdx === 'number'
                  ) {
                    setPlanArray((prev) => {
                      const copy = [...prev];
                      const phase = { ...copy[meta.pIdx] };
                      const tasks = [...phase.tasks];
                      tasks[meta.tIdx] = {
                        ...tasks[meta.tIdx],
                        title: editValue,
                      };
                      copy[meta.pIdx] = { ...phase, tasks };
                      return copy;
                    });
                  }
                  if (
                    editField === 'task_description' &&
                    typeof meta.pIdx === 'number' &&
                    typeof meta.tIdx === 'number'
                  ) {
                    setPlanArray((prev) => {
                      const copy = [...prev];
                      const phase = { ...copy[meta.pIdx] };
                      const tasks = [...phase.tasks];
                      tasks[meta.tIdx] = {
                        ...tasks[meta.tIdx],
                        description: editValue,
                      };
                      copy[meta.pIdx] = { ...phase, tasks };
                      return copy;
                    });
                  }
                  if (editField === 'permissionsPolicy') {
                    setPermissionsPolicy(JSON.parse(editValue));
                  }
                  if (
                    editField === 'task_executionPlan' &&
                    typeof meta.pIdx === 'number' &&
                    typeof meta.tIdx === 'number'
                  ) {
                    setPlanArray((prev) => {
                      const copy = [...prev];
                      const phase = { ...copy[meta.pIdx] };
                      const tasks = [...phase.tasks];
                      tasks[meta.tIdx] = {
                        ...tasks[meta.tIdx],
                        executionPlan: editValue
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean),
                      };
                      copy[meta.pIdx] = { ...phase, tasks };
                      return copy;
                    });
                  }
                  if (
                    editField === 'task_executionPlan' &&
                    taskSubStep === 'plan'
                  ) {
                    setCurrentTaskData((d) => ({
                      ...d,
                      executionPlan: editValue.split('\n'),
                    }));
                  }
                  if (
                    editField === 'task_completionCriteria' &&
                    typeof meta.pIdx === 'number' &&
                    typeof meta.tIdx === 'number'
                  ) {
                    setPlanArray((prev) => {
                      const copy = [...prev];
                      const phase = { ...copy[meta.pIdx] };
                      const tasks = [...phase.tasks];
                      tasks[meta.tIdx] = {
                        ...tasks[meta.tIdx],
                        completionCriteria: editValue
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean),
                      };
                      copy[meta.pIdx] = { ...phase, tasks };
                      return copy;
                    });
                  }
                  if (
                    editField.startsWith('task_') &&
                    taskSubStep === 'settings'
                  ) {
                    if (editField === 'task_userExplanation')
                      setCurrentTaskSettings((s) => ({
                        ...s,
                        userExplanation: editValue.split('\n'),
                      }));
                    if (editField === 'task_completionCriteria')
                      setCurrentTaskSettings((s) => ({
                        ...s,
                        completionCriteria: editValue.split('\n'),
                      }));
                    if (editField === 'task_skipConditions')
                      setCurrentTaskSettings((s) => ({
                        ...s,
                        skip_conditions: editValue,
                      }));
                  }
                  if (editField?.startsWith('task_')) {
                    // Task data is already updated in the UI state
                  }
                  if (
                    editField === 'skeletonTitle' ||
                    editField === 'skeletonDescription' ||
                    editField === 'skeletonPlan' ||
                    editField === 'phase_title' ||
                    editField === 'task_title'
                  ) {
                    // Skeleton data is already updated in the UI state
                  }
                  setEditModalOpen({ open: false, meta: {} });
                }}
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {permGenLoading && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex items-center gap-6 bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-200">
              <div className="relative">
                <Loader2 className="animate-spin text-primary-600" size={48} />
                <div className="absolute inset-0 bg-primary-500/20 rounded-full animate-ping"></div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">
                  Generating Permissions
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we configure your workflow...
                </p>
              </div>
            </div>
          </div>
        )}
          </div>
          {showSidebarChat ? (
            <aside className="xl:order-1 xl:sticky xl:top-6 h-[calc(100vh-4.5rem)] max-h-[calc(100vh-4.5rem)]">
              {chatPanelElement}
            </aside>
          ) : null}
        </div>
      </div>
      {null}
      {/* Side-by-side chat panel is rendered within the main container when open */}
    </div>
  );
}

// Floating chat panel for Plan Builder Agent
// Rendered after the main container to overlay on all steps


// Helper to determine if a task is "complete"
function taskIsComplete(task) {
  const hasExec =
    Array.isArray(task.executionPlan) && task.executionPlan.length;
  // const hasDeps = Array.isArray(task.depends_on) ? true : !!task.depends_on;
  // const hasSkip = !!task.skip_conditions;
  const hasComp =
    Array.isArray(task.completionCriteria) && task.completionCriteria.length;
  const hasUser =
    Array.isArray(task.userExplanation) && task.userExplanation.length;
  return hasExec && hasComp && hasUser; // Removed hasDeps requirement
}

function planIsComplete(obj) {
  if (!obj || !obj.plan) return false;
  if (!obj.title || !obj.description) return false;
  if (!obj.requiredPermissions?.policy) return false;
  if (!obj.planSettings?.defaultValues) return false;
  for (const ph of obj.plan) {
    for (const t of ph.tasks) if (!taskIsComplete(t)) return false;
  }
  return true;
}
