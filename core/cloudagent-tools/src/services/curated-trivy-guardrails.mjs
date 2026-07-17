export const TRIVY_CHECKS_AUDIT_SHA = "ce19a05406940646227cd65dbffeba4c17af38ae";
const UPSTREAM_ROOT = `https://github.com/aquasecurity/trivy-checks/blob/${TRIVY_CHECKS_AUDIT_SHA}/checks/cloud/aws`;

function trivyCheck(id, service, fileName, longId, aliases = []) {
  return {
    id,
    // Short aliases are not globally unique across AWS services. Keep the
    // numeric ID, AVD ID, and service-qualified long ID as stable identities.
    aliases: [`AVD-${id}`, longId, ...aliases],
    sourceUrl: `${UPSTREAM_ROOT}/${service}/${fileName}.rego`,
  };
}

function definition({
  id,
  title,
  service,
  serviceName,
  fileName,
  severity,
  checks,
  scope = "resource",
  governedAttributePaths = [],
}) {
  return {
    rule: {
      id,
      title,
      service,
      serviceName,
      severity,
      disposition: ["critical", "high"].includes(severity)
        ? "require_confirmation"
        : "warning",
      fileName,
    },
    mapping: {
      status: "supported_exact",
      checks,
      scope,
      governedAttributePaths,
    },
  };
}

const c = trivyCheck;

export const CURATED_TRIVY_GUARDRAILS = Object.freeze([
  definition({
    id: "API_GW_CACHE_ENABLED_AND_ENCRYPTED", title: "API Gateway cache enabled and encrypted",
    service: "api_gateway", serviceName: "API Gateway", fileName: "api_gw_cache_enabled_and_encrypted", severity: "medium",
    checks: [
      c("AWS-0190", "apigateway", "enable_cache", "aws-apigateway-enable-cache"),
      c("AWS-0002", "apigateway", "enable_cache_encryption", "aws-apigateway-enable-cache-encryption"),
    ], governedAttributePaths: ["cache_cluster_enabled", "cache_data_encrypted"],
  }),
  definition({
    id: "API_GW_DOMAIN_DENY_NON_TLS_TRAFFIC", title: "API Gateway domain denies outdated TLS",
    service: "api_gateway", serviceName: "API Gateway", fileName: "api_gw_domain_deny_non_tls_traffic", severity: "high",
    checks: [c("AWS-0005", "apigateway", "use_secure_tls_policy", "aws-apigateway-use-secure-tls-policy")], governedAttributePaths: ["security_policy"],
  }),
  definition({
    id: "API_GW_METHOD_AUTHORIZATION_TYPE_RULE", title: "API Gateway methods require authorization",
    service: "api_gateway", serviceName: "API Gateway", fileName: "api_gw_method_authorization_type_rule", severity: "low",
    checks: [c("AWS-0004", "apigateway", "no_public_access", "aws-apigateway-no-public-access")], governedAttributePaths: ["authorization"],
  }),
  definition({
    id: "CLOUDFRONT_ACCESSLOGS_ENABLED", title: "CloudFront access logging enabled",
    service: "cloudfront", serviceName: "CloudFront", fileName: "cloudfront_accesslogs_enabled", severity: "medium",
    checks: [c("AWS-0010", "cloudfront", "enable_logging", "aws-cloudfront-enable-logging")], governedAttributePaths: ["logging_config"],
  }),
  definition({
    id: "CLOUDFRONT_MINIMUM_PROTOCOL_VERSION_RULE", title: "CloudFront minimum TLS protocol configured",
    service: "cloudfront", serviceName: "CloudFront", fileName: "cloudfront_minimum_protocol_version_rule", severity: "high",
    checks: [c("AWS-0013", "cloudfront", "use_secure_tls_policy", "aws-cloudfront-use-secure-tls-policy")], governedAttributePaths: ["minimum_protocol_version"],
  }),
  definition({
    id: "CLOUDFRONT_VIEWER_POLICY_HTTPS", title: "CloudFront viewer traffic uses HTTPS",
    service: "cloudfront", serviceName: "CloudFront", fileName: "cloudfront_viewer_policy_https", severity: "critical",
    checks: [c("AWS-0012", "cloudfront", "enforce_https", "aws-cloudfront-enforce-https")], governedAttributePaths: ["viewer_protocol_policy"],
  }),
  definition({
    id: "CLOUD_TRAIL_CLOUD_WATCH_LOGS_ENABLED", title: "CloudTrail CloudWatch Logs integration enabled",
    service: "cloudtrail", serviceName: "CloudTrail", fileName: "cloud_trail_cloud_watch_logs_enabled", severity: "low",
    checks: [c("AWS-0162", "cloudtrail", "ensure_cloudwatch_integration", "aws-cloudtrail-ensure-cloudwatch-integration")], governedAttributePaths: ["cloud_watch_logs_group_arn"],
  }),
  definition({
    id: "CLOUD_TRAIL_ENCRYPTION_ENABLED", title: "CloudTrail customer-managed encryption enabled",
    service: "cloudtrail", serviceName: "CloudTrail", fileName: "cloud_trail_encryption_enabled", severity: "high",
    checks: [c("AWS-0015", "cloudtrail", "encryption_customer_key", "aws-cloudtrail-encryption-customer-managed-key")], governedAttributePaths: ["kms_key_id"],
  }),
  definition({
    id: "CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED", title: "CloudTrail log file validation enabled",
    service: "cloudtrail", serviceName: "CloudTrail", fileName: "cloud_trail_log_file_validation_enabled", severity: "high",
    checks: [c("AWS-0016", "cloudtrail", "enable_log_validation", "aws-cloudtrail-enable-log-validation")], governedAttributePaths: ["enable_log_file_validation"],
  }),
  definition({
    id: "CLOUDTRAIL_S3_DATAEVENTS_ENABLED", title: "CloudTrail S3 data events enabled",
    service: "cloudtrail", serviceName: "CloudTrail", fileName: "cloudtrail_s3_dataevents_enabled", severity: "medium", scope: "global",
    checks: [
      c("AWS-0171", "s3", "enable_object_write_logging", "aws-s3-enable-object-write-logging"),
      c("AWS-0172", "s3", "enable_object_read_logging", "aws-s3-enable-object-read-logging"),
    ], governedAttributePaths: ["event_selector", "advanced_event_selector"],
  }),
  definition({
    id: "MULTI_REGION_CLOUD_TRAIL_ENABLED", title: "Multi-region CloudTrail enabled",
    service: "cloudtrail", serviceName: "CloudTrail", fileName: "multi_region_cloud_trail_enabled", severity: "medium", scope: "global",
    checks: [c("AWS-0014", "cloudtrail", "enable_all_regions", "aws-cloudtrail-enable-all-regions")], governedAttributePaths: ["is_multi_region_trail"],
  }),
  definition({
    id: "CLOUDWATCH_LOG_GROUP_ENCRYPTED", title: "CloudWatch log group encrypted with a customer-managed key",
    service: "cloudwatch", serviceName: "CloudWatch", fileName: "cloudwatch_log_group_encrypted", severity: "low",
    checks: [c("AWS-0017", "cloudwatch", "log_group_customer_key", "aws-cloudwatch-log-group-customer-key")], governedAttributePaths: ["kms_key_id"],
  }),
  definition({
    id: "DAX_ENCRYPTION_ENABLED", title: "DAX encryption enabled",
    service: "dax", serviceName: "DAX", fileName: "dax_encryption_enabled", severity: "high",
    checks: [c("AWS-0023", "dynamodb", "enable_at_rest_encryption", "aws-dynamodb-enable-at-rest-encryption")], governedAttributePaths: ["server_side_encryption"],
  }),
  definition({
    id: "DYNAMODB_PITR_ENABLED", title: "DynamoDB point-in-time recovery enabled",
    service: "dynamodb", serviceName: "DynamoDB", fileName: "dynamodb_pitr_enabled", severity: "medium",
    checks: [c("AWS-0024", "dynamodb", "enable_recovery", "aws-dynamodb-enable-recovery")], governedAttributePaths: ["point_in_time_recovery"],
  }),
  definition({
    id: "EBS_VOLUME_ENCRYPTION_KEY_RULE", title: "EBS volume uses a customer-managed encryption key",
    service: "amazon_ec2", serviceName: "EC2", fileName: "ebs_volume_encryption_key_rule", severity: "low",
    checks: [c("AWS-0027", "ec2", "encryption_customer_key", "aws-ec2-volume-encryption-customer-key")], governedAttributePaths: ["kms_key_id"],
  }),
  definition({
    id: "EC2_SECURITY_GROUP_EGRESS_OPEN_TO_WORLD_RULE", title: "Security group egress is not open to the world",
    service: "amazon_ec2", serviceName: "EC2", fileName: "ec2_security_group_egress_open_to_world_rule", severity: "critical",
    checks: [c("AWS-0104", "ec2", "no_public_egress_sgr", "aws-ec2-no-public-egress-sgr")], governedAttributePaths: ["egress", "cidr_blocks", "ipv6_cidr_blocks"],
  }),
  definition({
    id: "ENCRYPTED_VOLUMES", title: "EBS volumes encrypted",
    service: "amazon_ec2", serviceName: "EC2", fileName: "encrypted_volumes", severity: "high",
    checks: [c("AWS-0026", "ec2", "enable_volume_encryption", "aws-ec2-enable-volume-encryption")], governedAttributePaths: ["encrypted"],
  }),
  definition({
    id: "SECURITY_GROUP_DESCRIPTION_RULE", title: "Security group rules have descriptions",
    service: "amazon_ec2", serviceName: "EC2", fileName: "security_group_description_rule", severity: "low",
    checks: [c("AWS-0124", "ec2", "add_description_to_security_group_rule", "aws-ec2-add-description-to-security-group-rule")], governedAttributePaths: ["description"],
  }),
  definition({
    id: "SUBNET_AUTO_ASSIGN_PUBLIC_IP_DISABLED", title: "Subnet auto-assign public IP disabled",
    service: "amazon_ec2", serviceName: "EC2", fileName: "subnet_auto_assign_public_ip_disabled", severity: "high",
    checks: [c("AWS-0164", "ec2", "no_public_ip_subnet", "aws-ec2-no-public-ip-subnet")], governedAttributePaths: ["map_public_ip_on_launch"],
  }),
  definition({
    id: "AUTOSCALING_LAUNCH_CONFIG_PUBLIC_IP_DISABLED", title: "Auto Scaling launch configuration public IP disabled",
    service: "amazon_ec2_auto_scaling", serviceName: "EC2 Auto Scaling", fileName: "autoscaling_launch_config_public_ip_disabled", severity: "high",
    checks: [c("AWS-0009", "ec2", "no_public_ip", "aws-ec2-no-public-ip")], governedAttributePaths: ["associate_public_ip_address"],
  }),
  definition({
    id: "ECR_REPO_SCAN_ON_PUSH", title: "ECR repository scan on push enabled",
    service: "aws_ecr", serviceName: "ECR", fileName: "ecr_repo_scan_on_push_rule", severity: "high",
    checks: [c("AWS-0030", "ecr", "enable_image_scans", "aws-ecr-enable-image-scans")], governedAttributePaths: ["image_scanning_configuration"],
  }),
  definition({
    id: "EFS_ENCRYPTED_CHECK", title: "EFS encryption enabled",
    service: "amazon_efs", serviceName: "EFS", fileName: "efs_encrypted_check", severity: "high",
    checks: [c("AWS-0037", "efs", "enable_at_rest_encryption", "aws-efs-enable-at-rest-encryption")], governedAttributePaths: ["encrypted", "kms_key_id"],
  }),
  definition({
    id: "EKS_CLUSTER_ENCRYPTION_RULE", title: "EKS secrets encryption enabled",
    service: "amazon_eks", serviceName: "EKS", fileName: "eks_cluster_encryption_rule", severity: "high",
    checks: [c("AWS-0039", "eks", "encrypt_secrets", "aws-eks-encrypt-secrets")], governedAttributePaths: ["encryption_config"],
  }),
  definition({
    id: "EKS_ENDPOINT_NO_PUBLIC_ACCESS", title: "EKS public endpoint disabled",
    service: "amazon_eks", serviceName: "EKS", fileName: "eks_endpoint_no_public_access", severity: "critical",
    checks: [c("AWS-0040", "eks", "no_public_cluster_access", "aws-eks-no-public-cluster-access")], governedAttributePaths: ["endpoint_public_access"],
  }),
  definition({
    id: "ELASTICACHE_REPLICATION_GROUP_ENCRYPTION_AT_REST", title: "ElastiCache encryption at rest enabled",
    service: "elasticache", serviceName: "ElastiCache", fileName: "elasticache_replication_group_encryption_at_rest", severity: "high",
    checks: [c("AWS-0045", "elasticache", "enable_at_rest_encryption", "aws-elasticache-enable-at-rest-encryption")], governedAttributePaths: ["at_rest_encryption_enabled"],
  }),
  definition({
    id: "ELASTICACHE_REPLICATION_GROUP_ENCRYPTION_IN_TRANSIT", title: "ElastiCache encryption in transit enabled",
    service: "elasticache", serviceName: "ElastiCache", fileName: "elasticache_replication_group_transit_encryption", severity: "high",
    checks: [c("AWS-0051", "elasticache", "enable_in_transit_encryption", "aws-elasticache-enable-in-transit-encryption")], governedAttributePaths: ["transit_encryption_enabled"],
  }),
  definition({
    id: "ALB_HTTP_DROP_INVALID_HEADER_ENABLED", title: "ALB drops invalid HTTP headers",
    service: "elastic_load_balancing_v2", serviceName: "ELB v2", fileName: "alb_http_drop_invalid_header_enabled", severity: "high",
    checks: [c("AWS-0052", "elb", "drop_invalid_headers", "aws-elb-drop-invalid-headers")], governedAttributePaths: ["drop_invalid_header_fields"],
  }),
  definition({
    id: "KINESIS_STREAM_ENCRYPTION_RULE", title: "Kinesis stream encryption enabled",
    service: "aws_kinesis", serviceName: "Kinesis", fileName: "kinesis_stream_encryption_rule", severity: "high",
    checks: [c("AWS-0064", "kinesis", "enable_in_transit_encryption", "aws-kinesis-enable-in-transit-encryption")], governedAttributePaths: ["encryption_type", "kms_key_id"],
  }),
  definition({
    id: "CMK_BACKING_KEY_ROTATION_ENABLED", title: "KMS key rotation enabled",
    service: "aws_kms", serviceName: "KMS", fileName: "cmk_backing_key_rotation_enabled", severity: "medium",
    checks: [c("AWS-0065", "kms", "auto_rotate_keys", "aws-kms-auto-rotate-keys")], governedAttributePaths: ["enable_key_rotation"],
  }),
  definition({
    id: "RDS_INSTANCE_DELETION_PROTECTION_ENABLED", title: "RDS deletion protection enabled",
    service: "amazon_rds", serviceName: "RDS", fileName: "rds_instance_deletion_protection_enabled", severity: "medium",
    checks: [c("AWS-0177", "rds", "enable_deletion_protection", "aws-rds-enable-deletion-protection")], governedAttributePaths: ["deletion_protection"],
  }),
  definition({
    id: "RDS_INSTANCE_PUBLIC_ACCESS_CHECK", title: "RDS public access disabled",
    service: "amazon_rds", serviceName: "RDS", fileName: "rds_instance_public_access_check", severity: "high",
    checks: [c("AWS-0180", "rds", "disable_public_access", "aws-rds-enable-public-access")], governedAttributePaths: ["publicly_accessible"],
  }),
  definition({
    id: "RDS_STORAGE_ENCRYPTED", title: "RDS storage encryption enabled",
    service: "amazon_rds", serviceName: "RDS", fileName: "rds_storage_encrypted", severity: "high",
    checks: [
      c("AWS-0079", "rds", "encrypt_cluster_storage_data", "aws-rds-encrypt-cluster-storage-data"),
      c("AWS-0080", "rds", "encrypt_instance_storage_data", "aws-rds-encrypt-instance-storage-data"),
    ], governedAttributePaths: ["storage_encrypted", "kms_key_id"],
  }),
  definition({
    id: "S3_BUCKET_LOGGING_ENABLED", title: "S3 access logging enabled",
    service: "amazon_s3", serviceName: "S3", fileName: "s3_bucket_logging_enabled", severity: "low",
    checks: [c("AWS-0089", "s3", "enable_logging", "aws-s3-enable-logging", ["s3-bucket-logging"])], governedAttributePaths: ["logging"],
  }),
  definition({
    id: "S3_BUCKET_LEVEL_PUBLIC_ACCESS_PROHIBITED", title: "S3 bucket public access prohibited",
    service: "amazon_s3", serviceName: "S3", fileName: "s3_bucket_level_public_access_prohibited", severity: "high",
    checks: [
      c("AWS-0086", "s3", "block_public_acls", "aws-s3-block-public-acls"),
      c("AWS-0087", "s3", "block_public_policy", "aws-s3-block-public-policy"),
      c("AWS-0091", "s3", "ignore_public_acls", "aws-s3-ignore-public-acls"),
      c("AWS-0093", "s3", "no_public_buckets", "aws-s3-no-public-buckets"),
    ], governedAttributePaths: ["block_public_acls", "block_public_policy", "ignore_public_acls", "restrict_public_buckets"],
  }),
  definition({
    id: "S3_BUCKET_VERSIONING_ENABLED", title: "S3 bucket versioning enabled",
    service: "amazon_s3", serviceName: "S3", fileName: "s3_bucket_versioning_enabled", severity: "medium",
    checks: [c("AWS-0090", "s3", "enable_versioning", "aws-s3-enable-versioning")], governedAttributePaths: ["versioning", "versioning_configuration"],
  }),
  definition({
    id: "SNS_ENCRYPTED_KMS", title: "SNS topic encryption enabled",
    service: "amazon_sns", serviceName: "SNS", fileName: "sns_encrypted_kms", severity: "high",
    checks: [c("AWS-0095", "sns", "enable_topic_encryption", "aws-sns-enable-topic-encryption")], governedAttributePaths: ["kms_master_key_id"],
  }),
  definition({
    id: "SECRETSMANAGER_USING_CMK", title: "Secrets Manager uses a customer-managed key",
    service: "secrets_manager", serviceName: "Secrets Manager", fileName: "secretsmanager_using_cmk", severity: "low",
    checks: [c("AWS-0098", "ssm", "secret_use_customer_key", "aws-ssm-secret-use-customer-key")], governedAttributePaths: ["kms_key_id"],
  }),
  definition({
    id: "WORKSPACE_ENCRYPTION_ENABLED", title: "WorkSpaces volume encryption enabled",
    service: "amazon_workspaces", serviceName: "WorkSpaces", fileName: "workspace_encryption_enabled", severity: "high",
    checks: [c("AWS-0109", "workspaces", "enable_disk_encryption", "aws-workspaces-enable-disk-encryption")], governedAttributePaths: ["root_volume_encryption_enabled", "user_volume_encryption_enabled"],
  }),
]);

export const CURATED_TRIVY_RULES = Object.freeze(
  CURATED_TRIVY_GUARDRAILS.map((item) => item.rule)
);

export const CURATED_TRIVY_MAPPINGS = Object.freeze(
  Object.fromEntries(CURATED_TRIVY_GUARDRAILS.map((item) => [item.rule.id, item.mapping]))
);

export default CURATED_TRIVY_GUARDRAILS;
