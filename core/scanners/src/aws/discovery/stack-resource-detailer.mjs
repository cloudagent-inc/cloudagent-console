import {
  scanEc2Resources,
  scanEc2SecurityGroups,
  scanEc2Vpcs,
  scanEc2Subnets,
  scanEc2InternetGateways,
  scanEc2NatGateways,
  scanEc2LaunchTemplates,
  scanEc2Volumes,
  scanEc2Snapshots,
} from "./ec2.mjs";
import { scanS3Resources } from "./s3.mjs";
import { scanDynamoDbResources } from "./dynamodb.mjs";
import { scanLambdaResources } from "./lambda.mjs";
import { scanIamResources } from "./iam.mjs";
import {
  scanElbv2LoadBalancers,
  scanElbv2Listeners,
  scanElbv2TargetGroups,
} from "./elbv2.mjs";
import { scanEcsClusters, scanEcsServices, scanEcsTaskDefinitions } from "./ecs.mjs";
import { scanEksClusters } from "./eks.mjs";
import { scanCloudWatchLogGroups } from "./logs.mjs";
import { scanAutoScalingGroups, scanLaunchConfigurations } from "./autoscaling.mjs";
import { scanEcrRepositories } from "./ecr.mjs";
import { scanRdsDbInstances, scanRdsDbClusters, scanRdsDbSubnetGroups, scanRdsDbParameterGroups } from "./rds.mjs";
import { scanElastiCacheReplicationGroups, scanElastiCacheCacheClusters, scanElastiCacheSubnetGroups } from "./elasticache.mjs";
import { scanOpenSearchDomains } from "./opensearch.mjs";
import { scanEfsFileSystems, scanEfsMountTargets } from "./efs.mjs";
import { scanSqsQueues } from "./sqs.mjs";
import { scanSnsTopics, scanSnsSubscriptions } from "./sns.mjs";
import { scanApiGatewayRestApis } from "./apigateway.mjs";
import { scanApiGatewayV2Apis } from "./apigatewayv2.mjs";
import { scanSfnStateMachines } from "./sfn.mjs";
import { scanCloudFrontDistributions } from "./cloudfront.mjs";
import { DEFAULT_REGION } from "./shared.mjs";

const RESOURCE_DETAILERS = {
  "AWS::EC2::Instance": {
    scanner: scanEc2Resources,
    filterKey: "instanceIds",
    extractId: (resource) =>
      resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::S3::Bucket": {
    scanner: scanS3Resources,
    filterKey: "bucketNames",
    extractId: (resource) =>
      resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::DynamoDB::Table": {
    scanner: scanDynamoDbResources,
    filterKey: "tableNames",
    extractId: (resource) =>
      resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::Lambda::Function": {
    scanner: scanLambdaResources,
    filterKey: "functionNames",
    extractId: (resource) =>
      resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::IAM::Role": {
    scanner: scanIamResources,
    filterKey: "roleNames",
    extractId: (resource) =>
      resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  // Additional resource types
  "AWS::EC2::SecurityGroup": {
    scanner: scanEc2SecurityGroups,
    filterKey: "securityGroupIds",
    extractId: (resource) =>
      resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::ElasticLoadBalancingV2::LoadBalancer": {
    scanner: scanElbv2LoadBalancers,
    filterKey: "loadBalancerArns",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::ElasticLoadBalancingV2::Listener": {
    scanner: scanElbv2Listeners,
    filterKey: "listenerArns",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::ElasticLoadBalancingV2::TargetGroup": {
    scanner: scanElbv2TargetGroups,
    filterKey: "targetGroupArns",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::ECS::Cluster": {
    scanner: scanEcsClusters,
    filterKey: "clusters",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::ECS::Service": {
    scanner: scanEcsServices,
    filterKey: "services",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::ECS::TaskDefinition": {
    scanner: scanEcsTaskDefinitions,
    filterKey: "taskDefinitions",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::Logs::LogGroup": {
    scanner: scanCloudWatchLogGroups,
    filterKey: "logGroupNames",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::EC2::VPC": {
    scanner: scanEc2Vpcs,
    filterKey: "vpcIds",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::EC2::Subnet": {
    scanner: scanEc2Subnets,
    filterKey: "subnetIds",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::EC2::InternetGateway": {
    scanner: scanEc2InternetGateways,
    filterKey: "internetGatewayIds",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  "AWS::EC2::NatGateway": {
    scanner: scanEc2NatGateways,
    filterKey: "natGatewayIds",
    extractId: (resource) => resource?.details?.physicalResourceId || resource?.resourceId || null,
  },
  // Compute & Scaling
  "AWS::AutoScaling::AutoScalingGroup": {
    scanner: scanAutoScalingGroups,
    filterKey: "autoScalingGroupNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::AutoScaling::LaunchConfiguration": {
    scanner: scanLaunchConfigurations,
    filterKey: "launchConfigurationNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::EC2::LaunchTemplate": {
    scanner: scanEc2LaunchTemplates,
    filterKey: "launchTemplateIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::ECR::Repository": {
    scanner: scanEcrRepositories,
    filterKey: "repositoryNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::EKS::Cluster": {
    scanner: scanEksClusters,
    filterKey: "clusterNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  // Data Stores
  "AWS::RDS::DBInstance": {
    scanner: scanRdsDbInstances,
    filterKey: "dbInstanceIdentifiers",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::RDS::DBCluster": {
    scanner: scanRdsDbClusters,
    filterKey: "dbClusterIdentifiers",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::RDS::DBSubnetGroup": {
    scanner: scanRdsDbSubnetGroups,
    filterKey: "dbSubnetGroupNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::RDS::DBParameterGroup": {
    scanner: scanRdsDbParameterGroups,
    filterKey: "dbParameterGroupNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::ElastiCache::ReplicationGroup": {
    scanner: scanElastiCacheReplicationGroups,
    filterKey: "replicationGroupIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::ElastiCache::CacheCluster": {
    scanner: scanElastiCacheCacheClusters,
    filterKey: "cacheClusterIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::ElastiCache::SubnetGroup": {
    scanner: scanElastiCacheSubnetGroups,
    filterKey: "subnetGroupNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::OpenSearchService::Domain": {
    scanner: scanOpenSearchDomains,
    filterKey: "domainNames",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::EFS::FileSystem": {
    scanner: scanEfsFileSystems,
    filterKey: "fileSystemIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::EFS::MountTarget": {
    scanner: scanEfsMountTargets,
    filterKey: "mountTargetIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::EC2::Volume": {
    scanner: scanEc2Volumes,
    filterKey: "volumeIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::EC2::Snapshot": {
    scanner: scanEc2Snapshots,
    filterKey: "snapshotIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  // Messaging, API, Events
  "AWS::SQS::Queue": {
    scanner: scanSqsQueues,
    filterKey: "queueUrls",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::SNS::Topic": {
    scanner: scanSnsTopics,
    filterKey: "topicArns",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::SNS::Subscription": {
    scanner: scanSnsSubscriptions,
    filterKey: "subscriptionArns",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::ApiGateway::RestApi": {
    scanner: scanApiGatewayRestApis,
    filterKey: "restApiIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::ApiGatewayV2::Api": {
    scanner: scanApiGatewayV2Apis,
    filterKey: "apiIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::StepFunctions::StateMachine": {
    scanner: scanSfnStateMachines,
    filterKey: "stateMachineArns",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
  "AWS::CloudFront::Distribution": {
    scanner: scanCloudFrontDistributions,
    filterKey: "distributionIds",
    extractId: (r) => r?.details?.physicalResourceId || r?.resourceId || null,
  },
};

function normalizeRegion(region, fallback) {
  if (typeof region === "string" && region.trim()) return region.trim();
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return null;
}

function summarizeResourceTypes(resources = []) {
  const counts = new Map();
  for (const resource of resources) {
    const resourceType = resource?.resourceType || "unknown";
    counts.set(resourceType, (counts.get(resourceType) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export async function enrichStackResources({
  stackResources = [],
  logger,
  credentials,
  accountId,
  syncedAt,
  defaultRegion,
} = {}) {
  const supported = stackResources.filter((resource) =>
    Boolean(RESOURCE_DETAILERS[resource?.resourceType])
  );
  const unsupported = stackResources.filter(
    (resource) => !RESOURCE_DETAILERS[resource?.resourceType]
  );

  logger?.info?.("[stack-resource-detailer] enrichment starting", {
    stackResourceCount: stackResources.length,
    supportedResourceCount: supported.length,
    unsupportedResourceCount: unsupported.length,
    supportedResourceTypes: summarizeResourceTypes(supported),
    unsupportedResourceTypes: summarizeResourceTypes(unsupported),
  });

  const aggregatedResources = [];
  const scannerErrors = [];
  const missing = [];

  for (const [resourceType, detailer] of Object.entries(RESOURCE_DETAILERS)) {
    const matchingResources = supported.filter((resource) => resource.resourceType === resourceType);
    if (!matchingResources.length) continue;

    const idsByRegion = new Map();
    for (const resource of matchingResources) {
      const id = detailer.extractId(resource);
      if (!id) continue;
      const region = normalizeRegion(resource.region, defaultRegion) || DEFAULT_REGION;
      if (!idsByRegion.has(region)) idsByRegion.set(region, new Set());
      idsByRegion.get(region).add(id);
    }

    if (idsByRegion.size === 0) {
      logger?.warn?.("[stack-resource-detailer] matching stack resources had no usable identifiers", {
        resourceType,
        resourceCount: matchingResources.length,
      });
    }

    for (const [region, idsSet] of idsByRegion.entries()) {
      const ids = [...idsSet];
      if (!ids.length) continue;

      try {
        const scanResult = await detailer.scanner({
          regions: [region],
          logger,
          credentials,
          accountId,
          syncedAt,
          [detailer.filterKey]: ids,
        });

        const returnedResources = Array.isArray(scanResult?.resources)
          ? scanResult.resources
          : [];
        aggregatedResources.push(...returnedResources);

        logger?.info?.("[stack-resource-detailer] scanner completed", {
          resourceType,
          region,
          requestedCount: ids.length,
          returnedCount: returnedResources.length,
          requestedIds: ids,
          returnedIds: returnedResources.map((item) => item?.resourceId).filter(Boolean),
        });

        const returnedIds = new Set(returnedResources.map((item) => item?.resourceId).filter(Boolean));
        for (const id of ids) {
          if (!returnedIds.has(id)) {
            missing.push({ resourceType, region, id });
          }
        }

        if (Array.isArray(scanResult?.errors) && scanResult.errors.length) {
          scannerErrors.push(
            ...scanResult.errors.map((err) => ({ ...err, resourceType, region }))
          );
        }
      } catch (error) {
        scannerErrors.push({
          resourceType,
          region,
          message: error?.message || "Scanner invocation failed",
        });
        logger?.error?.("[stack-resource-detailer] scanner invocation failed", {
          resourceType,
          region,
          error,
        });
      }
    }
  }

  const ok = scannerErrors.length === 0 && missing.length === 0;

  logger?.info?.("[stack-resource-detailer] enrichment completed", {
    ok,
    stackResourceCount: stackResources.length,
    supportedResourceCount: supported.length,
    unsupportedResourceCount: unsupported.length,
    enrichedResourceCount: aggregatedResources.length,
    missingCount: missing.length,
    scannerErrorCount: scannerErrors.length,
  });

  return {
    ok,
    resources: aggregatedResources,
    unsupported,
    missing,
    errors: scannerErrors,
  };
}
