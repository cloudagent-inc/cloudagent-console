import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  ChevronRight,
  ChevronDown,
  Edit,
  Upload,
  Download,
  Sparkles,
  Check,
  Circle,
  CheckCircle2,
  MinusCircle,
  AlertCircle,
  CloudUpload,
  Trash2,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import toast from 'react-hot-toast';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { setCurrentWorkload } from '@/features/wellArchitected/wellArchitectedSlice';
import { refreshAccountScans } from '@/features/auth/authSlice';
import UploadToAwsModal from '@/components/WellArchitected/UploadToAwsModal';
import wellArchitectedQuestions from '@/helpers/wellarchitected/blank_lens_wellarchitected';
import waMapping from '@/helpers/wellarchitected/wellArchitectedCustomQuestions';
import serverlessQuestions from '@/helpers/wellarchitected/blank_lens_serverless';
import saasQuestions from '@/helpers/wellarchitected/blank_lens_saas';
import containerBuildQuestions from '@/helpers/wellarchitected/blank_lens_containerbuild';
import machineLearningQuestions from '@/helpers/wellarchitected/blank_lens_machinelearning';
import devopsQuestions from '@/helpers/wellarchitected/blank_lens_devops';
import healthcareQuestions from '@/helpers/wellarchitected/blank_lens_healthcare';
import genaiQuestions from '@/helpers/wellarchitected/blank_lens_genai';
import choiceRiskMapping from '@/helpers/wellarchitected/choice_risk_mapping';
import { parseWellArchitectedAnswers } from '@/helpers/wellarchitected/wellarchitected';
import { fetchAssessmentResults } from '@/api/assessments';
import { getWellArchitectedWorkload } from '@/api/wellArchitected';
import ExpressReview from '@/components/WellArchitected/ExpressReview';
import WellArchitectedWorkloadModal from '@/components/WellArchitectedModal';
import PDFReport from '@/components/WellArchitected/WellArchitectedPdfReport';

// Lens options with pillars - matching asecurecloud
const lensOptions = {
  wellarchitected: {
    title: 'AWS Well-Architected Framework',
    pillars: {
      operationalExcellence: 'Operational Excellence',
      security: 'Security',
      reliability: 'Reliability',
      performance: 'Performance',
      costOptimization: 'Cost Optimization',
      sustainability: 'Sustainability',
    },
  },
  serverless: {
    title: 'Serverless Lens',
    pillars: {
      costOptimization: 'Cost Optimization',
      operationalExcellence: 'Operational Excellence',
      performance: 'Performance',
      reliability: 'Reliability',
      security: 'Security',
    },
  },
  softwareasaservice: {
    title: 'SaaS Lens',
    pillars: {
      costOptimization: 'Cost Optimization',
      operationalExcellence: 'Operational Excellence',
      performance: 'Performance',
      reliability: 'Reliability',
      security: 'Security',
    },
  },
  'arn:aws:wellarchitected::aws:lens/containerbuild': {
    title: 'Container Build Lens',
    pillars: {
      costOptimization: 'Cost Optimization',
      operationalExcellence: 'Operational Excellence',
      reliability: 'Reliability',
      performance: 'Performance',
      security: 'Security',
      sustainability: 'Sustainability',
    },
  },
  'arn:aws:wellarchitected::aws:lens/machinelearning': {
    title: 'Machine Learning Lens',
    pillars: {
      costOptimization: 'Cost Optimization',
      operationalExcellence: 'Operational Excellence',
      performance: 'Performance',
      reliability: 'Reliability',
      security: 'Security',
      sustainability: 'Sustainability',
    },
  },
  'arn:aws:wellarchitected::aws:lens/devops': {
    title: 'DevOps Lens',
    pillars: {
      Automated_Governance: 'Automated Governance',
      Development_Lifecycle: 'Development Lifecycle',
      Observability: 'Observability',
      Organizational_Adoption: 'Organizational Adoption',
      Quality_Assurance: 'Quality Assurance',
    },
  },
  'arn:aws:wellarchitected::aws:lens/healthcare': {
    title: 'Healthcare Lens',
    pillars: {
      costOptimization: 'Cost Optimization',
      operationalExcellence: 'Operational Excellence',
      performance: 'Performance',
      reliability: 'Reliability',
      security: 'Security',
      sustainability: 'Sustainability',
    },
  },
  'arn:aws:wellarchitected::aws:lens/genai': {
    title: 'Generative AI Lens',
    pillars: {
      operationalExcellence: 'Operational Excellence',
      security: 'Security',
      reliability: 'Reliability',
      performance: 'Performance Efficiency',
      costOptimization: 'Cost Optimization',
      sustainability: 'Sustainability',
    },
  },
};

const ALL_LENS_QUESTIONS = [
  ...wellArchitectedQuestions,
  ...serverlessQuestions,
  ...saasQuestions,
  ...containerBuildQuestions,
  ...machineLearningQuestions,
  ...devopsQuestions,
  ...healthcareQuestions,
  ...genaiQuestions,
];

const getQuestionsByPillarForLens = (lensAlias) => {
  return ALL_LENS_QUESTIONS.filter((q) => q.LensAlias === lensAlias).reduce(
    (acc, question) => {
      const pillarId = question.PillarId;
      if (!acc[pillarId]) {
        acc[pillarId] = [];
      }
      acc[pillarId].push(question);
      return acc;
    },
    {}
  );
};

const QUESTIONS_BY_PILLAR = getQuestionsByPillarForLens('wellarchitected');
const WELL_ARCHITECTED_REPORT_IDS = new Set([
  'compliance_aws_well_architected',
  'report_compliance_aws_well_architected',
]);

export default function WellArchitectedDetailPage() {
  const { workloadId } = useParams();
  const [searchParams] = useSearchParams();
  const workloadRegion = searchParams.get('region') || 'us-east-1';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { workloads, selectedAccountId } = useSelector((state) => state.wellArchitected);
  const { userProfile } = useSelector((state) => state.auth);

  // State for AWS workload (when not found in Redux)
  const [awsWorkload, setAwsWorkload] = useState(null);
  const [loadingAwsWorkload, setLoadingAwsWorkload] = useState(false);

  // First try to find in Redux (local workloads)
  const localWorkload = useMemo(() => {
    return workloads.find((w) => w.workloadId === workloadId);
  }, [workloads, workloadId]);

  // Use local workload if found, otherwise use AWS workload
  const workload = localWorkload || awsWorkload;
  const awsWorkloadLoadedForCurrentRoute =
    awsWorkload?.workloadId === workloadId &&
    awsWorkload?.awsRegion === workloadRegion &&
    awsWorkload?.environments?.[0] === selectedAccountId;

  // Fetch AWS workload if not found locally
  useEffect(() => {
    if (localWorkload || !workloadId || awsWorkloadLoadedForCurrentRoute) return;

    // Get the selected account's auth profile
    const selectedProfile = userProfile?.agentPermissionProfiles?.find(
      (p) => p.recordId === selectedAccountId
    );
    if (!selectedProfile) return;

    const authProfile =
      typeof selectedProfile.authProfile === 'string'
        ? JSON.parse(selectedProfile.authProfile)
        : selectedProfile.authProfile || {};

    const fetchAwsWorkload = async () => {
      setLoadingAwsWorkload(true);
      try {
        const result = await getWellArchitectedWorkload({
          workloadId,
          accountId: authProfile.awsAccountId,
          authProfile,
          workloadRegion,
        });
        console.log('[WellArchitectedDetail] AWS workload response:', result);

        // Parse the response
        if (result?.code === 200 && result?.data) {
          const data = result.data;
          const details = data.Details?.data || data;
          const answersData = data.Answers?.data || [];

          // Transform AWS workload format to our format
          const workloadLenses = details.Lenses || ['wellarchitected'];
          setAwsWorkload({
            workloadId: details.WorkloadId || workloadId,
            workloadName: details.WorkloadName,
            Lenses: workloadLenses,
            environments: [selectedAccountId],
            deploymentPreferences: JSON.stringify({
              type: 'well-architected',
              lenses: workloadLenses,
            }),
            description: details.Description,
            awsRegion: workloadRegion,
            regions: details.AwsRegions || [workloadRegion],
            environment: details.Environment,
            reviewOwner: details.ReviewOwner,
            tags: details.Tags,
            createdAt: details.UpdatedAt,
            updatedAt: details.UpdatedAt,
            isAwsWorkload: true,
            awsAnswers: answersData, // Store raw AWS answers
          });

          // Populate answers state with SelectedChoices from AWS
          if (answersData.length > 0) {
            const answersMap = {};
            answersData.forEach((answer) => {
              if (answer.SelectedChoices && answer.SelectedChoices.length > 0) {
                answersMap[answer.QuestionId] = answer.SelectedChoices;
              }
            });
            setAnswers(answersMap);
            console.log('[WellArchitectedDetail] Loaded answers from AWS:', answersMap);
          }
        }
      } catch (error) {
        console.error('[WellArchitectedDetail] Error fetching AWS workload:', error);
      } finally {
        setLoadingAwsWorkload(false);
      }
    };

    fetchAwsWorkload();
  }, [
    localWorkload,
    workloadId,
    workloadRegion,
    selectedAccountId,
    awsWorkloadLoadedForCurrentRoute,
    userProfile?.agentPermissionProfiles,
  ]);

  const deploymentPreferences = useMemo(() => {
    if (!workload?.deploymentPreferences)
      return { lenses: ['wellarchitected'] };
    return typeof workload.deploymentPreferences === 'string'
      ? JSON.parse(workload.deploymentPreferences)
      : workload.deploymentPreferences;
  }, [workload]);

  const [selectedLens, setSelectedLens] = useState('wellarchitected');
  const [selectedPillar, setSelectedPillar] = useState('security');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [selectedView, setSelectedView] = useState('defaultView');
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [questionNotes, setQuestionNotes] = useState('');
  const [editWorkloadModalOpen, setEditWorkloadModalOpen] = useState(false);

  const [applySuggestionsModalOpen, setApplySuggestionsModalOpen] =
    useState(false);
  const [applyMode, setApplyMode] = useState('question');
  const [copyNotesFromSuggestions, setCopyNotesFromSuggestions] =
    useState(true);

  const [selectedScanId, setSelectedScanId] = useState('');

  const [pdfExportModalOpen, setPdfExportModalOpen] = useState(false);
  const [pdfExportLoading, setPdfExportLoading] = useState(false);
  const [uploadToAwsModalOpen, setUploadToAwsModalOpen] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    suggestions: true,
    allQuestions: false,
    failed: false,
    answered: false,
    suggestedColumn: true,
    answersColumn: true,
    recommendationDetails: true,
    notes: false,
    customLogo: '',
    logoWidth: '',
    logoHeight: '',
    selectedFile: null,
  });

  const [answers, setAnswers] = useState({});
  const [notApplicableChoices, setNotApplicableChoices] = useState({});
  const [questionIsApplicable, setQuestionIsApplicable] = useState({});
  const [assessmentNotes, setAssessmentNotes] = useState({}); // Notes per question from assessment

  const [choiceContexts, setChoiceContexts] = useState({});

  // Express Review answer values - lifted from ExpressReview component to persist between view switches
  const [expressAnswerValues, setExpressAnswerValues] = useState({});

  const [expandedSuggestions, setExpandedSuggestions] = useState({});
  const [activeSuggestionResourceDetails, setActiveSuggestionResourceDetails] =
    useState(null);

  const [assessmentLoading, setAssessmentLoading] = useState(false);

  const allAccountScans = useSelector(
    (state) => state.auth?.userProfile?.reportHistory || []
  );

  // workloadAccountId is the recordId of the permission profile
  const workloadAccountRecordId = useMemo(() => {
    return workload?.environments?.[0] || null;
  }, [workload]);

  // Get the actual AWS account ID from the permission profile
  const workloadAwsAccountId = useMemo(() => {
    if (!workloadAccountRecordId) return null;
    const profile = userProfile?.agentPermissionProfiles?.find(
      (p) => p.recordId === workloadAccountRecordId
    );
    if (!profile) return null;
    const auth =
      typeof profile.authProfile === 'string'
        ? JSON.parse(profile.authProfile)
        : profile.authProfile || {};
    return auth.awsAccountId || null;
  }, [workloadAccountRecordId, userProfile?.agentPermissionProfiles]);

  // Get account display name for breadcrumb
  const accountDisplayName = useMemo(() => {
    return workloadAwsAccountId || workloadAccountRecordId || null;
  }, [workloadAwsAccountId, workloadAccountRecordId]);

  const wellArchitectedScans = useMemo(() => {
    return allAccountScans
      .filter((scan) => {
        const matchesReportId = WELL_ARCHITECTED_REPORT_IDS.has(scan.reportId);
        // Compare with actual AWS account ID, not the recordId
        const matchesAccount =
          !workloadAwsAccountId || scan.accountId === workloadAwsAccountId;
        return matchesReportId && matchesAccount;
      })
      .sort((a, b) => {
        const dateA = new Date(a.latestAssessmentDate || a.lastUpdateTime || 0);
        const dateB = new Date(b.latestAssessmentDate || b.lastUpdateTime || 0);
        return dateB - dateA;
      });
  }, [allAccountScans, workloadAwsAccountId]);

  const accountScans = wellArchitectedScans;

  const currentLensQuestions = useMemo(() => {
    return getQuestionsByPillarForLens(selectedLens);
  }, [selectedLens]);

  // Auto-select the latest Well-Architected scan on mount
  useEffect(() => {
    if (wellArchitectedScans.length > 0 && !selectedScanId) {
      const latestScan = wellArchitectedScans[0]; // Already sorted, first is newest
      setSelectedScanId(latestScan.scanId);
    }
  }, [wellArchitectedScans, selectedScanId]);

  // Load assessment data when selected scan changes
  useEffect(() => {
    if (selectedScanId) {
      loadAssessmentData(selectedScanId);
    }
  }, [selectedScanId]);

  // Report runs live in reportHistory; refresh once so the selector is not
  // limited to the profile snapshot loaded during sign-in.
  useEffect(() => {
    dispatch(refreshAccountScans()).catch((error) => {
      console.warn('[WellArchitectedDetail] Failed to refresh report history:', error);
    });
  }, [dispatch]);

  // Load assessment data function (called manually, not in useEffect)
  const loadAssessmentData = async (scanId) => {
    if (!scanId) return;

    setAssessmentLoading(true);
    try {
      // Find the scan to get the accountId
      const scan = accountScans.find((s) => s.scanId === scanId);

      // Fetch fresh presigned URL and assessment results via GraphQL
      const assessmentResults = await fetchAssessmentResults({
        scanId: scanId,
        accountId: scan?.accountId,
        userId: scan?.userId,
        cloudProvider: scan?.cloudProvider || 'aws',
        useReportHistory: scan?.source === 'reportHistory' || !!scan?.reportId,
      });

      // Parse the assessment results to populate choice contexts
      // Use all lens questions to match across all possible questions
      const allQuestions = ALL_LENS_QUESTIONS;
      const parsedAnswers = parseWellArchitectedAnswers(
        allQuestions,
        assessmentResults,
        {}
      );

      // Build choice contexts from parsed answers
      const newChoiceContexts = {};
      let contextCount = 0;
      parsedAnswers.forEach((question) => {
        question.Choices?.forEach((choice) => {
          if (
            choice.Context &&
            (choice.Context.passed?.length > 0 ||
              choice.Context.failed?.length > 0 ||
              choice.Context.notapplicable?.length > 0 ||
              choice.Context.accountContext?.length > 0)
          ) {
            const key = `${question.QuestionId}.${choice.ChoiceId}`;
            newChoiceContexts[key] = choice.Context;
            contextCount++;
          }
        });
      });

      setChoiceContexts(newChoiceContexts);
      toast.success(
        `Assessment data loaded - ${contextCount} suggestions found`
      );
    } catch (error) {
      console.error('Error loading assessment data:', error);
      toast.error('Failed to load assessment data');
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Get questions for selected pillar (from current lens)
  const questions = useMemo(() => {
    return currentLensQuestions[selectedPillar] || [];
  }, [currentLensQuestions, selectedPillar]);

  const selectedQuestion = questions[selectedQuestionIndex];

  // Get pillar options for current lens
  const pillarOptions = useMemo(() => {
    return (
      lensOptions[selectedLens]?.pillars || lensOptions.wellarchitected.pillars
    );
  }, [selectedLens]);

  // Calculate total questions and answered count (for current lens)
  const questionCounts = useMemo(() => {
    let total = 0;
    let answered = 0;
    Object.keys(currentLensQuestions).forEach((pillar) => {
      currentLensQuestions[pillar].forEach((q) => {
        total++;
        if (answers[q.QuestionId]?.length > 0) answered++;
      });
    });
    return { total, answered, unanswered: total - answered };
  }, [answers, currentLensQuestions]);

  // Handle choice selection
  const handleSelectChoice = (questionId, choiceId, choiceTitle) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      const isNoneOfThese = choiceTitle === 'None of these';

      if (isNoneOfThese) {
        return {
          ...prev,
          [questionId]: current.includes(choiceId) ? [] : [choiceId],
        };
      } else {
        const filtered = current.filter((id) => !id.includes('_none'));
        if (filtered.includes(choiceId)) {
          return {
            ...prev,
            [questionId]: filtered.filter((id) => id !== choiceId),
          };
        } else {
          return { ...prev, [questionId]: [...filtered, choiceId] };
        }
      }
    });
  };

  // Handle applicable toggle for choice
  const handleApplicableChoice = (questionId, choiceId) => {
    const key = `${questionId}.${choiceId}`;
    setNotApplicableChoices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Handle question applicable toggle
  const handleUpdateIsApplicable = (questionId, checked) => {
    setQuestionIsApplicable((prev) => ({
      ...prev,
      [questionId]: checked,
    }));
  };

  // Handle Express Review answers change - sync with Default View
  const handleExpressAnswersChange = useCallback((expressAnswers) => {
    if (!expressAnswers || Object.keys(expressAnswers).length === 0) return;

    setAnswers((prevAnswers) => {
      const newAnswers = { ...prevAnswers };

      // Process each express review question's analysis
      for (const questionId of Object.keys(expressAnswers)) {
        const { analysis } = expressAnswers[questionId] || {};

        if (!analysis || analysis.length === 0) continue;

        // For each analysis item, update the corresponding WA question's answers
        for (const item of analysis) {
          const { id: choiceId, waQuestionId, result, override } = item;

          if (!waQuestionId) continue;

          // Initialize the answer array for this WA question if needed
          if (!newAnswers[waQuestionId]) {
            newAnswers[waQuestionId] = [];
          }

          if (result === 'True' && override) {
            // Add the choice to selected answers if not already there
            if (!newAnswers[waQuestionId].includes(choiceId)) {
              newAnswers[waQuestionId] = [...newAnswers[waQuestionId], choiceId];
            }
            // Remove "None of these" choice if present
            newAnswers[waQuestionId] = newAnswers[waQuestionId].filter(
              (id) => !id.toLowerCase().includes('none')
            );
          } else if (result === 'False' || result === 'Not Applicable') {
            // Remove the choice from selected answers
            newAnswers[waQuestionId] = newAnswers[waQuestionId].filter(
              (id) => id !== choiceId
            );
          }
        }
      }

      console.log('[WellArchitectedDetail] Express answers synced to Default View:', newAnswers);
      return newAnswers;
    });
  }, []);

  // Open apply suggestions modal
  const handleOpenApplySuggestionsModal = () => {
    setApplyMode('question');
    setCopyNotesFromSuggestions(true);
    setApplySuggestionsModalOpen(true);
  };

  // Handle apply suggested answers
  const handleApplySuggestedAnswers = () => {
    // Helper to get passed choices for a question based on choiceContexts
    // Logic matches asecurecloud: select if (passed OR accountContextPassed) AND no failed
    const getPassedChoices = (question) => {
      const passedChoices = [];
      question.Choices.forEach((choice) => {
        if (choice.Title === 'None of these') return;

        // Key format matches how contexts are stored: ${questionId}.${choiceId}
        const contextKey = `${question.QuestionId}.${choice.ChoiceId}`;
        const context = choiceContexts[contextKey];

        // Only select if there's actual context with passed data
        if (context) {
          // Check AWS rules passed/failed
          const hasAwsPassed = context.passed?.length > 0;
          const hasAwsFailed = context.failed?.length > 0;

          // Check Express Review accountContext passed/failed
          const accountContextPassed = context.accountContext?.filter(ac => ac.result === 'True') || [];
          const accountContextFailed = context.accountContext?.filter(ac => ac.result === 'False') || [];

          const hasAccountContextPassed = accountContextPassed.length > 0;
          const hasAccountContextFailed = accountContextFailed.length > 0;

          // Select if (AWS passed OR accountContext passed) AND no AWS failed AND no accountContext failed
          if (
            (hasAwsPassed || hasAccountContextPassed) &&
            !hasAwsFailed &&
            !hasAccountContextFailed
          ) {
            passedChoices.push(choice.ChoiceId);
          }
        }
      });
      return passedChoices;
    };

    // Helper to build notes from assessment data for a question
    const buildNotesForQuestion = (question) => {
      let notes = '';
      question.Choices?.forEach((choice) => {
        if (choice.Title === 'None of these') return;

        const contextKey = `${question.QuestionId}.${choice.ChoiceId}`;
        const context = choiceContexts[contextKey];

        if (context) {
          const hasPassed = context.passed?.length > 0;
          const hasFailed = context.failed?.length > 0;
          const hasAccountContext = context.accountContext?.length > 0;

          if (hasPassed || hasFailed || hasAccountContext) {
            notes += `# ${choice.Title}\n`;

            // Add failed checks
            if (context.failed?.length > 0) {
              context.failed.forEach((check) => {
                notes += `- (assessment) Failed: ${check.title} (${check.count || 1})\n`;
              });
            }

            // Add passed checks
            if (context.passed?.length > 0) {
              context.passed.forEach((check) => {
                notes += `- (assessment) Passed: ${check.title} (${check.count || 1})\n`;
              });
            }

            // Add account context (custom notes)
            if (context.accountContext?.length > 0) {
              context.accountContext.forEach((note) => {
                notes += `- ${note.customAnswerText || note}\n`;
              });
            }

            notes += '\n';
          }
        }
      });
      return notes.trim();
    };

    // Helper to get "None of these" choice ID for a question
    const getNoneOfTheseChoiceId = (question) => {
      const noneChoice = question.Choices?.find(
        (c) => c.Title === 'None of these' || c.Title?.toLowerCase().includes('none of these')
      );
      return noneChoice?.ChoiceId || null;
    };

    if (applyMode === 'question') {
      // Apply to current question only
      if (selectedQuestion) {
        const suggestedChoices = getPassedChoices(selectedQuestion);
        const noneChoiceId = getNoneOfTheseChoiceId(selectedQuestion);

        // If no suggestions, select "None of these"
        const choicesToApply = suggestedChoices.length > 0 ? suggestedChoices : (noneChoiceId ? [noneChoiceId] : []);

        if (choicesToApply.length > 0) {
          setAnswers((prev) => ({
            ...prev,
            [selectedQuestion.QuestionId]: choicesToApply,
          }));

          // Build and store notes if copyNotesFromSuggestions is enabled
          if (copyNotesFromSuggestions) {
            const notes = buildNotesForQuestion(selectedQuestion);
            if (notes) {
              setAssessmentNotes((prev) => ({
                ...prev,
                [selectedQuestion.QuestionId]: notes,
              }));
            }
          }

          if (suggestedChoices.length > 0) {
            toast.success(`Applied ${suggestedChoices.length} suggested answer(s) to current question`);
          } else {
            toast.success('No suggestions found - selected "None of these"');
          }
        }
      }
    } else {
      // Apply to all questions across all pillars (for current lens)
      const newAnswers = { ...answers }; // Keep existing answers
      const newNotes = { ...assessmentNotes }; // Keep existing notes
      let totalApplied = 0;
      let totalNoneApplied = 0;

      Object.keys(currentLensQuestions).forEach((pillarId) => {
        currentLensQuestions[pillarId].forEach((question) => {
          const suggestedChoices = getPassedChoices(question);
          const noneChoiceId = getNoneOfTheseChoiceId(question);

          // If no suggestions, select "None of these"
          const choicesToApply = suggestedChoices.length > 0 ? suggestedChoices : (noneChoiceId ? [noneChoiceId] : []);

          if (choicesToApply.length > 0) {
            newAnswers[question.QuestionId] = choicesToApply;
            if (suggestedChoices.length > 0) {
              totalApplied++;
            } else {
              totalNoneApplied++;
            }

            // Build and store notes if copyNotesFromSuggestions is enabled
            if (copyNotesFromSuggestions) {
              const notes = buildNotesForQuestion(question);
              if (notes) {
                newNotes[question.QuestionId] = notes;
              }
            }
          }
        });
      });

      setAnswers(newAnswers);
      if (copyNotesFromSuggestions) {
        setAssessmentNotes(newNotes);
      }

      if (totalApplied > 0 || totalNoneApplied > 0) {
        const messages = [];
        if (totalApplied > 0) messages.push(`${totalApplied} with suggestions`);
        if (totalNoneApplied > 0) messages.push(`${totalNoneApplied} with "None of these"`);
        toast.success(`Applied answers to ${totalApplied + totalNoneApplied} question(s): ${messages.join(', ')}`);
      } else {
        toast('No questions to apply answers to', { icon: 'ℹ️' });
      }
    }
    setApplySuggestionsModalOpen(false);
  };

  // Handle lens change
  const handleChangeSelectedLens = (lens) => {
    setSelectedLens(lens);
    const pillars = Object.keys(lensOptions[lens]?.pillars || {});
    setSelectedPillar(pillars.includes('security') ? 'security' : pillars[0]);
    setSelectedQuestionIndex(0);
  };

  // Handle pillar change
  const handleSelectPillar = (pillar) => {
    setSelectedPillar(pillar);
    setSelectedQuestionIndex(0);
  };

  // Get risk for a choice
  const getRisk = (title) => {
    return choiceRiskMapping[title.trim()]?.risk || '';
  };

  // Get context for a choice (suggestion details)
  const getChoiceContext = (questionId, choiceId) => {
    const key = `${questionId}.${choiceId}`;
    const context = choiceContexts[key] || {
      passed: [],
      failed: [],
      notapplicable: [],
      accountContext: [],
    };

    // Derive account context passed/failed
    const accountContextPassed = (context.accountContext || []).filter(
      (c) => c.result === 'True'
    );
    const accountContextFailed = (context.accountContext || []).filter(
      (c) => c.result === 'False'
    );
    const accountContextNotApplicable = (context.accountContext || []).filter(
      (c) => c.result === 'Not Applicable'
    );

    return {
      ...context,
      accountContextPassed,
      accountContextFailed,
      accountContextNotApplicable,
    };
  };

  // Check if a choice has any suggestions
  const hasAnySuggestions = (context) => {
    return (
      context.passed?.length > 0 ||
      context.failed?.length > 0 ||
      context.notapplicable?.length > 0 ||
      context.accountContext?.length > 0
    );
  };

  // Get suggestion status for a choice (passed, failed, or mixed)
  const getSuggestionStatus = (context) => {
    const hasPassed =
      context.passed?.length > 0 || context.accountContextPassed?.length > 0;
    const hasFailed =
      context.failed?.length > 0 || context.accountContextFailed?.length > 0;

    if (hasPassed && !hasFailed) return 'passed';
    if (hasFailed && !hasPassed) return 'failed';
    if (hasPassed && hasFailed) return 'mixed';
    return null;
  };

  // Toggle suggestion dropdown
  const toggleSuggestionDropdown = (questionId, choiceId) => {
    const key = `${questionId}.${choiceId}`;
    setExpandedSuggestions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getResourceName = (resource) =>
    resource?.displayName ||
    resource?.resourceName ||
    resource?.resourceId ||
    resource?.resourceArn ||
    resource?.arn ||
    resource?.id ||
    'Resource';

  const getResourceDescription = (resource) =>
    resource?.description ||
    resource?.details ||
    resource?.message ||
    resource?.reason ||
    resource?.statusReason ||
    '';

  const renderSuggestionItem = ({ item, itemKey, status, icon, sourceIcon = null }) => {
    const resources = Array.isArray(item?.resources) ? item.resources : [];

    return (
      <div key={itemKey} className="border-b border-gray-100">
        <button
          type="button"
          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50"
          onClick={() =>
            setActiveSuggestionResourceDetails({
              item,
              status,
              resources,
            })
          }
        >
          <span className="flex items-center gap-1 mt-0.5 flex-shrink-0">
            {icon}
            {sourceIcon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-gray-700">{item.title || item.customAnswerText}</span>
            {resources.length > 0 && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                <ChevronRight className="h-3 w-3" />
                View {resources.length} resource{resources.length === 1 ? '' : 's'}
              </span>
            )}
            {resources.length === 0 && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400">
                No resource details
              </span>
            )}
          </span>
        </button>
      </div>
    );
  };

  // PDF Export handlers
  const handlePdfOptionChange = (name) => {
    setPdfOptions((prev) => {
      const newState = { ...prev, [name]: !prev[name] };

      // Handle mutual exclusion for question filter options
      if (name === 'allQuestions' && newState.allQuestions) {
        newState.suggestions = false;
        newState.answered = false;
        newState.failed = false;
      } else if (name === 'suggestions' && newState.suggestions) {
        newState.allQuestions = false;
        newState.answered = false;
        newState.failed = false;
      } else if (name === 'answered' && newState.answered) {
        newState.allQuestions = false;
        newState.suggestions = false;
        newState.failed = false;
      } else if (name === 'failed' && newState.failed) {
        newState.allQuestions = false;
        newState.suggestions = false;
        newState.answered = false;
      }

      return newState;
    });
  };

  const handleLogoFileChange = async (e) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setPdfOptions((prev) => ({
        ...prev,
        customLogo: reader.result,
        selectedFile: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPdfOptions((prev) => ({
      ...prev,
      customLogo: '',
      selectedFile: null,
      logoWidth: '',
      logoHeight: '',
    }));
  };

  const filterQuestionsWithSuggestions = (pillarGroup) => {
    return {
      ...pillarGroup,
      Questions: pillarGroup.Questions.filter((q) => {
        return q.Choices?.some((c) => {
          const context = c.Context || {};
          return (
            context.passed?.length > 0 ||
            context.failed?.length > 0 ||
            context.accountContext?.length > 0
          );
        });
      }),
    };
  };

  const filterQuestionsWithFailedSuggestions = (pillarGroup) => {
    return {
      ...pillarGroup,
      Questions: pillarGroup.Questions.filter((q) => {
        return q.Choices?.some((c) => {
          const context = c.Context || {};
          return context.failed?.length > 0;
        });
      }),
    };
  };

  const filterAnsweredQuestions = (pillarGroup) => {
    return {
      ...pillarGroup,
      Questions: pillarGroup.Questions.filter((q) => {
        return answers[q.QuestionId]?.length > 0;
      }),
    };
  };

  const handleExportPdf = async () => {
    setPdfExportLoading(true);

    try {
      // Build allLenses data structure from questions (using current lens)
      const lensAliasArray = [selectedLens];
      const arrayOfArrays = lensAliasArray.map((lensAlias) => {
        const allQuestions = Object.entries(currentLensQuestions).flatMap(
          ([pillarId, pillarQuestions]) =>
            pillarQuestions.map((q) => ({
              ...q,
              LensAlias: lensAlias,
              PillarId: pillarId,
              SelectedChoices: answers[q.QuestionId] || [],
              // Add Context data to each choice
              Choices: q.Choices.map((choice) => ({
                ...choice,
                Context: getChoiceContext(q.QuestionId, choice.ChoiceId),
              })),
            }))
        );

        const uniquePillarIds = [
          ...new Set(allQuestions.map((item) => item.PillarId)),
        ];

        return uniquePillarIds.map((pillarId) => ({
          LensAlias: lensAlias,
          PillarId: pillarId,
          Questions: allQuestions.filter((item) => item.PillarId === pillarId),
        }));
      });

      // Filter based on options
      const filteredArrayOfArrays = arrayOfArrays.map((lensGroup) =>
        lensGroup
          .map((pillarGroup) => {
            if (pdfOptions.suggestions) {
              return filterQuestionsWithSuggestions(pillarGroup);
            }
            if (pdfOptions.failed) {
              return filterQuestionsWithFailedSuggestions(pillarGroup);
            }
            if (pdfOptions.answered) {
              return filterAnsweredQuestions(pillarGroup);
            }
            return pillarGroup;
          })
          .filter((pillarGroup) => pillarGroup.Questions.length > 0)
      );

      const doc = (
        <PDFReport
          allLenses={filteredArrayOfArrays}
          milestones={workload.milestones || []}
          options={pdfOptions}
          logo={pdfOptions.customLogo}
          logoHeight={pdfOptions.logoHeight}
          logoWidth={pdfOptions.logoWidth}
          accountId={workload.accountId}
          workloadName={workload.workloadName}
        />
      );

      const asPdf = pdf([]);
      asPdf.updateContainer(doc);
      const blob = await asPdf.toBlob();

      saveAs(
        blob,
        `${workload.accountId || 'workload'}-${workload.workloadName}.pdf`
      );
      toast.success('PDF exported successfully');
      setPdfExportModalOpen(false);
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setPdfExportLoading(false);
    }
  };

  if (loadingAwsWorkload && !workload) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Loading workload...
          </h3>
          <p className="text-gray-500">
            Fetching workload details from AWS
          </p>
        </div>
      </div>
    );
  }

  if (!workload) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Workload not found
          </h3>
          <p className="text-gray-500 mb-4">
            The workload you're looking for doesn't exist or you need to select an AWS account first.
          </p>
          <Button onClick={() => navigate('/dashboard/well-architected')}>
            Back to Well-Architected
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb with Title, Edit & Assessment Selector */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span
              className="text-sm text-gray-500 cursor-pointer hover:text-primary-600"
              onClick={() => navigate('/dashboard/well-architected')}
            >
              AWS Well-Architected
            </span>
            <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
            {accountDisplayName && (
              <>
                <span className="text-sm text-gray-500">
                  {accountDisplayName}
                </span>
                <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
              </>
            )}
            <span className="text-sm text-gray-900 font-semibold">
              {workload.workloadName}
            </span>
            <button
              className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              onClick={() => setEditWorkloadModalOpen(true)}
              title="Edit workload"
            >
              <Edit className="h-4 w-4" />
            </button>
          </div>
          {/* Assessment Selector */}
          {wellArchitectedScans.length > 0 ? (
            <Select
              value={selectedScanId}
              onValueChange={(value) => setSelectedScanId(value)}
              disabled={assessmentLoading}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs bg-white border-gray-200">
                {assessmentLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Select assessment" />
                )}
              </SelectTrigger>
              <SelectContent>
                {wellArchitectedScans.map((scan) => (
                  <SelectItem key={scan.scanId} value={scan.scanId}>
                    {scan.accountId} -{' '}
                    {scan.latestAssessmentDate
                      ? new Date(scan.latestAssessmentDate).toLocaleDateString()
                      : 'No date'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                    title="Why run a report?"
                  >
                    <AlertCircle className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 text-sm bg-white" side="bottom" align="end">
                  <p className="text-gray-700 font-medium mb-1">No assessment data available</p>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Run a Well-Architected compliance report to get automated suggestions based on your environment's actual configuration. Without this, you'll need to answer questions manually.
                  </p>
                </PopoverContent>
              </Popover>
              <Link
                to={
                  isLocalRuntime()
                    ? '/dashboard/library/report/report_compliance_aws_well_architected'
                    : '/library/report/report_compliance_aws_well_architected'
                }
                className="px-3 py-1.5 text-xs font-medium border border-amber-300 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100"
              >
                Run Compliance Report
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Header - View Toggle & Actions */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* View Mode Toggle - More prominent */}
            {selectedLens === 'wellarchitected' && (
              <Popover>
                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setSelectedView('defaultView')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      selectedView === 'defaultView'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Default View
                  </button>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => setSelectedView('express')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                        selectedView === 'express'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Sparkles className="h-4 w-4" />
                      Express Review
                    </button>
                  </PopoverTrigger>
                </div>
                <PopoverContent className="w-72 p-3 text-sm bg-white" side="bottom" align="start">
                  <p className="text-gray-700 font-medium mb-1">Express Review</p>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Answer simplified, non-technical questions that automatically map to the full Well-Architected questionnaire. Great for quick assessments.
                  </p>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2"
              onClick={() => setPdfExportModalOpen(true)}
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-2"
              onClick={() => setUploadToAwsModalOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Upload to AWS
            </button>
          </div>
        </div>
      </div>

      {/* Lens & Pillar Navigation */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Lens Selector - Compact dropdown */}
            {(() => {
              const availableLenses = Object.keys(lensOptions).filter((lens) =>
                (deploymentPreferences.lenses || ['wellarchitected']).includes(lens)
              );
              
              // Only show selector if multiple lenses available
              if (availableLenses.length > 1) {
                return (
                  <Select value={selectedLens} onValueChange={handleChangeSelectedLens}>
                    <SelectTrigger className="w-auto min-w-[180px] h-9 text-sm bg-white border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLenses.map((lens) => (
                        <SelectItem key={lens} value={lens}>
                          {lensOptions[lens].title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }
              return null;
            })()}

            {/* Pillar Tabs - Only show in Default View */}
            {selectedView === 'defaultView' && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(pillarOptions).map(([key, label]) => (
                  <button
                    key={key}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedPillar === key
                        ? 'bg-primary-100 text-primary-700 border border-primary-600'
                        : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                    }`}
                    onClick={() => handleSelectPillar(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Not Answered Badge - Only show in Default View */}
          {selectedView === 'defaultView' && (
            <span className="px-3 py-1.5 text-sm border border-gray-200 rounded-full text-gray-600 bg-gray-50">
              {questionCounts.unanswered}/{questionCounts.total} Not Answered
            </span>
          )}
        </div>
      </div>

      {/* Express Review */}
      {selectedView === 'express' && (
        <div className="p-6">
          <ExpressReview
            answers={answers}
            setAnswers={setAnswers}
            assessmentNotes={assessmentNotes}
            setAssessmentNotes={setAssessmentNotes}
            answerValues={expressAnswerValues}
            setAnswerValues={setExpressAnswerValues}
            choiceContexts={choiceContexts}
            setChoiceContexts={setChoiceContexts}
          />
        </div>
      )}

      {/* Questions Container - Default View */}
      {selectedView === 'defaultView' && (
        <div className="flex p-6 gap-6">
          {/* Sidebar - Questions List */}
          <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] w-[400px] min-w-[400px] self-start flex-col rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 shrink-0">
              <h3 className="text-xl font-medium text-gray-900">
                Pillar Questions
              </h3>
              <p className="text-sm text-gray-500">
                {questions.length} questions available
              </p>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {questions.map((question, index) => {
                const isSelected = selectedQuestionIndex === index;
                const isAnswered =
                  (answers[question.QuestionId] || []).length > 0;
                const isApplicable =
                  questionIsApplicable[question.QuestionId] !== false;

                return (
                  <div
                    key={question.QuestionId}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary-400 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedQuestionIndex(index)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 flex items-center">
                        {isAnswered ? (
                          <CheckCircle2 className="h-4 w-4 text-primary-600 mr-2" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-300 mr-2" />
                        )}
                        Question {index + 1}
                      </span>
                      <Switch
                        checked={isApplicable}
                        onCheckedChange={(checked) =>
                          handleUpdateIsApplicable(question.QuestionId, checked)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-primary-600"
                      />
                    </div>
                    <div className="text-sm font-medium text-gray-900 leading-snug">
                      {question.QuestionTitle}
                    </div>
                    {(() => {
                      // Count choices that have actual suggestion data (Context with passed/failed/notapplicable/accountContext)
                      const suggestionCount = question.Choices.filter(
                        (choice) => {
                          const context = getChoiceContext(
                            question.QuestionId,
                            choice.ChoiceId
                          );
                          return (
                            context.passed?.length > 0 ||
                            context.failed?.length > 0 ||
                            context.notapplicable?.length > 0 ||
                            context.accountContext?.length > 0
                          );
                        }
                      ).length;

                      return suggestionCount > 0 ? (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 rounded-full text-xs font-medium text-primary-700">
                          {suggestionCount} Suggestions Available
                          <Check className="h-3 w-3" />
                        </div>
                      ) : null;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Section */}
          <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-200">
            {selectedQuestion ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-500">
                    Question {selectedQuestionIndex + 1}
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center gap-1"
                      onClick={() => {
                        // Load notes from assessmentNotes or question.Notes
                        const currentNotes = assessmentNotes[selectedQuestion?.QuestionId] || selectedQuestion?.Notes || '';
                        setQuestionNotes(currentNotes);
                        setNotesModalOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Notes
                    </button>
                    <button
                      className="px-4 py-2 text-sm font-medium bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 flex items-center gap-2"
                      onClick={handleOpenApplySuggestionsModal}
                    >
                      <Sparkles className="h-4 w-4" />
                      Apply Suggested Answers
                    </button>
                  </div>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">
                        Details
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 w-24">
                        Applicable
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 w-32">
                        Level of Risk
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 w-28">
                        Suggestion
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 w-20">
                        Answer
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuestion.Choices.map((choice) => {
                      const isNotApplicable =
                        notApplicableChoices[
                          `${selectedQuestion.QuestionId}.${choice.ChoiceId}`
                        ];
                      const isSelected = (
                        answers[selectedQuestion.QuestionId] || []
                      ).includes(choice.ChoiceId);
                      const risk = getRisk(choice.Title);
                      const isNoneOfThese = choice.Title === 'None of these';
                      const context = getChoiceContext(
                        selectedQuestion.QuestionId,
                        choice.ChoiceId
                      );
                      const hasSuggestions = hasAnySuggestions(context);
                      const suggestionStatus = getSuggestionStatus(context);
                      const dropdownKey = `${selectedQuestion.QuestionId}.${choice.ChoiceId}`;
                      const isExpanded = expandedSuggestions[dropdownKey];

                      return (
                        <tr
                          key={choice.ChoiceId}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="text-sm text-gray-900">
                              {choice.Title}
                            </div>
                            {/* Suggestion details dropdown - below the title */}
                            {hasSuggestions && (
                              <div className="mt-2">
                                <button
                                  onClick={() =>
                                    toggleSuggestionDropdown(
                                      selectedQuestion.QuestionId,
                                      choice.ChoiceId
                                    )
                                  }
                                  className="inline-flex items-center justify-between w-full max-w-xl px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-600 font-medium">
                                      Suggestions details
                                    </span>
                                    {context.notapplicable?.length > 0 && (
                                      <span className="flex items-center gap-1 text-gray-500 border-r border-gray-200 pr-2">
                                        <MinusCircle className="h-3.5 w-3.5" />
                                        {context.notapplicable.length}
                                      </span>
                                    )}
                                    {context.failed?.length > 0 && (
                                      <span className="flex items-center gap-1 text-red-600 border-r border-gray-200 pr-2">
                                        <XCircle className="h-3.5 w-3.5" />
                                        {context.failed.length}
                                      </span>
                                    )}
                                    {context.passed?.length > 0 && (
                                      <span className="flex items-center gap-1 text-green-600 border-r border-gray-200 pr-2">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {context.passed.length}
                                      </span>
                                    )}
                                    {context.accountContext?.length > 0 && (
                                      <span className="flex items-center gap-1 text-primary-600">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {context.accountContext.length}
                                      </span>
                                    )}
                                  </div>
                                  <ChevronDown
                                    className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  />
                                </button>
                                {isExpanded && (
                                  <div className="mt-1 w-full max-w-xl border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                    <div className="max-h-60 overflow-y-auto">
                                      {context.failed?.map((item, idx) =>
                                        renderSuggestionItem({
                                          item,
                                          itemKey: `${dropdownKey}.failed.${item.id || idx}`,
                                          status: 'failed',
                                          icon: (
                                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                          ),
                                        })
                                      )}
                                      {context.passed?.map((item, idx) =>
                                        renderSuggestionItem({
                                          item,
                                          itemKey: `${dropdownKey}.passed.${item.id || idx}`,
                                          status: 'passed',
                                          icon: (
                                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                          ),
                                        })
                                      )}
                                      {context.notapplicable?.map(
                                        (item, idx) =>
                                          renderSuggestionItem({
                                            item,
                                            itemKey: `${dropdownKey}.na.${item.id || idx}`,
                                            status: 'not applicable',
                                            icon: (
                                              <MinusCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            ),
                                          })
                                      )}
                                      {context.accountContextPassed?.map(
                                        (item, idx) => (
                                          <div
                                            key={`acc-passed-${idx}`}
                                            className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                          >
                                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <Sparkles className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                            <span className="text-sm text-gray-700">
                                              {item.customAnswerText}
                                            </span>
                                          </div>
                                        )
                                      )}
                                      {context.accountContextFailed?.map(
                                        (item, idx) => (
                                          <div
                                            key={`acc-failed-${idx}`}
                                            className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                          >
                                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                            <Sparkles className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                            <span className="text-sm text-gray-700">
                                              {item.customAnswerText}
                                            </span>
                                          </div>
                                        )
                                      )}
                                      {context.accountContextNotApplicable?.map(
                                        (item, idx) => (
                                          <div
                                            key={`acc-na-${idx}`}
                                            className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                          >
                                            <MinusCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <Sparkles className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                            <span className="text-sm text-gray-700">
                                              {item.customAnswerText}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {!isNoneOfThese && (
                              <Switch
                                checked={!isNotApplicable}
                                onCheckedChange={() =>
                                  handleApplicableChoice(
                                    selectedQuestion.QuestionId,
                                    choice.ChoiceId
                                  )
                                }
                                className="data-[state=checked]:bg-primary-600"
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {risk && (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  risk === 'High'
                                    ? 'bg-red-50 text-red-700'
                                    : risk === 'Medium'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-yellow-50 text-yellow-700'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    risk === 'High'
                                      ? 'bg-red-500'
                                      : risk === 'Medium'
                                        ? 'bg-amber-500'
                                        : 'bg-yellow-500'
                                  }`}
                                ></span>
                                {risk}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {/* Simplified suggestion status - just Passed/Failed/None */}
                            {suggestionStatus === 'passed' ? (
                              <span className="inline-flex items-center gap-1 text-sm text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Passed
                              </span>
                            ) : suggestionStatus === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-sm text-red-600">
                                <XCircle className="h-4 w-4" />
                                Failed
                              </span>
                            ) : suggestionStatus === 'mixed' ? (
                              <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                                <MinusCircle className="h-4 w-4" />
                                Mixed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                                <MinusCircle className="h-4 w-4" />
                                None
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                handleSelectChoice(
                                  selectedQuestion.QuestionId,
                                  choice.ChoiceId,
                                  choice.Title
                                )
                              }
                              disabled={isNotApplicable}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Select question to show details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggestion Resource Details Modal */}
      <Dialog
        open={!!activeSuggestionResourceDetails}
        onOpenChange={(open) => {
          if (!open) setActiveSuggestionResourceDetails(null);
        }}
      >
        <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assessment Resource Details</DialogTitle>
          </DialogHeader>
          {activeSuggestionResourceDetails && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {activeSuggestionResourceDetails.item?.title ||
                      'Assessment suggestion'}
                  </div>
                  {activeSuggestionResourceDetails.item?.description && (
                    <p className="mt-2 text-sm text-gray-600">
                      {activeSuggestionResourceDetails.item.description}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Resources
                  </h3>
                  <span className="text-xs text-gray-500">
                    {activeSuggestionResourceDetails.resources.length}{' '}
                    resource
                    {activeSuggestionResourceDetails.resources.length === 1
                      ? ''
                      : 's'}
                  </span>
                </div>

                {activeSuggestionResourceDetails.resources.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                    No resource details were returned for this suggestion.
                  </div>
                ) : (
                  <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-[110px]">Result</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead className="w-[140px]">Type</TableHead>
                          <TableHead className="w-[120px]">Region</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeSuggestionResourceDetails.resources.map(
                          (resource, resourceIndex) => {
                            const resourceName = getResourceName(resource);
                            const description = getResourceDescription(resource);
                            const status = activeSuggestionResourceDetails.status;

                            return (
                              <TableRow key={`suggestion-resource-${resourceIndex}`}>
                                <TableCell className="align-top">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      status === 'failed'
                                        ? 'bg-red-100 text-red-700'
                                        : status === 'passed'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {status === 'failed'
                                      ? 'Fail'
                                      : status === 'passed'
                                        ? 'Pass'
                                        : status}
                                  </span>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div
                                    className="max-w-[260px] truncate text-sm font-medium text-gray-900"
                                    title={resourceName}
                                  >
                                    {resourceName}
                                  </div>
                                  {resource.resourceArn &&
                                    resource.resourceArn !== resourceName && (
                                      <div
                                        className="mt-1 max-w-[360px] break-all text-xs text-gray-500"
                                        title={resource.resourceArn}
                                      >
                                        {resource.resourceArn}
                                      </div>
                                    )}
                                  {resource.accountId && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      Account: {resource.accountId}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top text-sm text-gray-600">
                                  {resource.resourceType || '-'}
                                </TableCell>
                                <TableCell className="align-top text-sm text-gray-600">
                                  {resource.region || '-'}
                                </TableCell>
                                <TableCell className="align-top text-sm text-gray-600">
                                  {description || (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Notes Modal */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="notes">Question Notes</Label>
              <Textarea
                id="notes"
                value={questionNotes}
                onChange={(e) => setQuestionNotes(e.target.value)}
                placeholder="Enter notes..."
                rows={10}
                className="mt-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotesModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Save notes to assessmentNotes state
                if (selectedQuestion?.QuestionId) {
                  setAssessmentNotes((prev) => ({
                    ...prev,
                    [selectedQuestion.QuestionId]: questionNotes,
                  }));
                }
                toast.success('Notes saved');
                setNotesModalOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Suggestions Modal */}
      <Dialog
        open={applySuggestionsModalOpen}
        onOpenChange={setApplySuggestionsModalOpen}
      >
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Apply Suggestions
            </DialogTitle>
          </DialogHeader>
          <RadioGroup
            value={applyMode}
            onValueChange={setApplyMode}
            className="space-y-6 py-4"
          >
            {/* Apply to this question only */}
            <div className="flex items-start gap-3">
              <RadioGroupItem value="question" id="question" className="mt-1" />
              <Label htmlFor="question" className="cursor-pointer font-normal">
                <div className="font-medium text-gray-900">
                  Apply suggestions to this question only
                </div>
                <div className="text-sm text-gray-500 font-normal">
                  This option applies only to a specific question that is
                  selected.
                </div>
              </Label>
            </div>

            {/* Apply all suggestions */}
            <div className="flex items-start gap-3">
              <RadioGroupItem value="all" id="all" className="mt-1" />
              <Label htmlFor="all" className="cursor-pointer font-normal">
                <div className="font-medium text-gray-900">
                  Apply all suggestions
                </div>
                <div className="text-sm text-gray-500 font-normal">
                  This will apply all suggestions across all pillars. Note that
                  this will overwrite any existing answers.
                </div>
              </Label>
            </div>
          </RadioGroup>

          {/* Copy notes from suggestions */}
          <div className="flex items-center gap-3 py-2">
            <Switch
              checked={copyNotesFromSuggestions}
              onCheckedChange={setCopyNotesFromSuggestions}
              className="data-[state=checked]:bg-primary-600"
            />
            <span className="text-gray-900">Copy notes from suggestions</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setApplySuggestionsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleApplySuggestedAnswers}>
              Apply Suggested Answers
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Workload Modal */}
      <WellArchitectedWorkloadModal
        isOpen={editWorkloadModalOpen}
        onClose={() => setEditWorkloadModalOpen(false)}
        editWorkload={workload}
        onWorkloadUpdated={(updatedWorkload) => {
          // Update local AWS workload state if it's an AWS workload
          if (awsWorkload) {
            setAwsWorkload((prev) => ({
              ...prev,
              ...updatedWorkload,
            }));
          }
        }}
      />

      {/* PDF Export Modal */}
      <Dialog open={pdfExportModalOpen} onOpenChange={setPdfExportModalOpen}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                Export PDF Report
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Customize your PDF export settings
              </p>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Export Options */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Export Options
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Choose which questions to include in your report
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.allQuestions}
                    onCheckedChange={() =>
                      handlePdfOptionChange('allQuestions')
                    }
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Export all questions
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.suggestions}
                    onCheckedChange={() => handlePdfOptionChange('suggestions')}
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Only questions with suggestions
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.failed}
                    onCheckedChange={() => handlePdfOptionChange('failed')}
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Only questions with failed suggestions
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.answered}
                    onCheckedChange={() => handlePdfOptionChange('answered')}
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Only answered questions
                  </span>
                </label>
              </div>
            </div>

            {/* Include in Export */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Include in Export
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Select additional columns and details
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.answersColumn}
                    onCheckedChange={() =>
                      handlePdfOptionChange('answersColumn')
                    }
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">Answers column</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.suggestedColumn}
                    onCheckedChange={() =>
                      handlePdfOptionChange('suggestedColumn')
                    }
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Suggestions column
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.recommendationDetails}
                    onCheckedChange={() =>
                      handlePdfOptionChange('recommendationDetails')
                    }
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Assessment details
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={pdfOptions.notes}
                    onCheckedChange={() => handlePdfOptionChange('notes')}
                    className="data-[state=checked]:bg-primary-600"
                  />
                  <span className="text-sm text-gray-700">Notes</span>
                </label>
              </div>
            </div>

            {/* Logo Customization */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Logo Customization
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Upload a custom logo for your report header
              </p>

              {!pdfOptions.customLogo && (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col items-center justify-center py-4">
                    <CloudUpload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700">
                      Upload Logo
                    </span>
                    <span className="text-xs text-gray-500">
                      PNG, JPG, GIF up to 5MB
                    </span>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png, image/gif, image/jpeg"
                    onChange={handleLogoFileChange}
                  />
                </label>
              )}

              {pdfOptions.selectedFile && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <CloudUpload className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {pdfOptions.selectedFile}
                      </p>
                      <p className="text-xs text-green-600">
                        Uploaded successfully
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveLogo}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {pdfOptions.customLogo && (
                <div className="flex gap-4 mt-3">
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600">Width (px)</Label>
                    <input
                      type="text"
                      value={pdfOptions.logoWidth}
                      onChange={(e) =>
                        setPdfOptions((prev) => ({
                          ...prev,
                          logoWidth: e.target.value,
                        }))
                      }
                      placeholder="Auto"
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600">Height (px)</Label>
                    <input
                      type="text"
                      value={pdfOptions.logoHeight}
                      onChange={(e) =>
                        setPdfOptions((prev) => ({
                          ...prev,
                          logoHeight: e.target.value,
                        }))
                      }
                      placeholder="Auto"
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setPdfExportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleExportPdf} disabled={pdfExportLoading}>
              {pdfExportLoading ? 'Exporting...' : 'Export PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload to AWS Modal */}
      {uploadToAwsModalOpen && console.log('[WellArchitectedDetail] Opening Upload Modal with:', {
        workload,
        answers,
        answersCount: Object.keys(answers).length,
        selectedLens,
      })}
      <UploadToAwsModal
        isOpen={uploadToAwsModalOpen}
        onClose={() => setUploadToAwsModalOpen(false)}
        workload={workload}
        answers={answers}
        assessmentNotes={assessmentNotes}
        questionsByPillar={currentLensQuestions}
        selectedLens={selectedLens}
        selectedAssessmentId={selectedScanId}
        initialAccountId={workloadAccountRecordId || selectedAccountId}
      />
    </div>
  );
}
