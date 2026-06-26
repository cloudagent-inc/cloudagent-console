
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Loader2,
  XCircle,
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  updateAgentPermissionProfile,
} from '../../features/agent/agentSlice';
import {
  createWorkloadDefinition,
  updateWorkloadDefinition,
} from '../../features/workload/workloadSlice';
import {
  getGlobalWorkloadDeploymentPreferences,
  runPostCreateWorkloadSync,
} from '@/features/workload/workloadCreationUtils';
import toast from 'react-hot-toast';
import rulesData from '../../helpers/rules.json';
import Govenance from '@/components/Workload/Govenance';
import DeploymentSettings from '@/components/Workload/DeploymentSettings';
import Architecture from '@/components/Workload/Architecture';
import General from '@/components/Workload/General';
import WorkloadDeliveryCard from '@/components/Workload/WorkloadDeliveryCard';
import { filterCloudEnvironments } from '@/helpers/shared';
import { getRegionOptions } from '@/helpers/shared';
import SecurityRulesTab from '@/components/SecurityCompliance/SecurityRulesTab';
import { buildGitRepo, cleanGitRepo, getGithubConnections } from '@/helpers/github';
import {
  buildWorkloadEnvironmentOptions,
  normalizeWorkloadEnvironmentIds,
  resolveWorkloadEnvironmentRef,
} from '@/features/workload/workloadEnvironmentUtils';
import {
  securityPresets as importedSecurityPresets,
  securityRulesConfig as importedSecurityRulesConfig,
  securityRulesConfigByService as importedSecurityRulesConfigByService,
  getCategoryRules as importedGetCategoryRules,
  countUniqueEnabledRules as importedCountUniqueEnabledRules,
  areAllUniqueRulesEnabled as importedAreAllUniqueRulesEnabled,
  allUniqueRuleIds as importedAllUniqueRuleIds,
  applySecurityPreset as importedApplySecurityPreset,
  getGlobalWorkloadSecurityRules,
} from '@/components/SecurityCompliance/securityRulesUtils';

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


function WorkloadModal({
    isOpen,
    onClose,
    workload,
    userProfile,
    hideGeneralTab,
  }) {
    const dispatch = useDispatch();
    const githubConnections = useMemo(
      () => getGithubConnections(userProfile),
      [userProfile]
    );
  
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
  
    const [activeTab, setActiveTab] = useState(
      hideGeneralTab ? 'deployment' : 'general'
    );
    const [isSaving, setIsSaving] = useState(false);
    const [regionsDropdownOpen, setRegionsDropdownOpen] = useState(false);
    const regionsDropdownRef = useRef(null);
    const [groupBy, setGroupBy] = useState('category'); // 'category' or 'service'
    const permissionProfiles = useMemo(
      () => filterCloudEnvironments(userProfile?.agentPermissionProfiles || []),
      [userProfile?.agentPermissionProfiles]
    );
    const [formData, setFormData] = useState({
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
          const environmentRef = resolveWorkloadEnvironmentRef(envValue, permissionProfiles);
          const label = environmentRef?.label || String(envValue || 'Unassigned');
          const value = environmentRef?.permissionProfileId || label;

          if (seen.has(value)) {
            return null;
          }
          seen.add(value);
          return { value, label };
        })
        .filter(Boolean);

      fallback.forEach((option) => {
        if (!seen.has(option.value)) {
          derived.push(option);
        }
      });

      return derived;
    }, [formData.environments, permissionProfiles]);

    // Helper to display environment name
    const getEnvironmentDisplay = (permissionProfileId) => {
      const environmentRef = resolveWorkloadEnvironmentRef(permissionProfileId, permissionProfiles);
      return environmentRef?.label || permissionProfileId || 'Unassigned';
    };

    // Environment options for destination picker in WorkloadDeliveryCard
    const destinationEnvironmentOptions = useMemo(() => {
      return buildWorkloadEnvironmentOptions(permissionProfiles);
    }, [permissionProfiles]);

    useEffect(() => {
      if (hideGeneralTab && activeTab === 'general') {
        setActiveTab('deployment');
      }
    }, [hideGeneralTab, activeTab]);

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
            ? normalizeWorkloadEnvironmentIds(workload.environments, permissionProfiles)
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
    }, [permissionProfiles, workload, userProfile?.settings]);
  
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

    const prepareWorkloadData = (data) => {
      const deploymentPreferences = data?.deploymentPreferences || {};
      const trackedResourcesInput = parseTrackedResources(
        data?.trackedResources,
        { resources: [], stacks: [] }
      );
      const securityRulesInput = data?.securityRules || { categories: {}, rules: {} };
  
      const cleanSecurityRules = {
        categories: {},
        rules: {},
      };
  
      Object.keys(securityRulesInput.categories || {}).forEach((categoryKey) => {
        cleanSecurityRules.categories[categoryKey] = {};
        Object.keys(securityRulesInput.categories[categoryKey] || {}).forEach((key) => {
          if (key !== '_expanded') {
            cleanSecurityRules.categories[categoryKey][key] =
              securityRulesInput.categories[categoryKey][key];
          }
        });
      });
  
      cleanSecurityRules.rules = { ...(securityRulesInput.rules || {}) };

      const cleanStacks = sanitizeStackEntries(
        getTrackedStacks(trackedResourcesInput, deploymentPreferences)
      );
  
      const cleanEnvironments = normalizeWorkloadEnvironmentIds(
        Array.isArray(data.environments) ? data.environments : [],
        permissionProfiles
      );
  
      const cleanRequiredTags = Array.isArray(deploymentPreferences.requiredTags)
        ? deploymentPreferences.requiredTags
            .filter((t) => t && typeof t === 'object' && (t.key || '').trim() !== '')
            .map((t) => ({
              key: (t.key || '').trim(),
              value: (t.value || '').trim(),
              notes: (t.notes || '').trim(),
            }))
        : [];
  
      return {
        workloadName: data.workloadName || '',
        description: data.description || '',
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
        trackedResources: {
          ...trackedResourcesInput,
          stacks: cleanStacks,
        },
        securityRules: cleanSecurityRules,
      };
    };

    const handleSave = async () => {
      // Basic validation for required fields
      if (!formData.workloadName || formData.workloadName.trim() === '') {
        toast.error('Workload name is required');
        return;
      }
  
      if (!formData.description || formData.description.trim() === '') {
        toast.error('Description is required');
        return;
      }
  
      if (formData.environments.length === 0) {
        toast.error('Please select at least one environment');
        return;
      }
  
      setIsSaving(true);
      try {
        const cleanData = prepareWorkloadData(formData);
  
        if (
          workload &&
          Object.keys(workload).length > 0 &&
          workload.workloadId &&
          !workload.workloadId.startsWith('permission_')
        ) {
          // Update existing workload
          const updatedWorkload = await dispatch(
            updateWorkloadDefinition({
              workloadId: workload.workloadId,
              ...cleanData,
            })
          ).unwrap();
  
          // Update the local formData with the response from the backend
          if (updatedWorkload) {
            // Parse the JSON strings back to objects for display
            const parsedDeploymentPreferences =
              typeof updatedWorkload.deploymentPreferences === 'string'
                ? JSON.parse(updatedWorkload.deploymentPreferences)
                : updatedWorkload.deploymentPreferences;
            
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
  
            const parsedTrackedResources = parseTrackedResources(
              updatedWorkload.trackedResources,
              { resources: [], stacks: [] }
            );
            const normalizedTrackedResources = {
              ...parsedTrackedResources,
              stacks: sanitizeStackEntries(
                getTrackedStacks(parsedTrackedResources, parsedDeploymentPreferences)
              ),
            };

            const parsedSecurityRulesRaw =
              typeof updatedWorkload.securityRules === 'string'
                ? JSON.parse(updatedWorkload.securityRules)
                : updatedWorkload.securityRules;
            const parsedSecurityRules = createSecurityRulesStructure(parsedSecurityRulesRaw);
            const parsedResourceRules =
              typeof updatedWorkload.resourceRules === 'string'
                ? JSON.parse(updatedWorkload.resourceRules)
                : updatedWorkload.resourceRules;
  
            const newFormData = {
              workloadName: updatedWorkload.workloadName || '',
              description: updatedWorkload.description || '',
              environments: updatedWorkload.environments || [],
              deploymentPreferences: parsedDeploymentPreferences || {
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
              },
              trackedResources: normalizedTrackedResources,
              securityRules: parsedSecurityRules,
              resourceRules: parsedResourceRules || {},
            };
  
            setFormData(newFormData);
          }
  
          toast.success(
            `Workload "${formData.workloadName}" updated successfully!`
          );
  
          // Keep modal open briefly to show the updated data
          setTimeout(() => {
            onClose();
          }, 1500); // Close after 1.5 seconds
          return; // Don't close immediately
        } else if (
          workload &&
          workload.workloadId &&
          workload.workloadId.startsWith('permission_')
        ) {
          // Update permission rules
          const recordId = workload.workloadId.replace('permission_', '');
          const permissionProfile = userProfile?.agentPermissionProfiles?.find(
            (p) => p.recordId === recordId
          );
  
          if (permissionProfile) {
            // Parse authProfile if it's a string
            const authProfile = typeof permissionProfile.authProfile === 'string' 
              ? JSON.parse(permissionProfile.authProfile) 
              : permissionProfile.authProfile || {};

            await dispatch(
              updateAgentPermissionProfile({
                recordId: recordId,
                deploymentPreferences: JSON.stringify(cleanData.deploymentPreferences),
                securityRules: JSON.stringify(cleanData.securityRules),
              })
            ).unwrap();
  
            toast.success('Permission rules updated successfully!');
          }
        } else {
          // Create new workload
          const createdWorkload = await dispatch(createWorkloadDefinition(cleanData)).unwrap();
          const syncResult = await runPostCreateWorkloadSync({
            dispatch,
            workloads: [createdWorkload],
          });
          toast.success(
            `Workload "${formData.workloadName}" created successfully!`
          );
          if (
            syncResult.healthResults.some((item) => !item.success) ||
            syncResult.summaryResults.some((item) => !item.success) ||
            syncResult.recommendationsRefreshError ||
            syncResult.recommendationsLoadError
          ) {
            toast.error(
              'Workload was created, but some health, summary, or recommendation data could not be refreshed.'
            );
          }
        }
        onClose();
      } catch (error) {
        console.error('Error saving workload:', error);
        toast.error('Failed to save workload. Please try again.');
      } finally {
        setIsSaving(false);
      }
    };
  
    const tabs = [
      { id: 'general', label: 'General' },
      { id: 'deployment', label: 'Deployment Settings' },
      { id: 'governance', label: 'Governance' },
      { id: 'architecture', label: 'Architecture Preferences' },
      { id: 'security', label: 'Security Rules' },
    ].filter((tab) => {
      if (hideGeneralTab && tab.id === 'general') {
        return false;
      }
      return true;
    });

    // Security rules handlers
    const totalRuleCount = importedAllUniqueRuleIds.size;
    const enabledRuleCount = importedCountUniqueEnabledRules(formData.securityRules || {});
    const allRulesEnabled = importedAreAllUniqueRulesEnabled(formData.securityRules || {});

    const handleApplyPreset = (presetKey) => {
      const current = formData.securityRules || {};
      const newSecurityRules = importedApplySecurityPreset(presetKey, current);
      setFormData((prev) => ({ ...prev, securityRules: newSecurityRules }));
    };

    const handleGroupByChange = (value) => {
      setGroupBy(value);
    };

    const handleToggleAllRules = () => {
      if (!formData.securityRules) return;
      const next = {
        categories: { ...formData.securityRules.categories },
        rules: { ...formData.securityRules.rules },
      };
      const shouldEnable = !allRulesEnabled;
      Object.keys(next.rules).forEach((id) => {
        next.rules[id] = { ...(next.rules[id] || {}), enabled: shouldEnable };
      });
      Object.keys(next.categories).forEach((categoryKey) => {
        const ids = importedGetCategoryRules(categoryKey);
        const all = ids.length > 0 && ids.every((id) => next.rules[id]?.enabled === true);
        next.categories[categoryKey] = {
          ...(next.categories[categoryKey] || {}),
          enable_all: all,
        };
      });
      setFormData((prev) => ({ ...prev, securityRules: next }));
    };

    const handleToggleCategoryEnable = (categoryKey, checked) => {
      if (!formData.securityRules) return;
      const next = {
        categories: { ...formData.securityRules.categories },
        rules: { ...formData.securityRules.rules },
      };
      const ids = importedGetCategoryRules(categoryKey);
      ids.forEach((id) => {
        next.rules[id] = { ...(next.rules[id] || {}), enabled: checked };
      });
      if (next.categories[categoryKey]) {
        next.categories[categoryKey] = {
          ...next.categories[categoryKey],
          enable_all: checked,
        };
      }
      setFormData((prev) => ({ ...prev, securityRules: next }));
    };

    const handleToggleCategoryExpand = (categoryKey) => {
      if (!formData.securityRules) return;
      const next = {
        categories: { ...formData.securityRules.categories },
        rules: { ...formData.securityRules.rules },
      };
      if (next.categories[categoryKey]) {
        next.categories[categoryKey] = {
          ...next.categories[categoryKey],
          _expanded: !next.categories[categoryKey]._expanded,
        };
      }
      setFormData((prev) => ({ ...prev, securityRules: next }));
    };

    const handleToggleRule = (categoryKey, ruleKey, checked) => {
      if (!formData.securityRules) return;
      const next = {
        categories: { ...formData.securityRules.categories },
        rules: {
          ...formData.securityRules.rules,
          [ruleKey]: { ...(formData.securityRules.rules?.[ruleKey] || {}), enabled: checked },
        },
      };
      const ids = importedGetCategoryRules(categoryKey);
      const all = ids.length > 0 && ids.every((id) =>
        id === ruleKey ? checked : next.rules[id]?.enabled === true
      );
      if (next.categories[categoryKey]) {
        next.categories[categoryKey] = {
          ...next.categories[categoryKey],
          enable_all: all,
        };
      }
      setFormData((prev) => ({ ...prev, securityRules: next }));
    };
  
    return (
      <>
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {hideGeneralTab
                ? `Edit Rules for: ${workload?.workloadName}`
                : workload && Object.keys(workload).length > 0
                  ? `Edit Workload: ${workload.workloadName}`
                  : 'Create New Workload'}
            </DialogTitle>
          </DialogHeader>
  
          {/* Tab Navigation */}
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
  
          {/* Tab Content */}
          <div className="py-6">
            {activeTab === 'general' && !hideGeneralTab && (
              <>
                <General
                  formData={formData}
                  setFormData={setFormData}
                  userProfile={userProfile}
                  workload={workload}
                  onEnvironmentAddedFromPermission={(selectedPermission) => {
                    if (
                      !workload ||
                      !workload.workloadId ||
                      workload.workloadId.startsWith('permission_')
                    ) {
                      const envSecurityRulesRaw = safeParseJson(
                        selectedPermission.securityRules,
                        {}
                      );
                      const envSecurityRules = createSecurityRulesStructure(envSecurityRulesRaw);

                      const envDeploymentPreferences = safeParseJson(
                        selectedPermission.deploymentPreferences,
                        {
                          method: 'cloudformation',
                          changeSet: false,
                          changeSetNotifications: {
                            email: { enabled: false, address: '' },
                            slack: { enabled: false },
                          },
                          stacks: [],
                          defaultRegions: [],
                          requiredTags: [],
                          useExistingVPCs: false,
                          specifiedVPCs: [],
                          resourceRules: {
                            allowedResources: { allowAll: true, allowedList: [], deniedList: [] },
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

                      if (envDeploymentPreferences) {
                        if (
                          envDeploymentPreferences.deploymentType &&
                          envDeploymentPreferences.changeSet === undefined
                        ) {
                          envDeploymentPreferences.changeSet =
                            envDeploymentPreferences.deploymentType === 'changeset';
                          delete envDeploymentPreferences.deploymentType;
                        } else if (typeof envDeploymentPreferences.changeSet === 'string') {
                          envDeploymentPreferences.changeSet =
                            envDeploymentPreferences.changeSet === 'changeset';
                        }
                        if (
                          envDeploymentPreferences.notifications &&
                          !envDeploymentPreferences.changeSetNotifications
                        ) {
                          envDeploymentPreferences.changeSetNotifications =
                            envDeploymentPreferences.notifications;
                          delete envDeploymentPreferences.notifications;
                        }
                      }

                      const { stacks: _ignoredStacks, ...envPrefsWithoutStacks } =
                        envDeploymentPreferences || {};
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
                  }}
                />
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Deployment Configuration</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Configure how this workload's infrastructure will be managed and deployed.
                  </p>
                  <WorkloadDeliveryCard
                    formData={formData}
                    setFormData={setFormData}
                    githubConnections={githubConnections}
                    environmentOptions={destinationEnvironmentOptions}
                    getEnvironmentDisplay={getEnvironmentDisplay}
                  />
                </div>
              </>
            )}

            {activeTab === 'governance' && (
              <Govenance formData={formData} setFormData={setFormData} />
            )}
  
  
            {activeTab === 'deployment' && (
              <DeploymentSettings
                formData={formData}
                setFormData={setFormData}
                awsRegionOptions={awsRegionOptions}
                githubConnections={githubConnections}
              />
            )}

  
            {activeTab === 'architecture' && (
              <Architecture
                formData={formData}
                setFormData={setFormData}
                applyPreset={applyPreset}
              />
            )}

            {activeTab === 'security' && (
              <SecurityRulesTab
                securityPresets={importedSecurityPresets}
                totalRuleCount={totalRuleCount}
                securityRules={formData.securityRules}
                onApplyPreset={handleApplyPreset}
                countEnabled={enabledRuleCount}
                currentGroupBy={groupBy}
                onToggleGroupBy={handleGroupByChange}
                allEnabled={allRulesEnabled}
                onToggleEnableAll={handleToggleAllRules}
                securityRulesConfig={importedSecurityRulesConfig}
                securityRulesConfigByService={importedSecurityRulesConfigByService}
                getCategoryRules={importedGetCategoryRules}
                onToggleCategoryEnable={handleToggleCategoryEnable}
                onToggleCategoryExpand={handleToggleCategoryExpand}
                onToggleRule={handleToggleRule}
              />
            )}
          </div>
  
          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                (!hideGeneralTab &&
                  (!formData.workloadName ||
                    formData.workloadName.trim() === '' ||
                    !formData.description ||
                    formData.description.trim() === '' ||
                    formData.environments.length === 0))
              }
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : hideGeneralTab ? (
                'Save Rules'
              ) : workload && Object.keys(workload).length > 0 ? (
                'Save Changes'
              ) : (
                'Create Workload'
              )}
            </Button>
          </div>
          </DialogContent>
        </Dialog>




      </>
    );
  }
  
  export default WorkloadModal;
