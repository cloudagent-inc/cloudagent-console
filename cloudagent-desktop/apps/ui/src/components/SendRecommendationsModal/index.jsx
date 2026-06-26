import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader2, ChevronRight, ChevronLeft, Eye, Edit2, Check, X, ExternalLink, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const DESTINATIONS = [
  { id: 'jira', name: 'Jira', icon: Icons.jiraIcon, enabled: true },
  { id: 'slack', name: 'Slack', icon: Icons.slackIcon, enabled: false, comingSoon: true },
  { id: 'servicenow', name: 'ServiceNow', icon: Icons.serviceNowIcon, enabled: false, comingSoon: true },
];

const safeJsonParse = (value) => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  const couldBeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!couldBeJson) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const toArray = (value) => {
  if (value == null) return [];
  const parsed = safeJsonParse(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed == null) return [];
  if (typeof parsed === 'object') return [parsed];
  return [parsed];
};

const formatJiraResourceEntry = (resource) => {
  if (!resource) return null;
  if (typeof resource === 'string') return resource;
  const parsed = safeJsonParse(resource);
  if (!parsed) return null;
  if (typeof parsed === 'string') return parsed;
  if (typeof parsed === 'object') {
    const name = parsed.resourceName || parsed.name || parsed.id || parsed.arn || '';
    const type = parsed.resourceType || parsed.type || '';
    return type ? `${name} (${type})` : name || null;
  }
  return String(parsed);
};

// Build recommendation payload for Jira
const buildJiraRecommendationPayload = (recommendation, options = {}) => {
  const { includeRemediationOverview = true, includeResourceDetails = true } = options;
  
  const id = recommendation?.pk || recommendation?.id || recommendation?.recommendationId || null;
  const metadata = safeJsonParse(recommendation?.metadata);
  const remediation = safeJsonParse(recommendation?.remediation);
  const recommendedAction = safeJsonParse(recommendation?.recommendedAction);
  const title = recommendation?.title || recommendation?.name || 'Recommendation';
  const summary = recommendation?.summary || recommendation?.description || recommendation?.details || title;
  
  const detailParts = [];
  if (recommendation?.description) {
    detailParts.push(recommendation.description);
  }
  if (includeRemediationOverview) {
    const remediationOverview = remediation?.overview && typeof remediation.overview === 'string' ? remediation.overview : null;
    const recommendedOverview = recommendedAction?.overview && typeof recommendedAction.overview === 'string' ? recommendedAction.overview : null;
    const overview = remediationOverview || recommendedOverview;
    if (overview) detailParts.push(overview);
  }
  const details = detailParts.filter(Boolean).join('\n\n');
  const category = metadata?.category ?? metadata?.categories ?? recommendation?.category ?? null;
  const priority = metadata?.priority ?? recommendation?.priority ?? null;
  const impact = metadata?.impact ?? recommendation?.impact ?? recommendation?.severity ?? null;
  const workloadName = recommendation?.workloadName || metadata?.workloadName || recommendation?.accountName || null;
  const recommendationUrl = `${window.location.origin}/dashboard/recommendations`;
  const resources = includeResourceDetails
    ? toArray(recommendation?.targetResources).map(formatJiraResourceEntry).filter(Boolean)
    : [];
  const normalizedCategory = Array.isArray(category) ? category.join(', ') : category;

  return {
    id,
    title,
    summary,
    details,
    category: normalizedCategory,
    priority,
    impact,
    workloadName,
    recommendationUrl,
    resources: resources.length ? resources : undefined,
  };
};

// Build description text from payload
const buildDescriptionFromPayload = (payload) => {
  const lines = [];
  if (payload?.summary) lines.push(`Summary: ${payload.summary}`);
  if (payload?.details) lines.push(`\nDetails:\n${payload.details}`);
  if (payload?.category) lines.push(`\nCategory: ${payload.category}`);
  if (payload?.priority) lines.push(`Priority: ${payload.priority}`);
  if (payload?.impact) lines.push(`Impact: ${payload.impact}`);
  if (payload?.workloadName) lines.push(`Workload: ${payload.workloadName}`);
  if (payload?.recommendationUrl) lines.push(`\nLink: ${payload.recommendationUrl}`);
  if (Array.isArray(payload?.resources) && payload.resources.length) {
    lines.push('\nAffected Resources:');
    payload.resources.forEach((resource) => {
      lines.push(`• ${resource}`);
    });
  }
  return lines.join('\n');
};

// Editable Issue Card component
const EditableIssueCard = ({ issue, index, onUpdate, isExpanded, onToggleExpand }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(issue.summary);
  const [editedDescription, setEditedDescription] = useState(issue.description);

  useEffect(() => {
    setEditedSummary(issue.summary);
    setEditedDescription(issue.description);
  }, [issue.summary, issue.description]);

  const handleSave = () => {
    onUpdate(issue.id, { summary: editedSummary, description: editedDescription });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSummary(issue.summary);
    setEditedDescription(issue.description);
    setIsEditing(false);
  };

  return (
    <div className="group rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-sm">
      <div 
        className="flex items-start justify-between gap-3 px-4 py-3 cursor-pointer"
        onClick={() => !isEditing && onToggleExpand(issue.id)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="text-sm font-medium"
                onClick={(e) => e.stopPropagation()}
                placeholder="Issue summary..."
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 truncate">{issue.summary}</p>
            )}
            {!isExpanded && !isEditing && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {issue.description?.split('\n')[0] || 'No description'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); onToggleExpand(issue.id, true); }}
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <ChevronRight 
                className={cn(
                  "h-4 w-4 text-slate-400 transition-transform",
                  isExpanded && "rotate-90"
                )} 
              />
            </>
          )}
        </div>
      </div>
      
      {(isExpanded || isEditing) && (
        <div className="border-t border-slate-100 px-4 py-3">
          {isEditing ? (
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="min-h-[160px] text-sm font-mono text-slate-700"
              placeholder="Issue description..."
            />
          ) : (
            <pre className="whitespace-pre-wrap text-xs text-slate-600 font-sans leading-relaxed">
              {issue.description || 'No description available.'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

// Step indicator component
const StepIndicator = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === currentStep ? "w-6 bg-primary-500" : "w-1.5 bg-slate-200"
          )}
        />
      ))}
    </div>
  );
};

// Main Modal Component
export default function SendRecommendationsModal({
  open,
  onOpenChange,
  selectedRecommendations = [],
  jiraConnections = [],
  jiraConnectionsLoading = false,
  onSendToJira,
  jiraSubmitting = false,
  jiraResult = null,
  jiraError = null,
  jiraReconnectNeeded = false,
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: Configure, 1: Preview & Edit
  const [destination, setDestination] = useState('jira');
  const [connectionId, setConnectionId] = useState('');
  const [mode, setMode] = useState('per_recommendation');
  const [singleIssueFormat, setSingleIssueFormat] = useState('sections');
  const [includeRemediationOverview, setIncludeRemediationOverview] = useState(true);
  const [includeResourceDetails, setIncludeResourceDetails] = useState(true);
  const [expandedIssueId, setExpandedIssueId] = useState(null);
  const [editedIssues, setEditedIssues] = useState({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(0);
      setEditedIssues({});
      setExpandedIssueId(null);
      // Auto-select first connection if available
      if (jiraConnections.length > 0 && !connectionId) {
        const readyConnection = jiraConnections.find(
          (c) => c.defaultProjectKey && c.defaultIssueTypeId
        );
        setConnectionId(readyConnection?.id || jiraConnections[0].id);
      }
    }
  }, [open, jiraConnections]);

  const activeConnection = useMemo(
    () => jiraConnections.find((c) => c.id === connectionId) || null,
    [jiraConnections, connectionId]
  );

  // Generate preview issues
  const previewIssues = useMemo(() => {
    const options = { includeRemediationOverview, includeResourceDetails };
    const payloads = selectedRecommendations
      .map((rec) => buildJiraRecommendationPayload(rec, options))
      .filter((p) => p?.id);

    if (!payloads.length) return [];

    if (mode === 'single') {
      const combinedDescription = payloads
        .map((p, i) => {
          const header = `━━━ Recommendation ${i + 1}: ${p.title} ━━━`;
          return `${header}\n${buildDescriptionFromPayload(p)}`;
        })
        .join('\n\n');
      
      return [{
        id: 'single-combined',
        summary: `Cloud Agent: ${payloads.length} Recommendation${payloads.length === 1 ? '' : 's'}`,
        description: combinedDescription,
        recommendationIds: payloads.map((p) => p.id),
      }];
    }

    return payloads.map((p) => ({
      id: p.id,
      summary: `Cloud Agent: ${p.title}`,
      description: buildDescriptionFromPayload(p),
      recommendationIds: [p.id],
    }));
  }, [selectedRecommendations, mode, includeRemediationOverview, includeResourceDetails]);

  // Get final issues with any edits applied
  const finalIssues = useMemo(() => {
    return previewIssues.map((issue) => ({
      ...issue,
      ...(editedIssues[issue.id] || {}),
    }));
  }, [previewIssues, editedIssues]);

  const handleUpdateIssue = useCallback((issueId, updates) => {
    setEditedIssues((prev) => ({
      ...prev,
      [issueId]: { ...(prev[issueId] || {}), ...updates },
    }));
  }, []);

  const handleToggleExpand = useCallback((issueId, forceExpand = false) => {
    setExpandedIssueId((prev) => (forceExpand || prev !== issueId ? issueId : null));
  }, []);

  const handleSend = () => {
    if (!connectionId || !finalIssues.length) return;
    
    // Transform issues back to payload format
    const payloadRecommendations = finalIssues.map((issue) => {
      const original = selectedRecommendations.find((rec) => {
        const recId = rec?.pk || rec?.id || rec?.recommendationId;
        return issue.recommendationIds?.includes(recId);
      });
      
      return {
        ...buildJiraRecommendationPayload(original || {}, { includeRemediationOverview, includeResourceDetails }),
        // Apply edited summary/description
        customSummary: editedIssues[issue.id]?.summary,
        customDescription: editedIssues[issue.id]?.description,
      };
    });

    onSendToJira({
      connectionId,
      mode,
      singleIssueFormat: mode === 'single' ? singleIssueFormat : undefined,
      recommendations: payloadRecommendations.filter((r) => r.id),
      customEdits: editedIssues,
    });
  };

  const canProceed = destination === 'jira' && connectionId && selectedRecommendations.length > 0;
  const connectionReady = activeConnection?.defaultProjectKey && activeConnection?.defaultIssueTypeId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <DialogHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-slate-900">
                {step === 0 ? 'Send Recommendations' : 'Preview & Edit'}
              </DialogTitle>
              <StepIndicator currentStep={step} totalSteps={2} />
            </div>
            <DialogDescription className="text-sm text-slate-500">
              {step === 0 
                ? 'Configure how recommendations are sent to your tools'
                : 'Review and customize before sending'
              }
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {step === 0 ? (
            <div className="space-y-6">
              {/* Destination Selection */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Destination
                </Label>
                <div className="flex gap-2">
                  {DESTINATIONS.map((dest) => {
                    const Icon = dest.icon;
                    return (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => dest.enabled && setDestination(dest.id)}
                        disabled={!dest.enabled}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all",
                          destination === dest.id && dest.enabled
                            ? "border-primary-500 bg-primary-50/50"
                            : dest.enabled
                              ? "border-slate-200 bg-white hover:border-slate-300"
                              : "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          destination === dest.id && dest.enabled ? "bg-white shadow-sm" : "bg-slate-100"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-center">
                          <p className={cn(
                            "text-sm font-medium",
                            dest.enabled ? "text-slate-900" : "text-slate-400"
                          )}>
                            {dest.name}
                          </p>
                          {dest.comingSoon && (
                            <p className="text-[10px] text-slate-400">Coming soon</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {destination === 'jira' && (
                <>
                  {/* Jira Connection */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Jira Connection
                    </Label>
                    {jiraConnectionsLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading connections...
                      </div>
                    ) : jiraConnections.length > 0 ? (
                      <RadioGroup value={connectionId} onValueChange={setConnectionId} className="gap-2">
                        {jiraConnections.map((conn) => {
                          const ready = conn.defaultProjectKey && conn.defaultIssueTypeId;
                          return (
                            <label
                              key={conn.id}
                              htmlFor={`conn-${conn.id}`}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all",
                                connectionId === conn.id
                                  ? "border-primary-500 bg-primary-50/50"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <RadioGroupItem id={`conn-${conn.id}`} value={conn.id} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900 truncate">
                                    {conn.displayName || conn.siteUrl}
                                  </span>
                                  {!ready && (
                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">
                                      Setup needed
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">{conn.siteUrl}</span>
                                  {!ready && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenChange(false);
                                        navigate('/dashboard/cloud-setup');
                                      }}
                                      className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                                    >
                                      Configure →
                                    </button>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                        <p className="text-sm text-slate-600 mb-3">No Jira connections configured</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false);
                            navigate('/dashboard/cloud-setup');
                          }}
                        >
                          Go to Integrations
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Options */}
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Issue Creation
                        </Label>
                        <span className="text-xs text-slate-500">
                          {selectedRecommendations.length} recommendation{selectedRecommendations.length !== 1 ? 's' : ''} selected
                        </span>
                      </div>
                      <RadioGroup value={mode} onValueChange={setMode} className="gap-2">
                        <label
                          htmlFor="mode-per"
                          className={cn(
                            "flex items-center gap-3 rounded-lg border bg-white px-4 py-3 cursor-pointer transition-all",
                            mode === 'per_recommendation'
                              ? "border-primary-500"
                              : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <RadioGroupItem id="mode-per" value="per_recommendation" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-900">One issue per recommendation</p>
                              <Badge variant="secondary" className="text-[10px] bg-slate-100">
                                {selectedRecommendations.length} issue{selectedRecommendations.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">Creates separate issues for tracking</p>
                          </div>
                        </label>
                        <label
                          htmlFor="mode-single"
                          className={cn(
                            "flex items-center gap-3 rounded-lg border bg-white px-4 py-3 cursor-pointer transition-all",
                            mode === 'single'
                              ? "border-primary-500"
                              : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <RadioGroupItem id="mode-single" value="single" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-900">Single combined issue</p>
                              <Badge variant="secondary" className="text-[10px] bg-slate-100">1 issue</Badge>
                            </div>
                            <p className="text-xs text-slate-500">All recommendations in one issue</p>
                          </div>
                        </label>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Include in Description
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Remediation overview</p>
                            <p className="text-xs text-slate-500">Recommended actions and fixes</p>
                          </div>
                          <Switch 
                            checked={includeRemediationOverview} 
                            onCheckedChange={setIncludeRemediationOverview}
                            className="data-[state=checked]:bg-primary-600"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Resource details</p>
                            <p className="text-xs text-slate-500">List of affected resources</p>
                          </div>
                          <Switch 
                            checked={includeResourceDetails} 
                            onCheckedChange={setIncludeResourceDetails}
                            className="data-[state=checked]:bg-primary-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Step 1: Preview & Edit */
            <div className="space-y-4">
              {/* Connection Info */}
              {activeConnection && (
                <div className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3",
                  connectionReady ? "bg-slate-50" : "bg-amber-50 border border-amber-200"
                )}>
                  <Icons.jiraIcon className={cn("h-5 w-5", connectionReady ? "text-slate-400" : "text-amber-500")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {activeConnection.displayName || activeConnection.siteUrl}
                    </p>
                    {connectionReady ? (
                      <p className="text-xs text-slate-500">
                        Project: {activeConnection.defaultProjectKey} · Type: {activeConnection.defaultIssueTypeName || 'Task'}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">
                        Missing default project or issue type configuration
                      </p>
                    )}
                  </div>
                  {!connectionReady && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        navigate('/dashboard/cloud-setup');
                      }}
                      className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Fix in Settings
                    </Button>
                  )}
                </div>
              )}

              {/* Issues Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {finalIssues.length === 1 ? 'Issue' : `${finalIssues.length} Issues`} to Create
                  </Label>
                  <span className="text-xs text-slate-400">Click to expand · Hover to edit</span>
                </div>
                
                {finalIssues.length > 0 ? (
                  <div className="space-y-2">
                    {finalIssues.map((issue, index) => (
                      <EditableIssueCard
                        key={issue.id}
                        issue={issue}
                        index={index}
                        onUpdate={handleUpdateIssue}
                        isExpanded={expandedIssueId === issue.id}
                        onToggleExpand={handleToggleExpand}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No issues to preview. Select recommendations first.
                  </div>
                )}
              </div>

              {/* Errors */}
              {jiraError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{jiraError}</p>
                    {jiraReconnectNeeded && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          navigate('/dashboard/cloud-setup');
                        }}
                      >
                        Reconnect Jira
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Success */}
              {jiraResult?.issues?.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-800 mb-2">
                    ✓ {jiraResult.issues.length} issue{jiraResult.issues.length === 1 ? '' : 's'} created
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {jiraResult.issues.map((issue, i) => {
                      const key = issue.issueKey || issue.key || `Issue ${i + 1}`;
                      return issue.url ? (
                        <a
                          key={key}
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-white border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          {key}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span
                          key={key}
                          className="rounded-full bg-white border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700"
                        >
                          {key}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              {step === 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep(0)}
                  disabled={jiraSubmitting}
                  className="text-slate-600"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={jiraSubmitting}
              >
                {jiraResult?.issues?.length ? 'Done' : 'Cancel'}
              </Button>
              {step === 0 ? (
                <Button
                  onClick={() => setStep(1)}
                  disabled={!canProceed}
                >
                  Preview
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleSend}
                  disabled={jiraSubmitting || !finalIssues.length || jiraResult?.issues?.length > 0 || !connectionReady}
                  className="min-w-[130px] border-slate-300 hover:bg-slate-100"
                  title={!connectionReady ? 'Configure Jira connection first' : undefined}
                >
                  {jiraSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Create Issue{finalIssues.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
