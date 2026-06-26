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
  [onboardCloudEnvironmentRuleId]: evaluateOnboardCloudEnvironmentRule,
  [discoverWorkloadsRuleId]: evaluateDiscoverWorkloadsRule,
};

export { toArray } from './utils';
