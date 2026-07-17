export const DEFAULT_SKILL_BUILDER_CLOUD_PROVIDER = 'aws';

export const SKILL_BUILDER_PLAN_TYPES = Object.freeze([
  Object.freeze({
    value: 'Review',
    label: 'Review',
    safetyLabel: 'Read-Only',
    safetyClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    description: 'Inspect, assess, and summarize AWS configuration without applying changes.',
  }),
  Object.freeze({
    value: 'Configuration',
    label: 'Configuration',
    safetyLabel: 'Changes Configuration',
    safetyClassName: 'border-amber-200 bg-amber-50 text-amber-800',
    description: 'Create steps that can modify AWS configuration and then validate the result.',
  }),
]);

