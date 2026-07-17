import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { DEFAULT_REGION } from "./shared.mjs";
import { scanElbv2Resources } from "./elbv2.mjs";
import { scanEcsResources } from "./ecs.mjs";
import { scanCloudWatchLogsResources } from "./logs.mjs";
import { scanAutoScalingResources } from "./autoscaling.mjs";
import { scanEksResources } from "./eks.mjs";
import { scanEcrResources } from "./ecr.mjs";
import { scanRdsResources } from "./rds.mjs";
import { scanElastiCacheResources } from "./elasticache.mjs";
import { scanOpenSearchResources } from "./opensearch.mjs";
import { scanEfsResources } from "./efs.mjs";
import { scanSqsResources } from "./sqs.mjs";
import { scanSnsResources } from "./sns.mjs";
import { scanApiGatewayResources } from "./apigateway.mjs";
import { scanApiGatewayV2Resources } from "./apigatewayv2.mjs";
import { scanEventBridgeResources } from "./eventbridge.mjs";
import { scanSfnResources } from "./sfn.mjs";
import { scanCloudFrontResources } from "./cloudfront.mjs";
import { scanEc2Resources } from "./ec2.mjs";
import { scanS3Resources } from "./s3.mjs";
import { scanCloudFormationResources } from "./cloudformation.mjs";
import { scanDynamoDbResources } from "./dynamodb.mjs";
import { scanLambdaResources } from "./lambda.mjs";
import { scanIamResources } from "./iam.mjs";

const SERVICE_SCANNERS = {
  ec2: scanEc2Resources,
  s3: scanS3Resources,
  cloudformation: scanCloudFormationResources,
  dynamodb: scanDynamoDbResources,
  lambda: scanLambdaResources,
  iam: scanIamResources,
  elbv2: scanElbv2Resources,
  ecs: scanEcsResources,
  logs: scanCloudWatchLogsResources,
  autoscaling: scanAutoScalingResources,
  ecr: scanEcrResources,
  rds: scanRdsResources,
  elasticache: scanElastiCacheResources,
  opensearch: scanOpenSearchResources,
  efs: scanEfsResources,
  sqs: scanSqsResources,
  sns: scanSnsResources,
  apigateway: scanApiGatewayResources,
  apigatewayv2: scanApiGatewayV2Resources,
  eventbridge: scanEventBridgeResources,
  sfn: scanSfnResources,
  eks: scanEksResources,
  cloudfront: scanCloudFrontResources,
};

export const SUPPORTED_SERVICE_IDS = Object.freeze(Object.keys(SERVICE_SCANNERS));
export const supportedServices = SUPPORTED_SERVICE_IDS;

async function resolveAccountId({ accountId, credentials, logger } = {}) {
  if (accountId) return accountId;
  try {
    const client = new STSClient({
      region: DEFAULT_REGION,
      maxAttempts: 5,
      retryMode: "standard",
      ...(credentials ? { credentials } : {}),
    });
    const identity = await client.send(new GetCallerIdentityCommand({}));
    return identity?.Account || null;
  } catch (error) {
    logger?.warn?.("[scanner] Failed to resolve AWS account ID via STS", { error });
    return null;
  }
}

export async function scanAwsResources({
  services,
  regions,
  logger,
  credentials,
  accountId,
} = {}) {
  const requestedServices =
    Array.isArray(services) && services.length > 0 ? services : SUPPORTED_SERVICE_IDS;

  const unsupported = requestedServices.filter((service) => !SERVICE_SCANNERS[service]);
  if (unsupported.length > 0) {
    throw new Error(`Unsupported services requested: ${unsupported.join(", ")}`);
  }

  const syncedAt = new Date().toISOString();
  const effectiveAccountId = await resolveAccountId({ accountId, credentials, logger });

  const results = {};
  for (const service of requestedServices) {
    const scanFn = SERVICE_SCANNERS[service];
    results[service] = await scanFn({
      regions,
      logger,
      syncedAt,
      accountId: effectiveAccountId,
      credentials,
    });
  }

  return {
    requestedServices,
    results,
    syncedAt,
    defaultAccountId: effectiveAccountId ?? null,
  };
}

