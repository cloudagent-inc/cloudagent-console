import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Loader2, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateWellArchitected } from '@/api/wellArchitected';
import { getRegionOptions } from '@/helpers/shared';
import toast from 'react-hot-toast';

const AWS_REGIONS = getRegionOptions();

const ENVIRONMENT_TYPES = [
  { value: 'PRODUCTION', label: 'PRODUCTION' },
  { value: 'PREPRODUCTION', label: 'PREPRODUCTION' },
];

const LENS_TITLES = {
  wellarchitected: 'AWS Well-Architected Framework',
  serverless: 'Serverless Lens',
  softwareasaservice: 'SaaS Lens',
  'arn:aws:wellarchitected::aws:lens/containerbuild': 'Container Build Lens',
  'arn:aws:wellarchitected::aws:lens/machinelearning': 'Machine Learning Lens',
  'arn:aws:wellarchitected::aws:lens/devops': 'DevOps Lens',
  'arn:aws:wellarchitected::aws:lens/healthcare': 'Healthcare Lens',
  'arn:aws:wellarchitected::aws:lens/genai': 'Generative AI Lens',
};

const PILLAR_NAMES = {
  // Well-Architected Framework
  operationalExcellence: 'Operational Excellence',
  security: 'Security',
  reliability: 'Reliability',
  performance: 'Performance',
  costOptimization: 'Cost Optimization',
  sustainability: 'Sustainability',
  // DevOps Lens
  Automated_Governance: 'Automated Governance',
  Development_Lifecycle: 'Development Lifecycle',
  Observability: 'Observability',
  Organizational_Adoption: 'Organizational Adoption',
  Quality_Assurance: 'Quality Assurance',
};

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
};

const normalizeRegionList = (regions) => {
  if (!Array.isArray(regions)) return [];
  return Array.from(
    new Set(
      regions
        .map((region) => String(region || '').trim())
        .filter(Boolean)
    )
  );
};

const getProfileAuthProfile = (profile) => parseJsonObject(profile?.authProfile);

const getProfileDefaultRegions = (profile) => {
  const deploymentPreferences = parseJsonObject(profile?.deploymentPreferences);
  return normalizeRegionList(deploymentPreferences.defaultRegions);
};

const getProfileAwsAccountId = (profile) =>
  String(getProfileAuthProfile(profile)?.awsAccountId || '').trim();

const resolveInitialAccountId = ({ initialAccountId, workload, awsAccounts }) => {
  const requestedAccountId = String(
    initialAccountId || workload?.environments?.[0] || ''
  ).trim();

  if (requestedAccountId) {
    const directMatch = awsAccounts.find(
      (account) => account.recordId === requestedAccountId
    );
    if (directMatch) return directMatch.recordId;

    const awsAccountMatch = awsAccounts.find(
      (account) => getProfileAwsAccountId(account) === requestedAccountId
    );
    if (awsAccountMatch) return awsAccountMatch.recordId;
  }

  return awsAccounts.length === 1 ? awsAccounts[0].recordId : '';
};

const resolveInitialRegions = ({ selectedProfile, workload }) => {
  const profileRegions = getProfileDefaultRegions(selectedProfile);
  if (profileRegions.length > 0) return profileRegions;

  const workloadRegions = normalizeRegionList(workload?.regions);
  if (workloadRegions.length > 0) return workloadRegions;

  if (workload?.awsRegion) return [workload.awsRegion];
  return ['us-east-1'];
};

export default function UploadToAwsModal({
  isOpen,
  onClose,
  workload,
  answers,
  assessmentNotes = {},
  questionsByPillar,
  selectedLens,
  selectedAssessmentId = '',
  initialAccountId = '',
}) {
  const { userProfile } = useSelector((state) => state.auth);

  // Check if this is an existing AWS workload (for update vs create)
  const isExistingAwsWorkload = workload?.isAwsWorkload === true;
  const existingWorkloadId = isExistingAwsWorkload ? workload.workloadId : null;

  // Get AWS accounts from permission profiles
  const awsAccounts = useMemo(
    () =>
      userProfile?.agentPermissionProfiles?.filter(
        (p) => p.type === 'aws account'
      ) || [],
    [userProfile?.agentPermissionProfiles]
  );

  // State - AWS Account Details
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [awsRegion, setAwsRegion] = useState(workload?.awsRegion || 'us-east-1');
  const [createMilestone, setCreateMilestone] = useState(false);
  const [milestoneName, setMilestoneName] = useState('');

  // State - Workload Details (pre-populate from existing workload)
  const [newWorkloadName, setNewWorkloadName] = useState(
    workload?.workloadName || ''
  );
  const [workloadAccountIds, setWorkloadAccountIds] = useState('');
  const [workloadDescription, setWorkloadDescription] = useState(
    workload?.description || ''
  );
  const [reviewOwner, setReviewOwner] = useState(
    workload?.reviewOwner || userProfile?.email || ''
  );
  const [environmentType, setEnvironmentType] = useState(
    workload?.environment || 'PRODUCTION'
  );
  const [workloadRegions, setWorkloadRegions] = useState(
    workload?.regions || ['us-east-1']
  );
  const [workloadTags, setWorkloadTags] = useState(
    workload?.tags ? Object.entries(workload.tags).map(([k, v]) => `${k}:${v}`).join(', ') : ''
  );

  // State - Upload
  const [uploading, setUploading] = useState(false);
  const [expandedPillars, setExpandedPillars] = useState({});
  const [selectedQuestions, setSelectedQuestions] = useState({});

  // Sync selectedQuestions with answers whenever modal opens or answers change
  // A question is selected if it has answers, is N/A, or has choice summaries
  useEffect(() => {
    if (!isOpen) return;

    const newSelection = {};
    Object.values(questionsByPillar || {}).flat().forEach((question) => {
      const hasAnswers = (answers?.[question.QuestionId]?.length > 0) ||
                        (question.SelectedChoices?.length > 0);
      const isNotApplicable = question.IsApplicable === false;
      const hasChoiceSummaries = question.ChoiceAnswerSummaries?.length > 0;

      newSelection[question.QuestionId] = hasAnswers || isNotApplicable || hasChoiceSummaries;
    });
    setSelectedQuestions(newSelection);
  }, [isOpen, answers, questionsByPillar]);

  useEffect(() => {
    if (!isOpen) return;

    const nextAccountId = resolveInitialAccountId({
      initialAccountId,
      workload,
      awsAccounts,
    });
    const nextProfile = awsAccounts.find((account) => account.recordId === nextAccountId);
    const nextRegions = resolveInitialRegions({
      selectedProfile: nextProfile,
      workload,
    });
    const nextRegion = nextRegions[0] || 'us-east-1';

    setSelectedAccountId(nextAccountId);
    setAwsRegion(nextRegion);
    setWorkloadRegions(nextRegions.length > 0 ? nextRegions : [nextRegion]);
  }, [isOpen, initialAccountId, workload, awsAccounts]);

  // Get selected account's auth profile
  const selectedProfile = useMemo(() => {
    return awsAccounts.find((a) => a.recordId === selectedAccountId);
  }, [awsAccounts, selectedAccountId]);

  const authProfile = useMemo(() => {
    if (!selectedProfile) return null;
    return getProfileAuthProfile(selectedProfile);
  }, [selectedProfile]);

  // Get AWS account ID from auth profile
  const awsAccountId = authProfile?.awsAccountId || '';

  // Update workloadAccountIds when account is selected
  React.useEffect(() => {
    if (awsAccountId) {
      setWorkloadAccountIds(awsAccountId);
    }
  }, [awsAccountId]);

  // Get questions organized by pillar with answer status
  const pillarsWithQuestions = useMemo(() => {
    const result = {};

    // Get pillar IDs from the actual questionsByPillar data
    // This handles all lens types (wellarchitected, devops, serverless, etc.)
    const pillarIds = Object.keys(questionsByPillar || {});

    // If no pillars found, use default wellarchitected pillars for display
    const allPillars = pillarIds.length > 0
      ? pillarIds
      : [
          'operationalExcellence',
          'security',
          'reliability',
          'performance',
          'costOptimization',
          'sustainability',
        ];

    allPillars.forEach((pillarId) => {
      const questions = questionsByPillar?.[pillarId] || [];
      const questionsWithStatus = questions.map((q) => ({
        ...q,
        isSelected: selectedQuestions[q.QuestionId] || false,
      }));
      const selectedCount = questionsWithStatus.filter((q) => q.isSelected).length;
      result[pillarId] = {
        questions: questionsWithStatus,
        totalCount: questions.length,
        selectedCount: selectedCount,
      };
    });
    return result;
  }, [questionsByPillar, selectedQuestions]);

  // Count total selected questions
  const totalSelectedCount = useMemo(() => {
    return Object.values(selectedQuestions).filter(Boolean).length;
  }, [selectedQuestions]);

  // Toggle pillar expansion
  const togglePillar = (pillarId) => {
    setExpandedPillars((prev) => ({
      ...prev,
      [pillarId]: !prev[pillarId],
    }));
  };

  // Toggle question selection
  const toggleQuestion = (questionId) => {
    setSelectedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Select/deselect all questions in a pillar
  const toggleAllInPillar = (pillarId) => {
    const pillarData = pillarsWithQuestions[pillarId];
    if (!pillarData) return;

    const allQuestions = pillarData.questions;
    const allSelected = allQuestions.every((q) => selectedQuestions[q.QuestionId]);

    setSelectedQuestions((prev) => {
      const updated = { ...prev };
      allQuestions.forEach((q) => {
        updated[q.QuestionId] = !allSelected;
      });
      return updated;
    });
  };

  // Build answers array for upload
  const buildAnswersForUpload = () => {
    const answersArray = [];
    const allQuestions = Object.values(questionsByPillar || {}).flat();
    const workloadIdForAnswers = workload?.workloadId || '';

    // Iterate over all questions and include those that are selected AND have answers
    allQuestions.forEach((question) => {
      if (selectedQuestions[question.QuestionId]) {
        // Get selected choices from answers prop, or use existing SelectedChoices from question
        const selectedChoices = answers[question.QuestionId] || question.SelectedChoices || [];

        // Only include questions that have actual answers selected
        if (selectedChoices.length > 0) {
          // Build ChoiceAnswerSummaries from selected choices
          const choiceAnswerSummaries = selectedChoices.map((choiceId) => ({
            ChoiceId: choiceId,
            Status: 'SELECTED',
            Reason: '',
          }));

          // Use existing ChoiceAnswerSummaries only if it has items, otherwise use built ones
          const finalChoiceAnswerSummaries =
            (question.ChoiceAnswerSummaries && question.ChoiceAnswerSummaries.length > 0)
              ? question.ChoiceAnswerSummaries
              : choiceAnswerSummaries;

          // Get notes from assessmentNotes (from Apply Suggested Answers) or from question
          const questionNotes = assessmentNotes[question.QuestionId] || question.Notes || '';

          answersArray.push({
            QuestionId: question.QuestionId,
            QuestionTitle: question.QuestionTitle || question.Title || '',
            PillarId: question.PillarId,
            WorkloadId: workloadIdForAnswers,
            IsApplicable: question.IsApplicable !== false,
            SelectedChoices: selectedChoices,
            isSelected: true,
            Notes: questionNotes,
            LensAlias: selectedLens,
            ChoiceAnswerSummaries: finalChoiceAnswerSummaries,
          });
        }
      }
    });

    console.log('[UploadToAwsModal] Built answers for upload:', answersArray);
    return answersArray;
  };

  const handleUpload = async () => {
    if (!selectedAccountId) {
      toast.error('Please select an AWS account');
      return;
    }

    // For new workloads, validate required fields
    if (!isExistingAwsWorkload) {
      if (!newWorkloadName.trim()) {
        toast.error('Please enter a workload name');
        return;
      }

      if (!workloadAccountIds.trim()) {
        toast.error('Please enter workload account IDs');
        return;
      }

      if (!workloadDescription.trim()) {
        toast.error('Please enter a workload description');
        return;
      }

      if (!reviewOwner.trim()) {
        toast.error('Please enter a review owner email');
        return;
      }
    }

    if (createMilestone && !milestoneName.trim()) {
      toast.error('Please enter a milestone name');
      return;
    }

    setUploading(true);

    try {
      const answersToUpload = buildAnswersForUpload();

      if (answersToUpload.length === 0) {
        toast.error('No questions selected to upload.');
        setUploading(false);
        return;
      }

      // Determine opType and workloadDetails based on whether it's existing or new
      const opType = isExistingAwsWorkload ? 'update' : 'create';

      let workloadDetails;
      if (isExistingAwsWorkload) {
        // For existing workloads, only send workloadId and awsRegion
        workloadDetails = {
          workloadId: existingWorkloadId,
          awsRegion,
        };
      } else {
        // For new workloads, send all details
        const tags = {};
        if (workloadTags.trim()) {
          workloadTags.split(',').forEach((tag) => {
            const [key, value] = tag.split(':').map((s) => s.trim());
            if (key && value) {
              tags[key] = value;
            }
          });
        }

        workloadDetails = {
          name: newWorkloadName,
          awsRegion,
          description: workloadDescription,
          regions: workloadRegions,
          environment: environmentType,
          reviewOwner: reviewOwner,
          tags: Object.keys(tags).length > 0 ? tags : undefined,
          lenses: [selectedLens],
        };
      }

      // Build authProfile for API - include name from selectedProfile
      // Remove fields that shouldn't be in authProfile (awsAccountId, stackArn, workloadId)
      const { awsAccountId: _awsAcctId, stackArn: _stackArn, workloadId: _wlId, ...restAuthProfile } = authProfile || {};
      const finalAuthProfile = {
        name: selectedProfile?.name || 'Default',
        description: restAuthProfile?.description || 'Authentication Profile to Allow Access to Account',
        authType: restAuthProfile?.authType || 'role',
        roleName: restAuthProfile?.roleName || '',
        externalId: restAuthProfile?.externalId || '',
        accessKeyId: restAuthProfile?.accessKeyId || '',
        secretAccessKey: restAuthProfile?.secretAccessKey || '',
        sessionToken: restAuthProfile?.sessionToken || '',
        iamUserName: restAuthProfile?.iamUserName || '',
        formError: restAuthProfile?.formError ?? false,
        permissionTemplates: restAuthProfile?.permissionTemplates || '',
        wellArchitectedAcess: restAuthProfile?.wellArchitectedAcess || 'readwrite',
        temporaryAccess: restAuthProfile?.temporaryAccess ?? false,
        temporaryAccessHours: restAuthProfile?.temporaryAccessHours || '1',
        restrictToCloudFormation: restAuthProfile?.restrictToCloudFormation ?? false,
        servicesEnabled: restAuthProfile?.servicesEnabled || [],
        accessType: restAuthProfile?.accessType || [],
        isMoreInfoPanelPermissionsOpen: restAuthProfile?.isMoreInfoPanelPermissionsOpen ?? false,
        isMoreInfoPanelRoleOpen: restAuthProfile?.isMoreInfoPanelRoleOpen ?? false,
      };

      console.log('[UploadToAwsModal] Uploading:', { opType, workloadDetails, answersCount: answersToUpload.length, finalAuthProfile });

      const result = await updateWellArchitected({
        opType,
        authProfile: finalAuthProfile,
        workloadDetails,
        answers: answersToUpload,
        accountId: awsAccountId,
        selectedAssessmentId,
        createMilestone,
        milestoneName,
        sourceAccountId: awsAccountId, // Always send the account ID as sourceAccountId
      });

      if (result.ok) {
        const messages = [];
        if (result.workloadCreated) {
          messages.push('Workload created');
        } else if (result.workloadId) {
          messages.push('Workload updated');
        }
        if (result.milestone?.created) {
          messages.push(`Milestone "${result.milestone.name}" created`);
        }

        toast.success(
          messages.length > 0
            ? `Well-Architected Review uploaded: ${messages.join(', ')}`
            : 'Well-Architected Review uploaded successfully'
        );
        onClose();
      } else {
        toast.error(result.error || 'Failed to upload to AWS');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload to AWS');
    } finally {
      setUploading(false);
    }
  };

  const getAccountDisplay = (profile) => {
    const auth =
      typeof profile.authProfile === 'string'
        ? JSON.parse(profile.authProfile)
        : profile.authProfile || {};
    const accountId = auth.awsAccountId || '';
    return accountId ? `${profile.name} (${accountId})` : profile.name;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isExistingAwsWorkload ? 'Update Workload in AWS' : 'Upload to AWS'}
          </DialogTitle>
          {isExistingAwsWorkload && (
            <p className="text-sm text-gray-500 mt-1">
              Updating: {workload?.workloadName}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* AWS Account Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              AWS Account Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-700">
                  Account Id <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select AWS Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {awsAccounts.map((account) => (
                      <SelectItem key={account.recordId} value={account.recordId}>
                        {getAccountDisplay(account)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-700">
                  Region <span className="text-red-500">*</span>
                </Label>
                <Select value={awsRegion} onValueChange={setAwsRegion}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {AWS_REGIONS.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Milestone */}
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-2">
                <Checkbox
                  checked={createMilestone}
                  onCheckedChange={setCreateMilestone}
                />
                <span className="text-sm font-medium text-gray-900">
                  Create Milestone
                </span>
              </div>
              {createMilestone && (
                <div>
                  <Label className="text-sm text-gray-700">Milestone</Label>
                  <Input
                    value={milestoneName}
                    onChange={(e) => setMilestoneName(e.target.value)}
                    placeholder="Milestone Name"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Workload Details - Only show for new workloads */}
          {!isExistingAwsWorkload && (
            <>
              <hr className="border-gray-200" />

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Workload Details
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-700">
                        Workload Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={newWorkloadName}
                        onChange={(e) => setNewWorkloadName(e.target.value)}
                        placeholder="Enter Workload Name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-700">
                        Workload Account Ids (Separated by Comma) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={workloadAccountIds}
                        onChange={(e) => setWorkloadAccountIds(e.target.value)}
                        placeholder="Enter Workload Account Ids"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-700">
                      Workload Description <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={workloadDescription}
                      onChange={(e) => setWorkloadDescription(e.target.value)}
                      placeholder="Enter Workload Description"
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-700">
                        Review Owner <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={reviewOwner}
                        onChange={(e) => setReviewOwner(e.target.value)}
                        placeholder="owner@example.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-700">
                        Environment Type <span className="text-red-500">*</span>
                      </Label>
                      <Select value={environmentType} onValueChange={setEnvironmentType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select Environment" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENVIRONMENT_TYPES.map((env) => (
                            <SelectItem key={env.value} value={env.value}>
                              {env.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-700">
                        Workload Regions <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={workloadRegions[0]}
                        onValueChange={(val) => setWorkloadRegions([val])}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select Region" />
                        </SelectTrigger>
                        <SelectContent>
                          {AWS_REGIONS.map((region) => (
                            <SelectItem key={region.value} value={region.value}>
                              {region.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-700">Workload Tags</Label>
                      <Input
                        value={workloadTags}
                        onChange={(e) => setWorkloadTags(e.target.value)}
                        placeholder="Enter Tags using the format key:value"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <hr className="border-gray-200" />

          {/* Selected Questions to Upload */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
              Selected Questions to Upload
            </h3>
            <h4 className="text-base font-bold text-gray-900 mb-4 text-center">
              {LENS_TITLES[selectedLens] || selectedLens}
            </h4>

            <div className="space-y-3">
              {Object.entries(pillarsWithQuestions).map(([pillarId, pillarData]) => (
                <div key={pillarId} className="border rounded-lg bg-white">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => togglePillar(pillarId)}
                  >
                    <span className="font-medium text-gray-900">
                      {PILLAR_NAMES[pillarId] || pillarId}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {pillarData.selectedCount} Questions Will Be Uploaded
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          expandedPillars[pillarId] ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {expandedPillars[pillarId] && pillarData.totalCount > 0 && (
                    <div className="border-t px-4 py-3 bg-gray-50">
                      <div className="mb-3 pb-2 border-b">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            checked={pillarData.questions.every((q) => selectedQuestions[q.QuestionId])}
                            onCheckedChange={() => toggleAllInPillar(pillarId)}
                            className="data-[state=checked]:bg-primary-600"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {pillarData.questions.every((q) => selectedQuestions[q.QuestionId])
                              ? 'Deselect All'
                              : 'Select All'}
                          </span>
                        </label>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pillarData.questions.map((question) => (
                          <label
                            key={question.QuestionId}
                            className="flex items-start gap-2 cursor-pointer"
                          >
                            <Switch
                              checked={selectedQuestions[question.QuestionId] || false}
                              onCheckedChange={() => toggleQuestion(question.QuestionId)}
                              className="mt-0.5 data-[state=checked]:bg-primary-600"
                            />
                            <span className="text-sm text-gray-700">
                              {question.QuestionTitle}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || !selectedAccountId}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isExistingAwsWorkload ? 'Updating...' : 'Uploading...'}
              </>
            ) : (
              isExistingAwsWorkload ? 'Update Workload' : 'Push to AWS Account'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
