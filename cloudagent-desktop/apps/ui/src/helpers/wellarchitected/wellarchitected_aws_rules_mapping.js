export const wellarchitected_aws_rules_mapping = {
	wellarchitected: {
		'securely-operate': {
			// 'How do you securely operate your workload?'
			answers: {
				sec_securely_operate_aws_account: [
					// 'Secure AWS account'
					{iam: 'iam_root_mfa'},
					{iam: 'iam_root_lastused'},
					{iam: 'iam_root_accesskeys'},
				],
				sec_securely_operate_control_objectives: [
					// 'Identify and validate control objectives'
					{securityhub: 'securityhub_01'},
					{securityhub: 'securityhub_02'},
					{securityhub: 'securityhub_03'},
				],
				sec_securely_operate_updated_threats: [
					// 'Keep up to date with security threats'
					{guardduty: 'guardduty_01'},
				],
				sec_securely_operate_updated_recommendations: [
					// 'Keep up to date with security recommendations'
					{securityhub: 'securityhub_01'},
					{securityhub: 'securityhub_autoenablecontrols'},
				],
			},
		},
		identities: {
			// 'How do you manage identities for people and machines?'
			answers: {
				sec_identities_enforce_mechanisms: [
					// 'Use strong sign-in mechanisms'
					{'domain-iam': 'iam_policy_admins_without_mfa'},
					{'domain-iam': 'iam_users_no_mfa'},
					{'domain-iam': 'iam_passwordpolicy_01'},
					{'domain-iam': 'iam_passwordpolicy_02'},
					{'domain-iam': 'iam_passwordpolicy_03'},
					{'domain-iam': 'iam_passwordpolicy_04'},
					{'domain-iam': 'iam_passwordpolicy_05'},
					{'domain-iam': 'iam_passwordpolicy_06'},
					{'domain-iam': 'iam_passwordpolicy_07'},
				],
				sec_identities_unique: [
					// 'Use temporary credentials'
					{'domain-iam': 'iam_sso_used'},
				],
				sec_identities_identity_provider: [
					// 'Rely on a centralized identity provider'
					{'domain-iam': 'iam_sso_used'},
				],
				sec_identities_audit: [
					// 'Audit and rotate credentials periodically'
					{'domain-iam': 'iam_access_keys_rotated'},
				],
				sec_identities_groups_attributes: [
					// 'Leverage user groups and attributes'
					{'domain-iam': 'iam_user_attached_policies'},
				],
				sec_identities_secrets: [
					{'domain-dp': 'secrets_or_encrypted_ssm_present'},
				],
			},
		},
		permissions: {
			// 'How do you manage permissions for people and machines?'
			// Only 3 choices have AWS rules here - the other 6 get suggestions from
			// Express Review custom questions (wellArchitectedCustomQuestions.js)
			answers: {
				sec_permissions_least_privileges: [
					// 'Grant least privilege access'
					{'domain-iam': 'iam_policy_full_admin'},
					{'domain-iam': 'iam_policy_s3_allaccess'},
					{'domain-iam': 'iam_policy_s3_readallaccess'},
					{'domain-iam': 'iam_policy_secretsmanager_allaccess'},
				],
				sec_permissions_analyze_cross_account: [
					// 'Analyze public and cross account access'
					{'domain-iam': 'accessanalyzer_enabled'},
				],
				sec_permissions_share_securely: [
					// 'Share resources securely'
					{'domain-iam': 'accessanalyzer_enabled'},
					{'domain-iam': 'accessanalyzer_findings'},
					{'domain-iam': 's3_bucket_public_access'},
					{'domain-iam': 'sns_public'},
					{'domain-iam': 'sqs_public'},
					{'domain-iam': 'es_public_access'},
					{'domain-iam': 'rds_public_snapshot'},
					{'domain-iam': 'ecr_public_repo'},
					{'domain-iam': 'emr_instances_public_access'},
					{'domain-iam': 'lambda_public_access'},
				],
			},
		},
		'detect-investigate-events': {
			// 'How do you detect and investigate security events?'
			answers: {
				sec_detect_investigate_events_app_service_logging: [
					// 'Configure service and application logging'
					{'domain-lm': 'cloudtrail_enabled'},
					{'domain-lm': 'vpc_flow_logs_enabled'},
					{'domain-lm': 's3_access_logging'},
					{'domain-lm': 'elb_01'},
					{'domain-lm': 'cloudfront_logging'},
					{'domain-lm': 'es_logging_enabled'},
					{'domain-lm': 'rds_logging_enabled'},
					{'domain-lm': 'waf_logging'},
					{'domain-lm': 'eks_control_plane_logging'},
					{'domain-lm': 'stage_access_logging'},
					{'domain-lm': 'acm_certificate_transparency_logging'},
					{'domain-lm': 'route53_resolver_vpc_query_logging_enabled'},
					{'domain-lm': 'docdb_audit_logs_enabled'},
					{'domain-lm': 'neptune_audit_logs_enabled"'},
				],
				sec_detect_investigate_events_analyze_all: [
					// 'Analyze logs, findings, and metrics centrally'
					{'domain-lm': 'cloudtrail_s3bucket_external'},
					{'domain-lm': 'guardduty_aggregated_to_other_account'},
					{'domain-lm': 'securityhub_aggregated_to_other_account'},
				],
				sec_detect_investigate_events_logs: [
					// 'Analyze logs, findings, and metrics centrally'
					{'domain-lm': 'cloudtrail_s3bucket_external'},
					{'domain-lm': 'guardduty_aggregated_to_other_account'},
					{'domain-lm': 'securityhub_aggregated_to_other_account'},
				],
				sec_detect_investigate_events_auto_response: [
					// 'Automate response to events'
					{'domain-lm': 'rule_s3_bucket_logging_remeditation'},
					{'domain-lm': 'rule_eip_attached_remeditation'},
					{
						'domain-lm': 'rule_s3_bucket_server_side_encryption_remeditation',
					},
				],
				sec_detect_investigate_events_noncompliant_resources: [
					// 'Automate response to events'
					{'domain-lm': 'rule_s3_bucket_logging_remeditation'},
					{'domain-lm': 'rule_eip_attached_remeditation'},
					{
						'domain-lm': 'rule_s3_bucket_server_side_encryption_remeditation',
					},
				],
				sec_detect_investigate_events_actionable_events: [
					// 'Implement actionable security events'
					{'domain-lm': 'guardduty_01'},
					{'domain-lm': 'rule_guardduty_findings'},
					{'domain-lm': 'securityhub_01'},
					{'domain-lm': 'alert_rule_security_hub_findings'},
					{'domain-lm': 'accessanalyzer_enabled'},
					{'domain-lm': 'rule_access_analyzer_findings'},
					{'domain-lm': 'macie_enabled'},
					{'domain-lm': 'rule_macie_findings'},
				],
			},
		},
		'network-protection': {
			// 'How do you protect your network resources?'
			answers: {
				sec_network_protection_create_layers: [
					{vpc: 'vpc_multi_layered_check'},
				],
				sec_network_protection_layered: [
					// 'Control traffic at all layers'
					{'domain-is': 'lambda_in_vpc'},
					{'domain-is': 'ec2_04'},
					{'domain-is': 'sg_all_ips_ports'},
					{'domain-is': 'sg_ssh_all'},
					{'domain-is': 'sg_rdp_all'},
				],

				sec_network_protection_inspection: [
					// 'Implement inspection and protection'
					{'domain-is': 'waf_associated_alb'},
					{'domain-is': 'restapi_WAF_ACL_attached'},
					{'domain-is': 'appsync_WAF_protected'},
					{'domain-is': 'cloudfront_waf'},
				],
			},
		},
		'protect-compute': {
			// 'How do you protect your compute resources?'
			answers: {
				sec_protect_compute_vulnerability_management: [
					// 'Perform vulnerability management'
					{'domain-is': 'ec2_managed_by_inspector'},
					{'domain-is': 'ec2_without_scan_30_days'},
				],
				sec_protect_compute_reduce_surface: [
					// 'Reduce attack surface'
					{'domain-is': 'ec2_managed_by_ssm'},
					{'domain-is': 'ec2_managed_by_ssm_compliant_patching'},
				],
				sec_protect_compute_auto_protection: [
					// 'Automate compute protection'
					{'domain-is': 'ec2_managed_by_inspector'},
					{'domain-is': 'ec2_managed_by_ssm'},
				],
				sec_protect_compute_actions_distance: [
					// 'Enable people to perform actions at a distance'
					{'domain-is': 'ec2_managed_by_ssm'},
				],
			},
		},
		'data-classification': {
			// 'How do you classify your data?'
			answers: {
				sec_data_classification_identify_data: [
					// 'Identify the data within your workload'
					{'domain-dp': 'macie_enabled'},
				],
			},
		},
		'protect-data-rest': {
			// 'How do you protect your data at rest?'
			answers: {
				sec_protect_data_rest_key_mgmt: [
					// Implement secure key management
					{kms: 'kms_rotation'},
					{kms: 'kms_public'},
				],
				sec_protect_data_rest_encrypt: [
					// Enforce encryption at rest
					{'domain-dp': 's3_bucket_encryption'},
					{'domain-dp': 'ec2_ebs_encryption'},
					{'domain-dp': 'ec2_03'},
					{'domain-dp': 'rds_03'},
					{'domain-dp': 'es_encrypted_storage'},
					{'domain-dp': 'sqs_encryption'},
					{'domain-dp': 'sns_encryption'},
					{'domain-dp': 'redshift_storage_encrypted'},
					{'domain-dp': 'dynamodb_server_side_encryption'},
					{'domain-dp': 'efs_encryption_enabled'},
					{'domain-dp': 'docdb_encryption_at_rest'},
					{'domain-dp': 'neptune_encryption_at_rest'},
					{'domain-dp': 'sagemaker_instance_storage_encryption'},
					{'domain-dp': 'sagemaker_job_volume_encryption'},
					{'domain-dp': 'glue_devendpoint_s3_encryption'},
					{'domain-dp': 'glue_devendpoint_cloudwatch_encryption'},
					{'domain-dp': 'glue_devendpoint_bookmark_encryption'},
					{'domain-dp': 'glue_devendpoint_bookmark_encryption'},
					{'domain-dp': 'glue_job_cloudwatch_encryption'},
					{'domain-dp': 'glue_job_bookmark_encryption'},
					{'domain-dp': 'glue_catalog_metadata_encryption'},
				],
				sec_protect_data_rest_automate_protection: [
					// Automate data at rest protection

					{'domain-dp': 'ec2_default_encryption'},
				],
				sec_protect_data_rest_access_control: [
					// Enforce access control
					{s3: 's3_no_bucket_policy'},
					{s3: 's3_04'},
					{ecr: 'ecr_resource_policy'},
					{elasticsearch: 'es_in_vpc'},
					{sqs: 'sqs_policy'},
				],
				sec_protect_data_rest_use_people_away: [
					// Use mechanisms to keep people away from dat
				],
			},
		},
		'protect-data-transit': {
			// 'How do you protect your data in transit?'
			answers: {
				sec_protect_data_transit_key_cert_mgmt: [
					// 'Implement secure key and certificate management'
					{acm: 'acm_certifiate_expired'},
					{acm: 'acm_certifiate_transparency_logging'},
				],
				sec_protect_data_transit_encrypt: [
					// 'Enforce encryption in transit'
					{'domain-dp': 's3_bucket_ssl_only'},

					{'domain-dp': 'elb_encrypted_listeners'},
					{'domain-dp': 'alb_listner_http_https_redirect'},
					{'domain-dp': 'cloudfront_https'},
					{'domain-dp': 'es_require_https'},
					{'domain-dp': 'glue_database_connection_SSL_encryption'},
				],
				sec_protect_data_transit_auto_unintended_access: [
					// 'Automate detection of unintended data access'
					{guardduty: 'guardduty_01'},
					{guardduty: 'guardduty_s3_protection'},
					{'domain-is': 'sg_all_ips_ports'},
					{'domain-is': 'sg_ssh_all'},
					{'domain-is': 'sg_rdp_all'},
				],
			},
		},
		'incident-response': {
			// 'How do you anticipate, respond to, and recover from incidents?'
			answers: {},
		},
		'backing-up-data': {
			//  How do you back up data?
			answers: {
				rel_backing_up_data_identified_backups_data: [
					// Identify and back up all data that needs to be backed up, or reproduce the data from sources

					{'domain-br': 'ec2_volumes_recent_snapshots'},
					{'domain-br': 'rds_04'},
					{'domain-br': 'redshit_automated_snapshots'},
					{'domain-br': 'dynamodb_PITR_enabled'},
					{'domain-br': 'backup_efs_covered'},
					{'domain-br': 'fsx_automated_backups'},
				],
				rel_backing_up_data_secured_backups_data: [
					//Secure and encrypt backups
					{ec2: 'ec2_03'},
					{ec2: 'ec2_11'},
					{rds: 'rds_public_snapshot'},
				],
				rel_backing_up_data_automated_backups_data: [
					{'domain-br': 'dlm_covered_ec2_and_ebs'},
					{'domain-br': 'backup_ebs_covered'},
					{'domain-br': 'backup_aurora_rds_covered'},
					{'domain-br': 'rds_04'},
					{'domain-br': 'redshit_automated_snapshots'},
					{'domain-br': 'backup_dynamodb_covered'},
					{'domain-br': 'backup_efs_covered'},
					{'domain-br': 'fsx_automated_backups'},
					{'domain-br': 'fsx_covered_by_aws_backup'},
				],
			},
		},
		'cloud-financial-management': {
			answers: {
				//How do you implement cloud financial management?
				cost_cloud_financial_management_usage_report: [
					//Report and notify on cost optimization
					{budgets: 'budgets_cost_defined'},
					{budgets: 'budgets_notification'},
				],
				cost_cloud_financial_management_proactive_process: [
					// Monitor cost proactively
					{budgets: 'budgets_notification'},
				],
			},
		},
		'monitor-usage': {
			answers: {
				// "How do you monitor usage and cost?"
				cost_monitor_usage_config_tools: [
					// Configure billing and cost management tools
					{budgets: 'budgets_cost_defined'},
				],
			},
		},
		'manage-service-limits': {
			answers: {
				// How do you manage service quotas and constraints?
				rel_manage_service_limits_limits_considered: [
					// Manage service quotas across accounts and regions
					{servicequotas: 'servicequotas_organization_quota_enabled'},
					{servicequotas: 'servicequotas_request_templates_exist'},
				],
				rel_manage_service_limits_automated_monitor_limits: [
					{servicequotas: 'servicequotas_request_templates_exist'},
				],
			},
		},
		'planning-network-topology': {
			answers: {
				//How do you plan your network topology??
				rel_planning_network_topology_ha_conn_private_networks: [
					// Provision redundant connectivity between private networks in the cloud and on-premises environments
					{vpc: 'vpn_tunnel_status'},
				],
				rel_planning_network_topology_ip_subnet_allocation: [
					{vpc: 'vpc_peering_connection_limit'},
				],
				rel_planning_network_topology_prefer_hub_and_spoke: [
					{vpc: 'vpc_peering_connection_limit'},
				],
			},
		},
		'adapt-to-changes': {
			answers: {
				// How do you design your workload to adapt to changes in demand?
				rel_adapt_to_changes_autoscale_adapt: [
					//Use automation when obtaining or scaling resources
					{autoscaling: 'autoscaling_used'},
				],
				rel_adapt_to_changes_reactive_adapt_auto: [
					//Obtain resources upon detection of impairment to a workload
					{autoscaling: 'autoscaling_group_load_balancer_health_check'},
				],
			},
		},
		'fault-isolation': {
			// How do you use fault isolation to protect your workload
			answers: {
				rel_fault_isolation_multiaz_region_system: [
					//Deploy the workload to multiple locations
					{vpc: 'vpc_subnet_multiaz'},
				],
			},
		},
		'withstand-component-failures': {
			// How do you design your workload to withstand component failures?
			answers: {
				rel_withstand_component_failures_auto_healing_system: [
					// Automate healing on all layers
					{autoscaling: 'autoscaling_group_load_balancer_health_check'},
				],
			},
		},
	},
	///// FTR Lense //////
	foundationaltechnicalreview: {
		sec_q1: {
			// How do you secure your AWS accounts?

			answers: {
				//'Root user is used only by exception
				sec_sec_q1_a3: [{iam: 'iam_root_lastused'}],

				//'Root user has multi-factor authentication (MFA) enabled.
				sec_sec_q1_a4: [{iam: 'iam_root_mfa'}],

				//'Root user has no access keys
				sec_sec_q1_a5: [{iam: 'iam_root_accesskeys'}],

				//'Configure AWS account contacts
				sec_sec_q1_a6: [],

				// Separate accounts are used for production and non-production stages
				sec_sec_q1_a7: [],
				// Separate accounts are used for critical and shared services
				sec_sec_q1_a8: [],

				//'Use AWS Organizations to manage your accounts.
				sec_sec_q1_a1: [],

				//'Restrict access to the AWS Organizations management account
				sec_sec_q1_a2: [],
			},
		},
		sec_q2: {
			answers: {
				// Enforce multi-factor authentication (MFA) for all administrators.
				sec_sec_q2_a2: [{iam: 'iam_policy_admins_without_mfa'}],

				// All IAM users have multi-factor authentication (MFA) enabled
				sec_sec_q2_a3: [{iam: 'iam_users_no_mfa'}],

				// Use roles for cross-account access
				sec_sec_q2_a4: [],

				// Use unique external ID for cross-account roles
				sec_sec_q2_a5: [{iam: 'iam_role_cross_account_external_id'}],

				// Store secrets in specialized service
				sec_sec_q2_a7: [],

				// Audit identities quarterly
				sec_sec_q2_a8: [],

				// Centralize identities for all administrators
				sec_sec_q2_a1: [{iam: 'iam_sso_used'}],

				// Use temporary credentials for API and CLI access
				sec_sec_q2_a6: [],
			},
		},
		sec_q3: {
			answers: {
				// Review IAM policies granting privileged access
				sec_sec_q3_a1: [],
				// Configure AWS Organizations Service Control Policies (SCPs)
				sec_sec_q3_a3: [
					{organizations: 'organizations_full_features'},
					{organizations: 'organizations_scp_restrict_root'},
					{organizations: 'organizations_scp_cloudtrail'},
				],
				// Use IAM Access Analyzer
				sec_sec_q3_a4: [{accessanalyzer: 'accessanalyzer_enabled'}],
			},
		},
		sec_q4: {
			answers: {
				// Configure CloudTrail multi-Region
				sec_sec_q4_a2: [
					{cloudtrail: 'cloudtrail_enabled'},
					{cloudtrail: 'cloudtrail_multiregion'},
				],
				// Protect log storage from unintended access
				sec_sec_q4_a3: [
					{cloudtrail: 'cloudtrail_05'},
					{cloudtrail: 'cloudtrail_s3bucket_public_access'},
				],
				// Enable CloudTrail log file integrity validation
				sec_sec_q4_a4: [{cloudtrail: 'cloudtrail_05'}],
				// Configure centralized threat detection for AWS accounts, workloads, and data
				sec_sec_q4_a5: [
					{guardduty: 'guardduty_01'},
					{guardduty: 'guardduty_aggregated_to_other_account'},
				],
				// Configure Amazon VPC Flow Logs
				sec_sec_q4_a6: [{vpc: 'vpc_flow_logs_enabled'}],
				// Configure Amazon S3 access logging
				sec_sec_q4_a7: [
					{s3: 's3_access_logging'},
					{cloudtrail: 'cloudtrail_s3_data_read_events_enabled'},
					{cloudtrail: 'cloudtrail_s3_data_write_events_enabled'},
				],
				// Configure AWS Config
				sec_sec_q4_a8: [{config: 'config_enabled'}],
				// Store logs in central account with limited access
				sec_sec_q4_a9: [{cloudtrail: 'cloudtrail_s3bucket_external'}],
				// Configure AWS Security Hub foundational best practices
				sec_sec_q4_a1: [
					{securityhub: 'securityhub_01'},
					{securityhub: 'securityhub_03'},
				],
			},
		},
		sec_q5: {
			answers: {
				// People are notified to take action on critical events
				sec_sec_q5_a1: [
					{monitoring_rules: 'rule_guardduty_findings'},
					{monitoring_rules: 'rule_health_event_findings'},
					{monitoring_rules: 'rule_macie_findings'},
					{
						monitoring_rules: 'log_metric_filter_and_alarm_root_account_usage',
					},
				],
				// Alerts create a ticket or task that is tracked
				sec_sec_q5_a2: [],
				// Events are escalated
				sec_sec_q5_a3: [],
			},
		},
		sec_q6: {
			answers: {
				// Patch EC2 operating systems automatically
				sec_sec_q6_a1: [
					{'domain-is': 'ec2_managed_by_ssm'},
					{'domain-is': 'ec2_managed_by_ssm_compliant_patching'},
				],
				// Scan source code libraries and dependencies
				sec_sec_q6_a2: [
					{'domain-is': 'ec2_managed_by_inspector'},
					{'domain-is': 'ec2_without_scan_30_days'},
					{ecr: 'ecr_vuln_scan'},
				],
				// Scan infrastructure
				sec_sec_q6_a3: [{securityhub: 'securityhub_01'}],
			},
		},
		sec_q7: {
			answers: {
				// Implement distributed denial of service (DDoS) protection
				sec_sec_q7_a1: [],
				// VPC security groups restrict inbound and outbound traffic
				sec_sec_q7_a2: [
					{'domain-is': 'sg_all_ips_ports'},
					{'domain-is': 'sg_ssh_all'},
					{'domain-is': 'sg_rdp_all'},
				],
				// Configure subnets to create layers
				sec_sec_q7_a3: [],
				// Periodically review unrestricted security groups
				sec_sec_q7_a4: [],
			},
		},
		sec_q8: {
			answers: {
				// Identify sensitive data
				sec_sec_q8_a1: [{macie: 'macie_enabled'}],
				// Encrypt all sensitive data at rest
				sec_sec_q8_a2: [
					{'domain-dp': 's3_bucket_encryption'},
					{'domain-dp': 'ec2_ebs_encryption'},
					{'domain-dp': 'ec2_03'},
					{'domain-dp': 'rds_03'},
					{'domain-dp': 'es_encrypted_storage'},
					{'domain-dp': 'sqs_encryption'},
					{'domain-dp': 'sns_encryption'},
					{'domain-dp': 'redshift_storage_encrypted'},
					{'domain-dp': 'dynamodb_server_side_encryption'},
					{'domain-dp': 'efs_encryption_enabled'},
					{'domain-dp': 'docdb_encryption_at_rest'},
					{'domain-dp': 'neptune_encryption_at_rest'},
					{'domain-dp': 'sagemaker_instance_storage_encryption'},
					{'domain-dp': 'sagemaker_job_volume_encryption'},
					{'domain-dp': 'glue_devendpoint_s3_encryption'},
					{'domain-dp': 'glue_devendpoint_cloudwatch_encryption'},
					{'domain-dp': 'glue_devendpoint_bookmark_encryption'},
					{'domain-dp': 'glue_devendpoint_bookmark_encryption'},
					{'domain-dp': 'glue_job_cloudwatch_encryption'},
					{'domain-dp': 'glue_job_bookmark_encryption'},
					{'domain-dp': 'glue_catalog_metadata_encryption'},
				],
				// Log access to sensitive data comprehensively throughout the system
				sec_sec_q8_a3: [
					{'domain-lm': 'cloudtrail_enabled'},
					{'domain-lm': 'vpc_flow_logs_enabled'},
					{'domain-lm': 's3_access_logging'},
					{'domain-lm': 'elb_01'},
					{'domain-lm': 'cloudfront_logging'},
					{'domain-lm': 'es_logging_enabled'},
					{'domain-lm': 'rds_logging_enabled'},
					{'domain-lm': 'waf_logging'},
					{'domain-lm': 'eks_control_plane_logging'},
					{'domain-lm': 'stage_access_logging'},
					{'domain-lm': 'acm_certificate_transparency_logging'},
					{'domain-lm': 'route53_resolver_vpc_query_logging_enabled'},
					{'domain-lm': 'docdb_audit_logs_enabled'},
					{'domain-lm': 'neptune_audit_logs_enabled"'},
				],
				// Manage encryption keys with AWS Key Management Service
				sec_sec_q8_a4: [],
				// Review permissions of all Amazon S3 buckets
				sec_sec_q8_a5: [{accessanalyzer: 'accessanalyzer_enabled'}],
				// Enable default encryption for Amazon S3 Buckets
				sec_sec_q8_a6: [{s3: 's3_bucket_encryption'}],
				// Enable default encryption for Amazon EBS volumes
				sec_sec_q8_a7: [{ec2: 'ec2_default_encryption'}],
				// Periodically review shared data
				sec_sec_q8_a8: [],
			},
		},
		sec_q9: {
			answers: {
				// Manage certificates centrally with Certificate Manager
				sec_sec_q9_a1: [],
				// Only use protocols with encryption
				sec_sec_q9_a2: [
					{'domain-dp': 's3_bucket_ssl_only'},

					{'domain-dp': 'elb_encrypted_listeners'},

					{'domain-dp': 'es_require_https'},
					{'domain-dp': 'glue_database_connection_SSL_encryption'},
				],

				// Block or redirect insecure protocols
				sec_sec_q9_a3: [
					{'domain-dp': 'alb_listner_http_https_redirect'},
					{'domain-dp': 'cloudfront_https'},
					{ec2: 'sg_insecure_ports'},
				],
			},
		},
		sec_q10: {
			answers: {},
		},
	},

	'arn:aws:wellarchitected::aws:lens/containerbuild': {
		COST1: {
			answers: {
				COST1_1: [
					{
						ecr: 'ecr_repository_lifecycle_policies',
					},
				],
			},
		},
		REL2: {
			answers: {
				REL2_1: [
					{
						efs: 'efs_lifecycle_policies_configured',
					},
				],
			},
		},

		SEC3: {
			answers: {
				SEC3_1: [
					{
						inspector2: 'inspector2_ecr_enabled',
					},
					{inspector2: 'inspector2_ecr_findings'},
					{inspector2: 'inspector2_ecr_covered'},
				],
			},
		},
		SEC4: {
			answers: {
				SEC4_1: [
					{
						ecr: 'ecr_public_repo',
					},
					{ecs: 'ecs_service_public_ip'},
					{ecs: 'ecs_task_definition_secure'},
				],
			},
		},
		SEC5: {
			answers: {
				SEC5_1: [
					{
						codebuild: 'codebuild_env_variables_clear_text_value',
					},
				],
			},
		},
	},

	'arn:aws:wellarchitected::aws:lens/devops': {
		AG_SAD: {
			answers: {
				AG_SAD_1: [{iam: 'iam_sso_used'}, {sso: 'aws_sso_enabled'}],
				AG_SAD_2: [
					{iam: 'iam_role_assume_public'},
					{iam: 'iam_policy_sts_assume'},
				],
				AG_SAD_3: [
					{codebuild: 'codebuild_env_variables_clear_text_value'},
					{codebuild: 'codebuild_project_s3_logs_encrypted'},
				],
				AG_SAD_4: [
					{iam: 'iam_users_no_mfa'},
					{iam: 'iam_policy_admins_without_mfa'},
				],
				AG_SAD_5: [
					{iam: 'iam_root_mfa'},
					{iam: 'iam_root_lastused'},
					{iam: 'iam_root_accesskeys'},
				],
				AG_SAD_6: [
					{iam: 'iam_unused_credentials'},
					{iam: 'iam_two_access_keys'},
					{iam: 'iam_user_attached_policies'},
				],
				AG_SAD_7: [
					{iam: 'iam_access_keys_rotated'},
					{secretsmanager: 'secretsmanager_automatic_rotation_enabled'},
					{kms: 'kms_rotation'},
					{acm: 'acm_certifiate_expired'},
				],
				AG_SAD_8: [
					{iam: 'iam_policy_service_wildcard'},
					{iam: 'iam_policy_full_admin'},
					{iam: 'iam_policy_blocked_kms_actions'},
				],
			},
		},
		AG_DLM: {
			answers: {
				AG_DLM_1: [
					{backup: 'backup_ebs_covered'},
					{backup: 'backup_ec2_covered'},
					{backup: 'backup_efs_covered'},
					{backup: 'backup_dynamodb_covered'},
					{backup: 'backup_aurora_rds_covered'},
					{backup: 'backup_documentdb_covered'},
					{backup: 'backup_neptune_covered'},
					{backup: 'backup_s3_covered'},
				],
				AG_DLM_2: [
					{s3: 's3_bucket_encryption'},
					{ec2: 'ec2_ebs_encryption'},
					{ec2: 'ec2_03'},
					{efs: 'efs_encryption_enabled'},
					{rds: 'rds_03'},
					{dynamodb: 'dynamodb_server_side_encryption'},
					{docdb: 'docdb_encryption_at_rest'},
					{neptune: 'neptune_encryption_at_rest'},
					{kms: 'kms_rotation'},
					{redshift: 'redshift_storage_encrypted'},
					{sqs: 'sqs_encryption'},
					{sns: 'sns_encryption'},
					{es: 'es_encrypted_storage'},
				],
				AG_DLM_3: [
					{glue: 'glue_devendpoint_s3_encryption'},
					{glue: 'glue_job_s3_encryption'},
					{glue: 'glue_job_cloudwatch_encryption'},
					{glue: 'glue_job_bookmark_encryption'},
					{glue: 'glue_catalog_metadata_encryption'},
				],
				AG_DLM_4: [
					{macie: 'macie_enabled'},
					{macie: 'macie_active_findings'},
					{macie: 's3_bucket_protected_by_macie'},
				],
				AG_DLM_5: [
					{s3: 's3_bucket_lifecycle_rules_configured'},
					{efs: 'efs_lifecycle_policies_configured'},
					{backup: 'backup_plan_min_retention_35_days'},
					{backup: 'backup_recovery_point_min_retention_35_days'},
				],
				AG_DLM_7: [
					{backup: 'backup_plan_cleanup'},
					{backup: 'backup_plan_min_retention_35_days'},
					{rds: 'rds_04'},
					{redshift: 'redshift_automated_snapshots'},
					{fsx: 'fsx_automated_backups'},
					{efs: 'efs_encryption_enabled'},
					{ec2: 'ec2_volumes_recent_snapshots'},
					{dlm: 'dlm_covered_ec2_and_ebs'},
				],
				AG_DLM_8: [
					{cloudtrail: 'cloudtrail_s3_data_read_events_enabled'},
					{cloudtrail: 'cloudtrail_s3_data_write_events_enabled'},
					{cloudtrail: 'cloudtrail_enabled'},
				],
			},
		},
		AG_DEP: {
			answers: {
				AG_DEP_1: [
					{organizations: 'organizations_full_features'},
					{organizations: 'account_part_of_organizations'},
					{organizations: 'organization_backup_policies_configured'},
				],
				AG_DEP_2: [
					{cloudformation: 'cloudformation_stack_drift_detection_7_days'},
					{cloudformation: 'cloudformation_stack_drift_detection_findings'},
				],
				AG_DEP_4: [
					{cloudformation: 'cloudformation_stack_delete_protection_enabled'},
				],
			},
		},
		AG_ACG: {
			answers: {
				AG_ACG_3: [
					{config: 'config_enabled'},
					{guardduty: 'guardduty_01'},
					{securityhub: 'securityhub_01'},
				],
				AG_ACG_4: [
					{organizations: 'organizations_scp_restrict_root'},
					{s3: 's3_account_s3_block_public_access'},
					{iam: 'iam_policy_full_admin'},
				],
				AG_ACG_5: [{macie: 'macie_enabled'}, {securityhub: 'securityhub_03'}],
				AG_ACG_6: [
					{autoremediation: 'rule_s3_bucket_logging_remeditation'},
					{
						autoremediation:
							'rule_s3_bucket_server_side_encryption_remeditation',
					},
					{autoremediation: 'rule_eip_attached_remeditation'},
				],
				AG_ACG_7: [
					{budgets: 'budgets_cost_defined'},
					{budgets: 'budgets_notification'},
					{costexplorer: 'cost_anomaly_monitor_defined'},
					{costexplorer: 'cost_anomaly_subscription_defined'},
				],
				AG_ACG_8: [
					{ec2: 'ec2_stopped_instance_30_days'},
					{sg: 'sg_unused'},
					{nacl: 'nacl_unused'},
				],
				AG_ACG_9: [
					{lambda: 'lambda_code_signing_enabled'},
					{ecr: 'ecr_vuln_scan'},
					{inspector2: 'inspector2_ecr_enabled'},
				],
				AG_ACG_10: [
					{monitoring_rules: 'rule_access_analyzer_findings'},
					{monitoring_rules: 'rule_macie_findings'},
					{monitoring_rules: 'rule_inspector2_findings'},
					{monitoring_rules: 'rule_security_hub_findings'},
					{monitoring_rules: 'rule_config_rules_compliance_change_findings'},
				],
				AG_ACG_11: [{lambda: 'lambda_code_signing_enabled'}],
			},
		},
		AG_CA: {
			answers: {
				AG_CA_1: [
					{cloudtrail: 'cloudtrail_enabled'},
					{cloudtrail: 'cloudtrail_multiregion'},
					{cloudtrail: 'cloudtrail_05'},
					{cloudtrail: 'cloudtrail_insights_enabled'},
					{cloudtrail: 'cloudtrail_global_services_enabled'},
				],
				AG_CA_2: [
					{config: 'config_enabled'},
					{config: 'config_global_resources'},
				],
			},
		},
		DL_LD: {
			answers: {
				DL_LD_7: [
					{budgets: 'budgets_cost_defined'},
					{budgets: 'budgets_notification'},
				],
				DL_LD_10: [
					{ec2: 'ec2_stopped_instance_30_days'},
					{igw: 'unused_igw'},
					{sg: 'sg_unused'},
				],
			},
		},
		DL_SCM: {
			answers: {
				DL_SCM_1: [{github: 'github_bitbucket_oauth'}],
				DL_SCM_3: [{ecr: 'ecr_resource_policy'}, {ecr: 'ecr_public_repo'}],
				DL_SCM_4: [{ecr: 'ecr_public_repo'}],
				DL_SCM_10: [
					{ecr: 'ecr_vuln_scan'},
					{inspector2: 'inspector2_ecr_enabled'},
				],
			},
		},
		DL_EAC: {
			answers: {
				DL_EAC_1: [
					{cloudformation: 'cloudformation_stack_delete_protection_enabled'},
					{cloudformation: 'cloudformation_stack_drift_detection_7_days'},
				],
				DL_EAC_4: [
					{config: 'config_enabled'},
					{config: 'config_global_resources'},
				],
				DL_EAC_7: [
					{ecr: 'ecr_vuln_scan'},
					{ecr: 'ecr_repository_lifecycle_policies'},
				],
			},
		},
		DL_CS: {
			answers: {
				DL_CS_1: [{lambda: 'lambda_code_signing_enabled'}],
				DL_CS_2: [{lambda: 'lambda_code_signing_enabled'}],
			},
		},
		DL_CI: {
			answers: {
				DL_CI_2: [
					{codebuild: 'codebuild_project_s3_logs_encrypted'},
					{codebuild: 'codebuild_env_variables_clear_text_value'},
				],
			},
		},
		DL_CD: {
			answers: {
				DL_CD_2: [
					{ecr: 'ecr_public_repo'},
					{ecr: 'ecr_resource_policy'},
					{lambda: 'lambda_code_signing_enabled'},
				],
				DL_CD_4: [{codebuild: 'codebuild_env_variables_clear_text_value'}],
			},
		},
		O_SI: {
			answers: {
				O_SI_3: [
					{cloudwatch: 'cloudwatchlogs_encrypted'},
					{cloudwatch: 'cloudwatchlogs_retention'},
				],
			},
		},
		O_DIP: {
			answers: {
				O_DIP_1: [
					{cloudwatch: 'cloudwatchlogs_retention'},
					{cloudwatch: 'cloudwatch_alarm_action_enabled'},
				],
				O_DIP_2: [
					{cloudwatch: 'cloudwatchlogs_encrypted'},
					{cloudtrail: 'cloudtrail_enabled'},
					{cloudtrail: 'cloudtrail_03'},
				],
				O_DIP_3: [{apigateway: 'restapi_stage_tracing_enabled'}],
			},
		},
		O_CM: {
			answers: {
				O_CM_1: [
					{
						monitoring_rules:
							'log_metric_filter_and_alarm_unauthorized_api_calls',
					},
					{monitoring_rules: 'log_metric_filter_and_alarm_console_mfa'},
					{monitoring_rules: 'log_metric_filter_and_alarm_root_account_usage'},
					{monitoring_rules: 'log_metric_filter_and_alarm_iam_policy_changes'},
				],
			},
		},
		QA_NFT: {
			answers: {
				QA_NT_5: [{securityhub: 'securityhub_03'}, {config: 'config_enabled'}],
			},
		},
		QA_ST: {
			answers: {
				QA_ST_1: [
					{inspector2: 'inspector2_ec2_enabled'},
					{inspector2: 'inspector2_ecr_enabled'},
					{inspector2: 'inspector2_ec2_covered'},
					{inspector2: 'inspector2_ecr_covered'},
				],
				QA_ST_2: [
					{securityhub: 'securityhub_01'},
					{securityhub: 'securityhub_03'},
					{securityhub: 'securityhub_aggregated_to_other_account'},
				],
				QA_ST_5: [{guardduty: 'guardduty_01'}, {guardduty: 'guardduty_02'}],
				QA_ST_6: [
					{ecr: 'ecr_vuln_scan'},
					{inspector2: 'inspector2_ecr_enabled'},
				],
			},
		},
		QA_DT: {
			answers: {
				QA_DT_4: [
					{costexplorer: 'cost_anomaly_monitor_defined'},
					{costexplorer: 'cost_anomaly_subscription_defined'},
				],
			},
		},
	},

	'arn:aws:wellarchitected::aws:lens/healthcare': {
		COST1: {
			answers: {
				COST1_2: [
					{s3: 's3_bucket_lifecycle_rules_configured'},
					{efs: 'efs_lifecycle_policies_configured'},
					{backup: 'backup_plan_min_retention_35_days'},
					{backup: 'backup_recovery_point_min_retention_35_days'},
				],
			},
		},
		OPS3: {
			answers: {
				OPS3_2: [
					{monitoring_rules: 'rule_config_rules_compliance_change_findings'},
				],
			},
		},
		OPS5: {
			answers: {
				OPS5_5: [
					{config: 'config_enabled'},
					{config: 'config_global_resources'},
				],
				OPS5_6: [{securityhub: 'securityhub_aggregated_to_other_account'}],
				OPS5_7: [
					{monitoring_rules: 'rule_config_rules_compliance_change_findings'},
				],
			},
		},
		OPS6: {
			answers: {
				OPS6_1: [
					{autoremediation: 'rule_s3_bucket_logging_remeditation'},
					{
						autoremediation:
							'rule_s3_bucket_server_side_encryption_remeditation',
					},
					{autoremediation: 'rule_eip_attached_remeditation'},
				],
			},
		},
		REL2: {
			answers: {
				REL2_1: [{vpc: 'vpc_subnet_multiaz'}],
			},
		},
		SEC1: {
			answers: {
				SEC1_4: [{macie: 'macie_enabled'}, {macie: 'macie_active_findings'}],
			},
		},
		SEC2: {
			answers: {
				SEC2_1: [{iam: 'iam_user_in_group'}],
			},
		},
		SEC3: {
			answers: {
				SEC3_1: [{cloudtrail: 'cloudtrail_enabled'}],
				SEC3_2: [{cloudtrail: 'cloudtrail_05'}],
			},
		},
		SEC4: {
			answers: {
				SEC4_2: [
					{
						monitoring_rules:
							'log_metric_filter_and_alarm_unauthorized_api_calls',
					},
				],
			},
		},
		SEC5: {
			answers: {
				SEC5_1: [{firewall: 'firewall_deletion_protection'}],
			},
		},
		SEC7: {
			answers: {
				SEC7_1: [{s3: 's3_bucket_encryption'}, {ec2: 'ec2_ebs_encryption'}],
				SEC7_2: [{rds: 'rds_03'}],
			},
		},
		SEC8: {
			answers: {
				SEC8_1: [{s3: 's3_bucket_public_access'}],
				SEC8_2: [{iam: 'iam_user_in_group'}],
			},
		},
	},

	'arn:aws:wellarchitected::aws:lens/machinelearning': {
		COST1: {
			answers: {
				COST1_3: [
					{budgets: 'budgets_cost_defined'},
					{costexplorer: 'cost_anomaly_monitor_defined'},
					{costexplorer: 'cost_anomaly_subscription_defined'},
				],
			},
		},

		COST3: {
			answers: {
				COST3_6: [
					{budgets: 'budgets_cost_defined'},
					{budgets: 'budgets_notification'},
				],
			},
		},

		PERF2: {
			answers: {
				PERF2_2: [{sagemaker: 'sagemaker_instance_storage_encryption'}],
				PERF2_4: [{ec2: 'ec2_instance_previous_generation_type'}],
			},
		},
		PERF3: {
			answers: {
				PERF3_1: [{codebuild: 'codebuild_project_s3_logs_encrypted'}],
				PERF3_2: [
					{
						monitoring_rules:
							'log_metric_filter_and_alarm_unauthorized_api_calls',
					},
				],
			},
		},
		REL1: {
			answers: {
				REL1_3: [{autoscaling: 'autoscaling_group_load_balancer_health_check'}],
			},
		},
		REL2: {
			answers: {
				REL2_3: [{glue: 'glue_job_s3_encryption'}],
			},
		},
		REL3: {
			answers: {
				REL3_1: [
					{cloudformation: 'cloudformation_stack_drift_detection_7_days'},
				],
				REL3_2: [{codebuild: 'codebuild_project_s3_logs_encrypted'}],
				REL3_3: [{ec2: 'ec2_termination_protection'}],
			},
		},
		SEC1: {
			answers: {
				SEC1_1: [],
				SEC1_2: [
					{sagemaker: 'sagemaker_instance_direct_internet_access'},
					{sagemaker: 'sagemaker_instance_vpc_configured'},
					{sagemaker: 'sagemaker_model_network_isolation'},
					{sagemaker: 'sagemaker_model_vpc_settings'},
					{sagemaker: 'sagemaker_job_network_isolation'},
					{sagemaker: 'sagemaker_job_vpc_settings'},
				],
			},
		},
		SEC2: {
			answers: {
				SEC2_1: [{sagemaker: 'sagemaker_instance_root_access'}],
				SEC2_2: [{sagemaker: 'sagemaker_instance_direct_internet_access'}],
				SEC2_3: [],
			},
		},
		SEC3: {
			answers: {
				SEC3_1: [{cloudtrail: 'cloudtrail_s3_data_read_events_enabled'}],
				SEC3_3: [
					{sagemaker: 'sagemaker_job_intercontainer_encryption'},
					{elasticsearch: 'es_encrypted_intransit'},
				],
				SEC3_5: [
					{sagemaker: 'sagemaker_instance_storage_encryption'},
					{sagemaker: 'sagemaker_job_volume_encryption'},
					{
						sagemaker:
							'sagemaker_endpoint_configuration_encryption_at_rest_enabled',
					},
				],
			},
		},
		SEC4: {
			answers: {
				SEC4_1: [
					{
						monitoring_rules:
							'log_metric_filter_and_alarm_console_authentication_failures',
					},
					{guardduty: 'guardduty_s3_protection'},
				],
				SEC4_2: [{guardduty: 'guardduty_01'}, {securityhub: 'securityhub_01'}],
			},
		},
	},

	serverless: {
		cost_q1: {
			answers: {
				cost_cost_q1_a2: [{cloudwatch: 'cloudwatchlogs_retention'}],
				cost_cost_q1_a4: [
					{costexplorer: 'cost_anomaly_monitor_defined'},
					{costexplorer: 'cost_anomaly_subscription_defined'},
				],
			},
		},
		ops_q1: {
			answers: {
				ops_ops_q1_a1: [{monitoring_rules: 'cloudwatch_alarm_action_enabled'}],
				ops_ops_q1_a3: [{apigateway: 'restapi_stage_tracing_enabled'}],
				ops_ops_q1_a4: [{apigateway: 'stage_logging_enabled'}],
			},
		},
		ops_q2: {
			answers: {
				ops_ops_q2_a1: [
					{cloudformation: 'cloudformation_stack_delete_protection_enabled'},
					{cloudformation: 'cloudformation_stack_drift_detection_7_days'},
				],
				ops_ops_q2_a5: [
					{config: 'config_enabled'},
					{config: 'config_global_resources'},
				],
			},
		},
		perf_q1: {
			answers: {
				perf_perf_q1_a2: [
					{lambda: 'lambda_function_concurrent_execution_limit_configured'},
				],
			},
		},

		sec_q1: {
			answers: {
				sec_sec_q1_a1: [{apigateway: 'apigwv2_authorization_type_configured'}],
				sec_sec_q1_a3: [
					{apigateway: 'restapi_private_public'},
					{apigateway: 'restapi_WAF_ACL_attached'},
				],
			},
		},
		// sec_q2: {
		// 	answers: {
		// 		sec_sec_q2_a4: [{iam: 'iam_sso_used'}],
		// 	},
		// },
		sec_q3: {
			answers: {
				sec_sec_q3_a2: [{lambda: 'lambda_code_signing_enabled'}],
				sec_sec_q3_a3: [
					{ecr: 'inspector2_ecr_enabled', ecr: 'inspector2_ecr_covered'},
				],
				sec_sec_q3_a4: [
					{codebuild: 'codebuild_env_variables_clear_text_value'},
					{secretsmanager: 'secretsmanager_secret_encrypted_with_kms_cmk'},
				],
			},
		},
	},

	softwareasaservice: {
		cost_q1: {
			answers: {
				cost_cost_q1_a2: [
					{costexplorer: 'cost_anomaly_monitor_defined'},
					{costexplorer: 'cost_anomaly_subscription_defined'},
				],
				cost_cost_q1_a3: [{budgets: 'budgets_cost_defined'}],
			},
		},
		cost_q2: {
			answers: {
				cost_cost_q2_a2: [
					{budgets: 'budgets_cost_defined'},
					{costexplorer: 'cost_anomaly_monitor_defined'},
					{costexplorer: 'cost_anomaly_subscription_defined'},
				],
			},
		},

		rel_q2: {
			answers: {
				rel_rel_q2_a1: [{cloudwatchlogs: 'cloudwatchlogs_retention'}],
				rel_rel_q2_a3: [
					{
						monitoring_rules:
							'log_metric_filter_and_alarm_unauthorized_api_calls',
					},
				],
				rel_rel_q2_a2: [{cloudtrail: 'cloudtrail_enabled'}],
			},
		},

		sec_q1: {
			answers: {
				sec_sec_q1_a2: [{sso: 'aws_sso_enabled'}],
			},
		},
	},

	'arn:aws:wellarchitected::aws:lens/genai': {
		gensec1: {
			answers: {
				gensec1_2: [
					{bedrock: 'bedrock_batch_inference_jobs_run_inside_vpc'},
					{bedrock: 'bedrock_custom_model_jobs_run_inside_vpc'},
				],
				gensec1_4: [
					{bedrock: 'bedrock_model_invocation_logging_enabled'},
					{bedrock: 'bedrock_kb_ingestion_logging_enabled'},
				],
			},
		},
		gensec2: {
			answers: {
				gensec2_1: [
					{bedrock: 'bedrock_agents_guardrails_associated'},
					{bedrock: 'bedrock_guardrails_prompt_attack_strength_high'},
				],
			},
		},
		gensec3: {
			answers: {
				gensec3_1: [
					{bedrock: 'bedrock_kb_ingestion_logging_enabled'},
					{bedrock: 'bedrock_model_invocation_logging_enabled'},
				],
			},
		},
		gensec4: {
			answers: {
				gensec4_1: [{bedrock: 'bedrock_prompt_catalog_versioning'}],
				gensec4_2: [
					{
						bedrock:
							'bedrock_guardrails_sensitive_information_filters_configured',
					},
				],
			},
		},

		genperf1: {
			answers: {
				genperf1_1: [
					{bedrock: 'bedrock_evaluation_jobs_prompt_dataset_configured'},
				],
			},
		},
		genperf3: {
			answers: {
				genperf3_1: [
					{bedrock: 'bedrock_managed_customization_or_hosting_in_use'},
				],
			},
		},
		genrel2: {
			answers: {
				genrel2_1: [{bedrock: 'bedrock_private_connectivity_redundant_azs'}],
			},
		},
		genrel3: {
			answers: {
				genrel3_1: [{bedrock: 'bedrock_flows_configured'}],
			},
		},
		genrel4: {
			answers: {
				genrel4_1: [{bedrock: 'bedrock_prompt_catalog_versioning'}],
			},
		},
	},
};
