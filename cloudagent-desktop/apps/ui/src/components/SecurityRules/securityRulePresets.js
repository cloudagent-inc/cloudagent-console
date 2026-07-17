const exposureRules = [
  'API_GW_METHOD_AUTHORIZATION_TYPE_RULE',
  'AUTOSCALING_LAUNCH_CONFIG_PUBLIC_IP_DISABLED',
  'RDS_INSTANCE_PUBLIC_ACCESS_CHECK',
  'S3_BUCKET_LEVEL_PUBLIC_ACCESS_PROHIBITED',
  'SUBNET_AUTO_ASSIGN_PUBLIC_IP_DISABLED',
];

const secureDefaultRules = [
  ...exposureRules,
  'ALB_HTTP_DROP_INVALID_HEADER_ENABLED',
  'API_GW_DOMAIN_DENY_NON_TLS_TRAFFIC',
  'CLOUDFRONT_MINIMUM_PROTOCOL_VERSION_RULE',
  'CLOUDFRONT_VIEWER_POLICY_HTTPS',
  'DAX_ENCRYPTION_ENABLED',
  'ECR_REPO_SCAN_ON_PUSH',
  'EFS_ENCRYPTED_CHECK',
  'ELASTICACHE_REPLICATION_GROUP_ENCRYPTION_AT_REST',
  'ELASTICACHE_REPLICATION_GROUP_ENCRYPTION_IN_TRANSIT',
  'ENCRYPTED_VOLUMES',
  'KINESIS_STREAM_ENCRYPTION_RULE',
  'RDS_STORAGE_ENCRYPTED',
  'SNS_ENCRYPTED_KMS',
  'WORKSPACE_ENCRYPTION_ENABLED',
];

const developmentRules = [
  ...secureDefaultRules,
  'SECURITY_GROUP_DESCRIPTION_RULE',
];

const productionRules = [
  ...developmentRules,
  'CLOUDFRONT_ACCESSLOGS_ENABLED',
  'CLOUD_TRAIL_CLOUD_WATCH_LOGS_ENABLED',
  'CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED',
  'CMK_BACKING_KEY_ROTATION_ENABLED',
  'DYNAMODB_PITR_ENABLED',
  'EKS_CLUSTER_ENCRYPTION_RULE',
  'MULTI_REGION_CLOUD_TRAIL_ENABLED',
  'RDS_INSTANCE_DELETION_PROTECTION_ENABLED',
  'S3_BUCKET_VERSIONING_ENABLED',
];

export const securityPresets = Object.freeze({
  none: Object.freeze({
    name: 'Start Empty',
    description: 'No policies selected; customize the policy set manually',
    rules: Object.freeze([]),
  }),
  relaxed: Object.freeze({
    name: 'Public Exposure Controls',
    description: 'Applies the supported controls for public endpoints and unauthenticated access',
    rules: Object.freeze(exposureRules),
  }),
  basic: Object.freeze({
    name: 'Secure Defaults',
    description: 'Adds low-friction encryption, TLS, scanning, and public-access controls',
    rules: Object.freeze(secureDefaultRules),
  }),
  development: Object.freeze({
    name: 'Development / Sandbox',
    description: 'Secure defaults plus configuration hygiene, without production durability controls',
    rules: Object.freeze(developmentRules),
  }),
  production: Object.freeze({
    name: 'Production',
    description: 'Adds production logging, recovery, deletion protection, and key rotation',
    rules: Object.freeze(productionRules),
  }),
  all: Object.freeze({
    name: 'Strict — All Supported Checks',
    description: 'Enables all 38 checks, including costly or architecture-dependent controls',
    rules: 'all',
  }),
});

export default securityPresets;
