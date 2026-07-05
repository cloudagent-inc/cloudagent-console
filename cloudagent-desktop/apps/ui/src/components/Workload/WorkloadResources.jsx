
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
  Cloud,
  RefreshCcw,
  Radar,
  ListPlus,
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  loadWorkloadsFromUserProfile,
} from '../../features/workload/workloadSlice';
import { updateWorkloadDefinition } from '@/features/workload/workloadSlice';
import toast from 'react-hot-toast';
import { getRegionOptions, filterCloudEnvironments } from '@/helpers/shared';
import { buildGitRepo, cleanGitRepo, getGithubConnections } from '@/helpers/github';
import rulesData from '../../helpers/rules.json';
import {
  fetchCloudFormationStacks,
  fetchCloudFormationStackResources,
} from '@/api/scanner';
import { listGithubBranches } from '@/api/integrations/github';
import {
  launchHealthScans,
  selectWorkloadHealthRequestsById,
} from '@/features/health/healthSlice';
import { getGlobalWorkloadSecurityRules } from '@/components/SecurityCompliance/securityRulesUtils';
import { getGlobalWorkloadDeploymentPreferences } from '@/features/workload/workloadCreationUtils';
import {
  getAwsAccountIdForWorkloadEnvironment,
  normalizeWorkloadEnvironmentIds,
} from '@/features/workload/workloadEnvironmentUtils';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';


// Utility functions for rules management
const groupRulesByCategory = (rules) => {
    const grouped = {};
    rules.forEach(rule => {
      rule.category.forEach(category => {
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(rule);
      });
    });
    return grouped;
  };
  
  const groupRulesByService = (rules) => {
    const grouped = {};
    rules.forEach(rule => {
      const serviceName = rule.serviceName;
      if (!grouped[serviceName]) {
        grouped[serviceName] = [];
      }
      grouped[serviceName].push(rule);
    });
    return grouped;
  };
  
  const createSecurityRulesConfig = (rulesByCategory) => {
    const config = {};
    Object.keys(rulesByCategory).forEach(category => {
      const categoryKey = category.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      config[categoryKey] = {
        label: `${category} Rules`,
        rules: {}
      };
      
      rulesByCategory[category].forEach(rule => {
        config[categoryKey].rules[rule.id] = {
          title: rule.title,
          description: rule.description,
          serviceName: rule.serviceName
        };
      });
    });
    return config;
  };
  
  // Create the new security rules structure with separate categories and rules
  const createSecurityRulesStructure = (existingSecurityRules = null) => {
    const rulesByCategory = groupRulesByCategory(rulesData);
    const rulesByService = groupRulesByService(rulesData);
    
    // Initialize categories structure
    const categories = {};
    
    // Add category-based groupings
    Object.keys(rulesByCategory).forEach(category => {
      const categoryKey = category.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      categories[categoryKey] = {
        label: category,
        enable_all: false,
        _expanded: false
      };
    });
    
    // Add service-based groupings
    Object.keys(rulesByService).forEach(service => {
      const serviceKey = service.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      categories[serviceKey] = {
        label: service,
        enable_all: false,
        _expanded: false
      };
    });
    
    // Initialize rules structure - all rules with enabled status
    const rules = {};
    rulesData.forEach(rule => {
      rules[rule.id] = {
        enabled: false
      };
    });
    
    // Apply existing data if provided
    if (existingSecurityRules) {
      // Handle old format - extract enabled rules from old structure
      if (existingSecurityRules.enabledRuleIds) {
        // Legacy support for enabledRuleIds array
        existingSecurityRules.enabledRuleIds.forEach(ruleId => {
          if (rules[ruleId]) {
            rules[ruleId].enabled = true;
          }
        });
      } else if (existingSecurityRules.rules) {
        // New format - directly use rules object
        Object.keys(existingSecurityRules.rules).forEach(ruleId => {
          if (rules[ruleId] && existingSecurityRules.rules[ruleId]) {
            rules[ruleId] = {
              ...rules[ruleId],
              ...existingSecurityRules.rules[ruleId]
            };
          }
        });
      } else {
        // Handle old nested structure
        Object.keys(existingSecurityRules).forEach(categoryKey => {
          if (typeof existingSecurityRules[categoryKey] === 'object') {
            Object.keys(existingSecurityRules[categoryKey]).forEach(key => {
              if (key !== 'enable_all' && key !== '_expanded' && existingSecurityRules[categoryKey][key]?.enabled === true) {
                if (rules[key]) {
                  rules[key].enabled = true;
                }
              }
            });
          }
        });
      }
      
      // Apply existing category settings if available
      if (existingSecurityRules.categories) {
        Object.keys(existingSecurityRules.categories).forEach(categoryKey => {
          if (categories[categoryKey]) {
            categories[categoryKey] = {
              ...categories[categoryKey],
              ...existingSecurityRules.categories[categoryKey]
            };
          }
        });
      }
    }
    
    // Update category enable_all states based on rules
    Object.keys(categories).forEach(categoryKey => {
      const categoryRules = getCategoryRules(categoryKey);
      const allEnabled = categoryRules.length > 0 && categoryRules.every(ruleId => rules[ruleId]?.enabled === true);
      categories[categoryKey].enable_all = allEnabled;
    });
    
    return {
      categories,
      rules
    };
  };
  
  // Helper function to get rules for a specific category
  const getCategoryRules = (categoryKey) => {
    const rulesByCategory = groupRulesByCategory(rulesData);
    const rulesByService = groupRulesByService(rulesData);
    
    // Find matching category or service
    const categoryName = Object.keys(rulesByCategory).find(cat => 
      cat.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') === categoryKey
    );
    
    const serviceName = Object.keys(rulesByService).find(service => 
      service.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') === categoryKey
    );
    
    if (categoryName && rulesByCategory[categoryName]) {
      return rulesByCategory[categoryName].map(rule => rule.id);
    }
    
    if (serviceName && rulesByService[serviceName]) {
      return rulesByService[serviceName].map(rule => rule.id);
    }
    
    return [];
  };
  
  // Helper function to count unique enabled rules (avoiding duplicates)
  const countUniqueEnabledRules = (securityRules) => {
    if (!securityRules || !securityRules.rules) return 0;
    
    return Object.keys(securityRules.rules).filter(ruleId => 
      securityRules.rules[ruleId]?.enabled === true
    ).length;
  };
  
  // Helper function to get all unique rule IDs from the rules data
  const getAllUniqueRuleIds = () => {
    const uniqueRuleIds = new Set();
    rulesData.forEach(rule => {
      uniqueRuleIds.add(rule.id);
    });
    return uniqueRuleIds;
  };
  
  // Helper function to check if all unique rules are enabled
  const areAllUniqueRulesEnabled = (securityRules) => {
    if (!securityRules || !securityRules.rules) return false;
    
    const enabledRuleIds = Object.keys(securityRules.rules).filter(ruleId => 
      securityRules.rules[ruleId]?.enabled === true
    );
    
    const allUniqueRuleIds = getAllUniqueRuleIds();
    return enabledRuleIds.length === allUniqueRuleIds.size && allUniqueRuleIds.size > 0;
  };
  

  // Security preset configurations
  const securityPresets = {
    'none': {
      name: 'No Security Rules',
      description: 'No security rules applied',
      rules: []
    },
    'relaxed': {
      name: 'Relaxed Sandbox',
      description: 'No clear text passwords',
      rules: [
        // Cost & Billing related rules
        'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
        'CLOUDTRAIL_ENABLED',
        // No clear text passwords
        'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
        'RDS_SNAPSHOTS_PUBLIC_PROHIBITED'
      ]
    },
    'basic': {
      name: 'Basic Security',
      description: 'Adds no public access restrictions',
      rules: [
        // Include relaxed rules
        'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
        'CLOUDTRAIL_ENABLED',
        'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
        'RDS_SNAPSHOTS_PUBLIC_PROHIBITED',
        // Add no public access
        'EC2_SECURITY_GROUP_ATTACHED_TO_ENI',
        'S3_BUCKET_PUBLIC_ACCESS_PROHIBITED',
        'RDS_INSTANCE_PUBLIC_ACCESS_CHECK',
        'REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK'
      ]
    },
    'development': {
      name: 'Development Environments',
      description: 'Adds logging and encryption in-transit',
      rules: [
        // Include basic rules
        'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
        'CLOUDTRAIL_ENABLED',
        'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
        'RDS_SNAPSHOTS_PUBLIC_PROHIBITED',
        'EC2_SECURITY_GROUP_ATTACHED_TO_ENI',
        'S3_BUCKET_PUBLIC_ACCESS_PROHIBITED',
        'RDS_INSTANCE_PUBLIC_ACCESS_CHECK',
        'REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK',
        // Add logging
        'CLOUDTRAIL_LOG_FILE_VALIDATION_ENABLED',
        'S3_BUCKET_LOGGING_ENABLED',
        'VPC_FLOW_LOGS_ENABLED',
        // Add encryption in-transit
        'ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK',
        'S3_BUCKET_SSL_REQUESTS_ONLY',
        'RDS_IN_TRANSIT_ENCRYPTION_ENABLED'
      ]
    },
    'production': {
      name: 'Production',
      description: 'Adds backup, encryption at-rest, resiliency',
      rules: [
        // Include development rules
        'EC2_INSTANCE_DETAILED_MONITORING_ENABLED',
        'CLOUDTRAIL_ENABLED',
        'RDS_INSTANCE_PUBLIC_READ_REPLICA_ACCESS_CHECK',
        'RDS_SNAPSHOTS_PUBLIC_PROHIBITED',
        'EC2_SECURITY_GROUP_ATTACHED_TO_ENI',
        'S3_BUCKET_PUBLIC_ACCESS_PROHIBITED',
        'RDS_INSTANCE_PUBLIC_ACCESS_CHECK',
        'REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK',
        'CLOUDTRAIL_LOG_FILE_VALIDATION_ENABLED',
        'S3_BUCKET_LOGGING_ENABLED',
        'VPC_FLOW_LOGS_ENABLED',
        'ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK',
        'S3_BUCKET_SSL_REQUESTS_ONLY',
        'RDS_IN_TRANSIT_ENCRYPTION_ENABLED',
        // Add backup
        'RDS_DB_INSTANCE_BACKUP_ENABLED',
        'DYNAMODB_POINT_IN_TIME_RECOVERY_ENABLED',
        'S3_BUCKET_CROSS_REGION_REPLICATION_ENABLED',
        // Add encryption at-rest
        'RDS_STORAGE_ENCRYPTED',
        'S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED',
        'EBS_OPTIMIZED_INSTANCE',
        // Add resiliency
        'RDS_MULTI_AZ_SUPPORT',
        'ELB_CROSS_ZONE_LOAD_BALANCING_ENABLED',
        'AUTO_SCALING_GROUP_ELB_HEALTH_CHECK_REQUIRED'
      ]
    },
    'all': {
      name: 'All Best Practices',
      description: 'Complete security coverage with all available rules',
      rules: 'all' // Special value to enable all rules
    }
  };
  
  // Helper function to apply a security preset
  const applySecurityPreset = (presetKey, securityRules) => {
    const preset = securityPresets[presetKey];
    if (!preset) return securityRules;

    // Create a new security rules structure based on current structure
    const newSecurityRules = {
      categories: { ...securityRules.categories },
      rules: { ...securityRules.rules }
    };

    // First, disable all rules
    Object.keys(newSecurityRules.rules).forEach(ruleId => {
      newSecurityRules.rules[ruleId] = { enabled: false };
    });

    // Enable rules based on preset
    if (preset.rules === 'all') {
      // Enable all rules
      Object.keys(newSecurityRules.rules).forEach(ruleId => {
        newSecurityRules.rules[ruleId] = { enabled: true };
      });
    } else {
      // Enable specific rules from preset
      preset.rules.forEach(ruleId => {
        if (newSecurityRules.rules[ruleId]) {
          newSecurityRules.rules[ruleId] = { enabled: true };
        }
      });
    }

    // Update category enable_all flags based on rules
    Object.keys(newSecurityRules.categories).forEach(categoryKey => {
      const categoryRules = getCategoryRules(categoryKey);
      const allEnabled = categoryRules.length > 0 && categoryRules.every(ruleId => 
        newSecurityRules.rules[ruleId]?.enabled === true
      );
      newSecurityRules.categories[categoryKey].enable_all = allEnabled;
    });

    return newSecurityRules;
  };
  
  // Group rules by category and service for config
  const rulesByCategory = groupRulesByCategory(rulesData);
  const rulesByService = groupRulesByService(rulesData);
  const securityRulesConfig = createSecurityRulesConfig(rulesByCategory);
  const securityRulesConfigByService = createSecurityRulesConfig(rulesByService);

  const awsRegionOptions = getRegionOptions();

  const manualResourceTypeOptions = [
    { value: 'DynamoDB Table', label: 'DynamoDB Table', service: 'DynamoDB' },
    { value: 'EC2 Instance', label: 'EC2 Instance', service: 'EC2' },
    { value: 'IAM Role', label: 'IAM Role', service: 'IAM' },
    { value: 'Lambda Function', label: 'Lambda Function', service: 'Lambda' },
    { value: 'S3 Bucket', label: 'S3 Bucket', service: 'S3' },
    
  ];

  const resourceScanServiceOptions = [
    { value: 's3', label: 'S3' },
    { value: 'dynamodb', label: 'DynamoDB' },
    { value: 'lambda', label: 'Lambda' },
    { value: 'iam', label: 'IAM' },
    { value: 'ec2', label: 'EC2' },
    { value: 'elbv2', label: 'Elastic Load Balancing V2' },
    { value: 'ecs', label: 'ECS' },
    { value: 'logs', label: 'Logs' },
    { value: 'autoscaling', label: 'Auto Scaling' },
    { value: 'ecr', label: 'ECR' },
    { value: 'eks', label: 'EKS' },
    { value: 'rds', label: 'RDS' },
    { value: 'elasticache', label: 'ElastiCache' },
    { value: 'opensearch', label: 'OpenSearch Service' },
    { value: 'efs', label: 'EFS' },
    { value: 'sqs', label: 'SQS' },
    { value: 'sns', label: 'SNS' },
    { value: 'apigateway', label: 'API Gateway' },
    { value: 'apigatewayv2', label: 'API Gateway V2' },
    { value: 'cloudfront', label: 'CloudFront' },
    { value: 'sfn', label: 'Step Functions' },
  ];

  const SERVICE_SLUGS = {
    DynamoDB: 'dynamodb',
    EC2: 'ec2',
    IAM: 'iam',
    Lambda: 'lambda',
    S3: 's3',
    ElasticLoadBalancingV2: 'elbv2',
    ECS: 'ecs',
    Logs: 'logs',
    AutoScaling: 'autoscaling',
    ECR: 'ecr',
    EKS: 'eks',
    RDS: 'rds',
    ElastiCache: 'elasticache',
    OpenSearchService: 'opensearch',
    EFS: 'efs',
    SQS: 'sqs',
    SNS: 'sns',
    ApiGateway: 'apigateway',
    ApiGatewayV2: 'apigatewayv2',
    CloudFront: 'cloudfront',
    StepFunctions: 'sfn',
  };

  const SERVICE_NAME_BY_SLUG = Object.fromEntries(
    Object.entries(SERVICE_SLUGS).map(([name, slug]) => [slug, name])
  );

  const RESOURCE_TYPE_BY_SERVICE_SLUG = {
    dynamodb: 'DynamoDB Table',
    ec2: 'EC2 Instance',
    iam: 'IAM Role',
    lambda: 'Lambda Function',
    s3: 'S3 Bucket',
    elbv2: 'Application Load Balancer',
    ecs: 'ECS Service',
    logs: 'CloudWatch Log Group',
    autoscaling: 'Auto Scaling Group',
    ecr: 'ECR Repository',
    eks: 'EKS Cluster',
    rds: 'RDS Instance',
    elasticache: 'ElastiCache Cluster',
    opensearch: 'OpenSearch Domain',
    efs: 'EFS File System',
    sqs: 'SQS Queue',
    sns: 'SNS Topic',
    apigateway: 'API Gateway REST API',
    apigatewayv2: 'API Gateway HTTP/WebSocket API',
    sfn: 'Step Functions State Machine',
  };

  const CANONICAL_RESOURCE_TYPE_BY_SERVICE_SLUG = {
    dynamodb: 'AWS::DynamoDB::Table',
    ec2: 'AWS::EC2::Instance',
    iam: 'AWS::IAM::Role',
    lambda: 'AWS::Lambda::Function',
    s3: 'AWS::S3::Bucket',
    elbv2: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    ecs: 'AWS::ECS::Service',
    logs: 'AWS::Logs::LogGroup',
    autoscaling: 'AWS::AutoScaling::AutoScalingGroup',
    ecr: 'AWS::ECR::Repository',
    eks: 'AWS::EKS::Cluster',
    rds: 'AWS::RDS::DBInstance',
    elasticache: 'AWS::ElastiCache::CacheCluster',
    opensearch: 'AWS::OpenSearchService::Domain',
    efs: 'AWS::EFS::FileSystem',
    sqs: 'AWS::SQS::Queue',
    sns: 'AWS::SNS::Topic',
    apigateway: 'AWS::ApiGateway::RestApi',
    apigatewayv2: 'AWS::ApiGatewayV2::Api',
    cloudfront: 'AWS::CloudFront::Distribution',
    sfn: 'AWS::StepFunctions::StateMachine',
  };

  const CANONICAL_RESOURCE_TYPE_BY_LABEL = {
    'DynamoDB Table': 'AWS::DynamoDB::Table',
    'EC2 Instance': 'AWS::EC2::Instance',
    'IAM Role': 'AWS::IAM::Role',
    'Lambda Function': 'AWS::Lambda::Function',
    'S3 Bucket': 'AWS::S3::Bucket',
    'Application Load Balancer': 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    'ECS Service': 'AWS::ECS::Service',
    'CloudWatch Log Group': 'AWS::Logs::LogGroup',
    'Auto Scaling Group': 'AWS::AutoScaling::AutoScalingGroup',
    'ECR Repository': 'AWS::ECR::Repository',
    'EKS Cluster': 'AWS::EKS::Cluster',
    'RDS Instance': 'AWS::RDS::DBInstance',
    'ElastiCache Cluster': 'AWS::ElastiCache::CacheCluster',
    'OpenSearch Domain': 'AWS::OpenSearchService::Domain',
    'EFS File System': 'AWS::EFS::FileSystem',
    'SQS Queue': 'AWS::SQS::Queue',
    'SNS Topic': 'AWS::SNS::Topic',
    'API Gateway REST API': 'AWS::ApiGateway::RestApi',
    'API Gateway HTTP/WebSocket API': 'AWS::ApiGatewayV2::Api',
    'Step Functions State Machine': 'AWS::StepFunctions::StateMachine',
  };

  const normalizeServiceName = (name) =>
    typeof name === 'string' ? name.trim() : '';

  const getServiceSlugFromName = (name) => {
    const normalized = normalizeServiceName(name);
    if (!normalized) return '';
    if (SERVICE_SLUGS[normalized]) {
      return SERVICE_SLUGS[normalized];
    }
    const upper = normalized.toUpperCase();
    if (SERVICE_SLUGS[upper]) {
      return SERVICE_SLUGS[upper];
    }
    const lower = normalized.toLowerCase();
    if (SERVICE_NAME_BY_SLUG[lower]) {
      return lower;
    }
    return lower.replace(/\s+/g, '');
  };

  const getServiceSlugForResourceType = (resourceType) => {
    const manualOption = manualResourceTypeOptions.find(
      (item) => item.value === resourceType
    );
    if (manualOption) {
      return getServiceSlugFromName(manualOption.service || manualOption.label);
    }
    const scanOption = resourceScanServiceOptions.find(
      (item) => item.value === resourceType || item.label === resourceType
    );
    if (scanOption) {
      return scanOption.value;
    }
    return getServiceSlugFromName(resourceType);
  };

  const getServiceDisplayFromSlug = (slug) =>
    SERVICE_NAME_BY_SLUG[slug] || slug?.toUpperCase() || '';

  const getResourceTypeLabelFromSlug = (slug, fallbackType) =>
    RESOURCE_TYPE_BY_SERVICE_SLUG[slug] || fallbackType || 'AWS Resource';

  const isCanonicalAwsResourceType = (resourceType) =>
    typeof resourceType === 'string' && resourceType.startsWith('AWS::');

  const toCanonicalResourceType = (resourceType, serviceSlug = '') => {
    if (isCanonicalAwsResourceType(resourceType)) {
      return resourceType;
    }

    if (resourceType && CANONICAL_RESOURCE_TYPE_BY_LABEL[resourceType]) {
      return CANONICAL_RESOURCE_TYPE_BY_LABEL[resourceType];
    }

    if (
      serviceSlug &&
      CANONICAL_RESOURCE_TYPE_BY_SERVICE_SLUG[serviceSlug]
    ) {
      return CANONICAL_RESOURCE_TYPE_BY_SERVICE_SLUG[serviceSlug];
    }

    return resourceType || '';
  };

  const normalizeHealthStatus = (status) => {
    const normalized = typeof status === 'string' ? status.toLowerCase().trim() : '';
    if (normalized === 'healthy') return 'healthy';
    if (normalized === 'not_applicable') return 'not_applicable';
    return 'not_healthy';
  };

  const isNotApplicableHealthMessage = (errorText) =>
    typeof errorText === 'string' &&
    errorText.trim().toLowerCase() === 'no health checks were returned for this resource.';

  const isResourceHealthNotApplicable = (resource) => {
    const health = resource?.health || {};
    if (health?.notApplicable === true) return true;
    const errors = Array.isArray(health?.errors) ? health.errors : [];
    return errors.some((errorText) => isNotApplicableHealthMessage(errorText));
  };

  const getResourceHealthCounts = (resource) => {
    const checks = Array.isArray(resource?.health?.checks)
      ? resource.health.checks
      : [];
    const counts = checks.reduce(
      (acc, check) => {
        const normalized = normalizeHealthStatus(check?.status);
        if (normalized === 'healthy') {
          acc.healthy += 1;
        } else if (normalized === 'not_applicable') {
          acc.notApplicable += 1;
        } else {
          acc.notHealthy += 1;
        }
        return acc;
      },
      { healthy: 0, notHealthy: 0, notApplicable: 0 }
    );
    return {
      healthy: counts.healthy,
      notHealthy: counts.notHealthy,
      notApplicable: counts.notApplicable,
      total: checks.length,
    };
  };

  const EMPTY_RESOURCE_INVENTORY = [];

  // Extract accountId and region from a CloudFormation stack ARN, if possible
  const parseCloudFormationStackArn = (arn) => {
    if (typeof arn !== 'string') return { accountId: '', region: '' };
    // arn:aws:cloudformation:<region>:<accountId>:stack/<name>/<id>
    const match = arn.match(
      /^arn:aws:cloudformation:([^:]+):(\d{12}):stack\/.+$/
    );
    if (!match) return { accountId: '', region: '' };
    return { region: match[1] || '', accountId: match[2] || '' };
  };

  const normalizeResourceIdentityParts = (resource = {}, resolveAccountIdFn = null) => {
    const rawAccountId = resource?.accountId || '';
    const normalizedAccountId = resolveAccountIdFn
      ? resolveAccountIdFn(rawAccountId)
      : rawAccountId;
    const accountId = normalizedAccountId ? String(normalizedAccountId).trim() : '';
    const region = typeof resource?.region === 'string' ? resource.region.trim() : '';
    const resourceId = typeof resource?.resourceId === 'string' ? resource.resourceId.trim() : '';
    const resourceArn = typeof resource?.resourceArn === 'string' ? resource.resourceArn.trim() : '';
    return {
      accountId,
      region,
      resourceId,
      resourceArn,
    };
  };

  const buildResourceIdentityKeys = (resource = {}, resolveAccountIdFn = null) => {
    const { accountId, region, resourceId, resourceArn } =
      normalizeResourceIdentityParts(resource, resolveAccountIdFn);
    const keys = new Set();

    const pushKey = (identifier) => {
      if (!identifier) return;
      keys.add(`${accountId}|${region}|${identifier}`);
      keys.add(`${accountId}||${identifier}`);
      keys.add(`|${region}|${identifier}`);
      keys.add(`||${identifier}`);
    };

    pushKey(resourceArn);
    pushKey(resourceId);

    return keys;
  };

  const sanitizeTrackedResourceEntries = (resourcesInput) => {
    if (!Array.isArray(resourcesInput)) return [];
    return resourcesInput
      .filter((resource) => resource && typeof resource === 'object')
      .map((resource) => {
        const { source: _source, ...rest } = resource;
        return rest;
      });
  };

  const summarizeResourceForDebug = (resource = {}, resolveAccountIdFn = null) => {
    const identityKeys = Array.from(
      buildResourceIdentityKeys(resource, resolveAccountIdFn)
    );
    const normalized = normalizeResourceIdentityParts(resource, resolveAccountIdFn);
    return {
      displayName: resource?.displayName || '',
      resourceId: resource?.resourceId || '',
      resourceArn: resource?.resourceArn || '',
      resourceType: resource?.resourceType || '',
      service: resource?.service || '',
      accountId: resource?.accountId || '',
      normalizedAccountId: normalized.accountId,
      region: resource?.region || '',
      normalizedRegion: normalized.region,
      identityKeys,
    };
  };

  const parseSummaryField = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const parseS3KeyFromPath = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!trimmed.startsWith('s3://')) return trimmed;
    const slashIndex = trimmed.indexOf('/', 's3://'.length);
    if (slashIndex < 0) return '';
    return trimmed.slice(slashIndex + 1);
  };

  const normalizeHealthAnalysisMetadata = (health) => {
    if (!health || typeof health !== 'object') return null;
    const objectKey =
      (typeof health.objectKey === 'string' && health.objectKey.trim()) ||
      (typeof health.fileKey === 'string' && health.fileKey.trim()) ||
      (typeof health.key === 'string' && health.key.trim()) ||
      parseS3KeyFromPath(health.path) ||
      '';
    const path =
      (typeof health.path === 'string' && health.path.trim()) ||
      (objectKey ? `s3://${health.bucket || ''}/${objectKey}`.replace('s3:///', 's3://') : '');
    const fileName =
      (typeof health.fileName === 'string' && health.fileName.trim()) ||
      (objectKey ? objectKey.split('/').filter(Boolean).pop() : '') ||
      '';
    const generatedAt =
      (typeof health.generatedAt === 'string' && health.generatedAt.trim()) ||
      (typeof health.createdAt === 'string' && health.createdAt.trim()) ||
      '';
    const parsedLookbackHours = Number(health?.options?.lookbackHours);
    const normalizedLookbackHours =
      Number.isFinite(parsedLookbackHours) && parsedLookbackHours > 0
        ? Math.min(Math.round(parsedLookbackHours), 24 * 5)
        : null;
    const normalizedIncludeCloudWatchLogChecks =
      health?.options?.includeCloudWatchLogChecks === true;
    const options =
      normalizedLookbackHours || normalizedIncludeCloudWatchLogChecks
        ? {
            lookbackHours: normalizedLookbackHours,
            includeCloudWatchLogChecks: normalizedIncludeCloudWatchLogChecks,
          }
        : null;

    if (!objectKey && !fileName && !generatedAt) return null;
    return {
      fileName,
      objectKey,
      path,
      generatedAt,
      options,
    };
  };

function WorkloadResourcesPage({ embedded = false, hideSummaryCards = false, formData: externalFormData, setFormData: externalSetFormData }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { workloadId } = useParams();
    const usingExternalFormState =
      embedded && !!externalFormData && typeof externalSetFormData === 'function';
    const userProfile = useSelector((state) => state.auth.userProfile);
    const workloadHealthRequestsById = useSelector(selectWorkloadHealthRequestsById);
    const isLocalMode = isLocalRuntime();
    const githubConnections = useMemo(
      () => getGithubConnections(userProfile),
      [userProfile]
    );
    const workloads = useSelector((state) => state.workload.workloads);
    const workload = useMemo(
      () => workloads.find((item) => item.workloadId === workloadId),
      [workloads, workloadId]
    );
    const workloadSummary = useMemo(
      () => parseSummaryField(workload?.summary),
      [workload?.summary]
    );
    const persistedHealthAnalysis = useMemo(
      () => normalizeHealthAnalysisMetadata(workloadSummary?.analysis?.health),
      [workloadSummary?.analysis?.health]
    );
    const onClose = useCallback(() => {
      navigate(-1);
    }, [navigate]);
    const hideGeneralTab = false;

    useEffect(() => {
      if (
        userProfile?.workloads &&
        userProfile.workloads.length > 0 &&
        workloads.length === 0
      ) {
        dispatch(loadWorkloadsFromUserProfile(userProfile.workloads));
      }
    }, [dispatch, userProfile?.workloads, workloads.length]);
  
    // Helper function to safely parse JSON or return default
    const safeParseJson = (jsonString, defaultValue) => {
      if (!jsonString) return defaultValue;
      if (typeof jsonString === 'object') return jsonString; // Already parsed
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        console.error('Error parsing JSON in WorkloadModal:', error);
        return defaultValue;
      }
    };
  
    // Utility function to safely parse JSON strings (keeping for backward compatibility)
    const safeJsonParse = (jsonString, defaultValue = {}) => {
      if (!jsonString || typeof jsonString !== 'string') {
        return defaultValue;
      }
  
      try {
        const parsed = JSON.parse(jsonString);
        return parsed || defaultValue;
      } catch (error) {
        console.error('Error parsing JSON string:', error);
        console.error('JSON string was:', jsonString);
        return defaultValue;
      }
    };

    const parseTrackedResources = (
      rawTrackedResources,
      fallback = { resources: [], stacks: [] }
    ) => {
      const parsed = safeParseJson(rawTrackedResources, fallback);
      if (!parsed || typeof parsed !== 'object') {
        return { ...(fallback || {}), resources: [], stacks: [] };
      }
      const normalized = {
        ...(fallback || {}),
        ...parsed,
      };
      if (
        Array.isArray(normalized.trackedResources) &&
        !Array.isArray(normalized.resources)
      ) {
        normalized.resources = normalized.trackedResources;
      }
      if (!Array.isArray(normalized.resources)) {
        normalized.resources = [];
      }
      if (!Array.isArray(normalized.stacks)) {
        normalized.stacks = [];
      }
      normalized.resources = normalized.resources
        .filter((resource) => resource && typeof resource === 'object')
        .map((resource) => {
          const { source: _source, ...rest } = resource;
          return rest;
        });
      return normalized;
    };

    const sanitizeStackEntries = (stacksInput) => {
      if (!Array.isArray(stacksInput)) return [];
      return stacksInput
        .filter(
          (stack) => stack && stack.stackId && String(stack.stackId).trim() !== ''
        )
        .map((stack) => ({
          stackId: String(stack.stackId).trim(),
          name: stack.name || '',
          description: stack.description || '',
          region: stack.region || '',
          accountId: stack.accountId || '',
        }));
    };

    const getTrackedStacks = (
      trackedResourcesObj,
      deploymentPreferencesObj = {}
    ) => {
      if (
        Array.isArray(trackedResourcesObj?.stacks) &&
        trackedResourcesObj.stacks.length > 0
      ) {
        return trackedResourcesObj.stacks;
      }
      if (Array.isArray(deploymentPreferencesObj?.stacks)) {
        return deploymentPreferencesObj.stacks;
      }
      return [];
    };
  
    // Debug logging to see what workload data we're receiving
  
    // Security rules configuration is now dynamically generated from rules.json
  
    const [activeTab, setActiveTab] = useState('resources');
    const [regionsDropdownOpen, setRegionsDropdownOpen] = useState(false);
    const regionsDropdownRef = useRef(null);
    const [groupBy, setGroupBy] = useState('category'); // 'category' or 'service'
    const [resourceInventory, setResourceInventory] = useState(
      () => EMPTY_RESOURCE_INVENTORY
    );
    const [availableStackImports, setAvailableStackImports] = useState([]);
    const [availableResourceImports, setAvailableResourceImports] = useState(
      []
    );
    const [isScanningStacks, setIsScanningStacks] = useState(false);
    const [isStackScanModalOpen, setIsStackScanModalOpen] = useState(false);
    const [lastStackScanAt, setLastStackScanAt] = useState(null);
    const [lastResourceScanAt, setLastResourceScanAt] = useState(null);
    const [manualResourceDraft, setManualResourceDraft] = useState({
      name: '',
      identifier: '',
      type: manualResourceTypeOptions[0]?.value || 'DynamoDB Table',
      environment: 'Production',
      region: 'us-east-1',
    });
    const [isManualResourceModalOpen, setIsManualResourceModalOpen] =
      useState(false);
    const [isAwsScanModalOpen, setIsAwsScanModalOpen] = useState(false);
    const [selectedAwsScanResourceIds, setSelectedAwsScanResourceIds] = useState(
      []
    );
    const [awsScanRemovalCandidates, setAwsScanRemovalCandidates] = useState([]);
    const [selectedAwsRemovalIds, setSelectedAwsRemovalIds] = useState([]);
    const [isRefreshingStackResources, setIsRefreshingStackResources] =
      useState(false);
    const [resourceHealthRun, setResourceHealthRun] = useState({
      generatedAt: '',
      version: '',
      cacheSource: '',
      cacheHit: false,
      unsupportedResourceTypes: [],
      evaluatedResourceCount: 0,
      healthAnalysis: null,
    });
    const [resourceHealthViewer, setResourceHealthViewer] = useState({
      open: false,
      resource: null,
    });
    const [expandedHealthCheckKey, setExpandedHealthCheckKey] = useState('');
    const [isResourceHealthOptionsModalOpen, setIsResourceHealthOptionsModalOpen] =
      useState(false);
    const [includeCloudWatchLogChecks, setIncludeCloudWatchLogChecks] =
      useState(false);
    const [healthCheckLookbackDays, setHealthCheckLookbackDays] = useState(5);
    const [forceRegenerateHealthReport, setForceRegenerateHealthReport] =
      useState(false);
    const [isResourceTypesModalOpen, setIsResourceTypesModalOpen] = useState(false);

    // In embedded mode, ensure changes to the inventory are reflected in the parent workload form state
    // so that the parent "Save Changes" persists them.
    useEffect(() => {
      if (!usingExternalFormState) return;
      const externalResources = Array.isArray(formData?.trackedResources?.resources)
        ? formData.trackedResources.resources
        : EMPTY_RESOURCE_INVENTORY;
      if (externalResources === resourceInventory) return;
      setFormData((prev) => ({
        ...prev,
        trackedResources: {
          ...(prev?.trackedResources || {}),
          resources: resourceInventory,
        },
      }));
    }, [usingExternalFormState, resourceInventory]);
    const [resourceFilter, setResourceFilter] = useState('');
    const selectAllAwsScanCheckboxRef = useRef(null);
    const scanTimeoutRef = useRef({ stack: null });
    const [tagViewer, setTagViewer] = useState({
      open: false,
      title: '',
      tags: {},
    });
    const isCheckingResourceHealth =
      workloadHealthRequestsById?.[String(workload?.workloadId || '').trim()]?.status ===
      'loading';

    const getEnvironmentDisplay = useCallback(
      (accountId) => {
        if (!accountId || accountId === 'unassigned') return 'Unassigned';
        const permission = userProfile?.agentPermissionProfiles?.find((p) => {
          const authProfile =
            typeof p.authProfile === 'string'
              ? JSON.parse(p.authProfile)
              : p.authProfile || {};
          return authProfile.awsAccountId === accountId;
        });

        if (permission) {
          return `${permission.name} (${accountId})`;
        }

        return accountId;
      },
      [userProfile]
    );
    const filteredResources = useMemo(() => {
      const query = (resourceFilter || '').trim().toLowerCase();
      if (!query) return resourceInventory;
      return resourceInventory.filter((r) => {
        const fields = [
          r.displayName,
          r.resourceId,
          r.resourceArn,
          r.resourceType,
          r.service,
          getEnvironmentDisplay(r.accountId),
          r.region,
        ];
        return fields.some((f) =>
          (f || '').toString().toLowerCase().includes(query)
        );
      });
    }, [resourceInventory, resourceFilter, getEnvironmentDisplay]);

    const getServiceForResourceType = useCallback((resourceType) => {
      const match = manualResourceTypeOptions.find(
        (option) => option.value === resourceType
      );
      return match?.service || resourceType;
    }, []);

    const resolveAccountId = (value) => {
      return (
        getAwsAccountIdForWorkloadEnvironment(
          value,
          userProfile?.agentPermissionProfiles || []
        ) || value
      );
    };
    const [internalFormData, setInternalFormData] = useState({
      workloadName: '',
      description: '',
      environments: [],
      deploymentPreferences: getGlobalWorkloadDeploymentPreferences(userProfile?.settings || {}),
      trackedResources: {
        resources: [],
        stacks: [],
      },
      securityRules: getGlobalWorkloadSecurityRules(userProfile?.settings || {}),
    });

    const formData = usingExternalFormState ? externalFormData : internalFormData;
    const setFormData = usingExternalFormState ? externalSetFormData : setInternalFormData;
    const [gitBranchOptions, setGitBranchOptions] = useState([]);
    const [gitBranchesLoading, setGitBranchesLoading] = useState(false);
    const [gitBranchesError, setGitBranchesError] = useState('');

    const gitRepo = useMemo(
      () => buildGitRepo(formData?.deploymentPreferences?.gitRepo),
      [formData?.deploymentPreferences?.gitRepo]
    );
    const selectedConnectionId = gitRepo?.connectionId || '';
    const selectedConnection = useMemo(
      () =>
        githubConnections.find((connection) => connection.id === selectedConnectionId) ||
        null,
      [githubConnections, selectedConnectionId]
    );
    const repoOptions = useMemo(() => {
      if (!selectedConnection?.repositories) return [];
      return selectedConnection.repositories
        .map((repo) => ({
          ...repo,
          fullName:
            repo?.fullName || (repo?.owner && repo?.name ? `${repo.owner}/${repo.name}` : ''),
        }))
        .filter((repo) => repo.fullName);
    }, [selectedConnection]);
    const selectedRepoKey = useMemo(() => {
      if (gitRepo?.fullName) return gitRepo.fullName;
      if (gitRepo?.owner && gitRepo?.repo) return `${gitRepo.owner}/${gitRepo.repo}`;
      return '';
    }, [gitRepo]);
    const selectedRepo = useMemo(
      () => repoOptions.find((repo) => repo.fullName === selectedRepoKey) || null,
      [repoOptions, selectedRepoKey]
    );
    const allowedBranches = useMemo(() => {
      if (!selectedRepo?.allowedBranches) return [];
      return selectedRepo.allowedBranches.filter(Boolean);
    }, [selectedRepo]);

    useEffect(() => {
      let isMounted = true;
      const loadBranches = async () => {
        if (!selectedConnectionId || !selectedRepo?.owner || !selectedRepo?.name) {
          if (isMounted) {
            setGitBranchOptions([]);
            setGitBranchesError('');
            setGitBranchesLoading(false);
          }
          return;
        }
        if (allowedBranches.length > 0) {
          if (isMounted) {
            setGitBranchOptions(allowedBranches);
            setGitBranchesError('');
            setGitBranchesLoading(false);
          }
          return;
        }
        setGitBranchesLoading(true);
        setGitBranchesError('');
        try {
          const data = await listGithubBranches(
            selectedConnectionId,
            selectedRepo.owner,
            selectedRepo.name
          );
          const branches = Array.isArray(data?.branches)
            ? data.branches.map((branch) => branch?.name).filter(Boolean)
            : [];
          if (isMounted) {
            setGitBranchOptions(branches);
          }
        } catch (error) {
          if (isMounted) {
            setGitBranchOptions([]);
            setGitBranchesError(error?.message || 'Failed to load branches.');
          }
        } finally {
          if (isMounted) {
            setGitBranchesLoading(false);
          }
        }
      };

      loadBranches();
      return () => {
        isMounted = false;
      };
    }, [selectedConnectionId, selectedRepo, allowedBranches]);
  
    const environmentOptions = useMemo(() => {
      const fallback = [
        { value: 'Production', label: 'Production' },
        { value: 'Staging', label: 'Staging' },
        { value: 'Development', label: 'Development' },
      ];
      const environments = Array.isArray(formData.environments)
        ? formData.environments
        : [];

      if (environments.length === 0) {
        return fallback;
      }

      const seen = new Set();
      const derived = environments
        .map((envValue) => {
          const awsAccountId = resolveAccountId(envValue);
          const permission = userProfile?.agentPermissionProfiles?.find(
            (p) => {
              const authProfile =
                typeof p.authProfile === 'string'
                  ? JSON.parse(p.authProfile)
                  : p.authProfile || {};
              return authProfile.awsAccountId === awsAccountId;
            }
          );

          const label = permission
            ? `${permission.name} (${awsAccountId})`
            : envValue || awsAccountId || 'Unassigned';

          if (seen.has(awsAccountId || label)) {
            return null;
          }
          seen.add(awsAccountId || label);
          return { value: awsAccountId || label, label };
        })
        .filter(Boolean);

      fallback.forEach((option) => {
        if (!seen.has(option.value)) {
          derived.push(option);
        }
      });

      return derived;
    }, [formData.environments, userProfile]);

    const resourceSummary = useMemo(() => {
      const counts = resourceInventory.reduce((acc, resource) => {
        const key = resource.resourceType || 'Other';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts).map(([type, count]) => ({
        type,
        count,
      }));
    }, [resourceInventory]);

    const environmentSummary = useMemo(() => {
      const map = new Map();

      resourceInventory.forEach((resource) => {
        const accountKey = resource.accountId || 'unassigned';
        const entry = map.get(accountKey) || {
          accountId: accountKey,
          label: getEnvironmentDisplay(resource.accountId),
          count: 0,
        };
        entry.count += 1;
        map.set(accountKey, entry);
      });

      return Array.from(map.values());
    }, [resourceInventory, getEnvironmentDisplay]);

    const serviceSummary = useMemo(() => {
      const counts = resourceInventory.reduce((acc, resource) => {
        const key = resource.service || 'Other';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts)
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count);
    }, [resourceInventory]);

    const isSkippedError = (errorText) => {
      if (typeof errorText !== 'string') return false;
      const lower = errorText.toLowerCase();
      return lower.includes('not implemented') || lower.includes('not supported');
    };

    const resourceHealthTotals = useMemo(() => {
      return resourceInventory.reduce(
        (acc, resource) => {
          const counts = getResourceHealthCounts(resource);
          const allErrors = Array.isArray(resource?.health?.errors)
            ? resource.health.errors
            : [];
          const isNotApplicable = isResourceHealthNotApplicable(resource);
          const skippedErrors = allErrors.filter(isSkippedError);
          const realErrors = allErrors.filter(
            (e) => !isSkippedError(e) && !isNotApplicableHealthMessage(e)
          );

          if (isNotApplicable) {
            acc.resourcesNotApplicable += 1;
            return acc;
          }
          
          if (counts.total === 0 && skippedErrors.length > 0 && realErrors.length === 0) {
            acc.resourcesSkipped += 1;
            return acc;
          }
          if (counts.total === 0 && allErrors.length === 0) {
            return acc;
          }
          acc.resourcesWithChecks += 1;
          acc.passedChecks += counts.healthy;
          acc.failedChecks += counts.notHealthy + realErrors.length;
          if (counts.notHealthy > 0 || realErrors.length > 0) {
            acc.resourcesWithIssues += 1;
          }
          return acc;
        },
        {
          passedChecks: 0,
          failedChecks: 0,
          resourcesWithChecks: 0,
          resourcesWithIssues: 0,
          resourcesNotApplicable: 0,
          resourcesSkipped: 0,
        }
      );
    }, [resourceInventory]);

    const derivedHealthRunInfo = useMemo(() => {
      let latestGeneratedAt = '';
      let latestVersion = '';
      let latestCacheSource = '';
      let latestCacheHit = false;

      resourceInventory.forEach((resource) => {
        const health = resource?.health;
        if (!health) return;

        const generatedAt = health.generatedAt || health.result?.generatedAt || '';
        if (generatedAt && (!latestGeneratedAt || new Date(generatedAt) > new Date(latestGeneratedAt))) {
          latestGeneratedAt = generatedAt;
          latestVersion = health.version || '';
          latestCacheSource = health.cache?.source || '';
          latestCacheHit = health.cache?.cacheHit || false;
        }
      });

      return {
        generatedAt: latestGeneratedAt,
        version: latestVersion,
        cacheSource: latestCacheSource,
        cacheHit: latestCacheHit,
      };
    }, [resourceInventory]);

    const effectiveHealthRunInfo = useMemo(() => {
      if (resourceHealthRun.generatedAt) {
        return resourceHealthRun;
      }
      return {
        ...resourceHealthRun,
        ...derivedHealthRunInfo,
      };
    }, [resourceHealthRun, derivedHealthRunInfo]);

    const activeHealthAnalysis = useMemo(
      () => resourceHealthRun.healthAnalysis || persistedHealthAnalysis || null,
      [resourceHealthRun.healthAnalysis, persistedHealthAnalysis]
    );

    const permissionProfiles = useMemo(() => {
      if (!Array.isArray(userProfile?.agentPermissionProfiles)) return [];
      return userProfile.agentPermissionProfiles.map((profile) => {
        const parsedAuthProfile = safeParseJson(profile.authProfile, {});
        const awsAccountId =
          parsedAuthProfile?.awsAccountId ||
          parsedAuthProfile?.aws_account_id ||
          parsedAuthProfile?.accountId ||
          '';
        return {
          ...profile,
          parsedAuthProfile,
          awsAccountId: awsAccountId ? String(awsAccountId) : '',
          permissionProfileId: profile.recordId || profile.id || '',
        };
      });
    }, [userProfile?.agentPermissionProfiles]);

    const permissionProfilesByAccount = useMemo(() => {
      const map = new Map();
      permissionProfiles.forEach((profile) => {
        if (profile.awsAccountId) {
          map.set(profile.awsAccountId, profile);
        }
      });
      return map;
    }, [permissionProfiles]);

    const totalResourceCount = resourceInventory.length;
    const resourceTypeCount = resourceSummary.length;
    const trackedStacksCount = useMemo(
      () =>
        Array.isArray(formData.trackedResources?.stacks)
          ? formData.trackedResources.stacks.length
          : 0,
      [formData.trackedResources?.stacks]
    );

    const trackedStacks = Array.isArray(formData.trackedResources?.stacks)
      ? formData.trackedResources.stacks
      : [];

    const selectableAwsResourceIds = useMemo(
      () =>
        availableResourceImports
          .filter((resource) => !resource.imported)
          .map((resource) => resource.resourceId),
      [availableResourceImports]
    );

    const allSelectableAwsResourcesSelected =
      selectableAwsResourceIds.length > 0 &&
      selectableAwsResourceIds.every((id) =>
        selectedAwsScanResourceIds.includes(id)
      );

    const isAwsSelectionPartial =
      selectedAwsScanResourceIds.length > 0 &&
      !allSelectableAwsResourcesSelected;

    const workloadEnvironmentAccounts = useMemo(() => {
      const environments = Array.isArray(formData.environments)
        ? formData.environments
        : [];
      const seen = new Set();
      const uniqueAccounts = [];
      environments.forEach((envValue) => {
        const accountId = resolveAccountId(envValue);
        if (!accountId) {
          return;
        }
        const normalized = String(accountId);
        if (seen.has(normalized)) {
          return;
        }
        seen.add(normalized);
        uniqueAccounts.push(normalized);
      });
      return uniqueAccounts;
    }, [formData.environments]);

    const { regions: workloadScanRegions } = useMemo(() => {
      const preferenceRegions = formData?.deploymentPreferences?.defaultRegions;
      if (Array.isArray(preferenceRegions)) {
        const trimmed = preferenceRegions
          .map((region) =>
            typeof region === 'string' ? region.trim() : String(region || '')
          )
          .filter(Boolean);
        if (trimmed.length > 0) {
          return {
            regions: Array.from(new Set(trimmed)),
          };
        }
      }
      return {
        regions: ['us-east-1'],
      };
    }, [formData?.deploymentPreferences?.defaultRegions]);

    const clearScanTimeout = (key) => {
      if (scanTimeoutRef.current[key]) {
        clearTimeout(scanTimeoutRef.current[key]);
        scanTimeoutRef.current[key] = null;
      }
    };

    const resolvePermissionProfiles = useCallback(
      (accountIds) => {
        const normalizedIds = Array.isArray(accountIds)
          ? accountIds
              .map((id) => (id ? String(id) : ''))
              .map((id) => id.trim())
              .filter(Boolean)
          : [];

        const selectedProfiles = normalizedIds
          .map((accountId) => permissionProfilesByAccount.get(accountId))
          .filter(Boolean)
          .filter((profile, index, arr) => {
            const profileId = profile.permissionProfileId;
            return profileId
              ? arr.findIndex(
                  (candidate) =>
                    candidate.permissionProfileId === profileId
                ) === index
              : index ===
                  arr.findIndex((candidate) => candidate === profile);
          });

        const missingAccounts = normalizedIds.filter(
          (accountId) => !permissionProfilesByAccount.has(accountId)
        );

        const fallbackProfiles =
          selectedProfiles.length === 0 && permissionProfiles.length > 0
            ? [permissionProfiles[0]]
            : [];

        return {
          profilesToQuery:
            selectedProfiles.length > 0 ? selectedProfiles : fallbackProfiles,
          missingAccounts,
        };
      },
      [permissionProfiles, permissionProfilesByAccount]
    );

    useEffect(() => {
      return () => {
        clearScanTimeout('stack');
        clearScanTimeout('resource');
      };
    }, []);
    const embeddedSeedRef = useRef({ workloadId: null, seeded: false });

    useEffect(() => {
      // Embedded mode: seed local inventory from parent ONCE per workloadId to avoid render loops.
      if (!usingExternalFormState) {
        embeddedSeedRef.current = { workloadId: null, seeded: false };
        return;
      }

      const seedKey = workloadId || 'embedded';
      const externalResources = Array.isArray(formData?.trackedResources?.resources)
        ? formData.trackedResources.resources
        : EMPTY_RESOURCE_INVENTORY;

      const shouldSeed =
        embeddedSeedRef.current.workloadId !== seedKey || !embeddedSeedRef.current.seeded;

      if (shouldSeed) {
        embeddedSeedRef.current = { workloadId: seedKey, seeded: true };
        setResourceInventory(sanitizeTrackedResourceEntries(externalResources));
      }
    }, [usingExternalFormState, workloadId]);

    useEffect(() => {
      // Standalone mode: seed from workload trackedResources once.
      if (usingExternalFormState) return;
      if (!workload) return;
      try {
        const raw = workload.trackedResources;
        const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
        const items = Array.isArray(parsed?.resources)
          ? parsed.resources
          : Array.isArray(parsed?.trackedResources)
            ? parsed.trackedResources
            : [];
        if (items.length > 0 && resourceInventory.length === 0) {
          setResourceInventory(sanitizeTrackedResourceEntries(items));
        }
      } catch (e) {
        console.warn('Failed to parse trackedResources', e);
      }
    }, [workload, usingExternalFormState, userProfile?.settings]);

    useEffect(() => {
      setManualResourceDraft((prev) => {
        if (
          environmentOptions.length === 0 ||
          environmentOptions.some((option) => option.value === prev.environment)
        ) {
          return prev;
        }
        return {
          ...prev,
          environment: environmentOptions[0].value,
        };
      });
    }, [environmentOptions]);

    useEffect(() => {
      if (selectAllAwsScanCheckboxRef.current) {
        selectAllAwsScanCheckboxRef.current.indeterminate =
          isAwsSelectionPartial;
      }
    }, [isAwsSelectionPartial, allSelectableAwsResourcesSelected]);


    // Deployment presets
    const deploymentPresets = {
      'Production App/Environment': {
        architecturePreferences: {
          instanceSize: 'Large',
          databasePreference: 'Aurora',
          nosqlPreference: 'DynamoDB',
          staticWebsite: 'Cloudfront + S3',
          dynamicWebsite: 'ECS + ALB',
        },
      },
      'Sandbox/Testing': {
        architecturePreferences: {
          instanceSize: 'Small',
          databasePreference: 'MySQL',
          nosqlPreference: 'No Preference',
          staticWebsite: 'Amplify',
          dynamicWebsite: 'EC2 + ALB',
        },
      },
    };
  
    const applyPreset = (presetName) => {
      const preset = deploymentPresets[presetName];
      if (preset) {
        setFormData((prev) => ({
          ...prev,
          deploymentPreferences: {
            ...prev.deploymentPreferences,
            architecturePreferences: {
              ...prev.deploymentPreferences.architecturePreferences,
              ...preset.architecturePreferences,
            },
          },
        }));
      }
    };
  
    useEffect(() => {
      // When embedded under `WorkloadDetails`, parent owns form state.
      // Avoid overwriting parent state; use `formData` / `setFormData` passed in.
      if (usingExternalFormState) return;
      if (workload && Object.keys(workload).length > 0) {
        // Editing existing workload
        // Use the safe parsing function for deploymentPreferences
        const parsedDeploymentPreferences = safeParseJson(
          workload.deploymentPreferences,
          {
            method: 'cloudformation',
            changeSet: false, // false = immediate, true = changeset
            changeSetNotifications: {
              email: {
                enabled: false,
                address: '',
              },
              slack: {
                enabled: false,
              },
            },
            stacks: [],
            defaultRegions: [],
            requiredTags: [],
            useExistingVPCs: false,
            specifiedVPCs: [],
            resourceRules: {
              allowedResources: {
                allowAll: true,
                allowedList: [],
                deniedList: [],
              },
            },
            gitRepo: null,
            deliveryMethod: null,
            stateSource: null,
            stateBucket: '',
            pipelineConfig: {
              autoDeploy: true,
              requireApproval: false,
              branch: '',
            },
            architecturePreferences: {
              instanceSize: 'No Preference',
              databasePreference: 'No Preference',
              nosqlPreference: 'No Preference',
              staticWebsite: 'No Preference',
              dynamicWebsite: 'No Preference',
            },
          }
        );
  
        // Handle backward compatibility - convert old field names to new ones
        if (parsedDeploymentPreferences) {
          // Convert old deploymentType to changeSet boolean
          if (parsedDeploymentPreferences.deploymentType && parsedDeploymentPreferences.changeSet === undefined) {
            parsedDeploymentPreferences.changeSet = parsedDeploymentPreferences.deploymentType === 'changeset';
            delete parsedDeploymentPreferences.deploymentType;
          }
          // Convert string changeSet to boolean
          else if (typeof parsedDeploymentPreferences.changeSet === 'string') {
            parsedDeploymentPreferences.changeSet = parsedDeploymentPreferences.changeSet === 'changeset';
          }
          
          // Convert old notifications to changeSetNotifications
          if (parsedDeploymentPreferences.notifications && !parsedDeploymentPreferences.changeSetNotifications) {
            parsedDeploymentPreferences.changeSetNotifications = parsedDeploymentPreferences.notifications;
            delete parsedDeploymentPreferences.notifications;
          }
        }
  
        // Initialize default security rules first  
        const parsedSecurityRules = safeParseJson(workload.securityRules, {});
        const securityRulesStructure = createSecurityRulesStructure(parsedSecurityRules);
        // Ensure deploymentPreferences has the expected structure
        const safeDeploymentPreferences = parsedDeploymentPreferences || {
          method: 'cloudformation',
          changeSet: false, // false = immediate, true = changeset
          changeSetNotifications: {
            email: {
              enabled: false,
              address: '',
            },
            slack: {
              enabled: false,
            },
          },
          stacks: [],
          defaultRegions: [],
          requiredTags: [],
          useExistingVPCs: false,
          specifiedVPCs: [],
          resourceRules: {
            allowedResources: {
              allowAll: true,
              allowedList: [],
              deniedList: [],
            },
          },
          gitRepo: null,
          deliveryMethod: null,
          stateSource: null,
          stateBucket: '',
          pipelineConfig: {
            autoDeploy: true,
            requireApproval: false,
            branch: '',
          },
          architecturePreferences: {
            instanceSize: 'No Preference',
            databasePreference: 'No Preference',
            nosqlPreference: 'No Preference',
            staticWebsite: 'No Preference',
            dynamicWebsite: 'No Preference',
          },
        };
  
        // Additional backward compatibility check for safeDeploymentPreferences
        if (safeDeploymentPreferences) {
          // Convert old deploymentType to changeSet boolean if still present
          if (safeDeploymentPreferences.deploymentType && safeDeploymentPreferences.changeSet === undefined) {
            safeDeploymentPreferences.changeSet = safeDeploymentPreferences.deploymentType === 'changeset';
            delete safeDeploymentPreferences.deploymentType;
          }
          // Convert string changeSet to boolean if still present
          else if (typeof safeDeploymentPreferences.changeSet === 'string') {
            safeDeploymentPreferences.changeSet = safeDeploymentPreferences.changeSet === 'changeset';
          }
          
          // Convert old notifications to changeSetNotifications if still present
          if (safeDeploymentPreferences.notifications && !safeDeploymentPreferences.changeSetNotifications) {
            safeDeploymentPreferences.changeSetNotifications = safeDeploymentPreferences.notifications;
            delete safeDeploymentPreferences.notifications;
          }
        }
        const parsedTrackedResources = parseTrackedResources(
          workload.trackedResources,
          { resources: [] }
        );
        const trackedStacks = sanitizeStackEntries(
          getTrackedStacks(parsedTrackedResources, safeDeploymentPreferences)
        );
        const normalizedTrackedResources = {
          ...parsedTrackedResources,
          stacks: trackedStacks,
        };
 
        setFormData({
          workloadName: workload.workloadName || '',
          description: workload.description || '',
          environments: Array.isArray(workload.environments)
            ? workload.environments.map(resolveAccountId)
            : [],
          deploymentPreferences: {
            method: safeDeploymentPreferences.method || 'cloudformation',
            changeSet: safeDeploymentPreferences.changeSet !== undefined ? safeDeploymentPreferences.changeSet : false,
            changeSetNotifications: safeDeploymentPreferences.changeSetNotifications || {
              email: {
                enabled: false,
                address: '',
              },
              slack: {
                enabled: false,
              },
            },
            defaultRegions: safeDeploymentPreferences.defaultRegions || [],
            requiredTags: safeDeploymentPreferences.requiredTags || [],
            useExistingVPCs: safeDeploymentPreferences.useExistingVPCs || false,
            specifiedVPCs: safeDeploymentPreferences.specifiedVPCs || [],
            resourceRules: safeDeploymentPreferences.resourceRules || {
              allowedResources: {
                allowAll: true,
                allowedList: [],
                deniedList: [],
              },
            },
            gitRepo: buildGitRepo(safeDeploymentPreferences.gitRepo),
            deliveryMethod: safeDeploymentPreferences.deliveryMethod || null,
            stateSource: safeDeploymentPreferences.stateSource || null,
            stateBucket: safeDeploymentPreferences.stateBucket || '',
            pipelineConfig: safeDeploymentPreferences.pipelineConfig || {
              autoDeploy: true,
              requireApproval: false,
              branch: '',
            },
            architecturePreferences: {
              instanceSize:
                safeDeploymentPreferences.architecturePreferences?.instanceSize ||
                'No Preference',
              databasePreference:
                safeDeploymentPreferences.architecturePreferences
                  ?.databasePreference || 'No Preference',
              nosqlPreference:
                safeDeploymentPreferences.architecturePreferences
                  ?.nosqlPreference || 'No Preference',
              staticWebsite:
                safeDeploymentPreferences.architecturePreferences
                  ?.staticWebsite || 'No Preference',
              dynamicWebsite:
                safeDeploymentPreferences.architecturePreferences
                  ?.dynamicWebsite || 'No Preference',
            },
          },
          trackedResources: normalizedTrackedResources,
          securityRules: securityRulesStructure,
        });
      } else {
        // Creating new workload - reset to defaults
 
        setFormData({
          workloadName: '',
          description: '',
          environments: [],
          deploymentPreferences: getGlobalWorkloadDeploymentPreferences(userProfile?.settings || {}),
          trackedResources: {
            resources: [],
            stacks: [],
          },
          securityRules: getGlobalWorkloadSecurityRules(userProfile?.settings || {}),
        });
      }
    }, [workload, usingExternalFormState, userProfile?.settings]);
  
    // Handle click outside regions dropdown
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          regionsDropdownRef.current &&
          !regionsDropdownRef.current.contains(event.target)
        ) {
          setRegionsDropdownOpen(false);
        }
      };
  
      if (regionsDropdownOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
  
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [regionsDropdownOpen]);
  
    const handleInputChange = (field, value) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    };
  
    const handleResourceRuleChange = (rule, value) => {
      setFormData((prev) => ({
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          resourceRules: {
            ...prev.deploymentPreferences.resourceRules,
            [rule]: value,
          },
        },
      }));
    };

    const updateGitRepo = (patch) => {
      setFormData((prev) => ({
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          gitRepo: patch ? { ...(prev.deploymentPreferences.gitRepo || {}), ...patch } : null,
        },
      }));
    };

    const handleScanStacks = async () => {
      if (isScanningStacks) return;
      if (isLocalMode) {
        toast.error('Stack discovery is not available in local mode yet.');
        return;
      }

      setIsScanningStacks(true);
      clearScanTimeout('stack');

      const preferredRegions = Array.isArray(
        formData.deploymentPreferences?.defaultRegions
      )
        ? formData.deploymentPreferences.defaultRegions
            .map((region) =>
              typeof region === 'string' ? region.trim() : String(region || '')
            )
            .filter(Boolean)
        : [];

      const uniqueRegions =
        preferredRegions.length > 0
          ? Array.from(new Set(preferredRegions))
          : ['us-east-1'];

      const environmentAccountIds = Array.isArray(formData.environments)
        ? formData.environments
            .map((env) => resolveAccountId(env))
            .map((value) => (value ? String(value) : ''))
            .filter(Boolean)
        : [];

      const { profilesToQuery, missingAccounts } =
        resolvePermissionProfiles(environmentAccountIds);

      if (missingAccounts.length > 0) {
        console.warn(
          '[WorkloadModal] Missing permission profiles for accounts:',
          missingAccounts
        );
      }

      if (profilesToQuery.length === 0) {
        toast.error(
          'No permission profiles available to scan CloudFormation stacks.'
        );
        setIsScanningStacks(false);
        return;
      }

      try {
        const scanResponses = await Promise.allSettled(
          profilesToQuery.map((profile) => {
            if (!profile.permissionProfileId) {
              return Promise.reject(
                new Error(
                  `Permission profile "${profile.name}" is missing an identifier.`
                )
              );
            }

            return fetchCloudFormationStacks({
              permissionProfileId: profile.permissionProfileId,
              regions: uniqueRegions,
            }).then((response) => ({
              profile,
              response,
            }));
          })
        );

        const aggregatedStacks = [];
        const seenStackIds = new Set();
        const failedScans = [];

        scanResponses.forEach((result) => {
          if (result.status === 'fulfilled') {
            const {
              profile,
              response: body,
            } = result.value || { profile: null, response: null };
            const stacks = Array.isArray(body?.stacks) ? body.stacks : [];

            stacks.forEach((stack) => {
              const stackId = stack?.stackId;
              if (!stackId || seenStackIds.has(stackId)) {
                return;
              }

              seenStackIds.add(stackId);
              aggregatedStacks.push({
                ...stack,
                accountId: stack.accountId || profile.awsAccountId || '',
                region:
                  stack.region || uniqueRegions[0] || 'us-east-1',
              });
            });
          } else {
            failedScans.push(result.reason);
            console.error(
              '[WorkloadModal] CloudFormation stack scan failed:',
              result.reason
            );
          }
        });

        const scanResults = aggregatedStacks.map((stack) => ({
          ...stack,
          imported: Array.isArray(formData.trackedResources?.stacks)
            ? formData.trackedResources.stacks.some(
                (existing) => existing.stackId === stack.stackId
              )
            : false,
        }));

        setAvailableStackImports(scanResults);
        setLastStackScanAt(new Date());
        setIsStackScanModalOpen(true);

        if (scanResults.length > 0) {
          const baseMessage = `Scan complete. ${scanResults.length} stack${
            scanResults.length === 1 ? '' : 's'
          } ready to import.`;
          const summaryMessage =
            failedScans.length > 0
              ? `${baseMessage} ${failedScans.length} environment${
                  failedScans.length === 1 ? '' : 's'
                } failed to respond.`
              : baseMessage;
          toast.success(summaryMessage);
        } else if (failedScans.length > 0) {
          toast.error(
            'Unable to discover CloudFormation stacks for the selected environments.'
          );
        } else {
          toast.success('Scan complete. No new stacks found.');
        }
      } catch (error) {
        console.error('Error scanning CloudFormation stacks:', error);
        const message =
          error?.message ||
          'Failed to scan CloudFormation stacks. Please try again.';
        toast.error(message);
      } finally {
        setIsScanningStacks(false);
        scanTimeoutRef.current.stack = null;
      }
    };

    const handleCheckResourceHealth = async ({
      includeLogs = false,
      lookbackHours = 120,
      forceRefresh = false,
    } = {}) => {
      if (isCheckingResourceHealth) return;
      if (isLocalMode) {
        toast.error('Health checks are not available in local mode yet.');
        return;
      }

      if (resourceInventory.length === 0) {
        toast.error('No tracked resources available for health checks.');
        return;
      }

      const resolveProfileForResource = (resource) => {
        const resolvedAccountId = resolveAccountId(resource?.accountId || '');
        if (resolvedAccountId) {
          const byAccount = permissionProfilesByAccount.get(
            String(resolvedAccountId)
          );
          if (byAccount?.permissionProfileId) {
            return byAccount;
          }
        }

        const { profilesToQuery } = resolvePermissionProfiles(
          workloadEnvironmentAccounts
        );
        if (profilesToQuery.length > 0) {
          return profilesToQuery[0];
        }

        return permissionProfiles[0] || null;
      };

      try {
        const targetProfiles = new Set();

        resourceInventory.forEach((resource) => {
          const profile = resolveProfileForResource(resource);
          if (profile?.permissionProfileId) {
            targetProfiles.add(String(profile.permissionProfileId));
          }
        });

        if (targetProfiles.size === 0) {
          toast.error('No resources could be prepared for health checks.');
          return;
        }

        const launchAction = await dispatch(
          launchHealthScans({
            workloadId: workload?.workloadId,
            forceRefresh,
            enableCloudWatchLogChecks: includeLogs,
            lookbackHours,
          })
        );

        if (launchAction.meta?.condition) {
          toast.success('Recent health results are already available for this workload.');
          return;
        }

        if (!launchHealthScans.fulfilled.match(launchAction)) {
          throw new Error(
            launchAction.payload ||
              launchAction.error?.message ||
              'Failed to start resource health checks. Please try again.'
          );
        }
        toast.success(
          `Health checks started for ${targetProfiles.size} environment${
            targetProfiles.size === 1 ? '' : 's'
          }. Watch Operations In Progress for updates.`
        );
      } catch (error) {
        console.error('Error evaluating AWS resource health:', error);
        toast.error(
          error?.message || 'Failed to start resource health checks. Please try again.'
        );
      }
    };

    const persistStacks = (stacksArray) => {
      if (!workload?.workloadId) return;
      try {
        const baseTracked = parseTrackedResources(
          formData?.trackedResources,
          parseTrackedResources(workload.trackedResources, { resources: [] })
        );
        const nextTracked = {
          ...baseTracked,
          stacks: stacksArray,
        };
        dispatch(
          updateWorkloadDefinition({
            workloadId: workload.workloadId,
            trackedResources: nextTracked,
          })
        );
      } catch (e) {
        console.warn('Failed to persist stacks to trackedResources', e);
      }
    };

    const handleImportStack = (stackInfo) => {
      if (!stackInfo?.stackId) return;

      const existingStacks = Array.isArray(
        formData.trackedResources?.stacks
      )
        ? formData.trackedResources.stacks
        : [];

      const alreadyTracked = existingStacks.some(
        (stack) => stack.stackId === stackInfo.stackId
      );

      if (!alreadyTracked) {
        const updatedStacks = [
          ...existingStacks,
          {
            stackId: stackInfo.stackId,
            name: stackInfo.name || '',
            description: stackInfo.description || '',
            region: stackInfo.region || '',
            accountId: stackInfo.accountId || '',
          },
        ];
        handleInputChange('trackedResources', {
          ...formData.trackedResources,
          stacks: updatedStacks,
        });
        // Persist stacks to trackedResources on backend
        persistStacks(updatedStacks);
      }

      if (Array.isArray(stackInfo.resources) && stackInfo.resources.length > 0) {
        setResourceInventory((prev) => {
          const existingIds = new Set(
            prev.map((resource) => resource.resourceId)
          );
          const newResources = stackInfo.resources
            .filter(
              (resource) =>
                resource && !existingIds.has(resource.resourceId)
            )
            .map((resource) => ({
              ...sanitizeTrackedResourceEntries([resource])[0],
              canonicalResourceType:
                resource?.canonicalResourceType ||
                toCanonicalResourceType(
                  resource?.resourceType,
                  getServiceSlugFromName(resource?.service) ||
                    getServiceSlugForResourceType(resource?.resourceType)
                ),
            }));
          return newResources.length > 0 ? [...prev, ...newResources] : prev;
        });
      }

      setAvailableStackImports((prev) =>
        prev.map((candidate) =>
          candidate.stackId === stackInfo.stackId
            ? { ...candidate, imported: true }
            : candidate
        )
      );

      toast.success('Stack imported into workload inventory');
    };

    const importResourcesIntoInventory = (resources) => {
      if (!Array.isArray(resources) || resources.length === 0) return 0;

      const resourcesToImport = resources.filter(
        (resource) => resource && !resource.imported
      );
      if (resourcesToImport.length === 0) return 0;

      let newResourceCount = 0;
      setResourceInventory((prev) => {
        const existingIds = new Set(
          prev.map((resource) => resource.resourceId)
        );
        const newEntries = [];

        resourcesToImport.forEach((resource) => {
          if (!existingIds.has(resource.resourceId)) {
            newEntries.push({
              ...sanitizeTrackedResourceEntries([resource])[0],
              canonicalResourceType:
                resource?.canonicalResourceType ||
                toCanonicalResourceType(
                  resource?.resourceType,
                  getServiceSlugFromName(resource?.service) ||
                    getServiceSlugForResourceType(resource?.resourceType)
                ),
            });
            existingIds.add(resource.resourceId);
          }
        });

        newResourceCount = newEntries.length;

        if (newEntries.length === 0) {
          return prev;
        }
        return [...prev, ...newEntries];
      });

      setAvailableResourceImports((prev) =>
        prev.map((candidate) =>
          resourcesToImport.some(
            (resource) => resource.resourceId === candidate.resourceId
          )
            ? { ...candidate, imported: true }
            : candidate
        )
      );

      setSelectedAwsScanResourceIds((prev) =>
        prev.filter(
          (id) =>
            !resourcesToImport.some(
              (resource) => resource.resourceId === id
            )
        )
      );

      return newResourceCount;
    };

    const handleAwsResourceSelectionChange = (resourceId, checked) => {
      setSelectedAwsScanResourceIds((prev) => {
        if (checked) {
          if (prev.includes(resourceId)) return prev;
          return [...prev, resourceId];
        }
        return prev.filter((id) => id !== resourceId);
      });
    };

    const handleToggleAllAwsResources = () => {
      if (selectableAwsResourceIds.length === 0) {
        setSelectedAwsScanResourceIds([]);
        return;
      }

      if (allSelectableAwsResourcesSelected) {
        setSelectedAwsScanResourceIds([]);
      } else {
        setSelectedAwsScanResourceIds(selectableAwsResourceIds);
      }
    };

    const handleRemovalSelectionChange = (resourceId, checked) => {
      setSelectedAwsRemovalIds((prev) => {
        if (checked) {
          if (prev.includes(resourceId)) return prev;
          return [...prev, resourceId];
        }
        return prev.filter((id) => id !== resourceId);
      });
    };

    const handleToggleAllRemovalCandidates = () => {
      if (awsScanRemovalCandidates.length === 0) {
        setSelectedAwsRemovalIds([]);
        return;
      }

      if (selectedAwsRemovalIds.length === awsScanRemovalCandidates.length) {
        setSelectedAwsRemovalIds([]);
      } else {
        setSelectedAwsRemovalIds(
          awsScanRemovalCandidates.map((resource) => resource.resourceId)
        );
      }
    };

    const handleApplyScanUpdates = () => {
      const selectedAddSet = new Set(selectedAwsScanResourceIds);
      const resourcesToAdd = availableResourceImports.filter(
        (resource) => selectedAddSet.has(resource.resourceId) && !resource.imported
      );
      const removalSet = new Set(selectedAwsRemovalIds);
      let removedCount = 0;

      // Compute next inventory deterministically
      const existingIds = new Set(resourceInventory.map((r) => r.resourceId));
      const kept = resourceInventory.filter((r) => {
        const keep = !removalSet.has(r.resourceId);
        if (!keep) removedCount += 1;
        return keep;
      });
      const additions = resourcesToAdd
        .filter((r) => !existingIds.has(r.resourceId))
        .map((r) => ({
          ...sanitizeTrackedResourceEntries([r])[0],
          canonicalResourceType:
            r?.canonicalResourceType ||
            toCanonicalResourceType(
              r?.resourceType,
              getServiceSlugFromName(r?.service) ||
                getServiceSlugForResourceType(r?.resourceType)
            ),
        }));
      const nextInventory = [...kept, ...additions];
      const addedCount = additions.length;

      setResourceInventory(sanitizeTrackedResourceEntries(nextInventory));
      if (removalSet.size > 0) {
        setAwsScanRemovalCandidates((prev) =>
          prev.filter((resource) => !removalSet.has(resource.resourceId))
        );
      }

      if (addedCount === 0 && removedCount === 0) {
        toast.error('Select resources to add or remove before updating');
        return;
      }

      if (addedCount > 0) {
        const addedIdSet = new Set(
          resourcesToAdd.map((resource) => resource.resourceId)
        );
        setAvailableResourceImports((prev) =>
          prev
            .map((resource) =>
              addedIdSet.has(resource.resourceId)
                ? { ...resource, imported: true }
                : resource
            )
            .filter((resource) => !addedIdSet.has(resource.resourceId))
        );
      }

      setSelectedAwsScanResourceIds([]);
      setSelectedAwsRemovalIds([]);
      setIsAwsScanModalOpen(false);

      const summaryParts = [];
      if (addedCount > 0) {
        summaryParts.push(`${addedCount} added`);
      }
      if (removedCount > 0) {
        summaryParts.push(`${removedCount} removed`);
      }
      toast.success(`Resources updated (${summaryParts.join(', ')})`);

      // Persist tracked resources via updateWorkloadDefinition
      if (workload?.workloadId) {
        try {
          const currentTracked = parseTrackedResources(
            formData?.trackedResources,
            parseTrackedResources(workload.trackedResources, { resources: [] })
          );
          const payload = {
            workloadId: workload.workloadId,
            trackedResources: {
              ...currentTracked,
              resources: sanitizeTrackedResourceEntries(nextInventory),
            },
          };
          // Debug: show exactly what we are saving
          dispatch(
            updateWorkloadDefinition(payload)
          );
        } catch (e) {
          console.warn('Failed to persist trackedResources', e);
        }
      }
    };

    const handleRefreshResourcesFromStacks = async () => {
      if (isRefreshingStackResources) return;
      if (isLocalMode) {
        toast.error('Stack resource refresh is not available in local mode yet.');
        return;
      }

      const trackedStacks = Array.isArray(formData.trackedResources?.stacks)
        ? formData.trackedResources.stacks.filter(
            (stack) => stack && stack.stackId
          )
        : [];

      if (trackedStacks.length === 0) {
        toast.error('No CloudFormation stacks to refresh');
        return;
      }

      const stackEntries = [];
      const missingProfiles = new Set();

      trackedStacks.forEach((stack) => {
        const { accountId: arnAccountId, region: arnRegion } =
          parseCloudFormationStackArn(stack.stackId || '');

        const stackAccountId = resolveAccountId(
          stack.accountId || arnAccountId || ''
        );

        const stackRegion =
          stack.region ||
          arnRegion ||
          workloadScanRegions[0] ||
          'us-east-1';

        if (!stackAccountId) {
          missingProfiles.add(stack.stackId || 'unknown');
          return;
        }

        const profile = permissionProfilesByAccount.get(stackAccountId);

        if (!profile || !profile.permissionProfileId) {
          missingProfiles.add(stackAccountId || stack.stackId || 'unknown');
          return;
        }

        stackEntries.push({
          stack,
          accountId: stackAccountId,
          region: stackRegion,
          profile,
        });
      });

      if (stackEntries.length === 0) {
        if (missingProfiles.size > 0) {
          toast.error(
            'No permission profiles available to refresh CloudFormation stack resources.'
          );
        }
        return;
      }

      if (missingProfiles.size > 0) {
        console.warn(
          '[WorkloadResources] Missing permission profiles for stacks:',
          Array.from(missingProfiles)
        );
      }

      setIsRefreshingStackResources(true);

      try {
        const responses = await Promise.allSettled(
          stackEntries.map(({ stack, accountId, region, profile }) =>
            fetchCloudFormationStackResources(stack.stackId, {
              permissionProfileId: profile.permissionProfileId,
              region,
            }).then((response) => ({
              stack,
              accountId,
              region,
              profile,
              response,
            }))
          )
        );

        const aggregatedResources = [];
        const seenResourceKeys = new Set();
        const failedStacks = [];

        responses.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { stack, accountId, region, profile, response } =
              result.value;
            const resources = Array.isArray(response?.resources)
              ? response.resources
              : [];

            resources.forEach((resource) => {
              const resourceId =
                resource?.resourceId ||
                resource?.resourceArn ||
                resource?.physicalResourceId ||
                resource?.logicalResourceId;

              const resolvedServiceSlug =
                getServiceSlugFromName(resource?.service) ||
                getServiceSlugForResourceType(resource?.resourceType);

              const serviceDisplay = getServiceDisplayFromSlug(
                resolvedServiceSlug
              );
              const resourceTypeLabel = getResourceTypeLabelFromSlug(
                resolvedServiceSlug,
                resource?.resourceType
              );

              const normalizedResource = {
                displayName:
                  resource?.displayName ||
                  resource?.logicalResourceId ||
                  resourceId,
                resourceId,
                resourceArn:
                  resource?.resourceArn || resource?.physicalResourceId || '',
                permissionProfileId: profile.permissionProfileId || '',
                region: resource?.region || region,
                accountId: resource?.accountId || accountId || profile.awsAccountId || '',
                lastSynced:
                  resource?.lastSynced ||
                  response?.syncedAt ||
                  new Date().toISOString(),
                resourceType: resourceTypeLabel || resource?.resourceType,
                canonicalResourceType: toCanonicalResourceType(
                  resource?.resourceType,
                  resolvedServiceSlug
                ),
                service:
                  serviceDisplay ||
                  resource?.service ||
                  resource?.resourceType ||
                  'CloudFormation',
                details: resource?.details || {},
              };

              const identityKeys = Array.from(
                buildResourceIdentityKeys(normalizedResource, resolveAccountId)
              );
              const primaryIdentityKey = identityKeys[0] || resourceId;

              if (!resourceId || seenResourceKeys.has(primaryIdentityKey)) {
                return;
              }
              seenResourceKeys.add(primaryIdentityKey);
              aggregatedResources.push(normalizedResource);
            });
          } else {
            failedStacks.push(result.reason);
            console.error(
              '[WorkloadResources] CloudFormation stack resource refresh failed:',
              result.reason
            );
          }
        });
        const existingInventoryIdentityKeys = new Set();
        resourceInventory.forEach((resource) => {
          buildResourceIdentityKeys(resource, resolveAccountId).forEach((key) =>
            existingInventoryIdentityKeys.add(key)
          );
        });

        const discoveredResources = aggregatedResources.map((resource) => ({
          ...resource,
          imported: Array.from(
            buildResourceIdentityKeys(resource, resolveAccountId)
          ).some((key) => existingInventoryIdentityKeys.has(key)),
        }));

        const discoveredIdentityKeys = new Set();
        discoveredResources.forEach((resource) => {
          buildResourceIdentityKeys(resource, resolveAccountId).forEach((key) =>
            discoveredIdentityKeys.add(key)
          );
        });

        const stackAccountSet = new Set(
          stackEntries
            .map((entry) => resolveAccountId(entry.accountId))
            .filter(Boolean)
            .map((value) => String(value))
        );
        const stackIdSet = new Set(
          stackEntries
            .map((entry) =>
              typeof entry.stack?.stackId === 'string' ? entry.stack.stackId.trim() : ''
            )
            .filter(Boolean)
        );
        const stackNameSet = new Set(
          stackEntries
            .map((entry) =>
              typeof entry.stack?.name === 'string' ? entry.stack.name.trim() : ''
            )
            .filter(Boolean)
        );
        const stackRegionSet = new Set(
          stackEntries
            .map((entry) =>
              typeof entry.region === 'string' ? entry.region.trim() : ''
            )
            .filter(Boolean)
        );

        const trackedResourceEligibility = resourceInventory.map((resource) => {
          const {
            accountId: normalizedAccountId,
            region: normalizedRegion,
          } = normalizeResourceIdentityParts(resource, resolveAccountId);

          const accountMatch = normalizedAccountId
            ? stackAccountSet.has(normalizedAccountId)
            : false;
          const regionMatch = normalizedRegion
            ? stackRegionSet.has(normalizedRegion)
            : false;
          const inStackScope = accountMatch || regionMatch;
          const resourceDetails =
            resource?.details && typeof resource.details === 'object'
              ? resource.details
              : {};
          const stackIdMatch =
            typeof resourceDetails.stackId === 'string' &&
            resourceDetails.stackId.trim() &&
            stackIdSet.has(resourceDetails.stackId.trim());
          const stackNameMatch =
            typeof resourceDetails.stackName === 'string' &&
            resourceDetails.stackName.trim() &&
            stackNameSet.has(resourceDetails.stackName.trim());
          const hasExplicitStackAssociation = stackIdMatch || stackNameMatch;
          const eligible = hasExplicitStackAssociation || inStackScope;

          return {
            resource,
            eligible,
            reason: hasExplicitStackAssociation
              ? 'stack_association_match'
              : inStackScope
              ? 'stack_scope_match'
              : 'outside_stack_scope',
            normalizedAccountId,
            normalizedRegion,
          };
        });

        const stackScopedTrackedResources = trackedResourceEligibility
          .filter((entry) => entry.eligible)
          .map((entry) => entry.resource);

        const removalCandidates = stackScopedTrackedResources
          .filter((resource) => {
            const resourceIdentityKeys = buildResourceIdentityKeys(
              resource,
              resolveAccountId
            );
            const stillPresent = Array.from(resourceIdentityKeys).some((key) =>
              discoveredIdentityKeys.has(key)
            );

            return !stillPresent;
          })
          .map((resource) => ({
            ...resource,
            flaggedAt: new Date().toISOString(),
          }));

        try {
          const rawResponseSummaries = responses.map((result, index) => {
            if (result.status === 'fulfilled') {
              const value = result.value || {};
              const responseBody = value?.response || {};
              const responseResources = Array.isArray(value?.response?.resources)
                ? value.response.resources
                : [];
              const responseUnsupported = Array.isArray(responseBody?.unsupported)
                ? responseBody.unsupported
                : [];
              const responseMissing = Array.isArray(responseBody?.missing)
                ? responseBody.missing
                : [];
              const responseErrors = Array.isArray(responseBody?.errors)
                ? responseBody.errors
                : [];
              return {
                index,
                status: 'fulfilled',
                stackId: value?.stack?.stackId || '',
                stackName: value?.stack?.name || '',
                accountId: value?.accountId || '',
                region: value?.region || '',
                permissionProfileId: value?.profile?.permissionProfileId || '',
                ok: responseBody?.ok,
                resourceCount: responseResources.length,
                unsupportedCount: responseUnsupported.length,
                missingCount: responseMissing.length,
                errorCount: responseErrors.length,
                unsupported: responseUnsupported.map((resource) =>
                  summarizeResourceForDebug(resource, resolveAccountId)
                ),
                missing: responseMissing,
                errors: responseErrors,
                resources: responseResources.map((resource) =>
                  summarizeResourceForDebug(resource, resolveAccountId)
                ),
              };
            }
            return {
              index,
              status: 'rejected',
              error:
                result.reason?.message ||
                result.reason?.error ||
                String(result.reason || 'Unknown error'),
            };
          });

          console.groupCollapsed(
            `[WorkloadResources] Stack refresh diagnostics for ${workload?.workloadId || workloadId}`
          );
          console.info('Tracked stacks', trackedStacks);
          console.info('Stack entries used for refresh', stackEntries);
          console.info('Raw CloudFormation refresh responses', rawResponseSummaries);
          console.info(
            'Tracked resource eligibility for stack refresh',
            trackedResourceEligibility.map((entry) => ({
              ...summarizeResourceForDebug(entry.resource, resolveAccountId),
              eligible: entry.eligible,
              reason: entry.reason,
              normalizedAccountId: entry.normalizedAccountId,
              normalizedRegion: entry.normalizedRegion,
            }))
          );
          console.info(
            'Tracked resources considered stack-managed before refresh',
            stackScopedTrackedResources.map((resource) =>
              summarizeResourceForDebug(resource, resolveAccountId)
            )
          );
          console.info(
            'Discovered resources after normalization',
            discoveredResources.map((resource) =>
              summarizeResourceForDebug(resource, resolveAccountId)
            )
          );
          console.info('Discovered identity keys', Array.from(discoveredIdentityKeys));
          console.info(
            'Removal candidates',
            removalCandidates.map((resource) =>
              summarizeResourceForDebug(resource, resolveAccountId)
            )
          );
          console.info('Failed stack refreshes', failedStacks);
          if (
            rawResponseSummaries.length > 0 &&
            rawResponseSummaries.every(
              (entry) =>
                entry.status === 'fulfilled' &&
                Number(entry.resourceCount || 0) === 0
            )
          ) {
            console.warn(
              '[WorkloadResources] Stack refresh returned zero resources for every queried stack.'
            );
          }
          console.groupEnd();
        } catch (debugError) {
          console.warn(
            '[WorkloadResources] Failed to emit stack refresh diagnostics',
            debugError
          );
        }

        setAvailableResourceImports(discoveredResources);
        setSelectedAwsScanResourceIds(
          discoveredResources
            .filter((resource) => !resource.imported)
            .map((resource) => resource.resourceId)
        );
        setAwsScanRemovalCandidates(removalCandidates);
        setSelectedAwsRemovalIds(
          removalCandidates.map((resource) => resource.resourceId)
        );
        setLastResourceScanAt(new Date());
        if (discoveredResources.length > 0 || removalCandidates.length > 0) {
          setIsAwsScanModalOpen(true);
        } else {
          setIsAwsScanModalOpen(false);
        }

        if (discoveredResources.length > 0 || removalCandidates.length > 0) {
          const summaryParts = [];
          if (discoveredResources.length > 0) {
            summaryParts.push(
              `${discoveredResources.length} resource${
                discoveredResources.length === 1 ? '' : 's'
              } ready to import`
            );
          }
          if (removalCandidates.length > 0) {
            summaryParts.push(
              `${removalCandidates.length} resource${
                removalCandidates.length === 1 ? '' : 's'
              } flagged for removal`
            );
          }
          if (failedStacks.length > 0) {
            summaryParts.push(
              `${failedStacks.length} stack${
                failedStacks.length === 1 ? '' : 's'
              } failed`
            );
          }
          toast.success(`Refresh complete. ${summaryParts.join(', ')}.`);
        } else if (failedStacks.length > 0) {
          toast.error('Unable to refresh resources for some stacks.');
        } else {
          toast.success('Refresh complete. No resource changes detected.');
        }
      } catch (error) {
        console.error('Error refreshing stack resources:', error);
        toast.error(
          error?.message || 'Failed to refresh stack resources. Please try again.'
        );
      } finally {
        setIsRefreshingStackResources(false);
      }
    };

    const handleManualResourceChange = (field, value) => {
      setManualResourceDraft((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

    const handleManualResourceAdd = () => {
      if (
        !manualResourceDraft.name.trim() ||
        !manualResourceDraft.identifier.trim()
      ) {
        toast.error('Name and resource identifier are required');
        return;
      }

      const trimmedName = manualResourceDraft.name.trim();
      const trimmedIdentifier = manualResourceDraft.identifier.trim();
      const resourceType = manualResourceDraft.type;
      const inferredService = getServiceForResourceType(resourceType);

      const newResource = {
        displayName: trimmedName,
        resourceId: trimmedIdentifier || trimmedName,
        resourceArn: trimmedIdentifier || '',
        region: manualResourceDraft.region.trim() || 'us-east-1',
        accountId: manualResourceDraft.environment,
        lastSynced: 'Not synced yet',
        resourceType,
        canonicalResourceType: toCanonicalResourceType(
          resourceType,
          getServiceSlugFromName(inferredService)
        ),
        service: inferredService,
      };

      setResourceInventory((prev) => [...prev, newResource]);
      setManualResourceDraft((prev) => ({
        ...prev,
        name: '',
        identifier: '',
      }));
      setIsManualResourceModalOpen(false);
      toast.success('Resource added to workload inventory');
    };

    const handleRemoveResource = (resourceId) => {
      setResourceInventory((prev) =>
        prev.filter((resource) => resource.resourceId !== resourceId)
      );
    };

    const prepareWorkloadData = (formData) => {
      // Normalize possibly missing nested objects
      const deploymentPreferences = formData?.deploymentPreferences || {};
      const trackedResourcesInput = parseTrackedResources(
        formData?.trackedResources,
        parseTrackedResources(workload?.trackedResources, { resources: [] })
      );
      const securityRulesInput = formData?.securityRules || { categories: {}, rules: {} };

      // Clean the security rules data to ensure it's JSON-serializable
      const cleanSecurityRules = {
        categories: {},
        rules: {},
      };

      // Clean categories (remove internal UI state)
      Object.keys(securityRulesInput.categories || {}).forEach((categoryKey) => {
        cleanSecurityRules.categories[categoryKey] = {};
        Object.keys(securityRulesInput.categories[categoryKey] || {}).forEach((key) => {
          if (key !== '_expanded') {
            cleanSecurityRules.categories[categoryKey][key] =
              securityRulesInput.categories[categoryKey][key];
          }
        });
      });

      // Clean rules
      cleanSecurityRules.rules = { ...(securityRulesInput.rules || {}) };

      const cleanStacks = sanitizeStackEntries(
        getTrackedStacks(trackedResourcesInput, deploymentPreferences)
      );

      const cleanEnvironments = normalizeWorkloadEnvironmentIds(
        Array.isArray(formData.environments) ? formData.environments : [],
        userProfile?.agentPermissionProfiles || []
      );

      // Clean required tags - only include entries with a non-empty key
      const cleanRequiredTags = Array.isArray(deploymentPreferences.requiredTags)
        ? deploymentPreferences.requiredTags
            .filter((t) => t && typeof t === 'object' && (t.key || '').trim() !== '')
            .map((t) => ({
              key: (t.key || '').trim(),
              value: (t.value || '').trim(),
              notes: (t.notes || '').trim(),
            }))
        : [];

      const result = {
        workloadName: formData.workloadName || '',
        description: formData.description || '',
        environments: cleanEnvironments,
        deploymentPreferences: {
          method: deploymentPreferences.method || 'cloudformation',
          changeSet: deploymentPreferences.changeSet,
          changeSetNotifications:
            deploymentPreferences.changeSetNotifications || {
              email: {
                enabled: false,
                address: '',
              },
              slack: {
                enabled: false,
              },
            },
          defaultRegions: deploymentPreferences.defaultRegions || [],
          requiredTags: cleanRequiredTags,
          useExistingVPCs: deploymentPreferences.useExistingVPCs || false,
          specifiedVPCs: deploymentPreferences.specifiedVPCs || [],
          resourceRules:
            deploymentPreferences.resourceRules || {
              allowedResources: {
                allowAll: true,
                allowedList: [],
                deniedList: [],
              },
            },
          gitRepo: cleanGitRepo(deploymentPreferences.gitRepo),
          deliveryMethod: deploymentPreferences.deliveryMethod || null,
          stateSource: deploymentPreferences.stateSource || null,
          stateBucket: deploymentPreferences.stateBucket || '',
          pipelineConfig: deploymentPreferences.pipelineConfig || {
            autoDeploy: true,
            requireApproval: false,
            branch: '',
          },
          architecturePreferences: {
            instanceSize:
              deploymentPreferences.architecturePreferences?.instanceSize ||
              'No Preference',
            databasePreference:
              deploymentPreferences.architecturePreferences?.databasePreference ||
              'No Preference',
            nosqlPreference:
              deploymentPreferences.architecturePreferences?.nosqlPreference ||
              'No Preference',
            staticWebsite:
              deploymentPreferences.architecturePreferences?.staticWebsite ||
              'No Preference',
            dynamicWebsite:
              deploymentPreferences.architecturePreferences?.dynamicWebsite ||
              'No Preference',
          },
        },
        securityRules: cleanSecurityRules,
        trackedResources: {
          ...trackedResourcesInput,
          resources: sanitizeTrackedResourceEntries(trackedResourcesInput.resources),
          stacks: cleanStacks,
        },
      };

      return result;
    };
  
    const tabs = [{ id: 'resources', label: 'Resources & Imports' }];
  
    if (!workload) {
      return (
        <div className="max-w-4xl mx-auto p-6">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
            Workload not found.{' '}
            <button
              type="button"
              onClick={onClose}
              className="underline font-medium"
            >
              Go back
            </button>
            .
          </div>
        </div>
      );
    }

    return (
      <Tabs defaultValue="overview" className="space-y-6">
        {!embedded && (<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center text-sm text-gray-500 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              Workloads
            </button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">
              {workload.workloadName}
            </span>
          </div>
        </div>)}

        {!embedded && (<div className="flex border-b">
          <TabsList className="inline-flex h-auto items-center justify-start bg-transparent p-0 text-muted-foreground">
            <TabsTrigger
              value="overview"
              className="rounded-none bg-transparent px-4 py-2 text-sm font-medium border-b-2 transition-colors data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent border-transparent text-gray-500 hover:text-gray-700"
            >
              Overview
            </TabsTrigger>
          </TabsList>
        </div>)}

        <TabsContent value="overview">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === 'general' && !hideGeneralTab && (
              <div className="space-y-6">
                {/* Workload Settings Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Workload Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="block mb-2">
                        Workload Name <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={formData.workloadName}
                        onChange={(e) =>
                          handleInputChange('workloadName', e.target.value)
                        }
                        placeholder="Enter workload name"
                        className={
                          !formData.workloadName ||
                          formData.workloadName.trim() === ''
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : ''
                        }
                      />
                    </div>
  
                    <div>
                      <Label htmlFor="description" className="block mb-2">
                        Description <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange('description', e.target.value)
                        }
                        placeholder="Enter workload description"
                        className={
                          !formData.description ||
                          formData.description.trim() === ''
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : ''
                        }
                      />
                    </div>
  
                    <div>
                      <Label className="block mb-2">
                        Environments <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <div
                        className={`space-y-2 ${formData.environments.length === 0 ? 'border border-red-300 rounded-md p-3 bg-red-50' : ''}`}
                      >
                        {Array.isArray(formData.environments) &&
                        formData.environments.length > 0 ? (
                          formData.environments.map((envValue, index) => {
                            const awsAccountId = resolveAccountId(envValue);
                            // Look up the permission profile to get the alias/name
                            const permission =
                              userProfile?.agentPermissionProfiles?.find((p) => {
                                const authProfile = typeof p.authProfile === 'string'
                                  ? JSON.parse(p.authProfile)
                                  : p.authProfile || {};
                                return authProfile.awsAccountId === awsAccountId;
                              });
                            const displayName = permission
                              ? permission.name
                              : awsAccountId;
  
                            return (
                              <div
                                key={index}
                                className="flex gap-2 items-center"
                              >
                                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded border flex-1">
                                  {displayName} ({awsAccountId})
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newEnvs = formData.environments.filter(
                                      (_, i) => i !== index
                                    );
                                    handleInputChange('environments', newEnvs);
                                  }}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })
                        ) : (
                          <div
                            className={`text-sm ${formData.environments.length === 0 ? 'text-red-500' : 'text-gray-500'}`}
                          >
                            {formData.environments.length === 0
                              ? 'Please select at least one environment'
                              : 'No environments configured'}
                          </div>
                        )}
  
                        <div className="flex gap-2">
                          <select
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            onChange={(e) => {
                              if (e.target.value) {
                                const cloudEnvironments = filterCloudEnvironments(userProfile?.agentPermissionProfiles || []);
                                const selectedPermission = cloudEnvironments.find(
                                  (p) => p.recordId === e.target.value
                                );
                                if (selectedPermission) {
                                  // Parse authProfile to get AWS account ID
                                  const authProfile = typeof selectedPermission.authProfile === 'string'
                                    ? JSON.parse(selectedPermission.authProfile)
                                    : selectedPermission.authProfile || {};
                                  // Only store the AWS account ID moving forward
                                  const newEnv = authProfile.awsAccountId;
                                  // Check if environment already exists
                                  const exists = formData.environments.some(
                                    (env) => env === newEnv
                                  );
                                  if (!exists) {
                                    const newEnvs = [
                                      ...formData.environments,
                                      newEnv,
                                    ];
                                    handleInputChange('environments', newEnvs);
  
                                    // For new workloads, copy securityRules and deploymentPreferences from the selected environment
                                    if (
                                      !workload ||
                                      !workload.workloadId ||
                                      workload.workloadId.startsWith(
                                        'permission_'
                                      )
                                    ) {
                                      // Parse the environment's securityRules and deploymentPreferences
                                      const envSecurityRulesRaw = safeParseJson(
                                        selectedPermission.securityRules,
                                        {}
                                      );
                                      const envSecurityRules = createSecurityRulesStructure(envSecurityRulesRaw);
  
                                      const envDeploymentPreferences =
                                        safeParseJson(
                                          selectedPermission.deploymentPreferences,
                                          {
                                            method: 'cloudformation',
                                            changeSet: false, // false = immediate, true = changeset
                                            changeSetNotifications: {
                                              email: {
                                                enabled: false,
                                                address: '',
                                              },
                                              slack: {
                                                enabled: false,
                                              },
                                            },
                                            stacks: [],
                                            defaultRegions: [],
                                            requiredTags: [],
                                            useExistingVPCs: false,
                                            specifiedVPCs: [],
                                            resourceRules: {
                                              allowedResources: {
                                                allowAll: true,
                                                allowedList: [],
                                                deniedList: [],
                                              },
                                            },
                                            architecturePreferences: {
                                              instanceSize: 'No Preference',
                                              databasePreference: 'No Preference',
                                              nosqlPreference: 'No Preference',
                                              staticWebsite: 'No Preference',
                                              dynamicWebsite: 'No Preference',
                                            },
                                          }
                                        );
  
                                      // Handle backward compatibility for environment deployment preferences
                                      if (envDeploymentPreferences) {
                                        // Convert old deploymentType to changeSet boolean
                                        if (envDeploymentPreferences.deploymentType && envDeploymentPreferences.changeSet === undefined) {
                                          envDeploymentPreferences.changeSet = envDeploymentPreferences.deploymentType === 'changeset';
                                          delete envDeploymentPreferences.deploymentType;
                                        }
                                        // Convert string changeSet to boolean
                                        else if (typeof envDeploymentPreferences.changeSet === 'string') {
                                          envDeploymentPreferences.changeSet = envDeploymentPreferences.changeSet === 'changeset';
                                        }
                                        
                                        // Convert old notifications to changeSetNotifications
                                        if (envDeploymentPreferences.notifications && !envDeploymentPreferences.changeSetNotifications) {
                                          envDeploymentPreferences.changeSetNotifications = envDeploymentPreferences.notifications;
                                          delete envDeploymentPreferences.notifications;
                                        }
                                      }
  
                                      // Update the form data with the environment's settings
                                      // IMPORTANT: Do not overwrite workload stacks with environment stacks
                                      const { stacks: _ignoredStacks, ...envPrefsWithoutStacks } = envDeploymentPreferences || {};
                                      setFormData((prev) => ({
                                        ...prev,
                                        securityRules: envSecurityRules,
                                        deploymentPreferences: {
                                          ...prev.deploymentPreferences,
                                          ...envPrefsWithoutStacks,
                                        },
                                        trackedResources: {
                                          ...prev.trackedResources,
                                          stacks: Array.isArray(prev.trackedResources?.stacks)
                                            ? prev.trackedResources.stacks
                                            : [],
                                        },
                                      }));
                                    }
                                  }
                                }
                                e.target.value = ''; // Reset selection
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">
                              Select an environment to add...
                            </option>
                            {filterCloudEnvironments(userProfile?.agentPermissionProfiles || []).map(
                              (permission) => {
                                const authProfile = typeof permission.authProfile === 'string'
                                  ? JSON.parse(permission.authProfile)
                                  : permission.authProfile || {};
                                return (
                                  <option
                                    key={permission.recordId}
                                    value={permission.recordId}
                                  >
                                    {permission.name} ({authProfile.awsAccountId || 'N/A'})
                                  </option>
                                );
                              }
                            )}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
  
              </div>
            )}

{activeTab === 'resources' && (
              <>
                <div className="space-y-6">
                  {/* Summary Dashboard - hidden when hideSummaryCards is true */}
                  {!hideSummaryCards && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Infrastructure Card */}
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <Cloud className="h-4 w-4" />
                        Infrastructure
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Resources</span>
                          <span className="text-lg font-semibold text-gray-900">{totalResourceCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Stacks</span>
                          <span className="text-lg font-semibold text-gray-900">{trackedStacksCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Environments</span>
                          <span className="text-lg font-semibold text-gray-900">{workloadEnvironmentAccounts.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Health Overview Card - Resource based */}
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <HeartPulse className="h-4 w-4" />
                        Resource Health
                      </div>
                      {(() => {
                        const healthyResources = resourceHealthTotals.resourcesWithChecks - resourceHealthTotals.resourcesWithIssues;
                        const unhealthyResources = resourceHealthTotals.resourcesWithIssues;
                        const totalEvaluated = resourceHealthTotals.resourcesWithChecks;
                        const healthPercent = totalEvaluated > 0 ? Math.round((healthyResources / totalEvaluated) * 100) : 0;
                        
                        return (
                          <>
                            <div className="mt-3 flex items-center gap-4">
                              <div className="relative h-20 w-20 flex-shrink-0">
                                <svg className="h-20 w-20 -rotate-90 transform" viewBox="0 0 36 36">
                                  <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="#e5e7eb"
                                    strokeWidth="3"
                                  />
                                  {totalEvaluated > 0 && (
                                    <path
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      fill="none"
                                      stroke={unhealthyResources === 0 ? '#22c55e' : healthyResources === 0 ? '#ef4444' : '#f59e0b'}
                                      strokeWidth="3"
                                      strokeDasharray={`${healthPercent}, 100`}
                                      strokeLinecap="round"
                                    />
                                  )}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-lg font-bold text-gray-900">
                                    {totalEvaluated > 0 ? healthPercent : '—'}
                                  </span>
                                  {totalEvaluated > 0 && (
                                    <span className="text-xs text-gray-500">%</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-1.5 text-gray-600">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    Healthy
                                  </span>
                                  <span className="font-semibold text-green-700">{healthyResources}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-1.5 text-gray-600">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                    Issues
                                  </span>
                                  <span className="font-semibold text-red-700">{unhealthyResources}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-500">Evaluated</span>
                                  <span className="font-medium text-gray-700">{totalEvaluated}</span>
                                </div>
                              </div>
                            </div>
                            {effectiveHealthRunInfo.generatedAt && (
                              <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
                                Last checked {(() => {
                                  const diff = Date.now() - new Date(effectiveHealthRunInfo.generatedAt).getTime();
                                  const minutes = Math.floor(diff / 60000);
                                  if (minutes < 1) return 'just now';
                                  if (minutes < 60) return `${minutes}m ago`;
                                  const hours = Math.floor(minutes / 60);
                                  if (hours < 24) return `${hours}h ago`;
                                  const days = Math.floor(hours / 24);
                                  return `${days}d ago`;
                                })()}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Resource Types Card */}
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                          <Radar className="h-4 w-4" />
                          Resource Types
                        </div>
                        <span className="text-lg font-semibold text-gray-900">{resourceTypeCount}</span>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {resourceSummary.length > 0 ? (
                          resourceSummary
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 4)
                            .map((item) => (
                              <div key={item.type} className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 truncate pr-2" title={item.type}>
                                  {item.type.replace('AWS::', '').replace('::', ' ')}
                                </span>
                                <span className="font-medium text-gray-900 flex-shrink-0">{item.count}</span>
                              </div>
                            ))
                        ) : (
                          <div className="text-sm text-gray-500 text-center py-2">
                            No resources tracked
                          </div>
                        )}
                        {resourceSummary.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setIsResourceTypesModalOpen(true)}
                            className="text-xs text-primary-600 hover:text-primary-700 pt-1 hover:underline"
                          >
                            +{resourceSummary.length - 4} more types
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Health Checks Summary Card */}
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <RefreshCcw className="h-4 w-4" />
                        Health Checks
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm text-gray-600">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Passed
                          </span>
                          <span className="text-lg font-semibold text-green-700">{resourceHealthTotals.passedChecks}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm text-gray-600">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            Failed
                          </span>
                          <span className="text-lg font-semibold text-red-700">{resourceHealthTotals.failedChecks}</span>
                        </div>
                        {resourceHealthTotals.resourcesSkipped > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-sm text-gray-600">
                              <span className="h-2 w-2 rounded-full bg-gray-400" />
                              Skipped
                            </span>
                            <span className="text-lg font-semibold text-gray-500">{resourceHealthTotals.resourcesSkipped}</span>
                          </div>
                        )}
                        {resourceHealthTotals.resourcesNotApplicable > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-sm text-gray-600">
                              <span className="h-2 w-2 rounded-full bg-slate-400" />
                              Not applicable
                            </span>
                            <span className="text-lg font-semibold text-slate-600">
                              {resourceHealthTotals.resourcesNotApplicable}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                          <span className="text-sm text-gray-500">Checks run</span>
                          <span className="text-lg font-semibold text-gray-900">
                            {resourceHealthTotals.passedChecks + resourceHealthTotals.failedChecks}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  <Accordion type="single" collapsible className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <AccordionItem value="cloudformation-stacks" className="border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 [&[data-state=open]]:rounded-t-lg [&[data-state=closed]]:rounded-lg">
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-semibold text-gray-900">
                            Tracked CloudFormation stacks
                          </h4>
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
                            {trackedStacks.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="border-t border-gray-200">
                          <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-end">
                            <div className="flex gap-2">
                              {!isLocalMode && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleScanStacks}
                                  disabled={isScanningStacks}
                                >
                                  {isScanningStacks ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Cloud className="mr-2 h-4 w-4" />
                                  )}
                                  {isScanningStacks ? 'Fetching stacks...' : 'Discover stacks'}
                                </Button>
                              )}
                              {!isLocalMode && availableStackImports.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsStackScanModalOpen(true)}
                                >
                                  <ListPlus className="mr-2 h-4 w-4" />
                                  Review discovered stacks
                                </Button>
                              )}
                              {!isLocalMode && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleRefreshResourcesFromStacks}
                                  disabled={
                                    isRefreshingStackResources || trackedStacks.length === 0
                                  }
                                >
                                  {isRefreshingStackResources ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Syncing...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCcw className="mr-2 h-4 w-4" />
                                      Refresh resources
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          {isLocalMode && (
                            <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-500">
                              Stack discovery and stack resource refresh are cloud-only for this MVP.
                              Add tracked resources manually below.
                            </div>
                          )}
                          <div className="space-y-4 p-4">
                            {trackedStacks.length > 0 ? (
                              <div className="space-y-3">
                                {trackedStacks.map((stack, index) => (
                                    <div
                                      key={`${stack.stackId}-${index}`}
                                      className="rounded border border-gray-200 bg-gray-50 p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-semibold text-gray-900">
                                            {stack.name || stack.description || `Stack ${index + 1}`}
                                          </div>
                                          {stack.name && (stack.description || '').trim() !== '' && (
                                            <div className="text-xs text-gray-500">
                                              {stack.description}
                                            </div>
                                          )}
                                          {stack.stackId && (
                                            <div className="text-xs text-gray-400 break-all">
                                              {stack.stackId}
                                            </div>
                                          )}
                                          {(stack.accountId || stack.region) && (
                                            <div className="text-xs text-gray-400">
                                              {stack.accountId ? `Account: ${stack.accountId}` : ''}
                                              {stack.accountId && stack.region ? ' • ' : ''}
                                              {stack.region ? `Region: ${stack.region}` : ''}
                                            </div>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newStacks = trackedStacks.filter(
                                              (_, i) => i !== index
                                            );
                                            handleInputChange('trackedResources', {
                                              ...formData.trackedResources,
                                              stacks: newStacks,
                                            });
                                            persistStacks(newStacks);
                                          }}
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                                No stacks are currently tracked. Import a stack from the scan results to keep resources in sync.
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <h4 className="text-base font-semibold text-gray-900">
                          Tracked resources
                        </h4>

                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
                          <Input
                            value={resourceFilter}
                            onChange={(e) => setResourceFilter(e.target.value)}
                            placeholder="Filter by name, type, service, environment or region"
                            className="h-10 w-full sm:w-80"
                          />
                         
                          {!isLocalMode && (
                            <Button
                              className="h-10 whitespace-nowrap"
                              onClick={() => {
                                setIncludeCloudWatchLogChecks(false);
                                setHealthCheckLookbackDays(5);
                                setForceRegenerateHealthReport(false);
                                setIsResourceHealthOptionsModalOpen(true);
                              }}
                              disabled={isCheckingResourceHealth}
                            >
                              {isCheckingResourceHealth ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Checking health...
                                </>
                              ) : (
                                <>
                                  <HeartPulse className="mr-2 h-4 w-4" />
                                  Refresh health
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="max-h-[320px] overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">
                              Resource
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">
                              Service
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">
                              Resource type
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">
                              Environment
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">
                              Region
                            </th>
                            <th className="w-[180px] px-4 py-2 text-right font-semibold text-gray-600">
                              Health
                            </th>
                            <th className="px-4 py-2 text-right font-semibold text-gray-600">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredResources.length > 0 ? (
                            filteredResources.map((resource) => (
                              <tr key={resource.resourceId} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">
                                    {resource.displayName}
                                  </div>
                                  <div className="text-xs text-gray-500 break-all">
                                    {resource.resourceId}
                                  </div>
                                  <div className="text-xs text-gray-500 break-all">
                                    {resource.resourceArn}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {resource.service || '—'}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {resource.resourceType || '—'}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {getEnvironmentDisplay(resource.accountId)}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {resource.region || '—'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {(() => {
                                    const healthCounts = getResourceHealthCounts(resource);
                                    const allErrors = Array.isArray(
                                      resource?.health?.errors
                                    )
                                      ? resource.health.errors
                                      : [];
                                    const isNotApplicable = isResourceHealthNotApplicable(resource);
                                    const skippedErrors = allErrors.filter(isSkippedError);
                                    const realErrors = allErrors.filter(
                                      (e) =>
                                        !isSkippedError(e) &&
                                        !isNotApplicableHealthMessage(e)
                                    );

                                    if (isNotApplicable) {
                                      return (
                                        <span className="text-xs text-slate-500">
                                          Not applicable
                                        </span>
                                      );
                                    }
                                    
                                    if (healthCounts.total === 0 && skippedErrors.length > 0 && realErrors.length === 0) {
                                      return (
                                        <span className="text-xs text-gray-400">
                                          Skipped
                                        </span>
                                      );
                                    }
                                    if (
                                      healthCounts.total === 0 &&
                                      allErrors.length === 0
                                    ) {
                                      return (
                                        <span className="text-xs text-gray-400">
                                          Not checked
                                        </span>
                                      );
                                    }
                                    const displayNotHealthy =
                                      healthCounts.notHealthy + realErrors.length;
                                    const onlyNotApplicable =
                                      healthCounts.total > 0 &&
                                      healthCounts.notApplicable === healthCounts.total &&
                                      displayNotHealthy === 0;
                                    if (onlyNotApplicable) {
                                      return (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 min-w-[128px] justify-center whitespace-nowrap border-slate-200 text-slate-600 hover:bg-slate-50"
                                          onClick={() => {
                                            setExpandedHealthCheckKey('');
                                            setResourceHealthViewer({
                                              open: true,
                                              resource,
                                            });
                                          }}
                                        >
                                          Not applicable
                                        </Button>
                                      );
                                    }
                                    const allHealthy = displayNotHealthy === 0;
                                    return (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className={`h-8 min-w-[128px] justify-center whitespace-nowrap ${
                                          allHealthy
                                            ? 'border-green-200 text-green-700 hover:bg-green-50'
                                            : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                        }`}
                                        onClick={() =>
                                          {
                                            setExpandedHealthCheckKey('');
                                            setResourceHealthViewer({
                                              open: true,
                                              resource,
                                            });
                                          }
                                        }
                                      >
                                        {allHealthy ? (
                                          <>
                                            <CheckCircle2 className="mr-1 h-4 w-4" />
                                            Healthy
                                          </>
                                        ) : (
                                          <>
                                            <AlertTriangle className="mr-1 h-4 w-4" />
                                            {displayNotHealthy} issue
                                            {displayNotHealthy === 1 ? '' : 's'}
                                          </>
                                        )}
                                      </Button>
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveResource(resource.resourceId)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          ) : (
                              <tr>
                                <td
                                  colSpan={9}
                                  className="px-4 py-6 text-center text-sm text-gray-500"
                                >
                              {resourceInventory.length === 0
                                ? 'No resources tracked yet. Use the scan action above to add or import resources.'
                                : 'No resources match your filter.'}
                                </td>
                              </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
          )}

            {activeTab === 'governance' && (
              <div className="space-y-6">
                {/* Deployment Preferences Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Change Approvals
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="immediate-deploy"
                            name="changeSet"
                            value={false}
                           checked={
                             !formData.deploymentPreferences.changeSet
                           }
                           onChange={(e) =>
                             setFormData((prev) => ({
                               ...prev,
                               deploymentPreferences: {
                                 ...prev.deploymentPreferences,
                                 changeSet: false, // immediate
                               },
                             }))
                           }
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <Label
                            htmlFor="immediate-deploy"
                            className="font-medium text-gray-700"
                          >
                            Deploy immediately
                          </Label>
                        </div>
  
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="changeset-deploy"
                            name="changeSet"
                            value={true}
                           checked={
                             formData.deploymentPreferences.changeSet
                           }
                           onChange={(e) =>
                             setFormData((prev) => ({
                               ...prev,
                               deploymentPreferences: {
                                 ...prev.deploymentPreferences,
                                 changeSet: true, // changeset
                               },
                             }))
                           }
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <Label
                            htmlFor="changeset-deploy"
                            className="font-medium text-gray-700"
                          >
                            Create change set for review
                          </Label>
                        </div>
                      </div>
                    </div>
  
                     {/* Notification Settings - Only show when change set is selected */}
                     {formData.deploymentPreferences.changeSet && (
                      <div>
                        <Label className="mb-2 block">
                          Notification Settings
                        </Label>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="email-notifications"
                              checked={
                                formData.deploymentPreferences.changeSetNotifications
                                  ?.email?.enabled || false
                              }
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  deploymentPreferences: {
                                    ...prev.deploymentPreferences,
                                    changeSetNotifications: {
                                      ...prev.deploymentPreferences.changeSetNotifications,
                                      email: {
                                        ...prev.deploymentPreferences
                                          .changeSetNotifications?.email,
                                        enabled: e.target.checked,
                                      },
                                    },
                                  },
                                }))
                              }
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                            />
                            <Label
                              htmlFor="email-notifications"
                              className="font-medium text-gray-700"
                            >
                              Email notifications
                            </Label>
                          </div>
  
                          {formData.deploymentPreferences.changeSetNotifications?.email
                            ?.enabled && (
                            <div className="ml-6">
                              <Label className="mb-2 block text-sm text-gray-600">
                                Email Address(es) (comma separated)
                              </Label>
                              <Input
                                value={
                                  formData.deploymentPreferences.changeSetNotifications
                                    ?.email?.address || ''
                                }
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    deploymentPreferences: {
                                      ...prev.deploymentPreferences,
                                      changeSetNotifications: {
                                        ...prev.deploymentPreferences
                                          .changeSetNotifications,
                                        email: {
                                          ...prev.deploymentPreferences
                                            .changeSetNotifications?.email,
                                          address: e.target.value,
                                        },
                                      },
                                    },
                                  }))
                                }
                                placeholder="Enter email address for notifications"
                                className="w-full"
                              />
                            </div>
                          )}
  
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="slack-notifications"
                              disabled
                              className="h-4 w-4 text-gray-400 focus:ring-gray-500 border-gray-300 cursor-not-allowed"
                            />
                            <Label
                              htmlFor="slack-notifications"
                              className="font-medium text-gray-400 cursor-not-allowed"
                            >
                              Slack notifications (Coming soon)
                            </Label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
  
                {/* Required Resource Tags Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Required Resource Tags
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Required Resource Tags</Label>
                      <div className="space-y-3">
                        {Array.isArray(
                          formData.deploymentPreferences.requiredTags
                        ) &&
                        formData.deploymentPreferences.requiredTags.length > 0 ? (
                          formData.deploymentPreferences.requiredTags.map(
                            (tag, index) => (
                              <div
                                key={index}
                                className="border rounded-lg p-3 bg-gray-50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <Input
                                      value={tag.key || ''}
                                      onChange={(e) => {
                                        const newTags = [
                                          ...formData.deploymentPreferences
                                            .requiredTags,
                                        ];
                                        newTags[index] = {
                                          ...newTags[index],
                                          key: e.target.value,
                                        };
                                        setFormData((prev) => ({
                                          ...prev,
                                          deploymentPreferences: {
                                            ...prev.deploymentPreferences,
                                            requiredTags: newTags,
                                          },
                                        }));
                                      }}
                                      placeholder="Tag key (e.g., environment)"
                                      className="mb-2"
                                    />
                                    <Input
                                      value={tag.value || ''}
                                      onChange={(e) => {
                                        const newTags = [
                                          ...formData.deploymentPreferences
                                            .requiredTags,
                                        ];
                                        newTags[index] = {
                                          ...newTags[index],
                                          value: e.target.value,
                                        };
                                        setFormData((prev) => ({
                                          ...prev,
                                          deploymentPreferences: {
                                            ...prev.deploymentPreferences,
                                            requiredTags: newTags,
                                          },
                                        }));
                                      }}
                                      placeholder="Required value (optional)"
                                      className="mb-2"
                                    />
                                    <Input
                                      value={tag.notes || ''}
                                      onChange={(e) => {
                                        const newTags = [
                                          ...formData.deploymentPreferences
                                            .requiredTags,
                                        ];
                                        newTags[index] = {
                                          ...newTags[index],
                                          notes: e.target.value,
                                        };
                                        setFormData((prev) => ({
                                          ...prev,
                                          deploymentPreferences: {
                                            ...prev.deploymentPreferences,
                                            requiredTags: newTags,
                                          },
                                        }));
                                      }}
                                      placeholder="Optional: Describe usage (e.g., 'Required for EC2 instances')"
                                      className="text-sm"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newTags =
                                        formData.deploymentPreferences.requiredTags.filter(
                                          (_, i) => i !== index
                                        );
                                      setFormData((prev) => ({
                                        ...prev,
                                        deploymentPreferences: {
                                          ...prev.deploymentPreferences,
                                          requiredTags: newTags,
                                        },
                                      }));
                                    }}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-sm text-gray-500">
                            No required tags configured
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newTags = [
                              ...(formData.deploymentPreferences.requiredTags ||
                                []),
                              { key: '', value: '', notes: '' },
                            ];
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                requiredTags: newTags,
                              },
                            }));
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Tag
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
  
  
            {activeTab === 'deployment' && (
              <div className="space-y-6">
                {/* General Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    General
                  </h3>
                  <div className="space-y-4">
                    {/* Deployment Method moved from General tab */}
                    <div>
                      <Label className="mb-3 block">Deployment Method</Label>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="cloudformation"
                            name="deploymentMethod"
                            value="cloudformation"
                            checked={
                              formData.deploymentPreferences.method ===
                              'cloudformation'
                            }
                            onChange={(e) =>
                              handleInputChange('deploymentPreferences', {
                                ...formData.deploymentPreferences,
                                method: e.target.value,
                              })
                            }
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <Label
                            htmlFor="cloudformation"
                            className="font-medium text-primary-600"
                          >
                            CloudFormation
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="terraform"
                            name="deploymentMethod"
                            value="terraform"
                            checked={
                              formData.deploymentPreferences.method ===
                              'terraform'
                            }
                            onChange={(e) =>
                              handleInputChange('deploymentPreferences', {
                                ...formData.deploymentPreferences,
                                method: e.target.value,
                              })
                            }
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <Label
                            htmlFor="terraform"
                            className="font-medium text-primary-600"
                          >
                            Terraform
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="opentofu"
                            name="deploymentMethod"
                            value="opentofu"
                            checked={
                              formData.deploymentPreferences.method === 'opentofu'
                            }
                            onChange={(e) =>
                              handleInputChange('deploymentPreferences', {
                                ...formData.deploymentPreferences,
                                method: e.target.value,
                              })
                            }
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <Label
                            htmlFor="opentofu"
                            className="font-medium text-primary-600"
                          >
                            OpenTofu
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="aws_cli"
                            name="deploymentMethod"
                            value="aws_cli"
                            checked={
                              formData.deploymentPreferences.method === 'aws_cli'
                            }
                            onChange={(e) =>
                              handleInputChange('deploymentPreferences', {
                                ...formData.deploymentPreferences,
                                method: e.target.value,
                              })
                            }
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <Label
                            htmlFor="aws_cli"
                            className="font-medium text-primary-600"
                          >
                            AWS CLI
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-3 block">Deployment Flow</Label>
                      <div className="space-y-2">
                        <Select
                          value={formData.deploymentPreferences.deliveryMethod || ''}
                          onValueChange={(value) =>
                            handleInputChange('deploymentPreferences', {
                              ...formData.deploymentPreferences,
                              deliveryMethod: value || null,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select deployment flow" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="github_actions" disabled={!gitRepo?.fullName}>
                              {gitRepo?.fullName
                                ? 'Automatic: GitHub Actions'
                                : 'Automatic: GitHub Actions (requires repo)'}
                            </SelectItem>
                            <SelectItem value="codepipeline">
                              Automatic: CodePipeline/CodeBuild
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-gray-500">
                          This controls how CloudAgent should coordinate updates to your workload.
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-3 block">Git Repository</Label>
                      {githubConnections.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          No GitHub connections configured yet.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <Label className="mb-2 block">GitHub Connection</Label>
                            <Select
                              value={selectedConnectionId || ''}
                              onValueChange={(value) => {
                                if (!value) {
                                  updateGitRepo(null);
                                  return;
                                }
                                updateGitRepo({
                                  connectionId: value,
                                  owner: '',
                                  repo: '',
                                  fullName: '',
                                  branch: '',
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a connection" />
                              </SelectTrigger>
                              <SelectContent>
                                {githubConnections.map((connection) => (
                                  <SelectItem key={connection.id} value={connection.id}>
                                    {connection.displayName || 'GitHub'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="mb-2 block">Repository</Label>
                            <Select
                              value={selectedRepoKey || ''}
                              onValueChange={(value) => {
                                const repo = repoOptions.find((item) => item.fullName === value);
                                if (!repo) {
                                  updateGitRepo({
                                    owner: '',
                                    repo: '',
                                    fullName: '',
                                    branch: '',
                                  });
                                  return;
                                }
                                const defaultBranch =
                                  gitRepo?.branch ||
                                  repo.defaultBranch ||
                                  (Array.isArray(repo.allowedBranches) && repo.allowedBranches[0]) ||
                                  '';
                                updateGitRepo({
                                  owner: repo.owner || '',
                                  repo: repo.name || '',
                                  fullName: repo.fullName || '',
                                  branch: defaultBranch,
                                });
                              }}
                              disabled={!selectedConnectionId}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    selectedConnectionId
                                      ? 'Select a repository'
                                      : 'Select a connection first'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {repoOptions.map((repo) => (
                                  <SelectItem key={repo.fullName} value={repo.fullName}>
                                    {repo.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="mb-2 block">Base Branch</Label>
                            <Select
                              value={gitRepo?.branch || ''}
                              onValueChange={(value) => updateGitRepo({ branch: value })}
                              disabled={!selectedRepo}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    selectedRepo
                                      ? 'Select a branch'
                                      : 'Select a repository first'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {gitBranchOptions.map((branch) => (
                                  <SelectItem key={branch} value={branch}>
                                    {branch}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {gitBranchesLoading && (
                              <div className="text-xs text-gray-500 mt-2">
                                Loading branches…
                              </div>
                            )}
                            {gitBranchesError && (
                              <div className="text-xs text-red-500 mt-2">
                                {gitBranchesError}
                              </div>
                            )}
                            {!gitBranchesLoading && selectedRepo && gitBranchOptions.length === 0 && (
                              <div className="text-xs text-gray-500 mt-2">
                                No branches available for this repository.
                              </div>
                            )}
                          </div>

                          {['terraform', 'opentofu'].includes(
                            formData.deploymentPreferences.method
                          ) && (
                            <div>
                              <Label className="mb-2 block">State source</Label>
                              <Select
                                value={formData.deploymentPreferences.stateSource || 'not_set'}
                                onValueChange={(value) =>
                                  handleInputChange('deploymentPreferences', {
                                    ...formData.deploymentPreferences,
                                    stateSource: value === 'not_set' ? null : value,
                                    stateBucket:
                                      value === 's3'
                                        ? formData.deploymentPreferences.stateBucket || ''
                                        : '',
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Not set" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="not_set">Not set</SelectItem>
                                  <SelectItem value="s3">S3 bucket</SelectItem>
                                </SelectContent>
                              </Select>
                              {formData.deploymentPreferences.stateSource === 's3' && (
                                <Input
                                  value={formData.deploymentPreferences.stateBucket || ''}
                                  onChange={(event) =>
                                    handleInputChange('deploymentPreferences', {
                                      ...formData.deploymentPreferences,
                                      stateBucket: event.target.value,
                                    })
                                  }
                                  placeholder="State bucket name"
                                  className="mt-2"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block">Default AWS Regions</Label>
                      <div className="relative" ref={regionsDropdownRef}>
                        <button
                          type="button"
                          onClick={() =>
                            setRegionsDropdownOpen(!regionsDropdownOpen)
                          }
                          className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                        >
                          <span
                            className={
                              formData.deploymentPreferences.defaultRegions
                                ?.length > 0
                                ? 'text-gray-900'
                                : 'text-gray-500'
                            }
                          >
                            {formData.deploymentPreferences.defaultRegions
                              ?.length > 0
                              ? `${formData.deploymentPreferences.defaultRegions.length} region(s) selected`
                              : 'Select AWS regions...'}
                          </span>
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </button>
  
                        {regionsDropdownOpen && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Select Regions
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      deploymentPreferences: {
                                        ...prev.deploymentPreferences,
                                        defaultRegions: [],
                                      },
                                    }));
                                  }}
                                  className="text-xs text-red-600 hover:text-red-800"
                                >
                                  Clear All
                                </button>
                              </div>
                              <div className="space-y-1">
                                {awsRegionOptions.map((region) => (
                                  <label
                                    key={region.value}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        formData.deploymentPreferences.defaultRegions?.includes(
                                          region.value
                                        ) || false
                                      }
                                      onChange={(e) => {
                                        const currentRegions =
                                          formData.deploymentPreferences
                                            .defaultRegions || [];
                                        const newRegions = e.target.checked
                                          ? [...currentRegions, region.value]
                                          : currentRegions.filter(
                                              (r) => r !== region.value
                                            );
                                        setFormData((prev) => ({
                                          ...prev,
                                          deploymentPreferences: {
                                            ...prev.deploymentPreferences,
                                            defaultRegions: newRegions,
                                          },
                                        }));
                                      }}
                                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {region.label}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
  
                {/* Networking Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Networking
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="useExistingVPCs"
                        checked={
                          formData.deploymentPreferences.useExistingVPCs || false
                        }
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            deploymentPreferences: {
                              ...prev.deploymentPreferences,
                              useExistingVPCs: checked,
                            },
                          }))
                        }
                        className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                      />
                      <Label htmlFor="useExistingVPCs">
                        Use existing VPCs for new resources
                      </Label>
                    </div>
  
                    {formData.deploymentPreferences.useExistingVPCs && (
                      <div className="space-y-3">
                        <div>
                          <Label className="mb-2 block">Specify VPCs</Label>
                          <div className="space-y-2">
                            {Array.isArray(
                              formData.deploymentPreferences.specifiedVPCs
                            ) &&
                            formData.deploymentPreferences.specifiedVPCs.length >
                              0 ? (
                              formData.deploymentPreferences.specifiedVPCs.map(
                                (vpc, index) => (
                                  <div
                                    key={index}
                                    className="flex gap-2 items-center"
                                  >
                                    <span className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded border flex-1">
                                      {vpc}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newVPCs =
                                          formData.deploymentPreferences.specifiedVPCs.filter(
                                            (_, i) => i !== index
                                          );
                                        setFormData((prev) => ({
                                          ...prev,
                                          deploymentPreferences: {
                                            ...prev.deploymentPreferences,
                                            specifiedVPCs: newVPCs,
                                          },
                                        }));
                                      }}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )
                              )
                            ) : (
                              <div className="text-sm text-gray-500">
                                No VPCs specified
                              </div>
                            )}
  
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter VPC ID (e.g., vpc-12345678)"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const vpcId = e.target.value.trim();
                                    if (vpcId) {
                                      const currentVPCs =
                                        formData.deploymentPreferences
                                          .specifiedVPCs || [];
                                      if (!currentVPCs.includes(vpcId)) {
                                        setFormData((prev) => ({
                                          ...prev,
                                          deploymentPreferences: {
                                            ...prev.deploymentPreferences,
                                            specifiedVPCs: [
                                              ...currentVPCs,
                                              vpcId,
                                            ],
                                          },
                                        }));
                                      }
                                      e.target.value = '';
                                    }
                                  }
                                }}
                                className="flex-1 h-12 text-base"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // TODO: Implement fetch VPCs functionality
                                }}
                              >
                                Fetch VPCs
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
  
                {/* Resource Types Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Resource Types
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="allowAllResources"
                        checked={
                          formData.deploymentPreferences.resourceRules
                            .allowedResources.allowAll
                        }
                        onCheckedChange={(checked) =>
                          handleResourceRuleChange('allowedResources', {
                            ...formData.deploymentPreferences.resourceRules
                              .allowedResources,
                            allowAll: checked,
                          })
                        }
                        disabled
                        className="data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400 opacity-50 cursor-not-allowed"
                      />
                      <Label htmlFor="allowAllResources" className="text-gray-400 cursor-not-allowed">
                        Allow all resources
                      </Label>
                    </div>
  
                    <div>
                      <Label htmlFor="allowedResources">Allowed Resources</Label>
                      <Input
                        id="allowedResources"
                        value={formData.deploymentPreferences.resourceRules.allowedResources.allowedList.join(
                          ', '
                        )}
                        onChange={(e) =>
                          handleResourceRuleChange('allowedResources', {
                            ...formData.deploymentPreferences.resourceRules
                              .allowedResources,
                            allowedList: e.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter((item) => item),
                          })
                        }
                        placeholder="Enter allowed resources (comma-separated)"
                        disabled={
                          formData.deploymentPreferences.resourceRules
                            .allowedResources.allowAll
                        }
                      />
                    </div>
  
                    <div>
                      <Label htmlFor="deniedResources" className="text-gray-400">Denied Resources</Label>
                      <Input
                        id="deniedResources"
                        value={formData.deploymentPreferences.resourceRules.allowedResources.deniedList.join(
                          ', '
                        )}
                        onChange={(e) =>
                          handleResourceRuleChange('allowedResources', {
                            ...formData.deploymentPreferences.resourceRules
                              .allowedResources,
                            deniedList: e.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter((item) => item),
                          })
                        }
                        placeholder="Enter denied resources (comma-separated)"
                        disabled
                        className="bg-gray-100 text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

  
            {activeTab === 'architecture' && (
              <div className="space-y-6">
                {/* Architecture Preferences Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Architecture Preferences
                    </h3>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="preset-select"
                        className="text-sm text-gray-600"
                      >
                        Apply Preset:
                      </Label>
                      <select
                        id="preset-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            applyPreset(e.target.value);
                            e.target.value = ''; // Reset selection
                          }
                        }}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        defaultValue=""
                      >
                        <option value="">Select a preset...</option>
                        <option value="Production App/Environment">
                          Production App/Environment
                        </option>
                        <option value="Sandbox/Testing">Sandbox/Testing</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Instance Size */}
                      <div>
                        <Label className="mb-2 block">Instance Size</Label>
                        <select
                          value={
                            formData.deploymentPreferences.architecturePreferences
                              ?.instanceSize || 'No Preference'
                          }
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                architecturePreferences: {
                                  ...prev.deploymentPreferences
                                    .architecturePreferences,
                                  instanceSize: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="No Preference">No Preference</option>
                          <option value="Large">Large</option>
                          <option value="Small">Small</option>
                        </select>
                      </div>
  
                      {/* Database Preferences */}
                      <div>
                        <Label className="mb-2 block">Database Preferences</Label>
                        <select
                          value={
                            formData.deploymentPreferences.architecturePreferences
                              ?.databasePreference || 'No Preference'
                          }
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                architecturePreferences: {
                                  ...prev.deploymentPreferences
                                    .architecturePreferences,
                                  databasePreference: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="No Preference">No Preference</option>
                          <option value="Aurora">Aurora</option>
                          <option value="MySQL">MySQL</option>
                          <option value="Postgres">Postgres</option>
                        </select>
                      </div>
  
                      {/* NoSQL Preferences */}
                      <div>
                        <Label className="mb-2 block">NoSQL Preference</Label>
                        <select
                          value={
                            formData.deploymentPreferences.architecturePreferences
                              ?.nosqlPreference || 'No Preference'
                          }
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                architecturePreferences: {
                                  ...prev.deploymentPreferences
                                    .architecturePreferences,
                                  nosqlPreference: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="No Preference">No Preference</option>
                          <option value="DynamoDB">DynamoDB</option>
                          <option value="RDS MongoDB">RDS MongoDB</option>
                        </select>
                      </div>
                    </div>
  
                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Static Websites */}
                      <div>
                        <Label className="mb-2 block">Static Websites</Label>
                        <select
                          value={
                            formData.deploymentPreferences.architecturePreferences
                              ?.staticWebsite || 'No Preference'
                          }
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                architecturePreferences: {
                                  ...prev.deploymentPreferences
                                    .architecturePreferences,
                                  staticWebsite: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="No Preference">No Preference</option>
                          <option value="Cloudfront + S3">Cloudfront + S3</option>
                          <option value="Amplify">Amplify</option>
                        </select>
                      </div>
  
                      {/* Dynamic Websites */}
                      <div>
                        <Label className="mb-2 block">Dynamic Websites</Label>
                        <select
                          value={
                            formData.deploymentPreferences.architecturePreferences
                              ?.dynamicWebsite || 'No Preference'
                          }
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                architecturePreferences: {
                                  ...prev.deploymentPreferences
                                    .architecturePreferences,
                                  dynamicWebsite: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="No Preference">No Preference</option>
                          <option value="ECS + ALB">ECS + ALB</option>
                          <option value="EC2 + ALB">EC2 + ALB</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Dialog
          open={isStackScanModalOpen}
          onOpenChange={setIsStackScanModalOpen}
        >
          <DialogContent className="max-w-xl bg-white">
            <DialogHeader>
              <DialogTitle>CloudFormation stacks discovered</DialogTitle>
              <DialogDescription>
                Import CloudFormation stacks to keep their resources tracked in this workload.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
              {availableStackImports.length === 0 ? (
                <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No new stacks were discovered. Launch another scan to look for changes.
                </div>
              ) : (
                <div className="space-y-3">
                  {availableStackImports.map((stack) => (
                    <div
                      key={stack.stackId}
                      className="flex flex-col gap-3 rounded border border-primary-200 bg-primary-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {stack.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {stack.description || 'No description provided'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Account: {stack.accountId || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Region: {stack.region || 'Unknown'}
                        </div>
                        <div className="break-all text-xs text-gray-400">
                          {stack.stackId}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={stack.imported}
                        onClick={() => handleImportStack(stack)}
                      >
                        {stack.imported ? 'Imported' : 'Import'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setIsStackScanModalOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isManualResourceModalOpen}
          onOpenChange={setIsManualResourceModalOpen}
        >
          <DialogContent className="max-w-lg bg-white">
            <DialogHeader>
              <DialogTitle>Add resource manually</DialogTitle>
              <DialogDescription>
                Capture resources that are not discoverable through scans.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="manual-resource-name-modal">Resource name</Label>
                <Input
                  id="manual-resource-name-modal"
                  value={manualResourceDraft.name}
                  onChange={(e) =>
                    handleManualResourceChange('name', e.target.value)
                  }
                  placeholder="e.g. analytics-ingestor"
                />
              </div>
              <div>
                <Label htmlFor="manual-resource-identifier-modal">
                  Resource identifier / ARN
                </Label>
                <Input
                  id="manual-resource-identifier-modal"
                  value={manualResourceDraft.identifier}
                  onChange={(e) =>
                    handleManualResourceChange('identifier', e.target.value)
                  }
                  placeholder="arn:aws:..."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="manual-resource-type-modal">Type</Label>
                  <select
                    id="manual-resource-type-modal"
                    value={manualResourceDraft.type}
                    onChange={(e) =>
                      handleManualResourceChange('type', e.target.value)
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {manualResourceTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="manual-resource-environment-modal">
                    Environment
                  </Label>
                  <select
                    id="manual-resource-environment-modal"
                    value={manualResourceDraft.environment}
                    onChange={(e) =>
                      handleManualResourceChange('environment', e.target.value)
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {environmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="manual-resource-region-modal">Region</Label>
                <Input
                  id="manual-resource-region-modal"
                  value={manualResourceDraft.region}
                  onChange={(e) =>
                    handleManualResourceChange('region', e.target.value)
                  }
                  placeholder="us-east-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsManualResourceModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleManualResourceAdd}>
                <ListPlus className="mr-2 h-4 w-4" />
                Add resource
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAwsScanModalOpen} onOpenChange={setIsAwsScanModalOpen}>
          <DialogContent className="max-w-4xl bg-white overflow-hidden">
            <DialogHeader>
              <DialogTitle>Stack resource changes</DialogTitle>
              <DialogDescription>
                Review resource changes discovered from tracked CloudFormation stacks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 overflow-x-auto">
              {availableResourceImports.length === 0 &&
              awsScanRemovalCandidates.length === 0 ? (
                <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No resource differences detected for the current workload settings.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Resources to add ({availableResourceImports.length})
                      </h4>
                      <span className="text-xs text-gray-500">
                        {selectedAwsScanResourceIds.length} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleAllAwsResources}
                        disabled={selectableAwsResourceIds.length === 0}
                      >
                        {allSelectableAwsResourcesSelected
                          ? 'Uncheck all'
                          : 'Check all'}
                      </Button>
                    </div>
                    {availableResourceImports.length > 0 ? (
                      <div className="max-h-[240px] overflow-y-auto overflow-x-auto rounded-md border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="w-12 px-4 py-2">
                                <input
                                  ref={selectAllAwsScanCheckboxRef}
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  disabled={selectableAwsResourceIds.length === 0}
                                  checked={
                                    selectableAwsResourceIds.length > 0 &&
                                    allSelectableAwsResourcesSelected
                                  }
                                  onChange={handleToggleAllAwsResources}
                                />
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Resource
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Resource type
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Service
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Tags
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Environment
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Region
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {availableResourceImports.map((resource) => {
                              const isSelected = selectedAwsScanResourceIds.includes(
                                resource.resourceId
                              );
                              return (
                                <tr
                                  key={resource.resourceId}
                                  className={`hover:bg-gray-50 ${
                                    resource.imported ? 'opacity-60' : ''
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                      disabled={resource.imported}
                                      checked={
                                        resource.imported ? false : isSelected
                                      }
                                      onChange={(e) =>
                                        handleAwsResourceSelectionChange(
                                          resource.resourceId,
                                          e.target.checked
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-gray-900 max-w-[280px] whitespace-nowrap overflow-hidden text-ellipsis">
                                      {resource.displayName}
                                    </div>
                                    <div className="text-xs text-gray-500 break-all">
                                      {resource.resourceId}
                                    </div>
                                    <div className="text-xs text-gray-500 break-all">
                                      {resource.resourceArn}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    <div
                                      title={resource.resourceType || ''}
                                      className="max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis"
                                    >
                                      {resource.resourceType || '—'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {resource.service || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {(() => {
                                      const tags =
                                        (resource.details &&
                                          resource.details.tags) ||
                                        {};
                                      const tagCount = Object.keys(tags).length;
                                      if (tagCount === 0) return '—';
                                      return (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="px-2 py-1"
                                          onClick={() =>
                                            setTagViewer({
                                              open: true,
                                              title:
                                                resource.displayName ||
                                                resource.resourceId ||
                                                'Resource',
                                              tags,
                                            })
                                          }
                                        >
                                          {tagCount}
                                        </Button>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {getEnvironmentDisplay(resource.accountId)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {resource.region || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        No new AWS resources discovered in this scan.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-6">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Resources to remove ({awsScanRemovalCandidates.length})
                      </h4>
                      <span className="text-xs text-gray-500">
                        {selectedAwsRemovalIds.length} selected
                      </span>
                    </div>
                    {awsScanRemovalCandidates.length > 0 ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleAllRemovalCandidates}
                          >
                            {selectedAwsRemovalIds.length ===
                            awsScanRemovalCandidates.length
                              ? 'Uncheck all'
                              : 'Check all'}
                          </Button>
                        </div>
                        <div className="max-h-[240px] overflow-y-auto overflow-x-auto rounded-md border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                              <tr>
                                <th className="w-12 px-4 py-2">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    checked={
                                      awsScanRemovalCandidates.length > 0 &&
                                      selectedAwsRemovalIds.length ===
                                        awsScanRemovalCandidates.length
                                    }
                                    onChange={handleToggleAllRemovalCandidates}
                                  />
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                  Resource
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                  Resource type
                                </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Service
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                Tags
                              </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                  Environment
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                  Region
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {awsScanRemovalCandidates.map((resource) => {
                                const isSelected = selectedAwsRemovalIds.includes(
                                  resource.resourceId
                                );
                                return (
                                  <tr key={resource.resourceId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        checked={isSelected}
                                        onChange={(e) =>
                                          handleRemovalSelectionChange(
                                            resource.resourceId,
                                            e.target.checked
                                          )
                                        }
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="font-medium text-gray-900 max-w-[280px] whitespace-nowrap overflow-hidden text-ellipsis">
                                        {resource.displayName}
                                      </div>
                                      <div className="text-xs text-gray-500 break-all">
                                        {resource.resourceId}
                                      </div>
                                      <div className="text-xs text-gray-500 break-all">
                                        {resource.resourceArn}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                    <div
                                      title={resource.resourceType || ''}
                                      className="max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis"
                                    >
                                      {resource.resourceType || '—'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {resource.service || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                      {(() => {
                                        const tags =
                                          (resource.details &&
                                            resource.details.tags) ||
                                          {};
                                        const tagCount = Object.keys(tags).length;
                                        if (tagCount === 0) return '—';
                                        return (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="px-2 py-1"
                                            onClick={() =>
                                              setTagViewer({
                                                open: true,
                                                title:
                                                  resource.displayName ||
                                                  resource.resourceId ||
                                                  'Resource',
                                                tags,
                                              })
                                            }
                                          >
                                            {tagCount}
                                          </Button>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                      {getEnvironmentDisplay(resource.accountId)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                      {resource.region || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        No tracked resources are missing from the selected AWS environments.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-gray-400">
                {lastResourceScanAt
                  ? `Last stack resource refresh ran at ${lastResourceScanAt.toLocaleTimeString()}.`
                  : 'No stack resource refresh has been run yet.'}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAwsScanModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={handleApplyScanUpdates}
                  disabled={
                    selectedAwsScanResourceIds.length === 0 &&
                    selectedAwsRemovalIds.length === 0
                  }
                >
                  Update resources
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isResourceHealthOptionsModalOpen}
          onOpenChange={setIsResourceHealthOptionsModalOpen}
        >
          <DialogContent className="max-w-lg bg-white">
            <DialogHeader>
              <DialogTitle>Run resource health checks</DialogTitle>
              <DialogDescription>
                Configure health check options for your tracked resources.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
                <Label
                  htmlFor="health-check-lookback-days"
                  className="text-sm font-medium text-gray-900"
                >
                  Lookback period
                </Label>
                <p className="mt-1 text-xs text-gray-600 mb-2">
                  How far back to analyze CloudWatch metrics and alarms for health evaluation.
                </p>
                <select
                  id="health-check-lookback-days"
                  value={healthCheckLookbackDays}
                  onChange={(e) => setHealthCheckLookbackDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  <option value={1}>Last 1 day</option>
                  <option value={3}>Last 3 days</option>
                  <option value={5}>Last 5 days (default)</option>
                </select>
              </div>
              <div className="flex items-start justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-3">
                <div>
                  <Label
                    htmlFor="include-cloudwatch-log-checks"
                    className="text-sm font-medium text-gray-900"
                  >
                    Include CloudWatch log checks
                  </Label>
                  <p className="mt-1 text-xs text-gray-600">
                    Searches CloudWatch logs for keywords like &quot;error&quot;, &quot;fail&quot;, &quot;exception&quot;, etc.
                    to detect potential issues in your resources.
                  </p>
                </div>
                <Switch
                  id="include-cloudwatch-log-checks"
                  checked={includeCloudWatchLogChecks}
                  onCheckedChange={setIncludeCloudWatchLogChecks}
                  className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                />
              </div>
              <div className="flex items-start justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-3">
                <div>
                  <Label
                    htmlFor="force-regenerate-health-report"
                    className="text-sm font-medium text-gray-900"
                  >
                    Generate a new report
                  </Label>
                  <p className="mt-1 text-xs text-gray-600">
                    When off, CloudAgent reuses the latest report if it was generated in the last 24 hours.
                  </p>
                </div>
                <Switch
                  id="force-regenerate-health-report"
                  checked={forceRegenerateHealthReport}
                  onCheckedChange={setForceRegenerateHealthReport}
                  className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                />
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Cost note: longer lookback periods and enabling log checks may increase API costs
                for workloads with large CloudWatch log volumes.
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsResourceHealthOptionsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsResourceHealthOptionsModalOpen(false);
                  handleCheckResourceHealth({
                    includeLogs: includeCloudWatchLogChecks,
                    lookbackHours: healthCheckLookbackDays * 24,
                    forceRefresh: forceRegenerateHealthReport,
                  });
                }}
                disabled={isCheckingResourceHealth}
              >
                {isCheckingResourceHealth ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running checks...
                  </>
                ) : (
                  'Run checks'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={resourceHealthViewer.open}
          onOpenChange={(open) => {
            if (!open) {
              setExpandedHealthCheckKey('');
              setResourceHealthViewer({ open: false, resource: null });
              return;
            }
            setResourceHealthViewer((prev) => ({ ...prev, open }));
          }}
        >
          <DialogContent className="max-w-4xl bg-white">
            <DialogHeader>
              <DialogTitle>
                Resource health details
                {resourceHealthViewer.resource?.displayName
                  ? `: ${resourceHealthViewer.resource.displayName}`
                  : ''}
              </DialogTitle>
              <DialogDescription className="break-all text-xs">
                {resourceHealthViewer.resource?.resourceArn ||
                  resourceHealthViewer.resource?.resourceId ||
                  ''}
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const selectedResource = resourceHealthViewer.resource || {};
              const selectedHealth = selectedResource?.health || {};
              const checks = Array.isArray(selectedHealth?.checks)
                ? selectedHealth.checks
                : [];
              const counts = getResourceHealthCounts(selectedResource);
              const resourceErrors = Array.isArray(selectedHealth?.errors)
                ? selectedHealth.errors
                : [];
              const isNotApplicable = isResourceHealthNotApplicable(selectedResource);
              const realErrors = resourceErrors.filter(
                (errorText) =>
                  !isSkippedError(errorText) && !isNotApplicableHealthMessage(errorText)
              );
              const totalIssues = counts.notHealthy + realErrors.length;

              return (
                <div className="space-y-4 py-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-green-700">
                      Healthy checks: {counts.healthy}
                    </span>
                    {counts.notApplicable > 0 && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                        Not applicable: {counts.notApplicable}
                      </span>
                    )}
                    {isNotApplicable ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                        Not applicable
                      </span>
                    ) : (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                        Issues: {totalIssues}
                      </span>
                    )}
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700">
                      Total checks: {counts.total}
                    </span>
                    {selectedHealth?.generatedAt && (
                      <span className="text-gray-500">
                        Generated at: {new Date(selectedHealth.generatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {realErrors.length > 0 && (
                    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {realErrors.map((errorText, index) => (
                        <div key={`${errorText}-${index}`}>{errorText}</div>
                      ))}
                    </div>
                  )}

                  {checks.length > 0 ? (
                    <div className="max-h-[420px] overflow-y-auto rounded border border-gray-200">
                      <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="w-[28%] px-4 py-2 text-left font-semibold text-gray-600">
                              Check
                            </th>
                            <th className="w-[12%] px-4 py-2 text-left font-semibold text-gray-600">
                              Status
                            </th>
                            <th className="w-[12%] px-4 py-2 text-left font-semibold text-gray-600">
                              Category
                            </th>
                            <th className="w-[26%] px-4 py-2 text-left font-semibold text-gray-600">
                              Summary
                            </th>
                            <th className="w-[14%] px-4 py-2 text-left font-semibold text-gray-600">
                              Checked at
                            </th>
                            <th className="w-[8%] px-4 py-2 text-left font-semibold text-gray-600">
                              Details
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {checks.map((check, checkIndex) => {
                            const status = String(check?.status || 'unknown');
                            const normalizedStatus = normalizeHealthStatus(status);
                            const statusClass =
                              normalizedStatus === 'healthy'
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : normalizedStatus === 'not_applicable'
                                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                                  : 'border-red-200 bg-red-50 text-red-700';
                            const checkKey = `${
                              check?.checkId || check?.checkName || 'check'
                            }-${check?.checkedAt || checkIndex}`;
                            const hasDetails = !!check?.details;
                            const isExpanded = expandedHealthCheckKey === checkKey;
                            return (
                              <React.Fragment key={checkKey}>
                                <tr>
                                  <td className="px-4 py-3 align-top">
                                    <div className="font-medium text-gray-900">
                                      {check?.checkName || check?.checkId || 'Check'}
                                    </div>
                                    {check?.checkId && (
                                      <div className="text-xs text-gray-500">
                                        {check.checkId}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass}`}
                                    >
                                      {status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 align-top text-gray-700">
                                    {check?.category || '—'}
                                  </td>
                                  <td className="px-4 py-3 align-top text-gray-700">
                                    <div className="break-words">
                                      {check?.summary || '—'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 align-top text-xs text-gray-500">
                                    {check?.checkedAt
                                      ? new Date(check.checkedAt).toLocaleString()
                                      : '—'}
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    {hasDetails ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        onClick={() =>
                                          setExpandedHealthCheckKey((prev) =>
                                            prev === checkKey ? '' : checkKey
                                          )
                                        }
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronDown className="mr-1 h-4 w-4" />
                                            Hide
                                          </>
                                        ) : (
                                          <>
                                            <ChevronRight className="mr-1 h-4 w-4" />
                                            View
                                          </>
                                        )}
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                </tr>
                                {hasDetails && isExpanded && (
                                  <tr className="bg-gray-50">
                                    <td colSpan={6} className="px-4 py-3">
                                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-gray-200 bg-white p-3 text-xs text-gray-700">
                                        {JSON.stringify(check.details, null, 2)}
                                      </pre>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      No health checks found for this resource.
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setExpandedHealthCheckKey('');
                        setResourceHealthViewer({ open: false, resource: null });
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
        <Dialog
          open={tagViewer.open}
          onOpenChange={(open) =>
            setTagViewer((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Tags</DialogTitle>
              <DialogDescription className="truncate">
                {tagViewer.title}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[320px] overflow-y-auto rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">
                      Key
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.keys(tagViewer.tags || {}).length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-gray-500" colSpan={2}>
                        No tags
                      </td>
                    </tr>
                  ) : (
                    Object.entries(tagViewer.tags).map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-4 py-3 text-gray-700 break-all">
                          {key}
                        </td>
                        <td className="px-4 py-3 text-gray-700 break-all">
                          {String(value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setTagViewer({ open: false, title: '', tags: {} })}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isResourceTypesModalOpen}
          onOpenChange={setIsResourceTypesModalOpen}
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Resource Types</DialogTitle>
              <DialogDescription>
                Breakdown of {totalResourceCount} tracked resources by type
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              <div className="space-y-2">
                {resourceSummary
                  .sort((a, b) => b.count - a.count)
                  .map((item) => (
                    <div
                      key={item.type}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="text-sm font-medium text-gray-900 truncate" title={item.type}>
                          {item.type.replace('AWS::', '').replace('::', ' ')}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={item.type}>
                          {item.type}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{
                              width: `${Math.min(100, (item.count / totalResourceCount) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setIsResourceTypesModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </TabsContent>
      </Tabs>
    );
  }
  
  export default WorkloadResourcesPage;
