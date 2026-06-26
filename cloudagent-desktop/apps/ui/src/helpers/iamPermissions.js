import { getRefParameter, mergeCfTemplates } from './cfTemplates/baseFunctions';
import { cfTemplateIamPolicy, cfTemplateIamRole } from './cfTemplates/iam';
import { mergeTfTemplates } from './tfTemplates/baseFunctions';
import { tfIamPolicy, tfIamRole } from './tfTemplates/iam';
import { SCAN_ENGINE_AWS_ACCOUNT_IDS } from '../config/appConfig';

export const PROVIDER_NAME = 'CloudAgent';

export const SCAN_ENGINE_AWS_ACCOUNT_ID = SCAN_ENGINE_AWS_ACCOUNT_IDS;

export const getCfTemplateForIamRole = ({
  roleName,
  externalId,
  managedPolicies,
  inlinePolicies = [],
  temporaryAccessHours,
}) => {
  
  const iamRoleTemplate = cfTemplateIamRole(
    {
      resourceNames: {},
      roleName: roleName,
      trustPolicy: { AWS: SCAN_ENGINE_AWS_ACCOUNT_ID },
      managedPolicies,
      inlinePolicies: [
        ...inlinePolicies,
        {
          PolicyName: 'DataAccessRestriction',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'DenySecretsManagerDataAccessActions',
                Effect: 'Deny',
                Action: ['secretsmanager:GetSecretValue'],
                Resource: '*',
              },
              {
                Sid: 'DenyS3DataAccessActions',
                Effect: 'Deny',
                Action: ['s3:GetObject', 's3:GetObjectVersion'],
                Resource: '*',
              },
            ],
          },
        },
        ...(temporaryAccessHours > 0
          ? [getIamPolicy(temporaryAccessHours)]
          : []),
      ],
      description: `IAM Role to allow acccess for ${PROVIDER_NAME} services`,
      externalId,
    },
    'Deploys necessary permissions for CloudAgent'
  ).cfTemplate;

  return iamRoleTemplate;
};

export const getIamPolicy = (hours) => {
  let currentTimestamp = new Date();

  currentTimestamp.setHours(currentTimestamp.getHours() + parseInt(hours));

  let policy = {
    PolicyName: 'TemporaryAccessPolicy',
    PolicyDocument: {
      Version: '2012-10-17',
      Statement:
        parseInt(hours) > 0
          ? [
              {
                Sid: 'TemporaryAccess',
                Effect: 'Deny',
                Action: '*',
                Resource: '*',
                Condition: {
                  DateGreaterThan: {
                    'aws:CurrentTime': currentTimestamp.toISOString(),
                  },
                },
              },
            ]
          : [],
    },
  };

  return policy;
};

export const getTfTemplateForIamRole = (
  roleName,
  externalId,
  servicesEnabled,
  accessType,
  temporaryAccessHours,
  restrictToCloudFormation
) => {
  // let cfTemplate = initCFTemplate();
  let inlinePolicies = [
    {
      PolicyName: 'BillingReadOnlyAccess',
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowBillingReadOnlyAccess',
            Effect: 'Allow',
            Action: ['ce:Get*', 'ce:List*'],
            Resource: '*',
          },
        ],
      },
    },
    {
      PolicyName: 'DataAccessRestriction',
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenySecretsManagerDataAccessActions',
            Effect: 'Deny',
            Action: ['secretsmanager:GetSecretValue'],
            Resource: '*',
          },
          {
            Sid: 'DenyS3DataAccessActions',
            Effect: 'Deny',
            Action: ['s3:GetObject', 's3:GetObjectVersion'],
            Resource: '*',
          },
        ],
      },
    },
  ];

  const iamPolicyTemplate = tfIamPolicy({
    policy: getIamPolicy(
      servicesEnabled,
      accessType,
      temporaryAccessHours,
      restrictToCloudFormation
    ),
    policyDescription: `Allow access for ${PROVIDER_NAME} services`,
    policyName: '',
  }).tfTemplate;

  let managedPolicies = [];
  let hours =
    temporaryAccessHours.length > 0 ? parseInt(temporaryAccessHours) || 0 : 0;
  if (accessType.includes('read-managed')) {
    managedPolicies.push('arn:aws:iam::aws:policy/ReadOnlyAccess');

    if (parseInt(hours) > 0) managedPolicies.push(getRefParameter('IamPolicy'));
  } else {
    managedPolicies.push(getRefParameter('IamPolicy'));
  }

  const iamRoleTemplate = tfIamRole({
    roleName: roleName,
    trustPolicy: { AWS: SCAN_ENGINE_AWS_ACCOUNT_ID },
    managedPolicies,
    inlinePolicies,
    description: `IAM Role to allow acccess for ${PROVIDER_NAME} services`,
    externalId,
    resourceNames: {},
  }).tfTemplate;

  return accessType.includes('read-managed') && !(parseInt(hours) > 0)
    ? iamRoleTemplate
    : mergeTfTemplates(iamPolicyTemplate, iamRoleTemplate);
};

export const services = [
  { key: 'config-rule-managed', text: 'AWS Config Rules (Managed Rules)' },
  { key: 'config-rule-custom', text: 'AWS Config Rules (Custom Rules)' },
  { key: 'cloudwatch-event', text: 'CloudWatch Event Rules' },
  { key: 'sns-topic', text: 'SNS Topics' },
  { key: 'cloudwatch-alarm', text: 'CloudWatch Alarms' },
  { key: 'config', text: 'Config' },
  { key: 'cloudtrail', text: 'CloudTrail' },
  { key: 'iam-policy', text: 'IAM Policies' },
  { key: 's3-policy', text: 'S3 Bucket Policies' },
  { key: 'security-group', text: 'Security Groups' },
  { key: 'network-acl', text: 'Network ACLs' },
  { key: 'flow-logs', text: 'VPC Flow Logs' },
  { key: 'guardduty', text: 'GuardDuty' },
  { key: 'scp', text: 'Service Control Policies' },
  { key: 'budgets', text: 'AWS Budgets' },
  { key: 's3', text: 'S3 Buckets' },
  { key: 'cwloggroup', text: 'CloudWatch Log Groups' },
  { key: 'kms', text: 'KMS' },
  { key: 'inspector', text: 'Inspector' },
  { key: 'iam-password-policy', text: 'IAM Password Settings' },
  { key: 's3-public-access', text: 'S3 Block Public Access ' },
  { key: 'ec2-default-encryption', text: 'EC2 Default Encryption' },
  { key: 'ssm-patchbaseline', text: 'Systems Manager Patch Baselines' },
  { key: 'ssm-maintenancewindow', text: 'Systems Manager Maintenance Windows' },
  { key: 'iam-role', text: 'IAM Roles for Systems Manager' },
  { key: 'vpc-endpoint', text: 'VPC Endpoints' },
  { key: 'security-hub', text: 'Security Hub' },
  { key: 'emr-block-public-access', text: 'EMR Block Public Access' },
  { key: 'emr-security-configuration', text: 'EMR Security Configurations' },
  { key: 'data-lifecycle-manager', text: 'Data Lifecycle Manager' },
  { key: 'access-analyzer', text: 'IAM Access Analyzer' },
  { key: 'dynamodb', text: 'DynamoDb' },
  { key: 'ssm-parameterstore', text: 'SSM Parameter Store' },
  { key: 'secretsmanager', text: 'Secrets Manager' },
  { key: 'lambda', text: 'Lambda' },
  { key: 'cloudfront', text: 'CloudFront' },
  { key: 'ecr', text: 'Amazon ECR' },
  { key: 'es', text: 'Amazon Elasticsearch' },
  { key: 'rds', text: 'Amazon RDS' },
  { key: 'elb', text: 'Elastic Load Balancing' },
  { key: 'organizations', text: 'AWS Organizations' },
  { key: 'sqs', text: 'SQS' },
  { key: 'waf', text: 'AWS WAF' },
  { key: 'backup', text: 'AWS Backup' },
];

export const servicesPermissionList = {
  cloudformation: {
    create: ['cloudformation:CreateStack', 'cloudformation:DescribeStacks'],
    update: [
      'cloudformation:UpdateStack',
      'cloudformation:CreateChangeSet',
      'cloudformation:DescribeChangeSet',
      'cloudformation:ExecuteChangeSet',
      'cloudformation:DeleteChangeSet',
    ],
    delete: ['cloudformation:DeleteStack'],
    read: [
      'cloudformation:Describe*',
      'cloudformation:Get*',
      'cloudformation:List*',
      'cloudformation:Detect*',
    ],
  },

  'config-rule-managed': {
    create: [
      'config:PutConfigRule',
      'config:PutRemediationExceptions',
      'config:PutRemediationConfigurations',
    ],
    delete: [
      'config:DeleteRemediationConfiguration',
      'config:DeleteConfigRule',
      'config:DeleteRemediationExceptions',
      'config:DescribeConfigRules',
    ],
    read: [
      'config:Get*',
      'config:Describe*',
      'config:List*',
      'tag:GetResources',
      'tag:GetTagKeys',
    ],
  },
  'config-rule-custom': {
    create: [
      'config:PutConfigRule',
      'config:PutRemediationExceptions',
      'config:PutRemediationConfigurations',
      'lambda:CreateFunction',
      'lambda:AddPermission',
      'iam:PassRole',
      'iam:CreateRole',
      'iam:AttachRolePolicy',
      'iam:PutRolePolicy',
      'iam:UpdateAssumeRolePolicy',
    ],
    delete: [
      'config:DeleteRemediationConfiguration',
      'config:DeleteConfigRule',
      'config:DeleteRemediationExceptions',
      'config:DescribeConfigRules',
      'lambda:DeleteFunction',
      'lambda:RemovePermission',
      'iam:DeleteRole',
      'iam:DeleteRolePolicy',
    ],
    read: [
      'config:Get*',
      'config:Describe*',
      'config:List*',
      'tag:GetResources',
      'tag:GetTagKeys',
    ],
  },
  'cloudwatch-event': {
    create: [
      'events:PutRule',
      'events:PutTargets',
      'events:EnableRule',
      'events:PutPermission',
      'events:DescribeRule',
      'sns:CreateTopic',
      'sns:Subscribe',
      'sns:ListTopics',
      'sns:GetTopicAttributes',
      'sns:SetTopicAttributes',
    ],
    delete: [
      'events:DeleteRule',
      'events:RemoveTargets',
      'events:RemovePermission',
      'events:DisableRule',
      'sns:DeleteTopic',
      'sns:Unsubscribe',
    ],
    read: [
      'events:DescribeRule',
      'events:DescribeEventBus',
      'events:DescribeEventSource',
      'events:ListEventBuses',
      'events:ListEventSources',
      'events:ListRuleNamesByTarget',
      'events:ListRules',
      'events:ListTargetsByRule',
    ],
  },
  'sns-topic': {
    create: [
      'sns:CreateTopic',
      'sns:Subscribe',
      'sns:ListTopics',
      'sns:GetTopicAttributes',
      'sns:SetTopicAttributes',
    ],
    delete: ['sns:DeleteTopic', 'sns:Unsubscribe'],
    read: ['sns:GetTopicAttributes', 'sns:List*'],
  },

  'cloudwatch-alarm': {
    create: [
      'cloudwatch:PutMetricAlarm',
      'cloudwatch:EnableAlarmActions',
      'cloudwatch:DescribeAlarms',
      'logs:PutMetricFilter',
      'sns:CreateTopic',
      'sns:Subscribe',
      'sns:ListTopics',
      'sns:GetTopicAttributes',
      'sns:SetTopicAttributes',
    ],
    delete: [
      'cloudwatch:DeleteAlarms',
      'cloudwatch:DisableAlarmActions',
      'logs:DeleteMetricFilter',
      'sns:DeleteTopic',
      'sns:Unsubscribe',
    ],
    read: ['cloudwatch:Describe*', 'cloudwatch:Get*', 'cloudwatch:List*'],
  },
  config: {
    create: [
      'config:PutConfigurationRecorder',
      'config:StartConfigurationRecorder',
      'config:PutDeliveryChannel',
      'iam:PassRole',
      'iam:CreateRole',
      'iam:AttachRolePolicy',
      'iam:PutRolePolicy',
      'iam:UpdateAssumeRolePolicy',
      'iam:GetRole',
      's3:CreateBucket',
      's3:PutBucketAcl',
      's3:PutBucketPolicy',
    ],
    delete: [
      'config:DeleteDeliveryChannel',
      'config:StopConfigurationRecorder',
      'config:DeleteConfigurationRecorder',
      'iam:DeleteRole',
      'iam:DeleteRolePolicy',
      's3:DeleteBucket',
      'iam:GetPolicy',
    ],
    read: [
      'config:Get*',
      'config:Describe*',
      'config:List*',
      'tag:GetResources',
      'tag:GetTagKeys',
    ],
  },
  cloudtrail: {
    create: [
      'cloudtrail:DescribeTrails',
      'cloudtrail:StartLogging',
      'cloudtrail:CreateTrail',
      'cloudtrail:PutEventSelectors',
      'logs:DescribeLogGroups',
      'logs:CreateLogGroup',
      's3:CreateBucket',
      's3:PutBucketAcl',
      's3:PutBucketPolicy',
      'iam:GetRole',
      'iam:PassRole',
      'iam:CreateRole',
      'iam:AttachRolePolicy',
      'iam:PutRolePolicy',
      'iam:UpdateAssumeRolePolicy',
    ],
    delete: [
      'cloudtrail:StopLogging',
      'cloudtrail:DeleteTrail',
      'logs:DeleteRetentionPolicy',
      's3:DeleteBucket',
      'iam:DeleteRole',
      'iam:DeleteRolePolicy',
      'iam:GetPolicy',
    ],
    read: [
      'cloudtrail:GetTrail',
      'cloudtrail:GetTrailStatus',
      'cloudtrail:DescribeTrails',
      'cloudtrail:ListTrails',
      'cloudtrail:ListTags',
      'cloudtrail:ListPublicKeys',
      'cloudtrail:GetEventSelectors',
      'cloudtrail:GetInsightSelectors',
      's3:ListAllMyBuckets',
      'kms:ListAliases',
    ],
  },

  'iam-policy': {
    create: ['iam:CreatePolicy', 'iam:CreatePolicyVersion'],
    delete: ['iam:DeletePolicy', 'iam:DeletePolicyVersion', 'iam:GetPolicy'],
    read: [
      'iam:GenerateCredentialReport',
      'iam:GenerateServiceLastAccessedDetails',
      'iam:Get*',
      'iam:List*',
      'iam:SimulateCustomPolicy',
      'iam:SimulatePrincipalPolicy',
    ],
  },
  's3-policy': {
    create: ['s3:PutBucketPolicy'],
    delete: ['s3:DeleteBucketPolicy'],
    read: ['s3:Get*', 's3:List*'],
  },
  s3: {
    create: [
      's3:CreateBucket',
      's3:PutAccountPublicAccessBlock',
      's3:PutBucketPublicAccessBlock',
      's3:PutReplicationConfiguration',
      's3:DeleteBucketPolicy',
      's3:PutEncryptionConfiguration',
      's3:PutObjectRetention',
      's3:PutBucketTagging',
      's3:PutBucketLogging',
      's3:PutLifecycleConfiguration',
      's3:PutBucketAcl',
      's3:PutBucketPolicy',
      's3:PutAccessPointPolicy',
      's3:PutBucketVersioning',
    ],
    delete: [
      's3:DeleteAccessPoint',
      's3:DeleteBucketPolicy',
      's3:DeleteAccessPointPolicy',
      's3:DeleteBucket',
    ],
    read: ['s3:Get*', 's3:List*'],
  },

  'security-group': {
    create: [
      'ec2:CreateSecurityGroup',
      'ec2:AuthorizeSecurityGroupEgress',
      'ec2:AuthorizeSecurityGroupIngress',
      'ec2:UpdateSecurityGroupRuleDescriptionsEgress',
      'ec2:UpdateSecurityGroupRuleDescriptionsIngress',
      'ec2:DescribeSecurityGroups',
    ],
    delete: [
      'ec2:RevokeSecurityGroupIngress',
      'ec2:RevokeSecurityGroupEgress',
      'ec2:DeleteSecurityGroup',
    ],
    read: ['ec2:Describe*'],
  },

  'network-acl': {
    create: [
      'ec2:CreateNetworkAcl',
      'ec2:CreateNetworkAclEntry',
      'ec2:ReplaceNetworkAclEntry',
      'ec2:DescribeNetworkAcls',
    ],
    delete: ['ec2:DeleteNetworkAcl', 'ec2:DeleteNetworkAclEntry'],
    read: ['ec2:Describe*'],
  },
  'flow-logs': {
    create: [
      'ec2:CreateFlowLogs',
      'logs:CreateLogDelivery',
      's3:GetBucketPolicy',
    ],
    delete: ['ec2:DeleteFlowLogs'],
    read: ['ec2:Describe*'],
  },
  guardduty: {
    create: [
      'guardduty:CreateDetector',
      'guardduty:CreateMembers',
      'guardduty:UpdateDetector',
      'guardduty:CreatePublishingDestination',
      'guardduty:AcceptInvitation',
      'guardduty:InviteMembers',
      'guardduty:StartMonitoringMembers',
    ],
    delete: [
      'guardduty:DeleteMembers',
      'guardduty:DisassociateFromMasterAccount',
      'guardduty:DeleteInvitations',
      'guardduty:DeleteDetector',
      'guardduty:DisassociateMembers',
      'guardduty:ListDetectors ',
    ],
    read: ['guardduty:Get*', 'guardduty:List*'],
  },
  scp: {
    create: [
      'organizations:CreatePolicy',
      'lambda:GetFunction',
      'lambda:GetFunctionConfiguration',
      'lambda:InvokeFunction',
    ],
    delete: ['organizations:DeletePolicy'],
    read: ['organizations:Describe*', 'organizations:List*'],
  },
  budgets: {
    create: ['budgets:ModifyBudget'],
    delete: [],
    read: ['budgets:ViewBudget', 'budgets:Describe*'],
  },

  cwloggroup: {
    create: [
      'logs:AssociateKmsKey',
      'logs:PutRetentionPolicy',
      'logs:CreateLogGroup',
    ],
    delete: ['logs:DeleteLogGroup', 'logs:DeleteRetentionPolicy'],
    read: [
      'logs:Describe*',
      'logs:Get*',
      'logs:List*',
      'logs:StartQuery',
      'logs:StopQuery',
      'logs:TestMetricFilter',
      'logs:FilterLogEvents',
    ],
  },
  kms: {
    create: ['kms:CreateKey'],
    delete: ['kms:ScheduleKeyDeletion'],
    read: ['kms:Describe*', 'kms:Get*', 'kms:List*'],
  },
  inspector: {
    create: [
      'inspector:UpdateAssessmentTarget',

      'inspector:CreateAssessmentTemplate',
      'inspector:SubscribeToEvent',

      'inspector:CreateAssessmentTarget',
      'inspector:CreateResourceGroup',
    ],
    delete: [
      'inspector:DeleteAssessmentTemplate',
      'inspector:DeleteAssessmentRun',
      'inspector:DeleteAssessmentTarget',
      'inspector:UnsubscribeFromEvent',
    ],
    read: [
      'inspector:Describe*',
      'inspector:Get*',
      'inspector:List*',
      'inspector:Preview*',
      'ec2:DescribeInstances',
      'ec2:DescribeTags',
      'sns:ListTopics',
      'events:DescribeRule',
      'events:ListRuleNamesByTarget',
    ],
  },
  'iam-password-policy': {
    create: ['iam:UpdateAccountPasswordPolicy'],
    delete: [],
    read: [
      'iam:GenerateCredentialReport',
      'iam:GenerateServiceLastAccessedDetails',
      'iam:Get*',
      'iam:List*',
      'iam:SimulateCustomPolicy',
      'iam:SimulatePrincipalPolicy',
    ],
  },
  's3-public-access': {
    create: ['s3:PutAccountPublicAccessBlock'],
    delete: [],
    read: ['s3:Get*', 's3:List*'],
  },
  'ec2-default-encryption': {
    create: ['ec2:EnableEbsEncryptionByDefault'],
    delete: ['ec2:DisableEbsEncryptionByDefault'],
    read: ['ec2:Describe*'],
  },

  'iam-role': {
    create: [
      'iam:CreateRole',
      'iam:AttachRolePolicy',
      'iam:PutRolePolicy',
      'iam:UpdateAssumeRolePolicy',
    ],
    delete: ['iam:DetachRolePolicy', 'iam:DeleteRolePolicy'],
    read: [
      'iam:GenerateCredentialReport',
      'iam:GenerateServiceLastAccessedDetails',
      'iam:Get*',
      'iam:List*',
      'iam:SimulateCustomPolicy',
      'iam:SimulatePrincipalPolicy',
    ],
  },

  'security-hub': {
    create: [
      'securityhub:EnableSecurityHub',
      'securityhub:CreateMembers',
      'securityhub:UpdateStandardsControl',
    ],
    delete: ['securityhub:DisableSecurityHub'],
    read: ['securityhub:Get*', 'securityhub:List*', 'securityhub:Describe*'],
  },
  'emr-block-public-access': {
    create: ['elasticmapreduce:PutBlockPublicAccessConfiguration'],
    delete: [],
    read: ['elasticmapreduce:Describe*', 'elasticmapreduce:List*'],
  },
  'emr-security-configuration': {
    create: [
      'elasticmapreduce:CreateSecurityConfiguration',
      'elasticmapreduce:DescribeSecurityConfiguration',
    ],
    delete: ['elasticmapreduce:DeleteSecurityConfiguration'],
    read: ['elasticmapreduce:Describe*', 'elasticmapreduce:List*'],
  },
  'data-lifecycle-manager': {
    create: ['dlm:CreateLifecyclePolicy', 'dlm:UpdateLifecyclePolicy'],
    delete: ['dlm:DeleteLifecyclePolicy'],
    read: [
      'dlm:GetLifecyclePolicy',
      'dlm:ListTagsForResource',
      'dlm:GetLifecyclePolicies',
    ],
  },
  'vpc-endpoint': {
    create: [
      'ec2:CreateVpcEndpointServiceConfiguration',
      'ec2:ModifyVpcEndpointServicePermissions',
      'ec2:ModifyVpcEndpointServiceConfiguration',
      'ec2:CreateVpcEndpoint',
      'ec2:DescribeVpcEndpoints',
      'ec2:ModifyVpcEndpoint',
      'ec2:CreateSecurityGroup',
      'ec2:AuthorizeSecurityGroupEgress',
      'ec2:AuthorizeSecurityGroupIngress',
      'ec2:UpdateSecurityGroupRuleDescriptionsEgress',
      'ec2:UpdateSecurityGroupRuleDescriptionsIngress',
      'ec2:DescribeSecurityGroups',
    ],
    delete: [
      'ec2:DeleteVpcEndpoints',
      'ec2:DeleteVpcEndpointServiceConfigurations',
      'ec2:RevokeSecurityGroupIngress',
      'ec2:RevokeSecurityGroupEgress',
      'ec2:DeleteSecurityGroup',
    ],
    read: ['ec2:Describe*'],
  },
  'access-analyzer': {
    create: [
      'access-analyzer:CreateArchiveRule',
      'access-analyzer:CreateAnalyzer',
      'access-analyzer:UpdateArchiveRule',
    ],
    delete: [
      'access-analyzer:DeleteArchiveRule',
      'access-analyzer:DeleteAnalyzer',
    ],
    read: ['access-analyzer:Get*', 'access-analyzer:List*'],
  },
  'ssm-patchbaseline': {
    create: [
      'ssm:UpdatePatchBaseline',
      'ssm:RegisterPatchBaselineForPatchGroup',
      'ssm:RegisterDefaultPatchBaseline',
      'ssm:CreatePatchBaseline',
      'ssm:AddTagsToResource',
    ],
    delete: [
      'ssm:DeletePatchBaseline',
      'ssm:DeregisterPatchBaselineForPatchGroup',
      'ssm:GetPatchBaseline',
    ],
    read: ['ssm:Describe*', 'ssm:Get*', 'ssm:List*'],
  },
  'ssm-maintenancewindow': {
    create: [
      'ssm:UpdateMaintenanceWindow',
      'ssm:RegisterTaskWithMaintenanceWindow',
      'ssm:CreateMaintenanceWindow',
      'ssm:RegisterTargetWithMaintenanceWindow',
      'ssm:UpdateMaintenanceWindowTask',
      'ssm:UpdateMaintenanceWindowTarget',
    ],
    delete: [
      'ssm:DeleteMaintenanceWindow',
      'ssm:DeregisterTaskFromMaintenanceWindow',
      'ssm:DeregisterTargetFromMaintenanceWindow',
    ],
    read: ['ssm:Describe*', 'ssm:Get*', 'ssm:List*'],
  },
  dynamodb: {
    create: [],
    delete: [],
    read: ['dynamodb:Describe*', 'dynamodb:List*'],
  },
  'ssm-parameterstore': {
    create: [],
    delete: [],
    read: ['ssm:DescribeParameters'],
  },
  secretsmanager: {
    create: [],
    delete: [],
    read: [
      'secretsmanager:List*',
      'secretsmanager:GetResourcePolicy',
      'secretsmanager:DescribeSecret',
    ],
  },
  lambda: {
    create: [],
    delete: [],
    read: [
      'lambda:ListFunctions',
      'lambda:GetFunctionEventInvokeConfig',
      'lambda:GetFunction',
      'lambda:GetFunctionConfiguration',
      'lambda:GetPolicy',
    ],
  },
  cloudfront: {
    create: [],
    delete: [],
    read: [
      'cloudfront:GetDistribution',
      'cloudfront:List*',
      'cloudfront:GetDistributionConfig',
    ],
  },
  ecr: {
    create: [],
    delete: [],
    read: ['ecr:Describe*', 'ecr:GetRepositoryPolicy'],
  },
  es: {
    create: [],
    delete: [],
    read: ['es:List*', 'es:Describe*'],
  },
  rds: {
    create: [],
    delete: [],
    read: ['rds:Describe*'],
  },
  elb: {
    create: [],
    delete: [],
    read: ['elasticloadbalancing:Describe*'],
  },
  organizations: {
    create: [],
    delete: [],
    read: ['organizations:List*', 'organizations:Describe*'],
  },
  waf: {
    create: [],
    delete: [],
    read: [
      'wafv2:ListResourcesForWebACL',
      'waf:ListWebACLs',
      'waf-regional:ListWebACLs',
      'wafv2:ListWebACLs',
      'wafv2:GetWebACL',
      'waf:GetWebACL',
      'waf-regional:ListResourcesForWebACL',
      'waf-regional:GetWebACL',
    ],
  },
  sqs: {
    create: [],
    delete: [],
    read: ['sqs:GetQueueAttributes', 'sqs:ListQueues'],
  },
  backup: {
    create: [],
    delete: [],
    read: [
      'backup:Get*',
      'backup:List*',
      'backup:Describe*',
      'backup:ExportBackupPlanTemplate',
    ],
  },
};
