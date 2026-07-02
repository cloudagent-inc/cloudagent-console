import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  PiggyBank,
  AlertCircle,
  Settings,
  Lightbulb,
  Server,
  CreditCard,
  BarChart3,
  Building2,
  Filter,
  ExternalLink,
  Database,
  Zap,
  Eye,
  Maximize2,
} from 'lucide-react';
import { Icons } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  launchEnvironmentCostScans,
  refreshEnvironmentCostAnalysis,
  selectEnvironmentCostRequestsById,
  selectEnvironmentCostResultsById,
} from '@/features/cost/costSlice';
import { selectScannerUpdatesConnectionId } from '@/features/operations/operationsSlice';
import { DEFAULT_HEALTH_MAX_AGE_HOURS } from '@/features/health/healthUtils';
import { selectWorkspaceScopedEnvironmentProfiles } from '@/features/workspace/workspaceScope';

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];
const ALL_ENVIRONMENTS_SCOPE = 'all';
const TABLE_PAGE_SIZE = 20;

const safeParseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseSummaryObject = (value) => safeParseJson(value, {});

const isFreshTimestamp = (value, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) => {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  return Date.now() - parsed < maxAgeHours * 60 * 60 * 1000;
};

const hasFreshCostMetadata = (profile, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) => {
  const summary = parseSummaryObject(profile?.summary);
  const analysis =
    summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
  const artifact = analysis?.cost && typeof analysis.cost === 'object' ? analysis.cost : {};
  const generatedAt = artifact.generatedAt || artifact.createdAt || artifact.timestamp || '';
  return isFreshTimestamp(generatedAt, maxAgeHours);
};

const hasStoredCostMetadata = (profile) => {
  const summary = parseSummaryObject(profile?.summary);
  const analysis =
    summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
  const artifact = analysis?.cost && typeof analysis.cost === 'object' ? analysis.cost : {};
  return Boolean(
    artifact.generatedAt ||
      artifact.createdAt ||
      artifact.timestamp ||
      artifact.objectKey ||
      artifact.path ||
      artifact.fileName
  );
};

const isAwsAccountProfile = (profile) => {
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'aws account';
};

const isAwsOrgProfile = (profile) => {
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'aws org';
};

const isAzureSubscriptionProfile = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  const normalizedType = String(profile?.type || authProfile?.provider || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'azure subscription' || Boolean(authProfile?.provider === 'azure' && authProfile?.subscriptionId);
};

const isAzureTenantProfile = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'azure tenant' || (authProfile?.provider === 'azure' && !authProfile?.subscriptionId);
};

const isAzureProfile = (profile) => isAzureTenantProfile(profile) || isAzureSubscriptionProfile(profile);

const getAwsAccountIdFromProfile = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  return String(
    authProfile?.awsAccountId || authProfile?.aws_account_id || authProfile?.accountId || ''
  ).trim();
};

const getAzureTenantIdFromProfile = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  return String(authProfile?.tenantId || '').trim();
};

const getAzureSubscriptionIdFromProfile = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  return String(authProfile?.subscriptionId || '').trim();
};

const getDiscoveredOrgMemberAccountIds = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  return new Set(
    (Array.isArray(authProfile?.memberAccountsDiscovered) ? authProfile.memberAccountsDiscovered : [])
      .map((account) => String(account?.id || account?.accountId || '').trim())
      .filter(Boolean)
  );
};

const getDiscoveredOrgMemberAccountNameMap = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  return new Map(
    (Array.isArray(authProfile?.memberAccountsDiscovered) ? authProfile.memberAccountsDiscovered : [])
      .map((account) => {
        const accountId = String(account?.id || account?.accountId || '').trim();
        if (!accountId) return null;
        return [accountId, String(account?.name || account?.accountName || '').trim()];
      })
      .filter(Boolean)
  );
};

const buildCostScopeMetadata = (profiles) => {
  const normalizedProfiles = (Array.isArray(profiles) ? profiles : []).map((profile) => {
    const permissionProfileId = String(
      profile?.recordId || profile?.id || profile?.permissionProfileId || ''
    ).trim();
    if (!permissionProfileId) return null;

    const deploymentPreferences = safeParseJson(profile?.deploymentPreferences, {});
    const accountId = getAwsAccountIdFromProfile(profile);
    const tenantId = getAzureTenantIdFromProfile(profile);
    const subscriptionId = getAzureSubscriptionIdFromProfile(profile);
    const normalizedType = isAwsOrgProfile(profile)
      ? 'aws org'
      : isAwsAccountProfile(profile)
        ? 'aws account'
        : isAzureTenantProfile(profile)
          ? 'azure tenant'
          : isAzureSubscriptionProfile(profile)
            ? 'azure subscription'
          : '';
    const cloudProvider = normalizedType.startsWith('azure ') ? 'azure' : 'aws';

    return {
      permissionProfileId,
      name:
        profile?.name ||
        (normalizedType === 'aws org'
          ? 'AWS Organization'
          : normalizedType === 'azure tenant'
            ? 'Azure Tenant'
            : normalizedType === 'azure subscription'
              ? 'Azure Subscription'
            : 'AWS Environment'),
      accountId: normalizedType === 'azure tenant' ? tenantId : normalizedType === 'azure subscription' ? subscriptionId : accountId,
      tenantId,
      subscriptionId,
      cloudProvider,
      type: normalizedType,
      orgPermissionProfileId: String(deploymentPreferences?.orgPermissionProfileId || '').trim(),
      orgManagementAccountId: String(deploymentPreferences?.orgManagementAccountId || '').trim(),
      isOrgManagementAccount: Boolean(deploymentPreferences?.isOrgManagementAccount),
      memberAccountIds: isAwsOrgProfile(profile) ? getDiscoveredOrgMemberAccountIds(profile) : new Set(),
      memberAccountNameById: isAwsOrgProfile(profile)
        ? getDiscoveredOrgMemberAccountNameMap(profile)
        : new Map(),
    };
  }).filter(Boolean);

  const orgProfiles = normalizedProfiles.filter((profile) => profile.type === 'aws org');
  const awsAccountProfiles = normalizedProfiles.filter((profile) => profile.type === 'aws account');
  const azureTenantProfiles = normalizedProfiles.filter((profile) => profile.type === 'azure tenant');
  const azureSubscriptionProfiles = normalizedProfiles.filter((profile) => profile.type === 'azure subscription');
  const azureSubscriptionsByTenantId = new Map();
  azureSubscriptionProfiles.forEach((profile) => {
    const tenantKey = String(profile.tenantId || '').trim();
    if (!tenantKey) return;
    const current = azureSubscriptionsByTenantId.get(tenantKey) || [];
    current.push(profile);
    azureSubscriptionsByTenantId.set(tenantKey, current);
  });
  const accountProfileNameById = new Map(
    awsAccountProfiles
      .filter((profile) => profile.accountId)
      .map((profile) => [profile.accountId, profile.name])
  );
  const orgById = new Map(orgProfiles.map((profile) => [profile.permissionProfileId, profile]));
  const orgByManagementAccountId = new Map(
    orgProfiles
      .filter((profile) => profile.accountId)
      .map((profile) => [profile.accountId, profile])
  );
  const managementAccountProfileByOrgId = new Map(
    awsAccountProfiles
      .filter((profile) => profile.isOrgManagementAccount && profile.orgPermissionProfileId)
      .map((profile) => [profile.orgPermissionProfileId, profile])
  );
  const managementAccountProfileByManagementAccountId = new Map(
    awsAccountProfiles
      .filter((profile) => profile.isOrgManagementAccount && profile.accountId)
      .map((profile) => [profile.accountId, profile])
  );

  const scopeOptions = normalizedProfiles
    .filter((profile) =>
      ['aws account', 'aws org', 'azure tenant', 'azure subscription'].includes(profile.type)
    )
    .map((profile) => {
      const canonicalManagementProfile =
        profile.type === 'aws org'
          ? managementAccountProfileByOrgId.get(profile.permissionProfileId) ||
            managementAccountProfileByManagementAccountId.get(profile.accountId)
          : null;

      return {
        permissionProfileId: profile.permissionProfileId,
        sourcePermissionProfileId: canonicalManagementProfile?.permissionProfileId || profile.permissionProfileId,
        name: profile.name,
        accountId: profile.accountId,
        tenantId: profile.tenantId,
        subscriptionId: profile.subscriptionId,
        cloudProvider: profile.cloudProvider,
        type: profile.type,
        azureSubscriptionProfiles:
          profile.type === 'azure tenant'
            ? (azureSubscriptionsByTenantId.get(profile.tenantId) || []).map((subscriptionProfile) => ({
                permissionProfileId: subscriptionProfile.permissionProfileId,
                name: subscriptionProfile.name,
                accountId: subscriptionProfile.accountId,
                tenantId: subscriptionProfile.tenantId,
                subscriptionId: subscriptionProfile.subscriptionId,
                cloudProvider: subscriptionProfile.cloudProvider,
                type: subscriptionProfile.type,
              }))
            : [],
        memberAccountIds: profile.memberAccountIds,
        memberAccountNameById: profile.memberAccountNameById,
      };
    });

  const excludedLinkedAccountProfiles = [];
  const aggregateSources = [];

  orgProfiles.forEach((profile) => {
    const canonicalManagementProfile =
      managementAccountProfileByOrgId.get(profile.permissionProfileId) ||
      managementAccountProfileByManagementAccountId.get(profile.accountId);

    aggregateSources.push({
      permissionProfileId: canonicalManagementProfile?.permissionProfileId || profile.permissionProfileId,
      name: profile.name,
      accountId: profile.accountId,
      type: profile.type,
      sourceProfileType: canonicalManagementProfile?.type || profile.type,
      sourceProfileName: canonicalManagementProfile?.name || profile.name,
      memberAccountNameById: new Map([
        ...getDiscoveredOrgMemberAccountNameMap(profile),
        ...accountProfileNameById,
      ]),
    });
  });

  awsAccountProfiles.forEach((profile) => {

    const linkedOrg =
      orgById.get(profile.orgPermissionProfileId) ||
      orgByManagementAccountId.get(profile.orgManagementAccountId) ||
      orgByManagementAccountId.get(profile.accountId) ||
      orgProfiles.find((orgProfile) => profile.accountId && orgProfile.memberAccountIds.has(profile.accountId));

    if (linkedOrg) {
      excludedLinkedAccountProfiles.push({
        permissionProfileId: profile.permissionProfileId,
        name: profile.name,
        accountId: profile.accountId,
        type: profile.type,
        coveredByOrgPermissionProfileId: linkedOrg.permissionProfileId,
        coveredByOrgName: linkedOrg.name,
      });
      return;
    }

    aggregateSources.push({
      permissionProfileId: profile.permissionProfileId,
      name: profile.name,
      accountId: profile.accountId,
      type: profile.type,
    });
  });

  azureTenantProfiles.forEach((profile) => {
    aggregateSources.push({
      permissionProfileId: profile.permissionProfileId,
      name: `${profile.name} Shared`,
      accountId: profile.tenantId,
      tenantId: profile.tenantId,
      cloudProvider: 'azure',
      type: 'azure tenant cost',
    });
  });

  azureSubscriptionProfiles.forEach((profile) => {
    aggregateSources.push({
      permissionProfileId: profile.permissionProfileId,
      name: profile.name,
      accountId: profile.subscriptionId,
      tenantId: profile.tenantId,
      subscriptionId: profile.subscriptionId,
      cloudProvider: 'azure',
      type: profile.type,
    });
  });

  return {
    scopeOptions,
    aggregateSources,
    excludedLinkedAccountProfiles,
  };
};

const getEnvironmentProviderIcon = (environment, className = 'h-3.5 w-3.5') => {
  if (environment?.cloudProvider === 'azure' || environment?.type === 'azure tenant') {
    return <Icons.azure className={className} />;
  }
  return <Icons.aws className={className} />;
};

const getEnvironmentTypeLabel = (type) => {
  if (type === 'aws org') return 'AWS Org';
  if (type === 'aws org account') return 'Org Account';
  if (type === 'azure tenant') return 'Azure Tenant';
  if (type === 'azure subscription') return 'Azure Subscription';
  if (type === 'azure tenant cost') return 'Tenant Cost';
  return 'AWS Account';
};

const getCostScanTargetsForEnvironment = (environment) => {
  if (!environment) return [];
  const permissionProfileId = String(
    environment.sourcePermissionProfileId || environment.permissionProfileId || ''
  ).trim();
  if (!permissionProfileId) return [];

  if (environment.type !== 'azure tenant') {
    return [{
      permissionProfileId,
      cloudProvider: environment.cloudProvider || 'aws',
    }];
  }

  const subscriptionTargets = (Array.isArray(environment.azureSubscriptionProfiles)
    ? environment.azureSubscriptionProfiles
    : [])
    .map((subscriptionProfile) => ({
      permissionProfileId: String(subscriptionProfile?.permissionProfileId || '').trim(),
      cloudProvider: 'azure',
    }))
    .filter((target) => target.permissionProfileId);

  return [
    { permissionProfileId, cloudProvider: 'azure' },
    ...subscriptionTargets,
  ];
};

const dedupeCostTargets = (targets = []) => {
  const seen = new Set();
  return (Array.isArray(targets) ? targets : []).filter((target) => {
    const key = `${target?.cloudProvider || 'aws'}:${target?.permissionProfileId || ''}`;
    if (!target?.permissionProfileId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const titleCase = (value) =>
  String(value || '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Unknown';

const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diffDays === 0) {
    if (diffHours === 0) {
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
    }
    return `today at ${timeStr}`;
  }
  if (diffDays === 1) {
    return `yesterday at ${timeStr}`;
  }
  return `${diffDays} days ago`;
};

const formatCurrency = (value, compact = false) => {
  if (!Number.isFinite(value)) return null;
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getFreshnessTextClass = (timestamp) =>
  timestamp && !isFreshTimestamp(timestamp, DEFAULT_HEALTH_MAX_AGE_HOURS)
    ? 'font-medium text-red-600'
    : 'text-gray-500';

const getFreshnessSuffix = (timestamp) =>
  timestamp && !isFreshTimestamp(timestamp, DEFAULT_HEALTH_MAX_AGE_HOURS)
    ? ' - stale'
    : '';

const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatMonthLabel = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getSavingsPlansRecommendationItems = (recommendationsByType) =>
  (Array.isArray(recommendationsByType) ? recommendationsByType : []).flatMap((type) => {
    const items = Array.isArray(type?.details)
      ? type.details
      : Array.isArray(type?.recommendations)
        ? type.recommendations
        : [];

    return items.map((recommendation) => ({
      ...recommendation,
      savingsPlansType:
        recommendation?.savingsPlansType ||
        recommendation?.SavingsPlansType ||
        type?.savingsPlansType ||
        type?.SavingsPlansType,
      termInYears: recommendation?.termInYears || recommendation?.TermInYears || type?.termInYears || type?.TermInYears,
      paymentOption:
        recommendation?.paymentOption ||
        recommendation?.PaymentOption ||
        type?.paymentOption ||
        type?.PaymentOption,
    }));
  });

const getSavingsPlansEstimatedSavings = (recommendation) =>
  toNumber(recommendation?.estimatedMonthlySavingsAmount) ||
  toNumber(recommendation?.EstimatedMonthlySavingsAmount) ||
  toNumber(recommendation?.estimatedMonthlySavings) ||
  toNumber(recommendation?.EstimatedMonthlySavings) ||
  toNumber(recommendation?.monthlySavingsAmount) ||
  toNumber(recommendation?.MonthlySavingsAmount) ||
  toNumber(recommendation?.estimatedSavingsAmount) ||
  toNumber(recommendation?.EstimatedSavingsAmount) ||
  toNumber(recommendation?.savingsAmount) ||
  0;

const getSavingsPlansHourlyCommitment = (recommendation) =>
  toNumber(recommendation?.hourlyCommitmentToPurchase) ||
  toNumber(recommendation?.HourlyCommitmentToPurchase) ||
  0;

const getRightsizingEstimatedSavings = (recommendation) =>
  toNumber(recommendation?.estimatedMonthlySavings) ||
  toNumber(recommendation?.EstimatedMonthlySavings) ||
  toNumber(recommendation?.estimatedMonthlySavingsAmount) ||
  toNumber(recommendation?.EstimatedMonthlySavingsAmount) ||
  toNumber(recommendation?.ModifyRecommendationDetail?.TargetInstances?.[0]?.EstimatedMonthlySavings) ||
  toNumber(recommendation?.modifyRecommendationDetail?.targetInstances?.[0]?.estimatedMonthlySavings) ||
  toNumber(recommendation?.TerminateRecommendationDetail?.EstimatedMonthlySavings) ||
  toNumber(recommendation?.terminateRecommendationDetail?.estimatedMonthlySavings) ||
  toNumber(recommendation?.savingsAmount) ||
  0;

const getCostOptimizationHubEstimatedSavings = (recommendation) =>
  toNumber(recommendation?.estimatedMonthlySavings) ||
  toNumber(recommendation?.estimatedMonthlySavings?.value) ||
  toNumber(recommendation?.estimatedSavings) ||
  0;

const extractAwsAccountIdFromArn = (value) => {
  const arn = String(value || '').trim();
  if (!arn.startsWith('arn:')) return '';
  const parts = arn.split(':');
  return parts.length >= 5 ? String(parts[4] || '').trim() : '';
};

const pickFirstNonEmptyString = (candidates = []) => {
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const annotateRecommendationAccount = (
  recommendation,
  {
    environmentName = '',
    environmentAccountId = '',
    accountNameById = null,
    fallbackRecommendationAccountId = '',
    fallbackRecommendationAccountName = '',
    recommendationAccountCandidates = [],
  } = {}
) => {
  const resolvedEnvironmentName = String(
    recommendation?.environmentName || environmentName || ''
  ).trim();
  const resolvedEnvironmentAccountId = String(
    recommendation?.environmentAccountId || environmentAccountId || ''
  ).trim();
  const resolvedRecommendationAccountId = pickFirstNonEmptyString([
    recommendation?.recommendationAccountId,
    ...recommendationAccountCandidates,
    fallbackRecommendationAccountId,
  ]);
  const accountNames = accountNameById instanceof Map ? accountNameById : new Map();
  const resolvedRecommendationAccountName = String(
    recommendation?.recommendationAccountName ||
      recommendation?.accountName ||
      recommendation?.AccountName ||
      (resolvedRecommendationAccountId
        ? accountNames.get(resolvedRecommendationAccountId)
        : '') ||
      (resolvedRecommendationAccountId === fallbackRecommendationAccountId
        ? fallbackRecommendationAccountName
        : '') ||
      ''
  ).trim();

  return {
    ...recommendation,
    ...(resolvedEnvironmentName ? { environmentName: resolvedEnvironmentName } : {}),
    ...(resolvedEnvironmentAccountId ? { environmentAccountId: resolvedEnvironmentAccountId } : {}),
    ...(resolvedRecommendationAccountId
      ? { recommendationAccountId: resolvedRecommendationAccountId }
      : {}),
    ...(resolvedRecommendationAccountName
      ? { recommendationAccountName: resolvedRecommendationAccountName }
      : {}),
  };
};

const getCostOptimizationHubRecommendationAccountId = (recommendation) => {
  const candidates = [
    recommendation?.accountId,
    recommendation?.AccountId,
    recommendation?.resourceAccountId,
    recommendation?.ResourceAccountId,
    recommendation?.resource?.accountId,
    recommendation?.resource?.AccountId,
    extractAwsAccountIdFromArn(recommendation?.resourceArn),
    extractAwsAccountIdFromArn(recommendation?.ResourceArn),
    extractAwsAccountIdFromArn(recommendation?.currentResourceArn),
    extractAwsAccountIdFromArn(recommendation?.CurrentResourceArn),
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }

  return '';
};

const getRightsizingRecommendationAccountId = (recommendation) =>
  pickFirstNonEmptyString([
    recommendation?.accountId,
    recommendation?.AccountId,
    recommendation?.linkedAccountId,
    recommendation?.LinkedAccountId,
    recommendation?.currentInstance?.accountId,
    recommendation?.CurrentInstance?.AccountId,
    recommendation?.currentInstance?.resourceAccountId,
    recommendation?.CurrentInstance?.ResourceAccountId,
    extractAwsAccountIdFromArn(recommendation?.resourceArn),
    extractAwsAccountIdFromArn(recommendation?.ResourceArn),
    extractAwsAccountIdFromArn(recommendation?.currentResourceArn),
    extractAwsAccountIdFromArn(recommendation?.CurrentResourceArn),
  ]);

const getSavingsPlansRecommendationAccountId = (recommendation) =>
  pickFirstNonEmptyString([
    recommendation?.accountId,
    recommendation?.AccountId,
    recommendation?.linkedAccountId,
    recommendation?.LinkedAccountId,
    recommendation?.payerAccountId,
    recommendation?.PayerAccountId,
  ]);

const annotateCostOptimizationHubRecommendation = (
  recommendation,
  {
    environmentName = '',
    environmentAccountId = '',
    accountNameById = null,
    fallbackRecommendationAccountId = '',
    fallbackRecommendationAccountName = '',
  } = {}
) => {
  return annotateRecommendationAccount(recommendation, {
    environmentName,
    environmentAccountId,
    accountNameById,
    fallbackRecommendationAccountId,
    fallbackRecommendationAccountName,
    recommendationAccountCandidates: [getCostOptimizationHubRecommendationAccountId(recommendation)],
  });
};

const annotateCostOptimizationHubRecommendations = (recommendations, context = {}) =>
  (Array.isArray(recommendations) ? recommendations : []).map((recommendation) =>
    annotateCostOptimizationHubRecommendation(recommendation, context)
  );

const annotateRightsizingRecommendations = (recommendations, context = {}) =>
  (Array.isArray(recommendations) ? recommendations : []).map((recommendation) =>
    annotateRecommendationAccount(recommendation, {
      ...context,
      recommendationAccountCandidates: [getRightsizingRecommendationAccountId(recommendation)],
    })
  );

const annotateSavingsPlansRecommendations = (recommendations, context = {}) =>
  (Array.isArray(recommendations) ? recommendations : []).map((recommendation) =>
    annotateRecommendationAccount(recommendation, {
      ...context,
      recommendationAccountCandidates: [getSavingsPlansRecommendationAccountId(recommendation)],
    })
  );

const annualizeMonthlySavings = (value) => {
  const numericValue = toNumber(value);
  if (numericValue === null) return null;
  return numericValue * 12;
};

const sortRecommendationsByEstimatedSavings = (items, getSavings) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      item,
      index,
      savings: annualizeMonthlySavings(getSavings(item)) || 0,
    }))
    .sort((a, b) => {
      if (b.savings !== a.savings) {
        return b.savings - a.savings;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);

const paginateItems = (items, page, pageSize = TABLE_PAGE_SIZE) => {
  const safeItems = Array.isArray(items) ? items : [];
  const totalPages = Math.max(1, Math.ceil(safeItems.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  return {
    items: safeItems.slice(startIndex, startIndex + pageSize),
    totalPages,
    currentPage,
    startIndex,
  };
};

const pickAmountFromObject = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const candidates = [
    entry.amount,
    entry.cost,
    entry.total,
    entry.totalCost,
    entry.unblendedCost,
    entry.blendedCost,
    entry.value,
  ];
  for (const candidate of candidates) {
    const parsed = toNumber(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
};

const pickLabelFromObject = (entry) => {
  if (!entry || typeof entry !== 'object') return '';
  return (
    entry.service ||
    entry.serviceName ||
    entry.dimensionValue ||
    entry.group ||
    entry.account ||
    entry.name ||
    entry.label ||
    entry.linkedAccountId ||
    entry.accountId ||
    ''
  );
};

const pickDateFromObject = (entry) => {
  if (!entry || typeof entry !== 'object') return '';
  return entry.date || entry.timePeriod?.Start || entry.start || '';
};

const processDailyTotalData = (dailyTotal) => {
  if (!Array.isArray(dailyTotal)) return [];
  return dailyTotal
    .map((entry) => {
      if (typeof entry === 'number') {
        return { amount: entry };
      }
      if (entry && typeof entry === 'object') {
        const amount = pickAmountFromObject(entry);
        const date = pickDateFromObject(entry);
        return { date, amount: amount || 0, label: formatShortDate(date) };
      }
      return null;
    })
    .filter(Boolean);
};

const processMonthlyTotalData = (monthlyTotal) => {
  if (!Array.isArray(monthlyTotal)) return [];
  return monthlyTotal
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const amount = pickAmountFromObject(entry);
      const date = pickDateFromObject(entry);
      if (!date) return null;
      return { date, amount: amount || 0, label: formatMonthLabel(date) };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const buildServiceTotals = (dailyByService) => {
  if (!Array.isArray(dailyByService)) return [];
  const totals = new Map();

  dailyByService.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;

    const nestedGroups = Array.isArray(entry.groups) ? entry.groups : null;
    if (nestedGroups) {
      nestedGroups.forEach((group) => {
        const label = pickLabelFromObject(group);
        const amount = pickAmountFromObject(group);
        if (!label || amount === null) return;
        totals.set(label, (totals.get(label) || 0) + amount);
      });
      return;
    }

    const label = pickLabelFromObject(entry);
    const amount = pickAmountFromObject(entry);
    if (!label || amount === null) return;
    totals.set(label, (totals.get(label) || 0) + amount);
  });

  return Array.from(totals.entries())
    .map(([service, total]) => ({ service, total }))
    .sort((a, b) => b.total - a.total);
};

const buildAccountTotals = (dailyByLinkedAccount) => {
  if (!Array.isArray(dailyByLinkedAccount)) return [];
  const totals = new Map();

  dailyByLinkedAccount.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;

    const nestedGroups = Array.isArray(entry.groups) ? entry.groups : null;
    if (nestedGroups) {
      nestedGroups.forEach((group) => {
        const label = pickLabelFromObject(group);
        const amount = pickAmountFromObject(group);
        if (!label || amount === null) return;
        totals.set(label, (totals.get(label) || 0) + amount);
      });
      return;
    }

    const label = pickLabelFromObject(entry);
    const amount = pickAmountFromObject(entry);
    if (!label || amount === null) return;
    totals.set(label, (totals.get(label) || 0) + amount);
  });

  return Array.from(totals.entries())
    .map(([account, total]) => ({ account, total }))
    .sort((a, b) => b.total - a.total);
};

const extractAccountIdFromEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return '';

  const candidates = [
    entry.linkedAccountId,
    entry.accountId,
    entry.account,
    entry.LinkedAccountId,
    entry.LinkedAccount,
    entry.AccountId,
    entry.Account,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }

  const fallbackLabel = String(pickLabelFromObject(entry) || '').trim();
  return /^\d{12}$/.test(fallbackLabel) ? fallbackLabel : '';
};

const filterCostEntriesByAllowedAccountIds = (entries, allowedAccountIds) => {
  if (!Array.isArray(entries) || !(allowedAccountIds instanceof Set) || allowedAccountIds.size === 0) {
    return Array.isArray(entries) ? entries : [];
  }

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const nestedGroups = Array.isArray(entry.groups) ? entry.groups : null;
      if (nestedGroups) {
        const groups = nestedGroups.filter((group) =>
          allowedAccountIds.has(extractAccountIdFromEntry(group))
        );
        return groups.length > 0 ? { ...entry, groups } : null;
      }

      return allowedAccountIds.has(extractAccountIdFromEntry(entry)) ? entry : null;
    })
    .filter(Boolean);
};

const buildDailyTotalsFromLinkedAccountData = (dailyByLinkedAccount) => {
  if (!Array.isArray(dailyByLinkedAccount)) return [];

  const totalsByDate = new Map();

  dailyByLinkedAccount.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;

    const date = pickDateFromObject(entry);
    if (!date) return;

    const nestedGroups = Array.isArray(entry.groups) ? entry.groups : null;
    const totalAmount = nestedGroups
      ? nestedGroups.reduce((sum, group) => sum + (pickAmountFromObject(group) || 0), 0)
      : (pickAmountFromObject(entry) || 0);

    totalsByDate.set(date, (totalsByDate.get(date) || 0) + totalAmount);
  });

  return Array.from(totalsByDate.entries())
    .map(([date, amount]) => ({
      date,
      amount,
      total: amount,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const buildMonthlyTotalsFromDailyTotals = (dailyTotals) => {
  if (!Array.isArray(dailyTotals) || dailyTotals.length === 0) return [];

  const totalsByMonth = new Map();

  dailyTotals.forEach((entry) => {
    const date = String(entry?.date || '').trim();
    if (!date) return;

    const amount = pickAmountFromObject(entry);
    const monthKey = `${date.slice(0, 7)}-01`;
    totalsByMonth.set(monthKey, (totalsByMonth.get(monthKey) || 0) + (amount || 0));
  });

  return Array.from(totalsByMonth.entries())
    .map(([date, amount]) => ({
      date,
      amount,
      total: amount,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const buildMergedDailyTotalData = (reports) => {
  const totals = new Map();

  reports.forEach(({ report }) => {
    const dailyTotal = report?.data?.spend?.dailyTotal;
    const processed = processDailyTotalData(Array.isArray(dailyTotal) ? dailyTotal : []);
    processed.forEach((entry) => {
      if (!entry?.date) return;
      totals.set(entry.date, (totals.get(entry.date) || 0) + (entry.amount || 0));
    });
  });

  return Array.from(totals.entries())
    .map(([date, amount]) => ({
      date,
      amount,
      label: formatShortDate(date),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const buildMergedMonthlyTotalData = (reports) => {
  const totals = new Map();

  reports.forEach(({ report }) => {
    const monthlyTotal = report?.data?.spend?.monthlyTotal12m;
    const processed = processMonthlyTotalData(Array.isArray(monthlyTotal) ? monthlyTotal : []);
    processed.forEach((entry) => {
      if (!entry?.date) return;
      totals.set(entry.date, (totals.get(entry.date) || 0) + (entry.amount || 0));
    });
  });

  return Array.from(totals.entries())
    .map(([date, amount]) => ({
      date,
      amount,
      label: formatMonthLabel(date),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const buildDateRangeFromDailyData = (dailyData, fallbackLookbackDays = 90) => {
  if (!Array.isArray(dailyData) || dailyData.length === 0) {
    return { startDate: '', endDate: '', lookbackDays: fallbackLookbackDays };
  }

  const sorted = [...dailyData].sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    startDate: sorted[0]?.date || '',
    endDate: sorted[sorted.length - 1]?.date || '',
    lookbackDays: fallbackLookbackDays,
  };
};

const buildDateRangeFromMonthlyData = (monthlyData, fallbackLookbackMonths = 12) => {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    return { startDate: '', endDate: '', lookbackMonths: fallbackLookbackMonths };
  }

  const sorted = [...monthlyData].sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    startDate: sorted[0]?.date || '',
    endDate: sorted[sorted.length - 1]?.date || '',
    lookbackMonths: fallbackLookbackMonths,
  };
};

const calculateEstimatedSavings = ({
  rightsizingRecommendations = [],
  savingsPlansRecommendations = [],
  costOptimizationHubRecommendations = [],
}) => {
  let total = 0;

  rightsizingRecommendations.forEach((recommendation) => {
    total += getRightsizingEstimatedSavings(recommendation);
  });

  savingsPlansRecommendations.forEach((recommendation) => {
    total += getSavingsPlansEstimatedSavings(recommendation);
  });

  costOptimizationHubRecommendations.forEach((recommendation) => {
    total += getCostOptimizationHubEstimatedSavings(recommendation);
  });

  return total;
};

const groupSavingsPlansRecommendations = (recommendations) => {
  const grouped = new Map();

  recommendations.forEach((recommendation) => {
    const type = recommendation.savingsPlansType || recommendation.savingsPlanType || 'Compute';
    const current = grouped.get(type) || [];
    current.push(recommendation);
    grouped.set(type, current);
  });

  return Array.from(grouped.entries()).map(([savingsPlansType, groupedRecommendations]) => ({
    savingsPlansType,
    recommendations: groupedRecommendations,
  }));
};

const buildAggregateChecks = (environmentReports) =>
  environmentReports.flatMap(({ environment, report }) =>
    (Array.isArray(report?.checks) ? report.checks : []).map((check) => ({
      ...check,
      environmentName: environment.name,
      environmentAccountId: environment.accountId,
      permissionProfileId: environment.permissionProfileId,
    }))
  );

const buildEnvironmentSummaries = (environmentReports, { expandAzureTenants = false } = {}) =>
  environmentReports
    .map(({ environment, report }) => {
      const spend = report?.data?.spend || {};
      const dailyTotalData = processDailyTotalData(
        Array.isArray(spend?.dailyTotal) ? spend.dailyTotal : []
      );
      const accountTotals = buildAccountTotals(
        Array.isArray(spend?.dailyByLinkedAccount) ? spend.dailyByLinkedAccount : []
      );
      const serviceTotals = buildServiceTotals(
        Array.isArray(spend?.dailyByService) ? spend.dailyByService : []
      );
      const rightsizingRecommendations = Array.isArray(report?.data?.rightsizing?.recommendations)
        ? report.data.rightsizing.recommendations
        : [];
      const savingsPlansRecommendations = getSavingsPlansRecommendationItems(
        report?.data?.savingsPlans?.recommendationsByType
      );
      const costOptimizationHubRecommendations = Array.isArray(report?.data?.costOptimizationHub?.recommendations)
        ? report.data.costOptimizationHub.recommendations
        : [];
      const anomalies = Array.isArray(report?.data?.anomalyDetection?.anomalies)
        ? report.data.anomalyDetection.anomalies
        : [];
      const spendMetrics = calculateSpendMetrics(dailyTotalData);
      const rows = [];
      const isAzureTenantEnvironment = environment.type === 'azure tenant';
      const azureSubscriptionBreakdown = Array.isArray(spend?.subscriptionBreakdown)
        ? spend.subscriptionBreakdown
        : [];
      const azureTenantLevelBreakdown = Array.isArray(spend?.tenantLevelBreakdown)
        ? spend.tenantLevelBreakdown
        : [];
      const azureBreakdownTotals = [
        ...azureSubscriptionBreakdown.map((item) => ({
          account: item?.id || item?.name,
          name: item?.name || item?.id,
          total: toNumber(item?.total) || 0,
          scopeType: 'subscription',
        })),
        ...azureTenantLevelBreakdown.map((item) => ({
          account: item?.id || item?.name,
          name: item?.name || 'Tenant-level charges',
          total: toNumber(item?.total) || 0,
          scopeType: 'tenant',
        })),
      ].filter((item) => item.account || item.name);
      const selectedAzureBreakdownTotals =
        azureBreakdownTotals.length > 0
          ? azureBreakdownTotals
          : accountTotals.map((item) => ({
              ...item,
              name: item.account,
              scopeType: String(item.account || '').toLowerCase().includes('tenant')
                ? 'tenant'
                : 'subscription',
            }));
      const shouldExpandAzureTenant = expandAzureTenants && isAzureTenantEnvironment && selectedAzureBreakdownTotals.length > 0;
      const shouldHideOrgContainerRow =
        (environment.type === 'aws org' && accountTotals.length > 0) || shouldExpandAzureTenant;

      if (!shouldHideOrgContainerRow) {
        rows.push({
          permissionProfileId: environment.permissionProfileId,
          name: environment.name,
          chartLabel: environment.name,
          accountId: environment.accountId,
          type: environment.type || 'aws account',
          totalSpend: spendMetrics.total,
          dailyAverage: spendMetrics.average,
          topService: serviceTotals[0]?.service || '',
          anomalyCount: anomalies.length,
          recommendationCount:
            rightsizingRecommendations.length +
            savingsPlansRecommendations.length +
            costOptimizationHubRecommendations.length,
          estimatedSavings: calculateEstimatedSavings({
            rightsizingRecommendations,
            savingsPlansRecommendations,
            costOptimizationHubRecommendations,
          }),
          generatedAt: report?.generatedAt || '',
          isBreakdownRow: false,
          parentName: '',
        });
      }

      if (environment.type === 'aws org' && accountTotals.length > 0) {
        const accountNameById = environment.memberAccountNameById instanceof Map
          ? environment.memberAccountNameById
          : new Map();

        accountTotals.forEach((account) => {
          const accountId = String(account.account || '').trim();
          const accountName = accountNameById.get(accountId) || accountId || 'Member Account';

          rows.push({
            permissionProfileId: `${environment.permissionProfileId}:${accountId || accountName}`,
            name: accountName,
            chartLabel: accountName,
            accountId,
            type: 'aws org account',
            totalSpend: account.total,
            dailyAverage: dailyTotalData.length > 0 ? account.total / dailyTotalData.length : 0,
            topService: '',
            anomalyCount: null,
            recommendationCount: null,
            estimatedSavings: null,
            generatedAt: report?.generatedAt || '',
            isBreakdownRow: false,
            parentName: environment.name,
          });
        });
      }

      if (shouldExpandAzureTenant) {
        selectedAzureBreakdownTotals.forEach((account) => {
          const accountId = String(account.account || account.name || '').trim();
          const isTenantLevel = account.scopeType === 'tenant';
          const accountName = account.name || accountId || (isTenantLevel ? 'Tenant-level charges' : 'Subscription');

          rows.push({
            permissionProfileId: `${environment.permissionProfileId}:${accountId || accountName}`,
            name: accountName,
            chartLabel: accountName,
            accountId,
            type: isTenantLevel ? 'azure tenant cost' : 'azure subscription',
            totalSpend: account.total,
            dailyAverage: dailyTotalData.length > 0 ? account.total / dailyTotalData.length : 0,
            topService: '',
            anomalyCount: null,
            recommendationCount: null,
            estimatedSavings: null,
            generatedAt: report?.generatedAt || '',
            isBreakdownRow: true,
            parentName: environment.name,
          });
        });
      }

      return rows;
    })
    .flat()
    .sort((a, b) => b.totalSpend - a.totalSpend);

const buildAggregatedCostReport = ({
  environments,
  environmentReports,
  failedEnvironments,
  configuredScopeCount = environments.length,
  excludedLinkedAccountProfiles = [],
}) => {
  const dailyTotal = buildMergedDailyTotalData(environmentReports);
  const monthlyTotal12m = buildMergedMonthlyTotalData(environmentReports);
  const dailyByService = environmentReports.flatMap(({ report }) =>
    Array.isArray(report?.data?.spend?.dailyByService) ? report.data.spend.dailyByService : []
  );
  const dailyByLinkedAccount = environmentReports.flatMap(({ report }) =>
    Array.isArray(report?.data?.spend?.dailyByLinkedAccount) ? report.data.spend.dailyByLinkedAccount : []
  );

  const anomalies = environmentReports.flatMap(({ environment, report }) =>
    (Array.isArray(report?.data?.anomalyDetection?.anomalies) ? report.data.anomalyDetection.anomalies : []).map(
      (anomaly) => ({
        ...anomaly,
        environmentName: environment.name,
        environmentAccountId: environment.accountId,
        permissionProfileId: environment.permissionProfileId,
      })
    )
  );

  const rightsizingRecommendations = environmentReports.flatMap(({ environment, report }) =>
    annotateRightsizingRecommendations(
      Array.isArray(report?.data?.rightsizing?.recommendations) ? report.data.rightsizing.recommendations : [],
      {
        environmentName: environment.name,
        environmentAccountId: environment.accountId,
        accountNameById: environment.memberAccountNameById,
        fallbackRecommendationAccountId: environment.type === 'aws account' ? environment.accountId : '',
        fallbackRecommendationAccountName: environment.type === 'aws account' ? environment.name : '',
      }
    ).map((recommendation) => ({
      ...recommendation,
      permissionProfileId: environment.permissionProfileId,
    }))
  );

  const savingsPlansRecommendations = environmentReports.flatMap(({ environment, report }) =>
    annotateSavingsPlansRecommendations(
      getSavingsPlansRecommendationItems(report?.data?.savingsPlans?.recommendationsByType),
      {
        environmentName: environment.name,
        environmentAccountId: environment.accountId,
        accountNameById: environment.memberAccountNameById,
        fallbackRecommendationAccountId: environment.type === 'aws account' ? environment.accountId : '',
        fallbackRecommendationAccountName: environment.type === 'aws account' ? environment.name : '',
      }
    ).map((recommendation) => ({
      ...recommendation,
      permissionProfileId: environment.permissionProfileId,
    }))
  );

  const costOptimizationHubRecommendations = environmentReports.flatMap(({ environment, report }) =>
    annotateCostOptimizationHubRecommendations(
      Array.isArray(report?.data?.costOptimizationHub?.recommendations)
        ? report.data.costOptimizationHub.recommendations
        : [],
      {
        environmentName: environment.name,
        environmentAccountId: environment.accountId,
        accountNameById: environment.memberAccountNameById,
        fallbackRecommendationAccountId: environment.type === 'aws account' ? environment.accountId : '',
        fallbackRecommendationAccountName: environment.type === 'aws account' ? environment.name : '',
      }
    ).map((recommendation) => ({
      ...recommendation,
      permissionProfileId: environment.permissionProfileId,
    }))
  );

  const lookbackCandidates = environmentReports
    .map(({ report }) => report?.lookbackDays || report?.data?.spend?.range?.lookbackDays)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const lookbackDays = lookbackCandidates.length > 0 ? Math.min(...lookbackCandidates) : 90;
  const monthlyRangeCandidates = environmentReports
    .map(({ report }) => report?.data?.spend?.monthlyRange12m)
    .filter((value) => value && typeof value === 'object');
  const monthlyRange12m = monthlyRangeCandidates.length > 0
    ? {
        startDate: monthlyRangeCandidates
          .map((value) => value.startDate)
          .filter(Boolean)
          .sort()[0] || '',
        endDate: monthlyRangeCandidates
          .map((value) => value.endDate)
          .filter(Boolean)
          .sort()
          .slice(-1)[0] || '',
        lookbackMonths: Number(monthlyRangeCandidates[0]?.lookbackMonths) || 12,
      }
    : buildDateRangeFromMonthlyData(monthlyTotal12m, 12);
  const generatedAtCandidates = environmentReports
    .map(({ report }) => report?.generatedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));

  return {
    ok: true,
    generatedAt: generatedAtCandidates[0] || '',
    lookbackDays,
    checks: buildAggregateChecks(environmentReports),
    aggregateContext: {
      isAggregate: true,
      totalEnvironmentCount: environments.length,
      loadedEnvironmentCount: environmentReports.length,
      configuredScopeCount,
      failedEnvironments,
      excludedLinkedAccountProfiles,
      environmentSummaries: buildEnvironmentSummaries(environmentReports),
    },
    data: {
      spend: {
        dailyTotal,
        monthlyTotal12m,
        dailyByService,
        dailyByLinkedAccount,
        range: buildDateRangeFromDailyData(dailyTotal, lookbackDays),
        monthlyRange12m,
      },
      anomalyDetection: {
        anomalies,
      },
      rightsizing: {
        recommendations: rightsizingRecommendations,
      },
      savingsPlans: {
        recommendationsByType: groupSavingsPlansRecommendations(savingsPlansRecommendations),
      },
      costOptimizationHub: {
        recommendations: costOptimizationHubRecommendations,
      },
    },
  };
};

const calculateMonthlySpend = (dailyData) => {
  if (!dailyData || dailyData.length === 0) return [];

  const monthlyTotals = new Map();

  dailyData.forEach((entry) => {
    if (!entry.date) return;
    const date = new Date(entry.date);
    if (isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyTotals.get(monthKey) || { month: monthKey, total: 0, date, latestDate: date };
    current.total += entry.amount || 0;
    if (!current.latestDate || date > current.latestDate) {
      current.latestDate = date;
    }
    monthlyTotals.set(monthKey, current);
  });

  return Array.from(monthlyTotals.values())
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 3)
    .map((item) => {
      const [year, month] = item.month.split('-');
      const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const now = new Date();
      const isCurrentMonth =
        monthDate.getFullYear() === now.getFullYear() &&
        monthDate.getMonth() === now.getMonth();
      const latestDay =
        item.latestDate instanceof Date && !isNaN(item.latestDate.getTime())
          ? item.latestDate.getDate()
          : now.getDate();
      const label = isCurrentMonth
        ? `${monthDate.toLocaleString('en-US', { month: 'short' })} 1-${latestDay}`
        : monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      return { ...item, label };
    });
};

const calculateSpendMetrics = (dailyData) => {
  if (!dailyData || dailyData.length === 0) {
    return { total: 0, average: 0, trend: 0, latest: 0 };
  }

  const total = dailyData.reduce((sum, d) => sum + (d.amount || 0), 0);
  const average = total / dailyData.length;
  const latest = dailyData[dailyData.length - 1]?.amount || 0;

  const midpoint = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, midpoint);
  const secondHalf = dailyData.slice(midpoint);

  const firstHalfAvg = firstHalf.length > 0
    ? firstHalf.reduce((sum, d) => sum + (d.amount || 0), 0) / firstHalf.length
    : 0;
  const secondHalfAvg = secondHalf.length > 0
    ? secondHalf.reduce((sum, d) => sum + (d.amount || 0), 0) / secondHalf.length
    : 0;

  const trend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  return { total, average, trend, latest };
};

const getAnomalyConsoleUrl = (anomaly, accountId) => {
  const anomalyId = anomaly?.AnomalyId || anomaly?.anomalyId;
  if (!anomalyId) return null;
  const region = 'us-east-1';
  return `https://${region}.console.aws.amazon.com/cost-management/home#/anomaly-detection/monitors/${encodeURIComponent(anomaly.MonitorArn || '')}/anomalies/${encodeURIComponent(anomalyId)}`;
};

const StatusIcon = ({ status, className = 'h-4 w-4' }) => {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case 'healthy':
      return <CheckCircle2 className={`${className} text-green-600`} />;
    case 'problem':
      return <AlertTriangle className={`${className} text-amber-600`} />;
    case 'error':
      return <XCircle className={`${className} text-red-600`} />;
    case 'unknown':
    default:
      return <HelpCircle className={`${className} text-gray-400`} />;
  }
};

const StatusBadge = ({ status }) => {
  const normalized = normalizeStatus(status);
  const styles = {
    healthy: 'bg-green-50 text-green-700 border-green-200',
    problem: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    unknown: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <Badge variant="outline" className={`${styles[normalized] || styles.unknown} font-medium`}>
      <StatusIcon status={status} className="h-3 w-3 mr-1" />
      {titleCase(status)}
    </Badge>
  );
};

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm">
      {label && <div className="font-medium text-gray-900 mb-1">{label}</div>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color || entry.fill }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const SpendTrendChart = ({ data, height = 280, seriesName = 'Daily Spend' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No spend data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrency(v, true)}
          width={60}
        />
        <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
        <Area
          type="monotone"
          dataKey="amount"
          name={seriesName}
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#spendGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const ServiceSpendChart = ({ data, height = 280, limit = 8 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No service data available
      </div>
    );
  }

  const topServices = typeof limit === 'number' ? data.slice(0, limit) : data;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={topServices} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          tickFormatter={(v) => formatCurrency(v, true)}
        />
        <YAxis
          type="category"
          dataKey="service"
          width={140}
          tick={{ fontSize: 11, fill: '#374151' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v.length > 20 ? v.slice(0, 20) + '...' : v)}
        />
        <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
        <Bar dataKey="total" name="Total Spend" radius={[0, 4, 4, 0]}>
          {topServices.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const AccountSpendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No linked account data available
      </div>
    );
  }

  const topAccounts = data.slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={topAccounts} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="account"
          tick={{ fontSize: 10, fill: '#6b7280', angle: -45, textAnchor: 'end' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          height={60}
          tickFormatter={(v) => (v.length > 12 ? '...' + v.slice(-8) : v)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrency(v, true)}
          width={60}
        />
        <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
        <Bar dataKey="total" name="Total Spend" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const EnvironmentSpendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No environment spend data available
      </div>
    );
  }

  const chartHeight = Math.max(data.length * 38, 280);

  return (
    <div className="max-h-[420px] overflow-y-auto pr-2">
      <div style={{ height: chartHeight, minWidth: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => formatCurrency(value, true)}
            />
            <YAxis
              type="category"
              dataKey="chartLabel"
              width={220}
              tick={{ fontSize: 11, fill: '#374151' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => (value.length > 32 ? value.slice(0, 32) + '...' : value)}
            />
            <Tooltip content={<CustomTooltip formatter={(value) => formatCurrency(value)} />} />
            <Bar dataKey="totalSpend" name="Total Spend" radius={[0, 4, 4, 0]}>
              {data.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const RefreshModal = ({ open, onClose, onRefresh, loading }) => {
  const [forceRefresh, setForceRefresh] = useState(false);

  const handleRefresh = () => {
    onRefresh(forceRefresh);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Refresh Cost Analysis</DialogTitle>
          <DialogDescription>
            Configure refresh options for the cost analysis data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
            <div>
              <Label htmlFor="force-refresh" className="text-sm font-medium">
                Force refresh
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Bypass the 24-hour cache and fetch fresh data
              </p>
            </div>
            <Switch
              id="force-refresh"
              checked={forceRefresh}
              onCheckedChange={setForceRefresh}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SourcesCard = ({ checks, onViewDetails }) => {
  const sourceConfig = [
    { key: 'ce', label: 'Cost Explorer', icon: BarChart3, checkId: 'ce.enabled' },
    { key: 'anomaly', label: 'Anomaly Detection', icon: AlertCircle, checkId: 'ce.anomaly_detection.configured' },
    { key: 'coh', label: 'Cost Optimization Hub', icon: Lightbulb, checkId: 'cost_optimization_hub.enabled' },
    { key: 'co', label: 'Compute Optimizer', icon: Zap, checkId: 'compute_optimizer.enabled' },
  ];

  const getSourceStatus = (checkId) => {
    const check = checks.find((c) => c.checkId === checkId);
    if (!check) return 'unknown';
    return normalizeStatus(check.status);
  };

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Data Sources</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onViewDetails} className="h-7 text-xs">
            <Eye className="h-3 w-3 mr-1" />
            Details
          </Button>
        </div>
        <div className="space-y-2">
          {sourceConfig.map(({ key, label, icon: Icon, checkId }) => {
            const status = getSourceStatus(checkId);
            return (
              <div
                key={key}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <StatusIcon status={status} className="h-4 w-4" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const AggregateSourcesCard = ({
  checks,
  environmentCount,
  loadedCount,
  failedEnvironments,
  onViewDetails,
  title = 'Environment Coverage',
  statLabel = 'Loaded',
  statusDescription = '',
  entityLabel = 'environment',
  provider = 'aws',
}) => {
  const sourceConfig = provider === 'azure'
    ? [
        { key: 'usage', label: 'Cost Management', icon: BarChart3, checkId: 'azure_costmanagement.usage' },
        { key: 'billing', label: 'Billing', icon: Database, checkId: 'azure_billing.accounts' },
        { key: 'advisor', label: 'Advisor Cost', icon: Lightbulb, checkId: 'azure_advisor.cost_recommendations' },
        { key: 'budgets', label: 'Budgets', icon: Zap, checkId: 'azure_consumption.budgets' },
      ]
    : [
        { key: 'ce', label: 'Cost Explorer', icon: BarChart3, checkId: 'ce.enabled' },
        { key: 'anomaly', label: 'Anomaly Detection', icon: AlertCircle, checkId: 'ce.anomaly_detection.configured' },
        { key: 'coh', label: 'Cost Optimization Hub', icon: Lightbulb, checkId: 'cost_optimization_hub.enabled' },
        { key: 'co', label: 'Compute Optimizer', icon: Zap, checkId: 'compute_optimizer.enabled' },
      ];

  const getCheckSummary = (checkId) => {
    const matchingChecks = checks.filter((check) => check.checkId === checkId);
    const healthy = matchingChecks.filter((check) => normalizeStatus(check.status) === 'healthy').length;
    const problem = matchingChecks.filter((check) => normalizeStatus(check.status) === 'problem').length;
    const error = matchingChecks.filter((check) => normalizeStatus(check.status) === 'error').length;

    return { healthy, problem, error };
  };

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{title}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onViewDetails} className="h-7 text-xs">
            <Eye className="h-3 w-3 mr-1" />
            Details
          </Button>
        </div>

        <div className="mb-3 rounded-lg border bg-gray-50 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{statLabel}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {loadedCount}/{environmentCount}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {statusDescription ||
              (failedEnvironments.length > 0
                ? `${failedEnvironments.length} ${entityLabel}${failedEnvironments.length === 1 ? '' : 's'} failed to load`
                : `All selected ${entityLabel}${loadedCount === 1 ? '' : 's'} loaded successfully`)}
          </div>
        </div>

        <div className="space-y-2">
          {sourceConfig.map(({ key, label, icon: Icon, checkId }) => {
            const summary = getCheckSummary(checkId);
            return (
              <div
                key={key}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <div className="text-xs text-gray-600 text-right">
                  <div>{summary.healthy}/{loadedCount} healthy</div>
                  {(summary.problem > 0 || summary.error > 0) && (
                    <div className="text-amber-600">
                      {summary.problem + summary.error} need attention
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const EnvironmentSummaryTable = ({ data }) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Environment</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Total Spend</TableHead>
            <TableHead className="text-right">Daily Avg</TableHead>
            <TableHead>Top Service</TableHead>
            <TableHead className="text-right">Anomalies</TableHead>
            <TableHead className="text-right">Savings</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((environment) => (
            <TableRow key={environment.permissionProfileId}>
              <TableCell>
                <div className={`font-medium ${environment.isBreakdownRow ? 'text-gray-700 pl-4' : 'text-gray-900'}`}>
                  {environment.isBreakdownRow ? `- ${environment.name || 'Account'}` : (environment.name || 'Environment')}
                </div>
                {environment.parentName && environment.type === 'aws org account' && (
                  <div className="text-xs text-gray-500">{environment.parentName}</div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {getEnvironmentTypeLabel(environment.type)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm">{environment.accountId || 'N/A'}</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(environment.totalSpend) || '$0'}
              </TableCell>
              <TableCell className="text-right text-gray-700">
                {formatCurrency(environment.dailyAverage) || '$0'}
              </TableCell>
              <TableCell>{environment.topService || 'N/A'}</TableCell>
              <TableCell className="text-right">{environment.anomalyCount ?? 'N/A'}</TableCell>
              <TableCell className="text-right text-emerald-600 font-medium">
                {environment.estimatedSavings === null
                  ? 'N/A'
                  : (formatCurrency(annualizeMonthlySavings(environment.estimatedSavings)) || '$0')}
              </TableCell>
              <TableCell className={`text-sm ${getFreshnessTextClass(environment.generatedAt)}`}>
                {formatRelativeTime(environment.generatedAt)}
                {getFreshnessSuffix(environment.generatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const ExpandedCostViewModal = ({
  open,
  onClose,
  view,
  dailyTotalData,
  serviceTotals,
  environmentSummaries,
  spendRange,
  trendTitle = 'Portfolio Spend Trend',
  servicesTitle = 'Portfolio Spend by Service',
  summaryChartTitle = 'Cost by Environment',
  summaryTableTitle = 'Environment Cost Summary',
  summaryRowLabel = 'environment and account rows',
}) => {
  const content = (() => {
    switch (view) {
      case 'trend':
        return {
          title: trendTitle,
          description: `${spendRange?.startDate || 'N/A'} to ${spendRange?.endDate || 'N/A'}`,
          body: <SpendTrendChart data={dailyTotalData} height={520} />,
        };
      case 'services':
        return {
          title: servicesTitle,
          description: `Showing all ${serviceTotals.length} service${serviceTotals.length === 1 ? '' : 's'}`,
          body: <ServiceSpendChart data={serviceTotals} height={Math.max(serviceTotals.length * 42, 420)} limit={null} />,
        };
      case 'environment-chart':
        return {
          title: summaryChartTitle,
          description: `Showing all ${environmentSummaries.length} ${summaryRowLabel}`,
          body: <EnvironmentSpendChart data={environmentSummaries} />,
        };
      case 'environments':
        return {
          title: summaryTableTitle,
          description: `Showing all ${environmentSummaries.length} ${summaryRowLabel}`,
          body: <EnvironmentSummaryTable data={environmentSummaries} />,
        };
      default:
        return null;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden bg-white">
        <DialogHeader>
          <DialogTitle>{content?.title || 'Expanded Cost View'}</DialogTitle>
          <DialogDescription>{content?.description || ''}</DialogDescription>
        </DialogHeader>
        <div className="overflow-auto max-h-[74vh] pr-1">
          {content?.body}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ChecksModal = ({ open, onClose, checks }) => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showHealthy, setShowHealthy] = useState(false);
  const hasEnvironmentColumn = useMemo(
    () => checks.some((check) => check.environmentName),
    [checks]
  );

  const categories = useMemo(() => {
    const cats = new Set(['all']);
    checks.forEach((check) => {
      if (check.category) cats.add(check.category);
    });
    return Array.from(cats);
  }, [checks]);

  const filteredChecks = useMemo(() => {
    let result = checks;
    if (!showHealthy) {
      result = result.filter((check) => normalizeStatus(check.status) !== 'healthy');
    }
    if (categoryFilter !== 'all') {
      result = result.filter((check) => check.category === categoryFilter);
    }
    return result;
  }, [checks, categoryFilter, showHealthy]);

  const healthyCount = useMemo(() => 
    checks.filter((c) => normalizeStatus(c.status) === 'healthy').length,
  [checks]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            All Configuration Checks
          </DialogTitle>
          <DialogDescription>
            Status of all cost analysis checks and configurations
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between py-2 gap-4">
          <div className="text-sm text-gray-600">
            Showing {filteredChecks.length} of {checks.length} checks
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="show-healthy"
                checked={showHealthy}
                onCheckedChange={setShowHealthy}
                className="scale-90"
              />
              <Label htmlFor="show-healthy" className="text-sm text-gray-600 whitespace-nowrap">
                Show healthy ({healthyCount})
              </Label>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-8">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {titleCase(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[60vh] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-24">Status</TableHead>
                {hasEnvironmentColumn && <TableHead className="w-40">Environment</TableHead>}
                <TableHead className="w-48">Check</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChecks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasEnvironmentColumn ? 5 : 4} className="text-center py-8 text-gray-500">
                    {showHealthy ? 'No checks match the current filter' : 'All checks are healthy'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredChecks.map((check, index) => (
                  <TableRow
                    key={`${check.permissionProfileId || 'global'}-${check.checkId}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    <TableCell>
                      <StatusBadge status={check.status} />
                    </TableCell>
                    {hasEnvironmentColumn && (
                      <TableCell>
                        <div className="font-medium text-gray-900 text-sm">{check.environmentName || 'N/A'}</div>
                        {check.environmentAccountId && (
                          <div className="text-xs text-gray-500 mt-0.5 font-mono">
                            {check.environmentAccountId}
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="font-medium text-gray-900 text-sm">
                        {check.checkName || check.checkId}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 font-mono">{check.checkId}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {check.category || 'other'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-700 whitespace-normal">{check.summary || 'N/A'}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TablePagination = ({ page, totalPages, totalItems, itemLabel, onPageChange }) => {
  if (totalItems <= TABLE_PAGE_SIZE) return null;

  return (
    <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 border-t flex items-center justify-between gap-3">
      <span>
        Page {page} of {totalPages} · {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

const RecommendationDetailsDialog = ({ open, onClose, recommendation }) => {
  if (!recommendation) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden bg-white">
        <DialogHeader>
          <DialogTitle>{recommendation.title || 'Recommendation details'}</DialogTitle>
          <DialogDescription>{recommendation.description || 'Full recommendation payload'}</DialogDescription>
        </DialogHeader>
        <div className="overflow-auto max-h-[65vh] space-y-4 pr-1">
          {recommendation.summary && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-900 mb-1">Summary</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {recommendation.summary}
              </div>
            </div>
          )}
          <div className="rounded-lg border border-gray-200 bg-slate-950 text-slate-100 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-300 mb-2">
              Raw payload
            </div>
            <pre className="text-xs whitespace-pre-wrap break-all overflow-x-auto">
              {JSON.stringify(recommendation.payload, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const RecommendationTableDialog = ({ open, onClose, title, description, children }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-[95vw] w-[95vw] max-h-[92vh] overflow-hidden bg-white">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="overflow-auto max-h-[78vh] pr-1">
        {children}
      </div>
    </DialogContent>
  </Dialog>
);

const getRecommendationEnvironmentDisplay = (recommendation) => {
  const primary =
    recommendation?.recommendationAccountName ||
    recommendation?.recommendationAccountId ||
    recommendation?.environmentName ||
    recommendation?.environmentAccountId ||
    'N/A';

  let secondary = '';

  if (
    recommendation?.recommendationAccountId &&
    recommendation?.recommendationAccountName &&
    recommendation.recommendationAccountName !== recommendation.recommendationAccountId
  ) {
    secondary = recommendation.recommendationAccountId;
  } else if (
    recommendation?.environmentAccountId &&
    recommendation?.environmentName &&
    recommendation.environmentName !== recommendation.environmentAccountId
  ) {
    secondary = recommendation.environmentAccountId;
  }

  return {
    primary,
    secondary,
  };
};

const RecommendationsSection = ({ rightsizing, savingsPlans, costOptimizationHub, provider = 'aws' }) => {
  const rightsizingRecs = Array.isArray(rightsizing?.recommendations)
    ? rightsizing.recommendations
    : [];
  const savingsPlansRecs = getSavingsPlansRecommendationItems(savingsPlans?.recommendationsByType);
  const cohRecs = Array.isArray(costOptimizationHub?.recommendations) ? costOptimizationHub.recommendations : [];
  const isAzureProvider = provider === 'azure';
  const [expandedTableKey, setExpandedTableKey] = useState(null);
  const recommendationTabs = useMemo(
    () =>
      [
        {
          key: 'rightsizing',
          label: isAzureProvider ? 'Advisor Rightsize' : 'Rightsizing',
          count: rightsizingRecs.length,
          content: <RightsizingTable recommendations={rightsizingRecs} provider={provider} />,
          expandedTitle: isAzureProvider ? 'Azure Advisor Rightsizing Recommendations' : 'Rightsizing Recommendations',
          order: 0,
        },
        {
          key: 'savings',
          label: isAzureProvider ? 'Benefits' : 'Savings Plans',
          count: savingsPlansRecs.length,
          content: <SavingsPlansTable recommendations={savingsPlansRecs} provider={provider} />,
          expandedTitle: isAzureProvider ? 'Azure Benefit Recommendations' : 'Savings Plans Recommendations',
          order: 1,
        },
        {
          key: 'coh',
          label: isAzureProvider ? 'Advisor Cost' : 'Cost Opt Hub',
          count: cohRecs.length,
          content: <CostOptimizationHubTable recommendations={cohRecs} provider={provider} />,
          expandedTitle: isAzureProvider ? 'Azure Advisor Cost Recommendations' : 'Cost Optimization Hub Recommendations',
          order: 2,
        },
      ].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.order - b.order;
      }),
    [cohRecs, isAzureProvider, provider, rightsizingRecs, savingsPlansRecs]
  );
  const firstTabWithRecommendations = recommendationTabs.find((tab) => tab.count > 0)?.key || recommendationTabs[0]?.key || '';
  const [selectedTab, setSelectedTab] = useState(firstTabWithRecommendations);
  const selectedRecommendationTab = recommendationTabs.find((tab) => tab.key === selectedTab) || null;
  const expandedRecommendationTab =
    recommendationTabs.find((tab) => tab.key === expandedTableKey) || null;

  const totalRecommendations = rightsizingRecs.length + savingsPlansRecs.length + cohRecs.length;

  useEffect(() => {
    const hasCurrentTab = recommendationTabs.some((tab) => tab.key === selectedTab);
    const currentTabHasRecommendations = recommendationTabs.some(
      (tab) => tab.key === selectedTab && tab.count > 0
    );
    const hasAnyRecommendations = recommendationTabs.some((tab) => tab.count > 0);

    if (!hasCurrentTab || (hasAnyRecommendations && !currentTabHasRecommendations)) {
      setSelectedTab(firstTabWithRecommendations);
    }
  }, [firstTabWithRecommendations, recommendationTabs, selectedTab]);

  if (totalRecommendations === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Lightbulb className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <div className="text-gray-600 font-medium">No recommendations available</div>
          <div className="text-sm text-gray-500 mt-1">
            {isAzureProvider
              ? "Azure Advisor hasn't generated any cost optimization recommendations yet."
              : "AWS Cost Explorer hasn't generated any optimization recommendations yet."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              {recommendationTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
                  {tab.label} ({tab.count})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedTableKey(selectedTab)}
            className="shrink-0"
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Full screen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recommendationTabs.find((tab) => tab.key === selectedTab)?.content || null}
      </CardContent>
      </Card>
      <RecommendationTableDialog
        open={Boolean(expandedTableKey)}
        onClose={() => setExpandedTableKey(null)}
        title={expandedRecommendationTab?.expandedTitle || 'Recommendation Table'}
        description={
          expandedRecommendationTab
            ? `Showing ${expandedRecommendationTab.count} recommendation${expandedRecommendationTab.count === 1 ? '' : 's'}`
            : ''
        }
      >
        {expandedRecommendationTab?.content || null}
      </RecommendationTableDialog>
    </>
  );
};

const AnomaliesSection = ({ anomalies, accountId }) => {
  if (!anomalies || anomalies.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Cost Anomalies Detected
          </CardTitle>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'}
          </Badge>
        </div>
        <CardDescription>
          Unusual spending patterns detected by AWS Cost Anomaly Detection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AnomaliesTable anomalies={anomalies} accountId={accountId} />
      </CardContent>
    </Card>
  );
};

const RightsizingTable = ({ recommendations, provider = 'aws' }) => {
  const [page, setPage] = useState(1);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const sortedRecommendations = useMemo(
    () => sortRecommendationsByEstimatedSavings(recommendations, getRightsizingEstimatedSavings),
    [recommendations]
  );
  const hasEnvironmentScopeColumn = sortedRecommendations.some(
    (recommendation) =>
      recommendation.recommendationAccountId ||
      recommendation.recommendationAccountName ||
      recommendation.environmentName ||
      recommendation.environmentAccountId
  );
  const paginated = paginateItems(sortedRecommendations, page);

  useEffect(() => {
    if (page !== paginated.currentPage) {
      setPage(paginated.currentPage);
    }
  }, [page, paginated.currentPage]);

  if (sortedRecommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {provider === 'azure'
          ? 'No Azure Advisor rightsizing recommendations available'
          : 'No rightsizing recommendations available'}
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {hasEnvironmentScopeColumn && <TableHead>Environment</TableHead>}
              <TableHead>Resource</TableHead>
              <TableHead>Current Type</TableHead>
              <TableHead>Recommended</TableHead>
              <TableHead className="text-right">Est. Savings</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.items.map((rec, idx) => {
            const resourceId =
              rec.currentInstance?.resourceId ||
              rec.CurrentInstance?.ResourceId ||
              rec.resourceId ||
              rec.instanceId ||
              `rec-${idx}`;
            const currentType =
              rec.currentInstance?.instanceType ||
              rec.CurrentInstance?.ResourceDetails?.EC2InstanceDetails?.InstanceType ||
              rec.currentInstanceType ||
              'N/A';
            const recommendedType =
              rec.modifyRecommendationDetail?.targetInstances?.[0]?.instanceType ||
              rec.ModifyRecommendationDetail?.TargetInstances?.[0]?.ResourceDetails?.EC2InstanceDetails?.InstanceType ||
              rec.recommendedInstanceType ||
              rec.targetInstanceType ||
              'N/A';
            const savings = getRightsizingEstimatedSavings(rec);
            const annualSavings = annualizeMonthlySavings(savings) || 0;
            const action =
              rec.rightsizingType ||
              rec.RightsizingType ||
              rec.findingReasonCodes?.[0] ||
              rec.FindingReasonCodes?.[0] ||
              'Modify';
            const recommendationEnvironment = getRecommendationEnvironmentDisplay(rec);

            return (
              <TableRow key={resourceId + idx}>
                {hasEnvironmentScopeColumn && (
                  <TableCell>
                    <div className="font-medium text-sm text-gray-900">
                      {recommendationEnvironment.primary}
                    </div>
                    {recommendationEnvironment.secondary && (
                      <div className="text-xs text-gray-500 font-mono">
                        {recommendationEnvironment.secondary}
                      </div>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-sm truncate max-w-[200px]">{resourceId}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{currentType}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    {recommendedType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(annualSavings)}/yr
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {titleCase(action)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setSelectedRecommendation({
                        title: `Rightsizing recommendation for ${resourceId}`,
                        description: [
                          recommendationEnvironment.primary !== 'N/A'
                            ? `Environment: ${recommendationEnvironment.primary}${recommendationEnvironment.secondary ? ` · ${recommendationEnvironment.secondary}` : ''}`
                            : '',
                        ].filter(Boolean).join('\n') || 'Full rightsizing recommendation payload',
                        summary: [
                          `Current type: ${currentType}`,
                          `Recommended type: ${recommendedType}`,
                          `Action: ${titleCase(action)}`,
                          `Estimated savings: ${formatCurrency(annualSavings)}/yr`,
                        ].join('\n'),
                        payload: rec,
                      })
                    }
                    title="View full recommendation"
                    aria-label="View full recommendation"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
          <TablePagination
          page={paginated.currentPage}
          totalPages={paginated.totalPages}
          totalItems={sortedRecommendations.length}
          itemLabel="recommendations"
          onPageChange={setPage}
        />
      </div>
      <RecommendationDetailsDialog
        open={Boolean(selectedRecommendation)}
        onClose={() => setSelectedRecommendation(null)}
        recommendation={selectedRecommendation}
      />
    </>
  );
};

const SavingsPlansTable = ({ recommendations, provider = 'aws' }) => {
  const [page, setPage] = useState(1);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const sortedRecommendations = useMemo(
    () => sortRecommendationsByEstimatedSavings(recommendations, getSavingsPlansEstimatedSavings),
    [recommendations]
  );
  const hasEnvironmentScopeColumn = sortedRecommendations.some(
    (recommendation) =>
      recommendation.recommendationAccountId ||
      recommendation.recommendationAccountName ||
      recommendation.environmentName ||
      recommendation.environmentAccountId
  );
  const paginated = paginateItems(sortedRecommendations, page);

  useEffect(() => {
    if (page !== paginated.currentPage) {
      setPage(paginated.currentPage);
    }
  }, [page, paginated.currentPage]);

  if (sortedRecommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {provider === 'azure'
          ? 'No Azure savings plan or reservation recommendations available'
          : 'No Savings Plans recommendations available'}
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {hasEnvironmentScopeColumn && <TableHead>Environment</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Payment Option</TableHead>
              <TableHead className="text-right">Hourly Commitment</TableHead>
              <TableHead className="text-right">Est. Savings</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.items.map((rec, idx) => {
            const savingsType =
              rec.savingsPlansType || rec.SavingsPlansType || rec.savingsPlanType || (provider === 'azure' ? 'Azure Benefit' : 'Compute');
            const termInYearsRaw = rec.termInYears || rec.TermInYears || '';
            const term =
              termInYearsRaw === 'ONE_YEAR'
                ? '1 Year'
                : termInYearsRaw === 'THREE_YEARS'
                  ? '3 Years'
                  : termInYearsRaw
                    ? titleCase(String(termInYearsRaw).replace(/_/g, ' '))
                    : 'N/A';
            const paymentOption = rec.paymentOption || rec.PaymentOption || 'NO_UPFRONT';
            const hourlyCommitment = getSavingsPlansHourlyCommitment(rec);
            const savings = getSavingsPlansEstimatedSavings(rec);
            const annualSavings = annualizeMonthlySavings(savings) || 0;
            const recommendationEnvironment = getRecommendationEnvironmentDisplay(rec);

            return (
              <TableRow key={`sp-${paginated.startIndex + idx}`}>
                {hasEnvironmentScopeColumn && (
                  <TableCell>
                    <div className="font-medium text-sm text-gray-900">
                      {recommendationEnvironment.primary}
                    </div>
                    {recommendationEnvironment.secondary && (
                      <div className="text-xs text-gray-500 font-mono">
                        {recommendationEnvironment.secondary}
                      </div>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{titleCase(savingsType)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{term}</Badge>
                </TableCell>
                <TableCell>
                    <span className="text-sm">{titleCase(String(paymentOption).replace(/_/g, ' '))}</span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(hourlyCommitment)}/hr
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(annualSavings)}/yr
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setSelectedRecommendation({
                        title: `${titleCase(savingsType)} recommendation`,
                        description: [
                          recommendationEnvironment.primary !== 'N/A'
                            ? `Environment: ${recommendationEnvironment.primary}${recommendationEnvironment.secondary ? ` · ${recommendationEnvironment.secondary}` : ''}`
                            : '',
                        ].filter(Boolean).join('\n') || 'Full Savings Plans recommendation payload',
                        summary: [
                          `Type: ${titleCase(savingsType)}`,
                          `Term: ${term}`,
                          `Payment option: ${titleCase(String(paymentOption).replace(/_/g, ' '))}`,
                          `Hourly commitment: ${formatCurrency(hourlyCommitment)}/hr`,
                          `Estimated savings: ${formatCurrency(annualSavings)}/yr`,
                        ].join('\n'),
                        payload: rec,
                      })
                    }
                    title="View full recommendation"
                    aria-label="View full recommendation"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
        <TablePagination
          page={paginated.currentPage}
          totalPages={paginated.totalPages}
          totalItems={sortedRecommendations.length}
          itemLabel="recommendations"
          onPageChange={setPage}
        />
      </div>
      <RecommendationDetailsDialog
        open={Boolean(selectedRecommendation)}
        onClose={() => setSelectedRecommendation(null)}
        recommendation={selectedRecommendation}
      />
    </>
  );
};

const AnomaliesTable = ({ anomalies, accountId }) => {
  const hasEnvironmentColumn = anomalies.some((anomaly) => anomaly.environmentName);

  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No anomalies detected in the analysis period
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {hasEnvironmentColumn && <TableHead>Environment</TableHead>}
            <TableHead>Service</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Impact</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anomalies.slice(0, 20).map((anomaly, idx) => {
            const anomalyId = anomaly.AnomalyId || anomaly.anomalyId || `anomaly-${idx}`;
            const service = anomaly.DimensionValue || anomaly.dimensionValue || 
              anomaly.RootCauses?.[0]?.Service || 'Multiple Services';
            const startDate = anomaly.AnomalyStartDate || anomaly.anomalyStartDate || '';
            const endDate = anomaly.AnomalyEndDate || anomaly.anomalyEndDate || '';
            const impact = anomaly.Impact || anomaly.impact || {};
            const totalImpact = toNumber(impact.TotalImpact) || toNumber(impact.totalImpact) || 0;
            const totalActual = toNumber(impact.TotalActualSpend) || toNumber(impact.totalActualSpend) || 0;
            const totalExpected = toNumber(impact.TotalExpectedSpend) || toNumber(impact.totalExpectedSpend) || 0;
            const impactPercent = toNumber(impact.TotalImpactPercentage) || toNumber(impact.totalImpactPercentage) || 0;
            const score = anomaly.AnomalyScore || anomaly.anomalyScore || {};
            const maxScore = toNumber(score.MaxScore) || toNumber(score.maxScore) || 0;
            const consoleUrl = getAnomalyConsoleUrl(anomaly, accountId);

            return (
              <TableRow key={anomalyId}>
                {hasEnvironmentColumn && (
                  <TableCell>
                    <div className="font-medium text-sm text-gray-900">{anomaly.environmentName || 'N/A'}</div>
                    {anomaly.environmentAccountId && (
                      <div className="text-xs text-gray-500 font-mono">{anomaly.environmentAccountId}</div>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="font-medium text-sm max-w-[180px] truncate">{service}</div>
                      <div className="text-xs text-gray-500 font-mono">{anomalyId.slice(0, 8)}...</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {formatFullDate(startDate)}
                    {endDate && endDate !== startDate && (
                      <span className="text-gray-400"> → {formatFullDate(endDate)}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm text-gray-600">{formatCurrency(totalExpected)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-medium">{formatCurrency(totalActual)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-medium text-amber-600">{formatCurrency(totalImpact)}</span>
                    {impactPercent > 0 && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        +{impactPercent.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className={`w-2 h-2 rounded-full ${maxScore > 0.7 ? 'bg-red-500' : maxScore > 0.4 ? 'bg-amber-500' : 'bg-green-500'}`} />
                    <span className="text-sm font-mono">{maxScore.toFixed(2)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {consoleUrl && (
                    <a
                      href={consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="View in AWS Console"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {anomalies.length > 20 && (
        <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 border-t">
          Showing 20 of {anomalies.length} anomalies
        </div>
      )}
    </div>
  );
};

const CostOptimizationHubTable = ({ recommendations, provider = 'aws' }) => {
  const [page, setPage] = useState(1);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const sortedRecommendations = useMemo(
    () => sortRecommendationsByEstimatedSavings(recommendations, getCostOptimizationHubEstimatedSavings),
    [recommendations]
  );
  const hasEnvironmentScopeColumn = sortedRecommendations.some(
    (recommendation) =>
      recommendation.recommendationAccountId ||
      recommendation.recommendationAccountName ||
      recommendation.environmentName ||
      recommendation.environmentAccountId
  );
  const paginated = paginateItems(sortedRecommendations, page);

  useEffect(() => {
    if (page !== paginated.currentPage) {
      setPage(paginated.currentPage);
    }
  }, [page, paginated.currentPage]);

  if (sortedRecommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {provider === 'azure'
          ? 'No Azure Advisor cost recommendations available'
          : 'No Cost Optimization Hub recommendations available'}
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {hasEnvironmentScopeColumn && <TableHead>Environment</TableHead>}
              <TableHead>Recommendation</TableHead>
              <TableHead>Resource Type</TableHead>
              <TableHead>Region</TableHead>
              <TableHead className="text-right">Est. Savings</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.items.map((rec, idx) => {
            const id = rec.recommendationId || rec.id || `coh-${idx}`;
            const summary =
              rec.recommendationSummary ||
              rec.shortDescription?.solution ||
              rec.shortDescription?.problem ||
              rec.currentResourceSummary ||
              rec.recommendedResourceSummary ||
              rec.actionType ||
              'Optimization';
            const resourceType = rec.currentResourceType || rec.resourceType || rec.impactedField || 'N/A';
            const region = rec.region || 'N/A';
            const savings = getCostOptimizationHubEstimatedSavings(rec);
            const annualSavings = annualizeMonthlySavings(savings) || 0;
            const source = rec.source || 'Cost Optimization Hub';
            const recommendationEnvironment = getRecommendationEnvironmentDisplay(rec);

            return (
              <TableRow key={id}>
                {hasEnvironmentScopeColumn && (
                  <TableCell>
                    <div className="font-medium text-sm text-gray-900">
                      {recommendationEnvironment.primary}
                    </div>
                    {recommendationEnvironment.secondary && (
                      <div className="text-xs text-gray-500 font-mono">
                        {recommendationEnvironment.secondary}
                      </div>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="max-w-xs truncate font-medium">{summary}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{resourceType}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">{region}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-emerald-600">{formatCurrency(annualSavings)}/yr</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-500">{source}</span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setSelectedRecommendation({
                        title: summary,
                        description: [
                          recommendationEnvironment.primary !== 'N/A'
                            ? `Environment: ${recommendationEnvironment.primary}${recommendationEnvironment.secondary ? ` · ${recommendationEnvironment.secondary}` : ''}`
                            : '',
                        ].filter(Boolean).join('\n') || 'Full Cost Optimization Hub recommendation payload',
                        summary: [
                          `Resource type: ${resourceType}`,
                          `Region: ${region}`,
                          `Estimated savings: ${formatCurrency(annualSavings)}/yr`,
                          `Source: ${source}`,
                          `Action: ${rec.actionType || 'N/A'}`,
                        ].join('\n'),
                        payload: rec,
                      })
                    }
                    title="View full recommendation"
                    aria-label="View full recommendation"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
        <TablePagination
          page={paginated.currentPage}
          totalPages={paginated.totalPages}
          totalItems={sortedRecommendations.length}
          itemLabel="recommendations"
          onPageChange={setPage}
        />
      </div>
      <RecommendationDetailsDialog
        open={Boolean(selectedRecommendation)}
        onClose={() => setSelectedRecommendation(null)}
        recommendation={selectedRecommendation}
      />
    </>
  );
};

export default function CostDashboard() {
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.auth);
  const scopedEnvironmentProfiles = useSelector(selectWorkspaceScopedEnvironmentProfiles);
  const environmentCostRequestRecords = useSelector(selectEnvironmentCostRequestsById);
  const environmentCostResultRecords = useSelector(selectEnvironmentCostResultsById);
  const scannerUpdatesConnectionId = useSelector(selectScannerUpdatesConnectionId);

  const [scope, setScope] = useState(ALL_ENVIRONMENTS_SCOPE);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [checksModalOpen, setChecksModalOpen] = useState(false);
  const [expandedView, setExpandedView] = useState(null);
  const inflightCostFetchIdsRef = React.useRef(new Set());
  const autoCheckedCostScanIdsRef = React.useRef(new Set());
  const autoStartedCostScanIdsRef = React.useRef(new Set());

  const costScopeMetadata = useMemo(
    () => buildCostScopeMetadata(scopedEnvironmentProfiles || []),
    [scopedEnvironmentProfiles]
  );
  const environments = costScopeMetadata.scopeOptions;
  const aggregateSourceEnvironments = costScopeMetadata.aggregateSources;
  const excludedLinkedAccountProfiles = costScopeMetadata.excludedLinkedAccountProfiles;

  useEffect(() => {
    if (environments.length === 0) {
      setScope(ALL_ENVIRONMENTS_SCOPE);
      setReport(null);
      return;
    }

    if (scope === ALL_ENVIRONMENTS_SCOPE && environments.length > 1) {
      return;
    }

    const validEnvironmentScopes = new Set(
      environments.map((environment) => `environment:${environment.permissionProfileId}`)
    );

    if (scope !== ALL_ENVIRONMENTS_SCOPE && validEnvironmentScopes.has(scope)) {
      return;
    }

    setScope(
      environments.length > 1
        ? ALL_ENVIRONMENTS_SCOPE
        : `environment:${environments[0].permissionProfileId}`
    );
  }, [environments, scope]);

  const selectedEnvironmentId = useMemo(
    () => (scope.startsWith('environment:') ? scope.slice('environment:'.length) : ''),
    [scope]
  );
  const isAggregateScope = scope === ALL_ENVIRONMENTS_SCOPE;
  const selectedEnvironment = useMemo(
    () => environments.find((env) => env.permissionProfileId === selectedEnvironmentId) || null,
    [environments, selectedEnvironmentId]
  );
  const isOrganizationScope = !isAggregateScope && selectedEnvironment?.type === 'aws org';
  const isAzureTenantScope = !isAggregateScope && selectedEnvironment?.type === 'azure tenant';
  const usesAggregateStyleLayout = isAggregateScope || isOrganizationScope || isAzureTenantScope;
  const orderedEnvironments = useMemo(() => {
    return [...environments].sort((left, right) => {
      const leftPriority = left?.type === 'aws org' ? 0 : 1;
      const rightPriority = right?.type === 'aws org' ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return String(left?.name || '').localeCompare(String(right?.name || ''));
    });
  }, [environments]);
  const selectedScopeLabel = useMemo(() => {
    if (isAggregateScope) {
      return `All Environments${environments.length > 1 ? ` (${environments.length})` : ''}`;
    }
    if (!selectedEnvironment) return 'Select scope';
    if (selectedEnvironment.type === 'aws org') {
      return `AWS Organization: ${selectedEnvironment.name}`;
    }
    if (selectedEnvironment.type === 'azure tenant') {
      return `Azure Tenant: ${selectedEnvironment.name}`;
    }
    if (selectedEnvironment.type === 'azure subscription') {
      return `Azure Subscription: ${selectedEnvironment.name}`;
    }
    return selectedEnvironment.name || 'Cloud Environment';
  }, [environments.length, isAggregateScope, selectedEnvironment]);
  const selectedEnvironmentSourceId =
    selectedEnvironment?.sourcePermissionProfileId || selectedEnvironmentId;
  const selectedAzureTenantSourceEnvironments = useMemo(() => {
    if (!selectedEnvironment || selectedEnvironment.type !== 'azure tenant') return [];
    const tenantSourceId = String(
      selectedEnvironment.sourcePermissionProfileId || selectedEnvironment.permissionProfileId || ''
    ).trim();
    const tenantSource = tenantSourceId
      ? [{
          ...selectedEnvironment,
          permissionProfileId: tenantSourceId,
          sourcePermissionProfileId: tenantSourceId,
          name: `${selectedEnvironment.name} Shared`,
          type: 'azure tenant cost',
        }]
      : [];
    const subscriptionSources = (Array.isArray(selectedEnvironment.azureSubscriptionProfiles)
      ? selectedEnvironment.azureSubscriptionProfiles
      : [])
      .map((subscriptionProfile) => ({
        ...subscriptionProfile,
        permissionProfileId: String(subscriptionProfile?.permissionProfileId || '').trim(),
        sourcePermissionProfileId: String(subscriptionProfile?.permissionProfileId || '').trim(),
        cloudProvider: 'azure',
        type: 'azure subscription',
      }))
      .filter((subscriptionProfile) => subscriptionProfile.permissionProfileId);
    return [...subscriptionSources, ...tenantSource];
  }, [selectedEnvironment]);
  const selectedEnvironmentAllowedAccountIds = useMemo(() => {
    if (selectedEnvironment?.type !== 'aws org') return null;

    const discoveredMemberAccountIds =
      selectedEnvironment?.memberAccountIds instanceof Set
        ? Array.from(selectedEnvironment.memberAccountIds)
        : [];

    if (discoveredMemberAccountIds.length === 0) {
      return null;
    }

    const allowedAccountIds = new Set(
      discoveredMemberAccountIds
        .map((accountId) => String(accountId || '').trim())
        .filter(Boolean)
    );

    const managementAccountId = String(selectedEnvironment?.accountId || '').trim();
    if (managementAccountId) {
      allowedAccountIds.add(managementAccountId);
    }

    return allowedAccountIds.size > 0 ? allowedAccountIds : null;
  }, [selectedEnvironment]);
  const environmentCostResultsById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(environmentCostResultRecords || {}).map(([permissionProfileId, record]) => [
          permissionProfileId,
          record?.payload || null,
        ])
      ),
    [environmentCostResultRecords]
  );
  const scopedProfilesById = useMemo(
    () =>
      new Map(
        (scopedEnvironmentProfiles || []).map((profile) => [
          String(profile?.recordId || profile?.id || profile?.permissionProfileId || '').trim(),
          profile,
        ])
      ),
    [scopedEnvironmentProfiles]
  );

  const resolveEnvironmentCostReport = useCallback(
    async (permissionProfileId, forceRefresh = false) => {
      const normalizedProfileId = String(permissionProfileId || '').trim();
      if (!normalizedProfileId) {
        throw new Error('Missing environment id for cost analysis');
      }

      const existing = environmentCostResultsById?.[normalizedProfileId] || null;
      const profile = scopedProfilesById.get(normalizedProfileId) || null;
      if (existing) {
        return existing;
      }
      if (!forceRefresh && !existing && !isAzureProfile(profile) && !hasStoredCostMetadata(profile)) {
        return null;
      }
      if (inflightCostFetchIdsRef.current.has(normalizedProfileId)) {
        return null;
      }

      inflightCostFetchIdsRef.current.add(normalizedProfileId);
      try {
        const action = await dispatch(
          refreshEnvironmentCostAnalysis({
            permissionProfileId: normalizedProfileId,
            cloudProvider: isAzureProfile(profile) ? 'azure' : 'aws',
            forceRefresh,
            allowWhileLoading: true,
          })
        );

        if (refreshEnvironmentCostAnalysis.fulfilled.match(action)) {
          return action.payload?.payload || null;
        }

        if (action.meta?.condition) {
          return environmentCostResultsById?.[normalizedProfileId] || null;
        }

        throw new Error(
          action.payload || action.error?.message || 'Failed to load cost analysis'
        );
      } finally {
        inflightCostFetchIdsRef.current.delete(normalizedProfileId);
      }
    },
    [dispatch, environmentCostResultsById, scopedProfilesById]
  );

  const startAzureCostScanIfNeeded = useCallback(
    (environment) => {
      if (!environment || !scannerUpdatesConnectionId) return;
      const targets = dedupeCostTargets(getCostScanTargetsForEnvironment(environment));
      if (targets.length === 0) return;

      const launchKey = `azure:${targets.map((target) => target.permissionProfileId).sort().join(',')}`;
      if (autoStartedCostScanIdsRef.current.has(launchKey)) return;

      autoStartedCostScanIdsRef.current.add(launchKey);
      dispatch(
        launchEnvironmentCostScans({
          targets,
          forceRefresh: true,
          allowWhileLoading: true,
        })
      );
    },
    [dispatch, scannerUpdatesConnectionId]
  );

  const fetchReport = useCallback(
    async (forceRefresh = false) => {
      if (environments.length === 0) return;
      if (!isAggregateScope && !selectedEnvironmentId) return;

      setLoading(true);
      setError('');
      setReport(null);
      try {
        if (isAggregateScope) {
          const settledResponses = await Promise.allSettled(
            aggregateSourceEnvironments.map(async (environment) => {
              const response = await resolveEnvironmentCostReport(
                environment.permissionProfileId,
                forceRefresh
              );

              if (!response) {
                throw new Error('Cost analysis is still running');
              }

              if (response.ok === false) {
                throw new Error(response?.error || response?.message || 'Failed to load cost analysis');
              }

              return {
                environment,
                report: response,
              };
            })
          );

          const successfulReports = [];
          const failedEnvironments = [];
          const pendingEnvironments = [];

          settledResponses.forEach((result, index) => {
            const environment = aggregateSourceEnvironments[index];
            if (result.status === 'fulfilled') {
              successfulReports.push(result.value);
              return;
            }

            if (result.reason?.message === 'Cost analysis is still running') {
              pendingEnvironments.push(environment);
              return;
            }

            failedEnvironments.push({
              ...environment,
              error: result.reason?.message || 'Failed to load cost analysis',
            });
          });

          if (successfulReports.length === 0) {
            if (pendingEnvironments.length > 0 && failedEnvironments.length === 0) {
              return;
            }
            throw new Error('Failed to load cost analysis for all environments');
          }

          setReport(
            buildAggregatedCostReport({
              environments: aggregateSourceEnvironments,
              environmentReports: successfulReports,
              failedEnvironments,
              configuredScopeCount: environments.length,
              excludedLinkedAccountProfiles,
            })
          );

          if (failedEnvironments.length > 0) {
            toast.error(
              `Loaded ${successfulReports.length}/${aggregateSourceEnvironments.length} cost sources for aggregate cost view`
            );
          }
        } else {
          if (isAzureTenantScope) {
            const tenantSources = selectedAzureTenantSourceEnvironments;
            const settledResponses = await Promise.allSettled(
              tenantSources.map(async (environment) => {
                const response = await resolveEnvironmentCostReport(
                  environment.permissionProfileId,
                  forceRefresh
                );

                if (!response) {
                  throw new Error('Cost analysis is still running');
                }

                if (response.ok === false) {
                  throw new Error(response?.error || response?.message || 'Failed to load cost analysis');
                }

                return {
                  environment,
                  report: response,
                };
              })
            );

            const successfulReports = [];
            const failedEnvironments = [];
            const pendingEnvironments = [];

            settledResponses.forEach((result, index) => {
              const environment = tenantSources[index];
              if (result.status === 'fulfilled') {
                successfulReports.push(result.value);
                return;
              }

              if (result.reason?.message === 'Cost analysis is still running') {
                pendingEnvironments.push(environment);
                return;
              }

              failedEnvironments.push({
                ...environment,
                error: result.reason?.message || 'Failed to load cost analysis',
              });
            });

            if (successfulReports.length === 0) {
              if (pendingEnvironments.length > 0 && failedEnvironments.length === 0) {
                return;
              }
              startAzureCostScanIfNeeded(selectedEnvironment);
              setReport(null);
              return;
            }

            setReport(
              buildAggregatedCostReport({
                environments: tenantSources,
                environmentReports: successfulReports,
                failedEnvironments,
                configuredScopeCount: tenantSources.length,
                excludedLinkedAccountProfiles: [],
              })
            );
            return;
          }

          const response = await resolveEnvironmentCostReport(
            selectedEnvironmentSourceId,
            forceRefresh
          );

          if (!response) {
            if (selectedEnvironment?.cloudProvider === 'azure') {
              startAzureCostScanIfNeeded(selectedEnvironment);
            }
            setReport(null);
            return;
          }

          if (!response || response.ok === false) {
            throw new Error(response?.error || response?.message || 'Failed to load cost analysis');
          }

          setReport({
            ...response,
            aggregateContext: {
              isAggregate: false,
              totalEnvironmentCount: 1,
              loadedEnvironmentCount: 1,
              configuredScopeCount: 1,
              failedEnvironments: [],
              excludedLinkedAccountProfiles: [],
              environmentSummaries: [],
            },
          });
        }
      } catch (fetchError) {
        const message = fetchError?.message || 'Failed to load cost analysis';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [
      aggregateSourceEnvironments,
      environments.length,
      excludedLinkedAccountProfiles,
      isAggregateScope,
      isAzureTenantScope,
      resolveEnvironmentCostReport,
      selectedEnvironmentId,
      selectedEnvironment,
      selectedEnvironmentSourceId,
      selectedAzureTenantSourceEnvironments,
      startAzureCostScanIfNeeded,
    ]
  );

  useEffect(() => {
    if (environments.length === 0) return;
    if (!isAggregateScope && !selectedEnvironmentId) return;
    fetchReport(false);
  }, [environments.length, fetchReport, isAggregateScope, selectedEnvironmentId]);

  useEffect(() => {
    if (!scannerUpdatesConnectionId || environments.length === 0) return;

    const targets = isAggregateScope
      ? aggregateSourceEnvironments
      : selectedEnvironment
        ? [selectedEnvironment]
        : [];

    const scanTargets = dedupeCostTargets(targets.flatMap((environment) =>
      getCostScanTargetsForEnvironment(environment).map((target) => ({
        ...target,
        parentEnvironment: environment,
      }))
    ));

    scanTargets.forEach((target) => {
      const permissionProfileId = String(target?.permissionProfileId || '').trim();
      if (!permissionProfileId || target?.cloudProvider !== 'azure') return;
      if (environmentCostResultsById?.[permissionProfileId]) return;
      if (inflightCostFetchIdsRef.current.has(permissionProfileId)) return;
      const request = environmentCostRequestRecords?.[permissionProfileId];
      if (request?.status === 'loading' && request?.params?.forceRefresh) return;

      const checkKey = `azure:${permissionProfileId}`;
      if (autoCheckedCostScanIdsRef.current.has(checkKey)) return;

      autoCheckedCostScanIdsRef.current.add(checkKey);
      dispatch(
        refreshEnvironmentCostAnalysis({
          permissionProfileId,
          cloudProvider: 'azure',
          forceRefresh: false,
          allowWhileLoading: true,
        })
      ).then((action) => {
        const cachedPayload = refreshEnvironmentCostAnalysis.fulfilled.match(action)
          ? action.payload?.payload
          : null;
        if (cachedPayload || environmentCostResultsById?.[permissionProfileId]) return;

        startAzureCostScanIfNeeded(target.parentEnvironment);
      });
    });
  }, [
    aggregateSourceEnvironments,
    dispatch,
    environmentCostRequestRecords,
    environmentCostResultsById,
    environments.length,
    isAggregateScope,
    scannerUpdatesConnectionId,
    selectedEnvironment,
    startAzureCostScanIfNeeded,
  ]);

  const handleLaunchRefresh = useCallback(
    async (forceRefresh = true) => {
      const targets = isAggregateScope
        ? dedupeCostTargets(aggregateSourceEnvironments.flatMap((environment) => getCostScanTargetsForEnvironment(environment)))
        : selectedEnvironment
          ? dedupeCostTargets(getCostScanTargetsForEnvironment(selectedEnvironment))
          : [];

      if (targets.length === 0) {
        toast.error('No environments selected for cost analysis.');
        return;
      }

      try {
        await dispatch(
          launchEnvironmentCostScans({
            targets,
            forceRefresh,
          })
        ).unwrap();
        setRefreshModalOpen(false);
        toast.success(
          targets.length === 1
            ? 'Cost analysis started. Watch Operations In Progress for updates.'
            : 'Cost analysis started for the selected environments.'
        );
      } catch (error) {
        toast.error(error?.message || 'Failed to start cost analysis');
      }
    },
    [aggregateSourceEnvironments, dispatch, isAggregateScope, selectedEnvironment, selectedEnvironmentSourceId]
  );

  const checks = useMemo(() => (Array.isArray(report?.checks) ? report.checks : []), [report]);

  const spendData = report?.data?.spend && typeof report.data.spend === 'object'
    ? report.data.spend
    : {};
  const rawDailyTotal = Array.isArray(spendData.dailyTotal) ? spendData.dailyTotal : [];
  const rawMonthlyTotal12m = Array.isArray(spendData.monthlyTotal12m) ? spendData.monthlyTotal12m : [];
  const dailyByService = Array.isArray(spendData.dailyByService) ? spendData.dailyByService : [];
  const rawDailyByLinkedAccount = Array.isArray(spendData.dailyByLinkedAccount)
    ? spendData.dailyByLinkedAccount
    : [];
  const dailyByLinkedAccount = useMemo(
    () => filterCostEntriesByAllowedAccountIds(rawDailyByLinkedAccount, selectedEnvironmentAllowedAccountIds),
    [rawDailyByLinkedAccount, selectedEnvironmentAllowedAccountIds]
  );
  const dailyTotalRaw = useMemo(
    () =>
      selectedEnvironmentAllowedAccountIds
        ? buildDailyTotalsFromLinkedAccountData(dailyByLinkedAccount)
        : rawDailyTotal,
    [dailyByLinkedAccount, rawDailyTotal, selectedEnvironmentAllowedAccountIds]
  );
  const monthlyTotal12mRaw = useMemo(
    () =>
      selectedEnvironmentAllowedAccountIds
        ? buildMonthlyTotalsFromDailyTotals(dailyTotalRaw)
        : rawMonthlyTotal12m,
    [dailyTotalRaw, rawMonthlyTotal12m, selectedEnvironmentAllowedAccountIds]
  );

  const dailyTotalData = useMemo(() => processDailyTotalData(dailyTotalRaw), [dailyTotalRaw]);
  const monthlyTotal12mData = useMemo(() => processMonthlyTotalData(monthlyTotal12mRaw), [monthlyTotal12mRaw]);
  const serviceTotals = useMemo(() => buildServiceTotals(dailyByService), [dailyByService]);
  const accountTotals = useMemo(() => buildAccountTotals(dailyByLinkedAccount), [dailyByLinkedAccount]);
  const spendMetrics = useMemo(() => calculateSpendMetrics(dailyTotalData), [dailyTotalData]);
  const monthlySpend = useMemo(() => calculateMonthlySpend(dailyTotalData), [dailyTotalData]);
  const lookbackDays = report?.lookbackDays || spendData?.range?.lookbackDays || 90;
  const displaySpendRange = useMemo(() => {
    if (isOrganizationScope) {
      return buildDateRangeFromDailyData(dailyTotalData, lookbackDays);
    }

    return spendData?.range && typeof spendData.range === 'object'
      ? spendData.range
      : { startDate: '', endDate: '', lookbackDays };
  }, [dailyTotalData, isOrganizationScope, lookbackDays, spendData?.range]);
  const monthlyRange12m = useMemo(() => {
    if (selectedEnvironmentAllowedAccountIds) {
      return buildDateRangeFromMonthlyData(monthlyTotal12mData, 12);
    }

    return spendData?.monthlyRange12m && typeof spendData.monthlyRange12m === 'object'
      ? spendData.monthlyRange12m
      : { startDate: '', endDate: '', lookbackMonths: 12 };
  }, [monthlyTotal12mData, selectedEnvironmentAllowedAccountIds, spendData?.monthlyRange12m]);
  const trailingYearSpend = useMemo(
    () => monthlyTotal12mData.reduce((sum, entry) => sum + (entry.amount || 0), 0),
    [monthlyTotal12mData]
  );
  const trailingYearMonthlyAverage = monthlyTotal12mData.length > 0 ? trailingYearSpend / monthlyTotal12mData.length : 0;

  const anomalyDetection =
    report?.data?.anomalyDetection && typeof report.data.anomalyDetection === 'object'
      ? report.data.anomalyDetection
      : {};
  const rightsizing = report?.data?.rightsizing && typeof report.data.rightsizing === 'object'
    ? report.data.rightsizing
    : {};
  const savingsPlans = report?.data?.savingsPlans && typeof report.data.savingsPlans === 'object'
    ? report.data.savingsPlans
    : {};
  const costOptimizationHub =
    report?.data?.costOptimizationHub && typeof report.data.costOptimizationHub === 'object'
      ? report.data.costOptimizationHub
      : {};
  const reportProvider = report?.provider || selectedEnvironment?.cloudProvider || 'aws';

  const aggregateContext =
    report?.aggregateContext && typeof report.aggregateContext === 'object'
      ? report.aggregateContext
      : {
          isAggregate: false,
          totalEnvironmentCount: selectedEnvironment ? 1 : 0,
          loadedEnvironmentCount: report ? 1 : 0,
          configuredScopeCount: selectedEnvironment ? 1 : 0,
          failedEnvironments: [],
          excludedLinkedAccountProfiles: [],
          environmentSummaries: [],
        };

  const anomalyFindings = Array.isArray(anomalyDetection?.anomalies) ? anomalyDetection.anomalies : [];
  const rightsizingRecs = Array.isArray(rightsizing?.recommendations) ? rightsizing.recommendations : [];
  const savingsPlansRecs = getSavingsPlansRecommendationItems(savingsPlans?.recommendationsByType);
  const cohRecs = useMemo(
    () =>
      annotateCostOptimizationHubRecommendations(
        Array.isArray(costOptimizationHub?.recommendations) ? costOptimizationHub.recommendations : [],
        {
          environmentName: selectedEnvironment?.name,
          environmentAccountId: selectedEnvironment?.accountId,
          accountNameById: selectedEnvironment?.memberAccountNameById,
          fallbackRecommendationAccountId:
            selectedEnvironment?.type === 'aws account' ? selectedEnvironment?.accountId : '',
          fallbackRecommendationAccountName:
            selectedEnvironment?.type === 'aws account' ? selectedEnvironment?.name : '',
        }
      ),
    [costOptimizationHub?.recommendations, selectedEnvironment]
  );
  const displayedCostOptimizationHub = useMemo(
    () => ({
      ...costOptimizationHub,
      recommendations: cohRecs,
    }),
    [cohRecs, costOptimizationHub]
  );
  const displayedRightsizing = useMemo(
    () => ({
      ...rightsizing,
      recommendations: rightsizingRecs,
    }),
    [rightsizing, rightsizingRecs]
  );
  const displayedSavingsPlans = useMemo(
    () => ({
      ...savingsPlans,
      recommendationsByType: groupSavingsPlansRecommendations(savingsPlansRecs),
    }),
    [savingsPlans, savingsPlansRecs]
  );
  const totalRecommendations = rightsizingRecs.length + savingsPlansRecs.length + cohRecs.length;

  const estimatedSavings = useMemo(() => {
    return calculateEstimatedSavings({
      rightsizingRecommendations: rightsizingRecs,
      savingsPlansRecommendations: savingsPlansRecs,
      costOptimizationHubRecommendations: cohRecs,
    });
  }, [rightsizingRecs, savingsPlansRecs, cohRecs]);
  const failedEnvironments = Array.isArray(aggregateContext.failedEnvironments)
    ? aggregateContext.failedEnvironments
    : [];
  const activeCostRequest = !isAggregateScope && selectedEnvironmentSourceId
    ? environmentCostRequestRecords?.[selectedEnvironmentSourceId]
    : null;
  const showEmptyCostState = environments.length > 0 && !loading && !error && !report;
  const environmentSummaries = Array.isArray(aggregateContext.environmentSummaries)
    ? aggregateContext.environmentSummaries
    : [];
  const selectedScopeSummaries = useMemo(() => {
    if ((!isOrganizationScope && !isAzureTenantScope) || !selectedEnvironment || !report) {
      return [];
    }

    if (isAzureTenantScope && Array.isArray(report?.aggregateContext?.environmentSummaries)) {
      return report.aggregateContext.environmentSummaries;
    }

    const scopedReport = {
      ...report,
      data: {
        ...(report?.data && typeof report.data === 'object' ? report.data : {}),
        spend: {
          ...spendData,
          dailyTotal: dailyTotalRaw,
          monthlyTotal12m: monthlyTotal12mRaw,
          dailyByLinkedAccount,
          range: displaySpendRange,
          monthlyRange12m,
        },
      },
    };

    return buildEnvironmentSummaries(
      [
        {
          environment: selectedEnvironment,
          report: scopedReport,
        },
      ],
      { expandAzureTenants: isAzureTenantScope }
    );
  }, [
    dailyByLinkedAccount,
    dailyTotalRaw,
    displaySpendRange,
    isAzureTenantScope,
    isOrganizationScope,
    monthlyRange12m,
    monthlyTotal12mRaw,
    report,
    selectedEnvironment,
    spendData,
  ]);
  const displayEnvironmentSummaries = usesAggregateStyleLayout
    ? (isAggregateScope ? environmentSummaries : selectedScopeSummaries)
    : [];
  const displayEntityCount = useMemo(() => {
    if (isAggregateScope) {
      return aggregateContext.loadedEnvironmentCount;
    }

    if (isAzureTenantScope) {
      return displayEnvironmentSummaries.length;
    }

    if (!isOrganizationScope) {
      return 0;
    }

    const organizationAccountIds = new Set(
      selectedEnvironment?.memberAccountIds instanceof Set
        ? Array.from(selectedEnvironment.memberAccountIds)
        : []
    );
    const managementAccountId = String(selectedEnvironment?.accountId || '').trim();
    if (managementAccountId) {
      organizationAccountIds.add(managementAccountId);
    }

    return organizationAccountIds.size || displayEnvironmentSummaries.length;
  }, [
    aggregateContext.loadedEnvironmentCount,
    displayEnvironmentSummaries.length,
    isAzureTenantScope,
    isAggregateScope,
    isOrganizationScope,
    selectedEnvironment,
  ]);
  const displayEntityLabel = isOrganizationScope ? 'account' : isAzureTenantScope ? 'subscription' : 'environment';
  const displayEntityLabelPlural = displayEntityCount === 1 ? displayEntityLabel : `${displayEntityLabel}s`;
  const scopeDisplayName = isAggregateScope ? 'Portfolio' : isOrganizationScope ? 'Organization' : isAzureTenantScope ? 'Azure Tenant' : 'Environment';
  const summaryChartTitle = isOrganizationScope ? 'Cost by Account' : isAzureTenantScope ? 'Cost by Subscription' : 'Cost by Environment';
  const summaryTableTitle = isOrganizationScope
    ? 'Organization Account Cost Summary'
    : isAzureTenantScope
      ? 'Azure Subscription Cost Summary'
    : 'Environment Cost Summary';
  const summaryRowLabel = isOrganizationScope ? 'account rows' : isAzureTenantScope ? 'subscription and tenant-level rows' : 'environment and account rows';
  const summarySectionId = isOrganizationScope ? 'organization-cost-summary' : isAzureTenantScope ? 'azure-tenant-cost-summary' : 'environment-cost-summary';
  const showAggregateEnvironmentChart = usesAggregateStyleLayout && displayEnvironmentSummaries.length > 0;
  const scrollToSection = useCallback((sectionId) => {
    if (typeof document === 'undefined') return;
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const handleJumpCardKeyDown = useCallback((event, sectionId) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    scrollToSection(sectionId);
  }, [scrollToSection]);

  return (
    <div className="space-y-6">
      {environments.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-72">
              <div className="flex min-w-0 items-center gap-2">
                {isAggregateScope || !selectedEnvironment ? (
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  getEnvironmentProviderIcon(selectedEnvironment)
                )}
                <span className="truncate">{selectedScopeLabel}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {environments.length > 1 && (
                <SelectItem value={ALL_ENVIRONMENTS_SCOPE}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>All Environments</span>
                    <span className="text-gray-500">({environments.length})</span>
                  </div>
                </SelectItem>
              )}
              {orderedEnvironments.map((environment) => (
                <SelectItem
                  key={environment.permissionProfileId}
                  value={`environment:${environment.permissionProfileId}`}
                >
                  <div className="flex items-center gap-2">
                    {getEnvironmentProviderIcon(environment)}
                    <span>
                      {environment.type === 'aws org'
                        ? `AWS Organization: ${environment.name}`
                        : environment.type === 'azure tenant'
                          ? `Azure Tenant: ${environment.name}`
                          : environment.type === 'azure subscription'
                            ? `Azure Subscription: ${environment.name}`
                        : environment.name}
                    </span>
                    <span className="text-gray-500">
                      [{environment.type === 'aws org'
                        ? 'org'
                        : environment.type === 'azure tenant'
                          ? 'tenant'
                          : environment.type === 'azure subscription'
                            ? 'subscription'
                          : 'account'}]
                    </span>
                    {environment.type === 'aws org' &&
                      environment.memberAccountIds instanceof Set &&
                      environment.memberAccountIds.size > 0 && (
                        <span className="text-gray-500">
                          ({environment.memberAccountIds.size} accounts)
                        </span>
                      )}
                    {environment.accountId && (
                      <span className="text-gray-500">({environment.accountId})</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setRefreshModalOpen(true)}
            disabled={loading || (!isAggregateScope && !selectedEnvironmentId)}
            className="h-9 w-9"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {environments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex justify-center gap-3 opacity-30 mb-3">
              <Icons.aws className="h-12 w-12" />
              <Icons.azure className="h-12 w-12" />
            </div>
            <div className="text-gray-600 font-medium">No cloud environments configured</div>
            <div className="text-sm text-gray-500 mt-1">
              Add an AWS account or Azure tenant in Cloud Setup to enable cost analysis.
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Error loading cost analysis</span>
            </div>
            <div className="text-sm text-red-600 mt-1">{error}</div>
          </CardContent>
        </Card>
      )}

      {isAggregateScope && failedEnvironments.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                Loaded {aggregateContext.loadedEnvironmentCount}/{aggregateContext.totalEnvironmentCount} environments
              </span>
            </div>
            <div className="mt-2 text-sm text-amber-700">
              {failedEnvironments
                .map((environment) => environment.name || environment.accountId || 'Environment')
                .join(', ')}
            </div>
          </CardContent>
        </Card>
      )}

      {showEmptyCostState && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <div className="text-gray-700 font-medium">
              {activeCostRequest?.status === 'loading'
                ? 'Cost analysis is running'
                : 'No cost data available yet'}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {activeCostRequest?.status === 'loading'
                ? 'The dashboard will update after the scanner finishes.'
                : 'Start a cost analysis scan to populate this environment.'}
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">Monthly Spend</span>
                  </div>
                  <span className={`text-xs ${getFreshnessTextClass(report?.generatedAt)}`}>
                    {formatRelativeTime(report?.generatedAt)}
                    {getFreshnessSuffix(report?.generatedAt)}
                  </span>
                </div>
                {monthlySpend.length > 0 ? (
                  <div className="space-y-2">
                    {monthlySpend.map((month, idx) => (
                      <div key={month.month} className="flex items-center justify-between">
                        <span className={`text-sm ${idx === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                          {month.label}
                        </span>
                        <span className={`${idx === 0 ? 'text-lg font-bold text-gray-900' : 'text-sm font-medium text-gray-700'}`}>
                          {formatCurrency(month.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(spendMetrics.total) || '$0'}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-gray-500">
                  <span>Total: {formatCurrency(spendMetrics.total)}</span>
                  <span>•</span>
                  <span>{lookbackDays} days</span>
                  {usesAggregateStyleLayout && (
                    <>
                      <span>•</span>
                      <span>{displayEntityCount} {displayEntityLabelPlural}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-purple-50">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Daily Average</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatCurrency(spendMetrics.average) || '$0'}
                </div>
                {serviceTotals.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-gray-500 mb-1">Top Service</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {serviceTotals[0]?.service || 'N/A'}
                    </div>
                    <div className="text-lg font-bold text-purple-600">
                      {formatCurrency(serviceTotals[0]?.total) || '$0'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {usesAggregateStyleLayout ? (
              <AggregateSourcesCard
                checks={checks}
                environmentCount={isAggregateScope ? aggregateContext.totalEnvironmentCount : displayEntityCount}
                loadedCount={isAggregateScope ? aggregateContext.loadedEnvironmentCount : displayEnvironmentSummaries.length}
                failedEnvironments={isAggregateScope ? failedEnvironments : []}
                title={isOrganizationScope ? 'Organization Account Coverage' : isAzureTenantScope ? 'Azure Tenant Coverage' : 'Environment Coverage'}
                statLabel={isOrganizationScope ? 'Accounts' : isAzureTenantScope ? 'Subscriptions' : 'Loaded'}
                statusDescription={
                  isOrganizationScope
                    ? `${displayEnvironmentSummaries.length}/${displayEntityCount} account${displayEntityCount === 1 ? '' : 's'} represented in the current org report`
                    : isAzureTenantScope
                      ? `${displayEnvironmentSummaries.length} subscription or tenant-level row${displayEnvironmentSummaries.length === 1 ? '' : 's'} represented in the current tenant report`
                    : ''
                }
                entityLabel={displayEntityLabel}
                provider={isAzureTenantScope ? 'azure' : 'aws'}
                onViewDetails={() => setChecksModalOpen(true)}
              />
            ) : (
              <SourcesCard checks={checks} onViewDetails={() => setChecksModalOpen(true)} />
            )}

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2"
              role="button"
              tabIndex={0}
              onClick={() => scrollToSection('optimization-recommendations')}
              onKeyDown={(event) => handleJumpCardKeyDown(event, 'optimization-recommendations')}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-50">
                    <PiggyBank className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Potential Savings</span>
                </div>
                <div className="text-3xl font-bold text-emerald-600">
                  {estimatedSavings > 0
                    ? formatCurrency(annualizeMonthlySavings(estimatedSavings))
                    : '$0'}
                  <span className="text-base font-normal text-emerald-500">/yr</span>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Recommendations</span>
                    <span className="font-semibold text-gray-900">{totalRecommendations}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Anomalies</span>
                    <span className={`font-semibold ${anomalyFindings.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                      {anomalyFindings.length}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-medium text-emerald-700">
                    Jump to optimization recommendations
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className={`grid grid-cols-1 gap-6 ${showAggregateEnvironmentChart ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    {usesAggregateStyleLayout ? `${scopeDisplayName} Spend Trend` : 'Daily Spend Trend'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {dailyTotalData.length} days
                    </Badge>
                    {usesAggregateStyleLayout && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setExpandedView('trend')}
                        title="Open larger view"
                        aria-label="Open larger view"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {displaySpendRange.startDate || 'N/A'} to {displaySpendRange.endDate || 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SpendTrendChart data={dailyTotalData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    {usesAggregateStyleLayout ? `${scopeDisplayName} Spend by Service` : 'Spend by Service'}
                  </CardTitle>
                  {usesAggregateStyleLayout && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setExpandedView('services')}
                      title="Open larger view"
                      aria-label="Open larger view"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {displaySpendRange.startDate || 'N/A'} to {displaySpendRange.endDate || 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceSpendChart data={serviceTotals} />
              </CardContent>
            </Card>

            {showAggregateEnvironmentChart && (
              <Card
                className="cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2"
                role="button"
                tabIndex={0}
                onClick={() => scrollToSection(summarySectionId)}
                onKeyDown={(event) => handleJumpCardKeyDown(event, summarySectionId)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-teal-600" />
                      {summaryChartTitle}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedView('environment-chart');
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      title="Open larger view"
                      aria-label="Open larger view"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardDescription>
                  {displaySpendRange.startDate || 'N/A'} to {displaySpendRange.endDate || 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EnvironmentSpendChart data={displayEnvironmentSummaries} />
                  <div className="mt-3 text-xs font-medium text-teal-700">
                    Jump to {isOrganizationScope ? 'organization account cost summary' : isAzureTenantScope ? 'Azure subscription cost summary' : 'environment cost summary'}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {monthlyTotal12mData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-600" />
                    Spend Over Past {monthlyTotal12mData.length} Month{monthlyTotal12mData.length === 1 ? '' : 's'}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {monthlyTotal12mData.length} months
                  </Badge>
                </div>
                <CardDescription>
                  {monthlyRange12m.startDate || 'N/A'} to {monthlyRange12m.endDate || 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm text-gray-500">
                      Trailing {monthlyTotal12mData.length}-month spend
                    </div>
                    <div className="text-3xl font-bold text-gray-900">
                      {formatCurrency(trailingYearSpend) || '$0'}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Average per month: <span className="font-semibold text-gray-900">
                      {formatCurrency(trailingYearMonthlyAverage) || '$0'}
                    </span>
                  </div>
                </div>
                <SpendTrendChart data={monthlyTotal12mData} height={260} seriesName="Monthly Spend" />
              </CardContent>
            </Card>
          )}

          {anomalyFindings.length > 0 && (
            <AnomaliesSection
              anomalies={anomalyFindings}
              accountId={selectedEnvironment?.accountId}
            />
          )}

          <div id="optimization-recommendations" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-emerald-500" />
              Optimization Recommendations
            </h2>
            <RecommendationsSection
              rightsizing={displayedRightsizing}
              savingsPlans={displayedSavingsPlans}
              costOptimizationHub={displayedCostOptimizationHub}
              provider={reportProvider}
            />
          </div>

          {usesAggregateStyleLayout && displayEnvironmentSummaries.length > 0 && (
            <Card id={summarySectionId} className="scroll-mt-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-600" />
                  {summaryTableTitle}
                </CardTitle>
                <CardDescription>
                  {isOrganizationScope
                    ? 'Ranked spend view across accounts in the selected AWS Organization'
                    : isAzureTenantScope
                      ? 'Ranked spend view across subscriptions and tenant-level charges in the selected Azure tenant'
                    : 'Ranked spend and savings view across aggregate portfolio sources'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnvironmentSummaryTable data={displayEnvironmentSummaries} />
              </CardContent>
            </Card>
          )}

          {!usesAggregateStyleLayout && accountTotals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-600" />
                  Spend by Linked Account
                </CardTitle>
                <CardDescription>
                  Distribution across {accountTotals.length} linked account{accountTotals.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccountSpendChart data={accountTotals} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <RefreshModal
        open={refreshModalOpen}
        onClose={() => setRefreshModalOpen(false)}
        onRefresh={handleLaunchRefresh}
        loading={loading}
      />

      <ChecksModal
        open={checksModalOpen}
        onClose={() => setChecksModalOpen(false)}
        checks={checks}
      />

      <ExpandedCostViewModal
        open={Boolean(expandedView)}
        onClose={() => setExpandedView(null)}
        view={expandedView}
        dailyTotalData={dailyTotalData}
        serviceTotals={serviceTotals}
        environmentSummaries={displayEnvironmentSummaries}
        spendRange={displaySpendRange}
        trendTitle={`${scopeDisplayName} Spend Trend`}
        servicesTitle={`${scopeDisplayName} Spend by Service`}
        summaryChartTitle={summaryChartTitle}
        summaryTableTitle={summaryTableTitle}
        summaryRowLabel={summaryRowLabel}
      />
    </div>
  );
}
