import {
  evaluateCisReportRule,
  cisReportRuleId,
} from './recommendation_report_aws_cis';
import {
  evaluateGwsCisReportRule,
  gwsCisReportRuleId,
} from './recommendation_report_gws_cis';
import {
  evaluateUnusedResourcesReportRule,
  unusedResourcesReportRuleId,
} from './recommendation_report_aws_unused_resources';
import {
  evaluateBackupStatusReportRule,
  backupStatusReportRuleId,
} from './recommendation_report_aws_backup';
import {
  evaluateLoggingStatusReportRule,
  loggingStatusReportRuleId,
} from './recommendation_report_aws_logging_status';
import {
  evaluatePublicResourcesReportRule,
  publicResourcesReportRuleId,
} from './recommendation_report_aws_public_resources';
import {
  evaluateResiliencyReportRule,
  resiliencyReportRuleId,
} from './recommendation_report_aws_resiliency';
import {
  evaluateOnboardCloudEnvironmentRule,
  onboardCloudEnvironmentRuleId,
} from './recommendation_onboard_cloud_environment';
import {
  evaluateDiscoverWorkloadsRule,
  discoverWorkloadsRuleId,
} from './recommendation_discover_workloads';
import { extractRuleId, toArray } from './utils';

const RULE_EVALUATORS = [
  evaluateCisReportRule,
  evaluateGwsCisReportRule,
  evaluateUnusedResourcesReportRule,
  evaluateBackupStatusReportRule,
  evaluateLoggingStatusReportRule,
  evaluatePublicResourcesReportRule,
  evaluateResiliencyReportRule,
  evaluateOnboardCloudEnvironmentRule,
  evaluateDiscoverWorkloadsRule,
];

export const evaluateRecommendationRules = (userProfile, now = new Date()) => {
  if (!userProfile || typeof userProfile !== 'object') {
    
    return [];
  }

  // Support both old flat structure and new nested structure
  const existingRecommendations = userProfile.recommendations?.recommendations 
    ? toArray(userProfile.recommendations.recommendations)
    : toArray(userProfile.recommendations);

  

  const evaluatedRecommendations = RULE_EVALUATORS.flatMap((fn) =>
    fn(userProfile, now)
  );

  

  const newRuleIds = new Set(
    evaluatedRecommendations
      .map((rec) => extractRuleId(rec) || rec.recommendationId || rec.id)
      .filter(Boolean)
  );

  const preservedExisting = existingRecommendations.filter((rec) => {
    const ruleId = extractRuleId(rec);
    if (!ruleId) {
      return true;
    }
    return !newRuleIds.has(ruleId);
  });

  const result = [...preservedExisting, ...evaluatedRecommendations];
 

  return result;
};

export const recommendationRuleEvaluators = {
  [cisReportRuleId]: evaluateCisReportRule,
  [gwsCisReportRuleId]: evaluateGwsCisReportRule,
  [unusedResourcesReportRuleId]: evaluateUnusedResourcesReportRule,
  [backupStatusReportRuleId]: evaluateBackupStatusReportRule,
  [loggingStatusReportRuleId]: evaluateLoggingStatusReportRule,
  [publicResourcesReportRuleId]: evaluatePublicResourcesReportRule,
  [resiliencyReportRuleId]: evaluateResiliencyReportRule,
  [onboardCloudEnvironmentRuleId]: evaluateOnboardCloudEnvironmentRule,
  [discoverWorkloadsRuleId]: evaluateDiscoverWorkloadsRule,
};

export { toArray } from './utils';
