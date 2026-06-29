import {
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  DescribeDBMajorEngineVersionsCommand,
  RDSClient,
} from "@aws-sdk/client-rds";
import {
  DocDBClient,
  DescribeDBClustersCommand as DescribeDocDbClustersCommand,
  DescribeDBInstancesCommand as DescribeDocDbInstancesCommand,
} from "@aws-sdk/client-docdb";
import {
  NeptuneClient,
  DescribeDBClustersCommand as DescribeNeptuneClustersCommand,
  DescribeDBInstancesCommand as DescribeNeptuneInstancesCommand,
  DescribeGlobalClustersCommand as DescribeNeptuneGlobalClustersCommand,
} from "@aws-sdk/client-neptune";
import {
  RedshiftClient,
  DescribeClustersCommand as DescribeRedshiftClustersCommand,
} from "@aws-sdk/client-redshift";
import {
  MemoryDBClient,
  DescribeClustersCommand as DescribeMemoryDbClustersCommand,
} from "@aws-sdk/client-memorydb";
import {
  TimestreamWriteClient,
  DescribeDatabaseCommand as DescribeTimestreamDatabaseCommand,
  DescribeTableCommand as DescribeTimestreamTableCommand,
} from "@aws-sdk/client-timestream-write";
import {
  KeyspacesClient,
  GetKeyspaceCommand,
  GetTableCommand,
} from "@aws-sdk/client-keyspaces";
import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
  DescribeCacheSubnetGroupsCommand,
  DescribeReplicationGroupsCommand,
} from "@aws-sdk/client-elasticache";
import { CloudWatchClient, ListMetricsCommand } from "@aws-sdk/client-cloudwatch";
import {
  DEFAULT_LOOKBACK_HOURS,
  HEALTH_STATUS,
  createCheckResult,
  createResourceResult,
  getCloudWatchMetricValues,
  getOrCreateClient,
  parseAwsArn,
  queryLogGroupsForErrorKeywords,
  safeTrim,
} from "./shared.mjs";

const RDS_INSTANCE_STATUS_CHECK_ID = "rds.db_instance.status";
const RDS_CLUSTER_STATUS_CHECK_ID = "rds.db_cluster.status";
const RDS_INSTANCE_LOGS_CHECK_ID = "rds.db_instance.logs.error_keywords";
const RDS_CLUSTER_LOGS_CHECK_ID = "rds.db_cluster.logs.error_keywords";
const RDS_INSTANCE_RUNTIME_CHECK_ID = "rds.db_instance.engine_lifecycle";
const RDS_CLUSTER_RUNTIME_CHECK_ID = "rds.db_cluster.engine_lifecycle";
const RDS_INSTANCE_FREE_STORAGE_CHECK_ID = "rds.db_instance.free_storage";
const RDS_INSTANCE_REPLICA_LAG_CHECK_ID = "rds.db_instance.replica_lag";
const RDS_CLUSTER_DEADLOCKS_CHECK_ID = "rds.db_cluster.deadlocks";
const DOCDB_INSTANCE_STATUS_CHECK_ID = "docdb.db_instance.status";
const DOCDB_CLUSTER_STATUS_CHECK_ID = "docdb.db_cluster.status";
const DOCDB_INSTANCE_REPLICA_CHECK_ID = "docdb.db_instance.read_replica_status";
const DOCDB_CLUSTER_LOGS_CHECK_ID = "docdb.db_cluster.logs.error_keywords";
const DOCDB_INSTANCE_CONNECTION_LIMIT_CHECK_ID = "docdb.db_instance.connection_limit_headroom";
const DOCDB_INSTANCE_LOW_MEMORY_THROTTLING_CHECK_ID =
  "docdb.db_instance.low_memory_throttling";
const DOCDB_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID =
  "docdb.db_cluster.global_replication_lag";
const NEPTUNE_INSTANCE_STATUS_CHECK_ID = "neptune.db_instance.status";
const NEPTUNE_CLUSTER_STATUS_CHECK_ID = "neptune.db_cluster.status";
const NEPTUNE_INSTANCE_REPLICA_CHECK_ID = "neptune.db_instance.read_replica_status";
const NEPTUNE_CLUSTER_LOGS_CHECK_ID = "neptune.db_cluster.logs.error_keywords";
const NEPTUNE_INSTANCE_QUEUE_PRESSURE_CHECK_ID =
  "neptune.db_instance.main_request_queue_pending_requests";
const NEPTUNE_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID =
  "neptune.db_cluster.global_replication_lag";
const REDSHIFT_CLUSTER_STATUS_CHECK_ID = "redshift.cluster.status";
const REDSHIFT_CLUSTER_HEALTH_STATUS_CHECK_ID = "redshift.cluster.health_status";
const REDSHIFT_CLUSTER_CPU_CHECK_ID = "redshift.cluster.cpu_utilization";
const REDSHIFT_CLUSTER_DISK_CHECK_ID = "redshift.cluster.disk_space_used";
const MEMORYDB_CLUSTER_STATUS_CHECK_ID = "memorydb.cluster.status";
const MEMORYDB_CLUSTER_CPU_CHECK_ID = "memorydb.cluster.cpu_utilization";
const MEMORYDB_CLUSTER_ENGINE_CPU_CHECK_ID = "memorydb.cluster.engine_cpu_utilization";
const MEMORYDB_CLUSTER_EVICTIONS_CHECK_ID = "memorydb.cluster.evictions";
const TIMESTREAM_DATABASE_STATUS_CHECK_ID = "timestream.database.status";
const TIMESTREAM_TABLE_STATUS_CHECK_ID = "timestream.table.status";
const TIMESTREAM_TABLE_REJECTED_RECORDS_CHECK_ID =
  "timestream.table.magnetic_store_rejected_records";
const KEYSPACES_KEYSPACE_STATUS_CHECK_ID = "keyspaces.keyspace.reachable";
const KEYSPACES_TABLE_STATUS_CHECK_ID = "keyspaces.table.status";
const KEYSPACES_TABLE_SYSTEM_ERRORS_CHECK_ID = "keyspaces.table.system_errors";
const KEYSPACES_TABLE_USER_ERRORS_CHECK_ID = "keyspaces.table.user_errors";
const KEYSPACES_TABLE_READ_THROTTLES_CHECK_ID = "keyspaces.table.read_throttle_events";
const KEYSPACES_TABLE_WRITE_THROTTLES_CHECK_ID = "keyspaces.table.write_throttle_events";
const KEYSPACES_TABLE_CONNECTION_RATE_CHECK_ID =
  "keyspaces.table.per_connection_request_rate_exceeded";
const ELASTICACHE_CLUSTER_STATUS_CHECK_ID = "elasticache.cache_cluster.status";
const ELASTICACHE_CLUSTER_CPU_CHECK_ID = "elasticache.cache_cluster.cpu_utilization";
const ELASTICACHE_REPLICATION_GROUP_STATUS_CHECK_ID =
  "elasticache.replication_group.status";
const ELASTICACHE_REPLICATION_GROUP_EVICTIONS_CHECK_ID =
  "elasticache.replication_group.evictions";
const ELASTICACHE_SUBNET_GROUP_STATUS_CHECK_ID = "elasticache.subnet_group.status";

const RDS_UNHEALTHY_INSTANCE_STATUSES = new Set([
  "creating",
  "deleting",
  "failed",
  "incompatible-parameters",
  "incompatible-network",
  "storage-full",
]);
const RDS_UNHEALTHY_CLUSTER_STATUSES = new Set([
  "creating",
  "deleting",
  "failed",
  "incompatible-parameters",
  "incompatible-network",
]);
const DOCDB_UNHEALTHY_INSTANCE_STATUSES = new Set([
  "creating",
  "deleting",
  "failed",
  "incompatible-parameters",
  "incompatible-network",
]);
const DOCDB_UNHEALTHY_CLUSTER_STATUSES = new Set([
  "creating",
  "deleting",
  "failed",
  "incompatible-parameters",
  "incompatible-network",
]);
const NEPTUNE_UNHEALTHY_INSTANCE_STATUSES = new Set([
  "creating",
  "deleting",
  "failed",
  "incompatible-parameters",
  "incompatible-network",
]);
const NEPTUNE_UNHEALTHY_CLUSTER_STATUSES = new Set([
  "creating",
  "deleting",
  "failed",
  "incompatible-parameters",
  "incompatible-network",
]);
const REDSHIFT_UNHEALTHY_CLUSTER_STATUSES = new Set([
  "deleting",
  "hardware-failure",
  "incompatible-hsm",
  "incompatible-network",
  "incompatible-parameters",
  "incompatible-restore",
  "rebooting",
  "storage-full",
]);
const MEMORYDB_UNHEALTHY_CLUSTER_STATUSES = new Set([
  "creating",
  "deleting",
  "snapshotting",
  "updating",
]);
const ELASTICACHE_UNHEALTHY_CLUSTER_STATUSES = new Set([
  "creating",
  "deleting",
  "rebooting cluster nodes",
  "restore-failed",
]);
const ELASTICACHE_UNHEALTHY_REPLICATION_GROUP_STATUSES = new Set([
  "creating",
  "deleting",
  "modifying",
  "snapshotting",
]);
const KEYSPACES_UNHEALTHY_TABLE_STATUSES = new Set([
  "creating",
  "updating",
  "deleting",
  "deleted",
  "restoring",
  "inaccessible_encryption_credentials",
]);
const KEYSPACES_CQL_OPERATIONS = Object.freeze([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
]);
const REPLICA_UNHEALTHY_STATUSES = new Set(["error", "stopped", "terminated"]);
const RDS_LIFECYCLE_SUPPORTED_ENGINES = new Set([
  "aurora-mysql",
  "aurora-postgresql",
  "mariadb",
  "mysql",
  "postgres",
]);
const RDS_STANDARD_SUPPORT = "open-source-rds-standard-support";
const RDS_EXTENDED_SUPPORT = "open-source-rds-extended-support";
const LOW_REMAINING_CAPACITY_RATIO = 0.10;
const HIGH_UTILIZATION_RATIO = 0.90;
const HIGH_UTILIZATION_PERCENT = 90;
const GIB_IN_BYTES = 1024 ** 3;
const MINUTE_IN_SECONDS = 60;
const FIVE_MINUTES_IN_SECONDS = 5 * MINUTE_IN_SECONDS;

export const DATABASE_SUPPORTED_RESOURCE_TYPES = Object.freeze([
  "AWS::DocDB::DBCluster",
  "AWS::DocDB::DBInstance",
  "AWS::Cassandra::Keyspace",
  "AWS::Cassandra::Table",
  "AWS::ElastiCache::CacheCluster",
  "AWS::ElastiCache::ReplicationGroup",
  "AWS::ElastiCache::SubnetGroup",
  "AWS::Neptune::DBCluster",
  "AWS::Neptune::DBInstance",
  "AWS::MemoryDB::Cluster",
  "AWS::RDS::DBCluster",
  "AWS::RDS::DBInstance",
  "AWS::Redshift::Cluster",
  "AWS::Timestream::Database",
  "AWS::Timestream::Table",
]);

function isAuroraRdsEngine(engine) {
  const normalizedEngine = safeTrim(engine).toLowerCase();
  return normalizedEngine === "aurora" || normalizedEngine.startsWith("aurora-");
}

function createRdsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new RDSClient(config);
}

function createDocDbClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new DocDBClient(config);
}

function createNeptuneClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new NeptuneClient(config);
}

function createRedshiftClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new RedshiftClient(config);
}

function createMemoryDbClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new MemoryDBClient(config);
}

function createTimestreamWriteClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new TimestreamWriteClient(config);
}

function createKeyspacesClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new KeyspacesClient(config);
}

function createElastiCacheClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new ElastiCacheClient(config);
}

function parseDbResourceIdentifier(target, expectedPrefix = "") {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;

  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const resource = safeTrim(parsed?.resource);
  if (!resource) {
    return safeTrim(target?.identifier);
  }

  const match = resource.match(/^([^:/]+)[:/](.+)$/);
  if (!match) {
    return safeTrim(target?.identifier);
  }

  const [, prefix, value] = match;
  if (expectedPrefix && prefix !== expectedPrefix) {
    return safeTrim(target?.identifier);
  }
  return safeTrim(value) || safeTrim(target?.identifier);
}

function parseRedshiftClusterIdentifier(target) {
  return parseDbResourceIdentifier(target, "cluster");
}

function parseMemoryDbClusterName(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;

  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const resource = safeTrim(parsed?.resource);
  if (resource) {
    const match = resource.match(/^cluster[/:](.+)$/);
    if (match?.[1]) return safeTrim(match[1]);
  }
  return safeTrim(target?.identifier);
}

function parseTimestreamResourceNames(target) {
  const rawValues = [
    safeTrim(target?.resourceId),
    safeTrim(target?.identifier),
    safeTrim(target?.displayName),
  ].filter(Boolean);

  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const resource = safeTrim(parsed?.resource);
  if (resource) {
    const dbTableMatch = resource.match(/^database[/:]([^/:]+)[/:]table[/:]([^/:]+)$/);
    if (dbTableMatch) {
      return {
        databaseName: safeTrim(dbTableMatch[1]),
        tableName: safeTrim(dbTableMatch[2]),
      };
    }
    const dbMatch = resource.match(/^database[/:]([^/:]+)$/);
    if (dbMatch) {
      return { databaseName: safeTrim(dbMatch[1]), tableName: "" };
    }
  }

  for (const value of rawValues) {
    const normalized = value.replace(/\|/g, "/");
    const parts = normalized.split("/").map(safeTrim).filter(Boolean);
    if (parts.length >= 2) {
      return { databaseName: parts[parts.length - 2], tableName: parts[parts.length - 1] };
    }
  }

  return {
    databaseName: safeTrim(target?.resourceId || target?.identifier),
    tableName: "",
  };
}

function parseKeyspacesResourceNames(target) {
  const rawValues = [
    safeTrim(target?.resourceId),
    safeTrim(target?.identifier),
    safeTrim(target?.displayName),
  ].filter(Boolean);

  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const resource = safeTrim(parsed?.resource);
  if (resource) {
    const parts = resource.replace(/^\/+|\/+$/g, "").split(/[/:]/).map(safeTrim).filter(Boolean);
    if (parts[0] === "keyspace" && parts[2] === "table") {
      return {
        keyspaceName: safeTrim(parts[1]),
        tableName: safeTrim(parts[3]),
      };
    }
    if (parts[0] === "keyspace") {
      return { keyspaceName: safeTrim(parts[1]), tableName: "" };
    }
  }

  for (const value of rawValues) {
    const normalized = value.replace(/\|/g, "/");
    const parts = normalized.split("/").map(safeTrim).filter(Boolean);
    if (parts.length >= 2) {
      return { keyspaceName: parts[parts.length - 2], tableName: parts[parts.length - 1] };
    }
  }

  return {
    keyspaceName: safeTrim(target?.resourceId || target?.identifier),
    tableName: "",
  };
}

function normalizeStringArray(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeTrim).filter(Boolean))];
}

function normalizeDimensions(dimensions = []) {
  return (Array.isArray(dimensions) ? dimensions : [])
    .map((dimension) => ({
      Name: safeTrim(dimension?.Name),
      Value: safeTrim(dimension?.Value),
    }))
    .filter((dimension) => dimension.Name && dimension.Value);
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(1)}%`;
}

function formatBytesGiB(value) {
  if (!Number.isFinite(value)) return null;
  return `${(value / GIB_IN_BYTES).toFixed(2)} GiB`;
}

function buildStatusCheck({
  checkId,
  checkName,
  statusValue,
  unhealthyStatuses,
  details = {},
}) {
  const normalizedStatus = safeTrim(statusValue).toLowerCase();
  if (!normalizedStatus) {
    return createCheckResult({
      checkId,
      checkName,
      category: "availability",
      status: HEALTH_STATUS.UNKNOWN,
      summary: `${checkName} is unavailable from the service API.`,
      details,
    });
  }

  const unhealthy = unhealthyStatuses.has(normalizedStatus);
  return createCheckResult({
    checkId,
    checkName,
    category: "availability",
    status: unhealthy ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY,
    summary: unhealthy
      ? `${checkName} is ${normalizedStatus}.`
      : `${checkName} is ${normalizedStatus}.`,
    details: {
      ...details,
      status: normalizedStatus,
    },
  });
}

function buildReplicaStatusCheck({
  checkId,
  checkName,
  statusInfos = [],
  details = {},
}) {
  const normalizedInfos = (Array.isArray(statusInfos) ? statusInfos : [])
    .map((entry) => ({
      statusType: safeTrim(entry?.StatusType),
      status: safeTrim(entry?.Status).toLowerCase(),
      normal: typeof entry?.Normal === "boolean" ? entry.Normal : null,
      message: safeTrim(entry?.Message) || null,
    }))
    .filter((entry) => entry.statusType || entry.status || entry.message);

  if (normalizedInfos.length === 0) {
    return createCheckResult({
      checkId,
      checkName,
      category: "availability",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Read replica status is not applicable or unavailable for this instance.",
      details,
    });
  }

  const problematic = normalizedInfos.filter(
    (entry) => entry.normal === false || REPLICA_UNHEALTHY_STATUSES.has(entry.status)
  );
  if (problematic.length > 0) {
    return createCheckResult({
      checkId,
      checkName,
      category: "availability",
      status: HEALTH_STATUS.PROBLEM,
      summary: "Read replica status indicates a replication issue.",
      details: {
        ...details,
        statusInfos: normalizedInfos,
      },
    });
  }

  return createCheckResult({
    checkId,
    checkName,
    category: "availability",
    status: HEALTH_STATUS.HEALTHY,
    summary: "Read replica status is normal.",
    details: {
      ...details,
      statusInfos: normalizedInfos,
    },
  });
}

async function buildAnyPositiveMetricCheck({
  checkId,
  checkName,
  category = "errors",
  namespace,
  metricName,
  dimensionSets = [],
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  statistic = "Maximum",
  periodSeconds = MINUTE_IN_SECONDS,
  cloudWatchClientCache,
  notApplicableSummary,
  missingDataSummary,
  zeroDatapointsHealthySummary,
  positiveSummary,
  zeroSummary,
  treatMissingAsZero = false,
  notApplicableStatus = HEALTH_STATUS.UNKNOWN,
  details = {},
}) {
  const normalizedSets = (Array.isArray(dimensionSets) ? dimensionSets : [])
    .map(normalizeDimensions)
    .filter((set) => set.length > 0);

  if (normalizedSets.length === 0) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: notApplicableStatus,
      summary:
        notApplicableSummary || `${checkName} is not applicable for this resource.`,
      details: {
        ...details,
        metricName,
        namespace,
        notApplicable: notApplicableStatus === HEALTH_STATUS.NOT_APPLICABLE,
      },
    });
  }

  try {
    const results = await Promise.all(
      normalizedSets.map(async (dimensions) => ({
        dimensions,
        values: await getCloudWatchMetricValues({
          region,
          credentials,
          namespace,
          metricName,
          dimensions,
          lookbackHours,
          statistic,
          periodSeconds,
          clientCache: cloudWatchClientCache,
        }),
      }))
    );

    const datapoints = results.flatMap((result) => result.values);
    if (datapoints.length === 0) {
      const summary = treatMissingAsZero
        ? zeroDatapointsHealthySummary ||
          `No ${metricName} datapoints were reported in the last ${lookbackHours}h.`
        : missingDataSummary ||
          `No ${metricName} datapoints were reported in the last ${lookbackHours}h.`;
      return createCheckResult({
        checkId,
        checkName,
        category,
        status: treatMissingAsZero ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNKNOWN,
        summary,
        details: {
          ...details,
          metricName,
          namespace,
          lookbackHours,
          statistic,
          datapointCount: 0,
          dimensionSets: normalizedSets,
        },
      });
    }

    const maxValue = Math.max(...datapoints);
    const hasBreach = maxValue > 0;
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: hasBreach ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY,
      summary: hasBreach
        ? positiveSummary?.(maxValue) ||
          `${metricName} reported a value of ${maxValue} in the last ${lookbackHours}h.`
        : zeroSummary || `${metricName} remained at 0 in the last ${lookbackHours}h.`,
      details: {
        ...details,
        metricName,
        namespace,
        lookbackHours,
        statistic,
        maxValue,
        datapointCount: datapoints.length,
        dimensionSets: normalizedSets,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: {
        ...details,
        metricName,
        namespace,
        lookbackHours,
        dimensionSets: normalizedSets,
      },
    });
  }
}

async function listMetricDimensionSets({
  namespace,
  metricName,
  requiredDimensions = [],
  region,
  credentials,
  clientCache,
}) {
  const normalizedRequiredDimensions = normalizeDimensions(requiredDimensions);
  if (normalizedRequiredDimensions.length === 0) return [];

  const cache = clientCache || new Map();
  const key = `cw-list:${region}`;
  const client = getOrCreateClient(cache, key, () => {
    const config = { region, maxAttempts: 5, retryMode: "standard" };
    if (credentials) config.credentials = credentials;
    return new CloudWatchClient(config);
  });

  const dimensionSets = [];
  let nextToken = undefined;
  do {
    const response = await client.send(
      new ListMetricsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: normalizedRequiredDimensions,
        NextToken: nextToken,
      })
    );
    for (const metric of response?.Metrics || []) {
      const dimensions = normalizeDimensions(metric?.Dimensions || []);
      if (dimensions.length > 0) dimensionSets.push(dimensions);
    }
    nextToken = response?.NextToken;
  } while (nextToken);

  const seen = new Set();
  return dimensionSets.filter((dimensions) => {
    const key = dimensions
      .map((dimension) => `${dimension.Name}:${dimension.Value}`)
      .sort()
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildKeyspacesMetricDimensionSets({
  keyspaceName,
  tableName,
  metricName,
  region,
  credentials,
  cloudWatchClientCache,
}) {
  const requiredDimensions = [
    { Name: "Keyspace", Value: keyspaceName },
    { Name: "TableName", Value: tableName },
  ];
  try {
    const discovered = await listMetricDimensionSets({
      namespace: "AWS/Cassandra",
      metricName,
      requiredDimensions,
      region,
      credentials,
      clientCache: cloudWatchClientCache,
    });
    if (discovered.length > 0) return discovered;
  } catch {
    // Fall back to common CQL operation dimensions below.
  }

  return KEYSPACES_CQL_OPERATIONS.map((operation) => [
    ...requiredDimensions,
    { Name: "Operation", Value: operation },
  ]);
}

async function buildMaximumMetricThresholdCheck({
  checkId,
  checkName,
  category,
  namespace,
  metricName,
  dimensions,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  threshold,
  unit = "",
  statistic = "Maximum",
  periodSeconds = FIVE_MINUTES_IN_SECONDS,
  cloudWatchClientCache,
  healthySummary,
  problemSummary,
  details = {},
}) {
  const normalizedDimensions = normalizeDimensions(dimensions);
  if (normalizedDimensions.length === 0) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: HEALTH_STATUS.UNKNOWN,
      summary: `${metricName} dimensions are unavailable.`,
      details: { ...details, metricName, namespace },
    });
  }

  try {
    const values = await getCloudWatchMetricValues({
      region,
      credentials,
      namespace,
      metricName,
      dimensions: normalizedDimensions,
      lookbackHours,
      statistic,
      periodSeconds,
      clientCache: cloudWatchClientCache,
    });

    if (values.length === 0) {
      return createCheckResult({
        checkId,
        checkName,
        category,
        status: HEALTH_STATUS.UNKNOWN,
        summary: `No ${metricName} datapoints were reported in the last ${lookbackHours}h.`,
        details: {
          ...details,
          metricName,
          namespace,
          lookbackHours,
          datapointCount: 0,
          dimensions: normalizedDimensions,
        },
      });
    }

    const maxValue = Math.max(...values);
    const unhealthy = maxValue > threshold;
    const formattedValue = `${maxValue}${unit}`;
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: unhealthy ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY,
      summary: unhealthy
        ? problemSummary?.(maxValue) ||
          `${metricName} reached ${formattedValue}, above the ${threshold}${unit} threshold.`
        : healthySummary?.(maxValue) ||
          `${metricName} stayed at or below ${threshold}${unit} in the last ${lookbackHours}h.`,
      details: {
        ...details,
        metricName,
        namespace,
        lookbackHours,
        statistic,
        maxValue,
        threshold,
        unit,
        datapointCount: values.length,
        dimensions: normalizedDimensions,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { ...details, metricName, namespace, lookbackHours },
    });
  }
}

async function buildMinimumMetricHealthyCheck({
  checkId,
  checkName,
  category,
  namespace,
  metricName,
  dimensions,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  minimumHealthyValue,
  statistic = "Minimum",
  periodSeconds = FIVE_MINUTES_IN_SECONDS,
  cloudWatchClientCache,
  healthySummary,
  problemSummary,
  details = {},
}) {
  const normalizedDimensions = normalizeDimensions(dimensions);
  if (normalizedDimensions.length === 0) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: HEALTH_STATUS.UNKNOWN,
      summary: `${metricName} dimensions are unavailable.`,
      details: { ...details, metricName, namespace },
    });
  }

  try {
    const values = await getCloudWatchMetricValues({
      region,
      credentials,
      namespace,
      metricName,
      dimensions: normalizedDimensions,
      lookbackHours,
      statistic,
      periodSeconds,
      clientCache: cloudWatchClientCache,
    });

    if (values.length === 0) {
      return createCheckResult({
        checkId,
        checkName,
        category,
        status: HEALTH_STATUS.UNKNOWN,
        summary: `No ${metricName} datapoints were reported in the last ${lookbackHours}h.`,
        details: {
          ...details,
          metricName,
          namespace,
          lookbackHours,
          datapointCount: 0,
          dimensions: normalizedDimensions,
        },
      });
    }

    const minValue = Math.min(...values);
    const unhealthy = minValue < minimumHealthyValue;
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: unhealthy ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY,
      summary: unhealthy
        ? problemSummary?.(minValue) ||
          `${metricName} dropped below ${minimumHealthyValue} in the last ${lookbackHours}h.`
        : healthySummary?.(minValue) ||
          `${metricName} stayed at or above ${minimumHealthyValue} in the last ${lookbackHours}h.`,
      details: {
        ...details,
        metricName,
        namespace,
        lookbackHours,
        statistic,
        minValue,
        minimumHealthyValue,
        datapointCount: values.length,
        dimensions: normalizedDimensions,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { ...details, metricName, namespace, lookbackHours },
    });
  }
}

async function buildRdsFreeStorageCheck({
  instance,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  cloudWatchClientCache,
}) {
  const dbInstanceIdentifier = safeTrim(instance?.DBInstanceIdentifier);
  const engine = safeTrim(instance?.Engine);
  const dbClusterIdentifier = safeTrim(instance?.DBClusterIdentifier);
  const allocatedStorageGiB = Number(instance?.AllocatedStorage);
  if (!dbInstanceIdentifier) {
    return createCheckResult({
      checkId: RDS_INSTANCE_FREE_STORAGE_CHECK_ID,
      checkName: "Free storage space",
      category: "capacity",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "DB instance identifier is unavailable for the free storage check.",
    });
  }
  if (isAuroraRdsEngine(engine)) {
    return createCheckResult({
      checkId: RDS_INSTANCE_FREE_STORAGE_CHECK_ID,
      checkName: "Free storage space",
      category: "capacity",
      status: HEALTH_STATUS.NOT_APPLICABLE,
      summary:
        "FreeStorageSpace is not reported for Aurora DB instances; Aurora storage is managed at the cluster volume level.",
      details: {
        dbInstanceIdentifier,
        dbClusterIdentifier,
        engine,
        metricName: "FreeStorageSpace",
        namespace: "AWS/RDS",
        notApplicable: true,
        recommendation: "Use Aurora cluster storage metrics or instance FreeLocalStorage instead.",
      },
    });
  }
  if (!Number.isFinite(allocatedStorageGiB) || allocatedStorageGiB <= 0) {
    return createCheckResult({
      checkId: RDS_INSTANCE_FREE_STORAGE_CHECK_ID,
      checkName: "Free storage space",
      category: "capacity",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Allocated storage is unavailable for the free storage check.",
      details: { dbInstanceIdentifier },
    });
  }

  const thresholdBytes = allocatedStorageGiB * GIB_IN_BYTES * LOW_REMAINING_CAPACITY_RATIO;

  try {
    const values = await getCloudWatchMetricValues({
      region,
      credentials,
      namespace: "AWS/RDS",
      metricName: "FreeStorageSpace",
      dimensions: [{ Name: "DBInstanceIdentifier", Value: dbInstanceIdentifier }],
      lookbackHours,
      statistic: "Minimum",
      periodSeconds: MINUTE_IN_SECONDS,
      clientCache: cloudWatchClientCache,
    });

    if (values.length === 0) {
      return createCheckResult({
        checkId: RDS_INSTANCE_FREE_STORAGE_CHECK_ID,
        checkName: "Free storage space",
        category: "capacity",
        status: HEALTH_STATUS.UNKNOWN,
        summary: `No FreeStorageSpace datapoints were reported in the last ${lookbackHours}h.`,
        details: {
          dbInstanceIdentifier,
          allocatedStorageGiB,
          thresholdBytes,
          lookbackHours,
        },
      });
    }

    const minimumFreeStorageBytes = Math.min(...values);
    const thresholdRatio = minimumFreeStorageBytes / (allocatedStorageGiB * GIB_IN_BYTES);
    const unhealthy = minimumFreeStorageBytes <= thresholdBytes;
    return createCheckResult({
      checkId: RDS_INSTANCE_FREE_STORAGE_CHECK_ID,
      checkName: "Free storage space",
      category: "capacity",
      status: unhealthy ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY,
      summary: unhealthy
        ? `Free storage reached ${formatBytesGiB(minimumFreeStorageBytes)}, within 10% of allocated storage.`
        : `Free storage stayed above 10% of allocated storage in the last ${lookbackHours}h.`,
      details: {
        dbInstanceIdentifier,
        allocatedStorageGiB,
        minimumFreeStorageBytes,
        minimumFreeStorageGiB: formatBytesGiB(minimumFreeStorageBytes),
        remainingStorageRatio: thresholdRatio,
        remainingStoragePercent: formatPercentage(thresholdRatio),
        thresholdBytes,
        thresholdGiB: formatBytesGiB(thresholdBytes),
        lookbackHours,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId: RDS_INSTANCE_FREE_STORAGE_CHECK_ID,
      checkName: "Free storage space",
      category: "capacity",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { dbInstanceIdentifier, allocatedStorageGiB, lookbackHours },
    });
  }
}

async function buildDocDbConnectionHeadroomCheck({
  instance,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  cloudWatchClientCache,
}) {
  const dbInstanceIdentifier = safeTrim(instance?.DBInstanceIdentifier);
  if (!dbInstanceIdentifier) {
    return createCheckResult({
      checkId: DOCDB_INSTANCE_CONNECTION_LIMIT_CHECK_ID,
      checkName: "Connection limit headroom",
      category: "capacity",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "DB instance identifier is unavailable for the connection headroom check.",
    });
  }

  try {
    const dimensions = [{ Name: "DBInstanceIdentifier", Value: dbInstanceIdentifier }];
    const [usageValues, limitValues] = await Promise.all([
      getCloudWatchMetricValues({
        region,
        credentials,
        namespace: "AWS/DocDB",
        metricName: "DatabaseConnections",
        dimensions,
        lookbackHours,
        statistic: "Maximum",
        periodSeconds: MINUTE_IN_SECONDS,
        clientCache: cloudWatchClientCache,
      }),
      getCloudWatchMetricValues({
        region,
        credentials,
        namespace: "AWS/DocDB",
        metricName: "DatabaseConnectionsLimit",
        dimensions,
        lookbackHours,
        statistic: "Minimum",
        periodSeconds: MINUTE_IN_SECONDS,
        clientCache: cloudWatchClientCache,
      }),
    ]);

    if (usageValues.length === 0 || limitValues.length === 0) {
      return createCheckResult({
        checkId: DOCDB_INSTANCE_CONNECTION_LIMIT_CHECK_ID,
        checkName: "Connection limit headroom",
        category: "capacity",
        status: HEALTH_STATUS.UNKNOWN,
        summary: `Connection limit datapoints were unavailable in the last ${lookbackHours}h.`,
        details: {
          dbInstanceIdentifier,
          usageDatapointCount: usageValues.length,
          limitDatapointCount: limitValues.length,
          lookbackHours,
        },
      });
    }

    const peakConnections = Math.max(...usageValues);
    const minimumConnectionLimit = Math.min(...limitValues);
    const utilizationRatio =
      minimumConnectionLimit > 0 ? peakConnections / minimumConnectionLimit : NaN;
    const unhealthy =
      Number.isFinite(utilizationRatio) && utilizationRatio >= HIGH_UTILIZATION_RATIO;

    return createCheckResult({
      checkId: DOCDB_INSTANCE_CONNECTION_LIMIT_CHECK_ID,
      checkName: "Connection limit headroom",
      category: "capacity",
      status: unhealthy ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY,
      summary: unhealthy
        ? `Database connections reached ${peakConnections}, within 10% of the connection limit.`
        : `Database connections stayed below 90% of the connection limit in the last ${lookbackHours}h.`,
      details: {
        dbInstanceIdentifier,
        peakConnections,
        minimumConnectionLimit,
        utilizationRatio,
        utilizationPercent: formatPercentage(utilizationRatio),
        lookbackHours,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId: DOCDB_INSTANCE_CONNECTION_LIMIT_CHECK_ID,
      checkName: "Connection limit headroom",
      category: "capacity",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { dbInstanceIdentifier, lookbackHours },
    });
  }
}

function extractArnRegions(arns = []) {
  return normalizeStringArray(
    (Array.isArray(arns) ? arns : []).map((arn) => parseAwsArn(arn)?.region)
  );
}

async function fetchNeptuneGlobalCluster({ cluster, target, credentials, clientCache }) {
  const globalClusterIdentifier = safeTrim(cluster?.GlobalClusterIdentifier);
  if (!globalClusterIdentifier) return null;

  const client = getOrCreateClient(clientCache, `neptune:${target.region}`, () =>
    createNeptuneClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeNeptuneGlobalClustersCommand({ GlobalClusterIdentifier: globalClusterIdentifier })
  );
  return Array.isArray(response?.GlobalClusters) ? response.GlobalClusters[0] || null : null;
}

function resolveEnabledLogExports(config) {
  return normalizeStringArray(
    config?.EnabledCloudwatchLogsExports || config?.EnabledCloudWatchLogsExports || []
  );
}

function buildRdsLogGroupNames(kind, identifier, logTypes = []) {
  const id = safeTrim(identifier);
  if (!id) return [];
  const prefix = kind === "cluster" ? "/aws/rds/cluster" : "/aws/rds/instance";
  return normalizeStringArray(logTypes).map((logType) => `${prefix}/${id}/${logType}`);
}

function buildDocDbLogGroupNames(clusterIdentifier, logTypes = []) {
  const id = safeTrim(clusterIdentifier);
  if (!id) return [];
  return normalizeStringArray(logTypes).map((logType) => `/aws/docdb/${id}/${logType}`);
}

function buildNeptuneLogGroupNames(clusterIdentifier, logTypes = []) {
  const id = safeTrim(clusterIdentifier);
  if (!id) return [];
  return normalizeStringArray(logTypes).map((logType) => `/aws/neptune/${id}/${logType}`);
}

async function buildLogKeywordCheck({
  checkId,
  checkName,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  logger,
  logsClientCache,
  exportedLogTypes = [],
  logGroupNames = [],
}) {
  const normalizedLogTypes = normalizeStringArray(exportedLogTypes);
  const normalizedGroups = normalizeStringArray(logGroupNames);

  if (normalizedLogTypes.length === 0 || normalizedGroups.length === 0) {
    return createCheckResult({
      checkId,
      checkName,
      category: "error-logs",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "CloudWatch log export is not enabled for this resource.",
      details: {
        exportedLogTypes: normalizedLogTypes,
        logGroupNames: normalizedGroups,
      },
    });
  }

  try {
    const queryResult = await queryLogGroupsForErrorKeywords({
      region,
      credentials,
      logGroupNames: normalizedGroups,
      lookbackHours,
      logger,
      clientCache: logsClientCache,
    });
    const matchCount = Number(queryResult?.matchCount || 0);
    return createCheckResult({
      checkId,
      checkName,
      category: "error-logs",
      status: matchCount > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY,
      summary:
        matchCount > 0
          ? `Found ${matchCount} error-like log matches in recent exported database logs.`
          : "No error-like keywords found in recent exported database logs.",
      details: {
        exportedLogTypes: normalizedLogTypes,
        logGroupNames: normalizedGroups,
        matchCount,
        lookbackHours,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category: "error-logs",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch Logs query failed: ${error?.message || "unknown error"}.`,
      details: {
        exportedLogTypes: normalizedLogTypes,
        logGroupNames: normalizedGroups,
      },
    });
  }
}

function majorVersionForLifecycle(engine, engineVersion) {
  const normalizedEngine = safeTrim(engine);
  const normalizedVersion = safeTrim(engineVersion);
  if (!normalizedEngine || !normalizedVersion) return null;

  const numericSegments = normalizedVersion.match(/\d+/g) || [];
  if (numericSegments.length === 0) return null;

  if (normalizedEngine === "postgres" || normalizedEngine === "aurora-postgresql") {
    return numericSegments[0];
  }

  if (
    normalizedEngine === "mysql" ||
    normalizedEngine === "aurora-mysql" ||
    normalizedEngine === "mariadb"
  ) {
    if (numericSegments.length >= 2) {
      return `${numericSegments[0]}.${numericSegments[1]}`;
    }
    return numericSegments[0];
  }

  return null;
}

async function fetchRdsLifecycleInfo({
  region,
  credentials,
  engine,
  majorVersion,
  lifecycleCache,
}) {
  const cacheKey = `${region}|${engine}|${majorVersion}`;
  if (lifecycleCache.has(cacheKey)) {
    return lifecycleCache.get(cacheKey);
  }

  const client = createRdsClient(region, credentials);
  const response = await client.send(
    new DescribeDBMajorEngineVersionsCommand({
      Engine: engine,
      MajorEngineVersion: majorVersion,
    })
  );
  const matches = Array.isArray(response?.DBMajorEngineVersions)
    ? response.DBMajorEngineVersions
    : [];
  const selected =
    matches.find((entry) => safeTrim(entry?.MajorEngineVersion) === majorVersion) || matches[0] || null;
  lifecycleCache.set(cacheKey, selected);
  return selected;
}

async function buildRdsLifecycleCheck({
  checkId,
  checkName,
  config,
  region,
  credentials,
  lifecycleCache,
}) {
  const engine = safeTrim(config?.Engine);
  const engineVersion = safeTrim(config?.EngineVersion);

  if (!RDS_LIFECYCLE_SUPPORTED_ENGINES.has(engine)) {
    return createCheckResult({
      checkId,
      checkName,
      category: "runtime-eol",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Lifecycle support data is not available for this database engine.",
      details: { engine: engine || null, engineVersion: engineVersion || null },
    });
  }

  const majorVersion = majorVersionForLifecycle(engine, engineVersion);
  if (!majorVersion) {
    return createCheckResult({
      checkId,
      checkName,
      category: "runtime-eol",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Unable to derive the major engine version for lifecycle support lookup.",
      details: { engine, engineVersion },
    });
  }

  try {
    const lifecycleEntry = await fetchRdsLifecycleInfo({
      region,
      credentials,
      engine,
      majorVersion,
      lifecycleCache,
    });
    const lifecycleItems = Array.isArray(lifecycleEntry?.SupportedEngineLifecycles)
      ? lifecycleEntry.SupportedEngineLifecycles
      : [];
    if (lifecycleItems.length === 0) {
      return createCheckResult({
        checkId,
        checkName,
        category: "runtime-eol",
        status: HEALTH_STATUS.UNKNOWN,
        summary: "Lifecycle support dates were not returned for this major engine version.",
        details: { engine, engineVersion, majorVersion },
      });
    }

    const nowMs = Date.now();
    const standard = lifecycleItems.find(
      (item) => safeTrim(item?.LifecycleSupportName) === RDS_STANDARD_SUPPORT
    );
    const extended = lifecycleItems.find(
      (item) => safeTrim(item?.LifecycleSupportName) === RDS_EXTENDED_SUPPORT
    );
    const standardEndMs = standard?.LifecycleSupportEndDate
      ? Date.parse(standard.LifecycleSupportEndDate)
      : NaN;
    const extendedEndMs = extended?.LifecycleSupportEndDate
      ? Date.parse(extended.LifecycleSupportEndDate)
      : NaN;

    let status = HEALTH_STATUS.UNKNOWN;
    let lifecyclePhase = "unknown";
    let summary = "Lifecycle support dates are unavailable.";

    if (Number.isFinite(standardEndMs) && nowMs <= standardEndMs) {
      status = HEALTH_STATUS.HEALTHY;
      lifecyclePhase = "standard_support";
      summary = "Database engine major version is within standard support.";
    } else if (Number.isFinite(extendedEndMs) && nowMs <= extendedEndMs) {
      status = HEALTH_STATUS.PROBLEM;
      lifecyclePhase = "extended_support";
      summary = "Database engine major version is in extended support.";
    } else if (Number.isFinite(standardEndMs) || Number.isFinite(extendedEndMs)) {
      status = HEALTH_STATUS.PROBLEM;
      lifecyclePhase = "out_of_support";
      summary = "Database engine major version is past its published support window.";
    }

    return createCheckResult({
      checkId,
      checkName,
      category: "runtime-eol",
      status,
      summary,
      details: {
        engine,
        engineVersion,
        majorVersion,
        lifecyclePhase,
        standardSupportEndDate: standard?.LifecycleSupportEndDate || null,
        extendedSupportEndDate: extended?.LifecycleSupportEndDate || null,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category: "runtime-eol",
      status: HEALTH_STATUS.ERROR,
      summary: `Lifecycle support lookup failed: ${error?.message || "unknown error"}.`,
      details: { engine, engineVersion, majorVersion },
    });
  }
}

async function fetchRdsDbInstance({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target, "db");
  if (!identifier) throw new Error("RDS DB instance identifier is required");
  const client = getOrCreateClient(clientCache, `rds:${target.region}`, () =>
    createRdsClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: identifier })
  );
  const instance = Array.isArray(response?.DBInstances) ? response.DBInstances[0] : null;
  if (!instance) throw new Error("RDS DB instance not found");
  return instance;
}

async function fetchRdsDbCluster({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target, "cluster");
  if (!identifier) throw new Error("RDS DB cluster identifier is required");
  const client = getOrCreateClient(clientCache, `rds:${target.region}`, () =>
    createRdsClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeDBClustersCommand({ DBClusterIdentifier: identifier })
  );
  const cluster = Array.isArray(response?.DBClusters) ? response.DBClusters[0] : null;
  if (!cluster) throw new Error("RDS DB cluster not found");
  return cluster;
}

async function fetchDocDbInstance({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target, "db");
  if (!identifier) throw new Error("DocumentDB DB instance identifier is required");
  const client = getOrCreateClient(clientCache, `docdb:${target.region}`, () =>
    createDocDbClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeDocDbInstancesCommand({ DBInstanceIdentifier: identifier })
  );
  const instance = Array.isArray(response?.DBInstances) ? response.DBInstances[0] : null;
  if (!instance) throw new Error("DocumentDB DB instance not found");
  return instance;
}

async function fetchDocDbCluster({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target, "cluster");
  if (!identifier) throw new Error("DocumentDB DB cluster identifier is required");
  const client = getOrCreateClient(clientCache, `docdb:${target.region}`, () =>
    createDocDbClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeDocDbClustersCommand({ DBClusterIdentifier: identifier })
  );
  const cluster = Array.isArray(response?.DBClusters) ? response.DBClusters[0] : null;
  if (!cluster) throw new Error("DocumentDB DB cluster not found");
  return cluster;
}

async function fetchNeptuneInstance({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target, "db");
  if (!identifier) throw new Error("Neptune DB instance identifier is required");
  const client = getOrCreateClient(clientCache, `neptune:${target.region}`, () =>
    createNeptuneClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeNeptuneInstancesCommand({ DBInstanceIdentifier: identifier })
  );
  const instance = Array.isArray(response?.DBInstances) ? response.DBInstances[0] : null;
  if (!instance) throw new Error("Neptune DB instance not found");
  return instance;
}

async function fetchNeptuneCluster({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target, "cluster");
  if (!identifier) throw new Error("Neptune DB cluster identifier is required");
  const client = getOrCreateClient(clientCache, `neptune:${target.region}`, () =>
    createNeptuneClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeNeptuneClustersCommand({ DBClusterIdentifier: identifier })
  );
  const cluster = Array.isArray(response?.DBClusters) ? response.DBClusters[0] : null;
  if (!cluster) throw new Error("Neptune DB cluster not found");
  return cluster;
}

async function fetchRedshiftCluster({ target, credentials, clientCache }) {
  const identifier = parseRedshiftClusterIdentifier(target);
  if (!identifier) throw new Error("Redshift cluster identifier is required");
  const client = getOrCreateClient(clientCache, `redshift:${target.region}`, () =>
    createRedshiftClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeRedshiftClustersCommand({ ClusterIdentifier: identifier })
  );
  const cluster = Array.isArray(response?.Clusters) ? response.Clusters[0] : null;
  if (!cluster) throw new Error("Redshift cluster not found");
  return cluster;
}

async function fetchMemoryDbCluster({ target, credentials, clientCache }) {
  const clusterName = parseMemoryDbClusterName(target);
  if (!clusterName) throw new Error("MemoryDB cluster name is required");
  const client = getOrCreateClient(clientCache, `memorydb:${target.region}`, () =>
    createMemoryDbClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeMemoryDbClustersCommand({ ClusterName: clusterName, ShowShardDetails: false })
  );
  const cluster = Array.isArray(response?.Clusters) ? response.Clusters[0] : null;
  if (!cluster) throw new Error("MemoryDB cluster not found");
  return cluster;
}

async function fetchTimestreamDatabase({ target, credentials, clientCache }) {
  const { databaseName } = parseTimestreamResourceNames(target);
  if (!databaseName) throw new Error("Timestream database name is required");
  const client = getOrCreateClient(clientCache, `timestream:${target.region}`, () =>
    createTimestreamWriteClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeTimestreamDatabaseCommand({ DatabaseName: databaseName })
  );
  if (!response?.Database) throw new Error("Timestream database not found");
  return response.Database;
}

async function fetchTimestreamTable({ target, credentials, clientCache }) {
  const { databaseName, tableName } = parseTimestreamResourceNames(target);
  if (!databaseName || !tableName) {
    throw new Error("Timestream database and table names are required");
  }
  const client = getOrCreateClient(clientCache, `timestream:${target.region}`, () =>
    createTimestreamWriteClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeTimestreamTableCommand({ DatabaseName: databaseName, TableName: tableName })
  );
  if (!response?.Table) throw new Error("Timestream table not found");
  return response.Table;
}

async function fetchKeyspacesKeyspace({ target, credentials, clientCache }) {
  const { keyspaceName } = parseKeyspacesResourceNames(target);
  const client = getOrCreateClient(clientCache, `keyspaces:${target.region}`, () =>
    createKeyspacesClient(target.region, credentials)
  );
  return client.send(new GetKeyspaceCommand({ keyspaceName }));
}

async function fetchKeyspacesTable({ target, credentials, clientCache }) {
  const { keyspaceName, tableName } = parseKeyspacesResourceNames(target);
  const client = getOrCreateClient(clientCache, `keyspaces:${target.region}`, () =>
    createKeyspacesClient(target.region, credentials)
  );
  return client.send(new GetTableCommand({ keyspaceName, tableName }));
}

async function fetchElastiCacheCluster({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target);
  if (!identifier) throw new Error("ElastiCache cache cluster identifier is required");
  const client = getOrCreateClient(clientCache, `elasticache:${target.region}`, () =>
    createElastiCacheClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeCacheClustersCommand({ CacheClusterId: identifier, ShowCacheNodeInfo: false })
  );
  const cluster = Array.isArray(response?.CacheClusters) ? response.CacheClusters[0] : null;
  if (!cluster) throw new Error("ElastiCache cache cluster not found");
  return cluster;
}

async function fetchElastiCacheReplicationGroup({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target);
  if (!identifier) throw new Error("ElastiCache replication group identifier is required");
  const client = getOrCreateClient(clientCache, `elasticache:${target.region}`, () =>
    createElastiCacheClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeReplicationGroupsCommand({ ReplicationGroupId: identifier })
  );
  const group = Array.isArray(response?.ReplicationGroups) ? response.ReplicationGroups[0] : null;
  if (!group) throw new Error("ElastiCache replication group not found");
  return group;
}

async function fetchElastiCacheSubnetGroup({ target, credentials, clientCache }) {
  const identifier = parseDbResourceIdentifier(target);
  if (!identifier) throw new Error("ElastiCache subnet group name is required");
  const client = getOrCreateClient(clientCache, `elasticache:${target.region}`, () =>
    createElastiCacheClient(target.region, credentials)
  );
  const response = await client.send(
    new DescribeCacheSubnetGroupsCommand({ CacheSubnetGroupName: identifier })
  );
  const group = Array.isArray(response?.CacheSubnetGroups) ? response.CacheSubnetGroups[0] : null;
  if (!group) throw new Error("ElastiCache subnet group not found");
  return group;
}

function buildCheckError({ checkId, checkName, category, summary }) {
  return createCheckResult({
    checkId,
    checkName,
    category,
    status: HEALTH_STATUS.ERROR,
    summary,
  });
}

async function buildRdsReplicaLagCheck({
  instance,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  cloudWatchClientCache,
}) {
  const dbInstanceIdentifier = safeTrim(instance?.DBInstanceIdentifier);
  const engine = safeTrim(instance?.Engine);
  const dbClusterIdentifier = safeTrim(instance?.DBClusterIdentifier);
  const isReadReplica =
    safeTrim(instance?.ReadReplicaSourceDBInstanceIdentifier) ||
    safeTrim(instance?.ReadReplicaSourceDBClusterIdentifier);

  if (!dbInstanceIdentifier) {
    return createCheckResult({
      checkId: RDS_INSTANCE_REPLICA_LAG_CHECK_ID,
      checkName: "Replica lag",
      category: "errors",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "DB instance identifier is unavailable for the replica lag check.",
    });
  }

  const isAurora = isAuroraRdsEngine(engine);
  return buildAnyPositiveMetricCheck({
    checkId: RDS_INSTANCE_REPLICA_LAG_CHECK_ID,
    checkName: "Replica lag",
    namespace: "AWS/RDS",
    metricName: "ReplicaLag",
    dimensionSets: isReadReplica
      ? [[{ Name: "DBInstanceIdentifier", Value: dbInstanceIdentifier }]]
      : [],
    region,
    credentials,
    lookbackHours,
    statistic: "Maximum",
    periodSeconds: MINUTE_IN_SECONDS,
    cloudWatchClientCache,
    notApplicableStatus: HEALTH_STATUS.NOT_APPLICABLE,
    notApplicableSummary: isAurora
      ? "Generic RDS ReplicaLag is not used for Aurora cluster instances; Aurora replicas publish AuroraReplicaLag."
      : "Replica lag is only applicable to read replica DB instances.",
    missingDataSummary: `No ReplicaLag datapoints were reported in the last ${lookbackHours}h.`,
    positiveSummary: (value) =>
      `Replica lag reached ${value} seconds in the last ${lookbackHours}h.`,
    zeroSummary: `Replica lag remained at 0 in the last ${lookbackHours}h.`,
    details: {
      dbInstanceIdentifier,
      dbClusterIdentifier,
      engine,
    },
  });
}

async function buildRdsDeadlocksCheck({
  cluster,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  cloudWatchClientCache,
}) {
  const dbClusterIdentifier = safeTrim(cluster?.DBClusterIdentifier);
  return buildAnyPositiveMetricCheck({
    checkId: RDS_CLUSTER_DEADLOCKS_CHECK_ID,
    checkName: "Deadlocks",
    namespace: "AWS/RDS",
    metricName: "Deadlocks",
    dimensionSets: dbClusterIdentifier
      ? [[{ Name: "DBClusterIdentifier", Value: dbClusterIdentifier }]]
      : [],
    region,
    credentials,
    lookbackHours,
    statistic: "Sum",
    periodSeconds: MINUTE_IN_SECONDS,
    cloudWatchClientCache,
    notApplicableSummary: "DB cluster identifier is unavailable for the deadlock check.",
    missingDataSummary: `No Deadlocks datapoints were reported in the last ${lookbackHours}h.`,
    positiveSummary: (value) =>
      `Deadlocks were reported for this DB cluster in the last ${lookbackHours}h.`,
    zeroSummary: `No deadlocks were reported in the last ${lookbackHours}h.`,
    details: { dbClusterIdentifier },
  });
}

async function buildDocDbLowMemoryThrottlingCheck({
  instance,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  cloudWatchClientCache,
}) {
  const dbInstanceIdentifier = safeTrim(instance?.DBInstanceIdentifier);
  return buildAnyPositiveMetricCheck({
    checkId: DOCDB_INSTANCE_LOW_MEMORY_THROTTLING_CHECK_ID,
    checkName: "Low-memory throttling",
    namespace: "AWS/DocDB",
    metricName: "LowMemNumOperationsThrottled",
    dimensionSets: dbInstanceIdentifier
      ? [[{ Name: "DBInstanceIdentifier", Value: dbInstanceIdentifier }]]
      : [],
    region,
    credentials,
    lookbackHours,
    statistic: "Sum",
    periodSeconds: MINUTE_IN_SECONDS,
    cloudWatchClientCache,
    notApplicableSummary:
      "DB instance identifier is unavailable for the low-memory throttling check.",
    missingDataSummary: `No LowMemNumOperationsThrottled datapoints were reported in the last ${lookbackHours}h.`,
    positiveSummary: () =>
      `Low-memory throttling was reported for this DB instance in the last ${lookbackHours}h.`,
    zeroSummary: `No low-memory throttling was reported in the last ${lookbackHours}h.`,
    details: { dbInstanceIdentifier },
  });
}

async function buildDocDbGlobalReplicationLagCheck({
  cluster,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  cloudWatchClientCache,
}) {
  const dbClusterIdentifier = safeTrim(cluster?.DBClusterIdentifier);
  const replicationSourceIdentifier = safeTrim(cluster?.ReplicationSourceIdentifier);
  const secondaryClusterIdentifiers = normalizeStringArray(cluster?.ReadReplicaIdentifiers || []);
  const lagTargets = replicationSourceIdentifier ? [dbClusterIdentifier] : secondaryClusterIdentifiers;

  return buildAnyPositiveMetricCheck({
    checkId: DOCDB_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID,
    checkName: "Global replication lag",
    namespace: "AWS/DocDB",
    metricName: "GlobalClusterReplicationLag",
    dimensionSets: lagTargets.map((identifier) => [
      { Name: "DBClusterIdentifier", Value: identifier },
    ]),
    region,
    credentials,
    lookbackHours,
    statistic: "Maximum",
    periodSeconds: FIVE_MINUTES_IN_SECONDS,
    cloudWatchClientCache,
    notApplicableSummary:
      "Global replication lag is only applicable to DocumentDB global clusters.",
    missingDataSummary: `No GlobalClusterReplicationLag datapoints were reported in the last ${lookbackHours}h.`,
    positiveSummary: (value) =>
      `Global replication lag reached ${value} ms in the last ${lookbackHours}h.`,
    zeroSummary: `Global replication lag remained at 0 in the last ${lookbackHours}h.`,
    details: {
      dbClusterIdentifier,
      lagTargets,
    },
  });
}

async function buildNeptuneQueuePressureCheck({
  instance,
  region,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  cloudWatchClientCache,
}) {
  const dbInstanceIdentifier = safeTrim(instance?.DBInstanceIdentifier);
  return buildAnyPositiveMetricCheck({
    checkId: NEPTUNE_INSTANCE_QUEUE_PRESSURE_CHECK_ID,
    checkName: "Main request queue pending requests",
    namespace: "AWS/Neptune",
    metricName: "MainRequestQueuePendingRequests",
    dimensionSets: dbInstanceIdentifier
      ? [[{ Name: "DBInstanceIdentifier", Value: dbInstanceIdentifier }]]
      : [],
    region,
    credentials,
    lookbackHours,
    statistic: "Maximum",
    periodSeconds: FIVE_MINUTES_IN_SECONDS,
    cloudWatchClientCache,
    notApplicableSummary:
      "DB instance identifier is unavailable for the request queue pressure check.",
    zeroDatapointsHealthySummary:
      "No MainRequestQueuePendingRequests datapoints were published; Neptune only emits this metric when it is non-zero.",
    positiveSummary: (value) =>
      `Main request queue pending requests reached ${value} in the last ${lookbackHours}h.`,
    zeroSummary:
      "Main request queue pending requests remained at 0 in the last lookback window.",
    treatMissingAsZero: true,
    details: { dbInstanceIdentifier },
  });
}

async function buildNeptuneGlobalReplicationLagCheck({
  cluster,
  target,
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  caches,
}) {
  const dbClusterIdentifier = safeTrim(cluster?.DBClusterIdentifier);
  const globalClusterIdentifier = safeTrim(cluster?.GlobalClusterIdentifier);
  if (!globalClusterIdentifier) {
    return createCheckResult({
      checkId: NEPTUNE_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID,
      checkName: "Global replication lag",
      category: "errors",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Global replication lag is only applicable to Neptune global databases.",
      details: { dbClusterIdentifier },
    });
  }

  let globalCluster;
  try {
    globalCluster = await fetchNeptuneGlobalCluster({
      cluster,
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
  } catch (error) {
    return createCheckResult({
      checkId: NEPTUNE_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID,
      checkName: "Global replication lag",
      category: "errors",
      status: HEALTH_STATUS.ERROR,
      summary: `Neptune global cluster lookup failed: ${error?.message || "unknown error"}.`,
      details: { dbClusterIdentifier, globalClusterIdentifier },
    });
  }

  const members = Array.isArray(globalCluster?.GlobalClusterMembers)
    ? globalCluster.GlobalClusterMembers
    : [];
  const currentClusterArn = safeTrim(cluster?.DBClusterArn);
  const currentMember =
    members.find((member) => safeTrim(member?.DBClusterArn) === currentClusterArn) || null;
  const writerMember = members.find((member) => member?.IsWriter === true) || null;

  let dimensionSets = [];
  if (currentMember?.IsWriter === true) {
    const secondaryRegions = extractArnRegions(currentMember?.Readers || []);
    dimensionSets = secondaryRegions.map((secondaryRegion) => [
      { Name: "DBClusterIdentifier", Value: dbClusterIdentifier },
      { Name: "SecondaryRegion", Value: secondaryRegion },
    ]);
  } else if (currentMember && writerMember) {
    const sourceRegion = safeTrim(parseAwsArn(writerMember?.DBClusterArn || "")?.region);
    if (sourceRegion) {
      dimensionSets = [[
        { Name: "DBClusterIdentifier", Value: dbClusterIdentifier },
        { Name: "SourceRegion", Value: sourceRegion },
      ]];
    }
  }

  return buildAnyPositiveMetricCheck({
    checkId: NEPTUNE_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID,
    checkName: "Global replication lag",
    namespace: "AWS/Neptune",
    metricName: "GlobalDbProgressLag",
    dimensionSets,
    region: target.region,
    credentials,
    lookbackHours,
    statistic: "Maximum",
    periodSeconds: FIVE_MINUTES_IN_SECONDS,
    cloudWatchClientCache: caches.cloudWatchClientCache,
    notApplicableSummary: "Global replication lag is only applicable to Neptune global databases.",
    zeroDatapointsHealthySummary:
      "No GlobalDbProgressLag datapoints were published; Neptune only emits this metric when it is non-zero.",
    positiveSummary: (value) =>
      `Global replication lag reached ${value} ms in the last ${lookbackHours}h.`,
    zeroSummary: "Global replication lag remained at 0 in the last lookback window.",
    treatMissingAsZero: true,
    details: { dbClusterIdentifier },
  });
}

function buildTimestreamRetentionCheck({ table }) {
  const databaseName = safeTrim(table?.DatabaseName);
  const tableName = safeTrim(table?.TableName);
  const memoryHours = Number(table?.RetentionProperties?.MemoryStoreRetentionPeriodInHours);
  const magneticDays = Number(table?.RetentionProperties?.MagneticStoreRetentionPeriodInDays);
  const valid =
    Number.isFinite(memoryHours) &&
    memoryHours > 0 &&
    Number.isFinite(magneticDays) &&
    magneticDays > 0;

  return createCheckResult({
    checkId: "timestream.table.retention",
    checkName: "Retention configuration",
    category: "configuration",
    status: valid ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNKNOWN,
    summary: valid
      ? "Timestream table has memory and magnetic store retention configured."
      : "Timestream table retention properties are unavailable.",
    details: {
      databaseName,
      tableName,
      memoryStoreRetentionHours: Number.isFinite(memoryHours) ? memoryHours : null,
      magneticStoreRetentionDays: Number.isFinite(magneticDays) ? magneticDays : null,
    },
  });
}

async function evaluateRdsDbInstance({
  target,
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks,
  caches,
  logger,
}) {
  const checks = [];
  const errors = [];
  try {
    const instance = await fetchRdsDbInstance({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      buildStatusCheck({
        checkId: RDS_INSTANCE_STATUS_CHECK_ID,
        checkName: "DB instance status",
        statusValue: instance?.DBInstanceStatus,
        unhealthyStatuses: RDS_UNHEALTHY_INSTANCE_STATUSES,
        details: {
          dbInstanceIdentifier: instance?.DBInstanceIdentifier || null,
          dbInstanceArn: instance?.DBInstanceArn || null,
        },
      })
    );
    checks.push(
      await buildRdsLifecycleCheck({
        checkId: RDS_INSTANCE_RUNTIME_CHECK_ID,
        checkName: "DB engine major version lifecycle support status",
        config: instance,
        region: target.region,
        credentials,
        lifecycleCache: caches.lifecycleCache,
      })
    );
    checks.push(
      await buildRdsFreeStorageCheck({
        instance,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    checks.push(
      await buildRdsReplicaLagCheck({
        instance,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    if (includeCloudWatchLogChecks) {
      const logTypes = resolveEnabledLogExports(instance);
      checks.push(
        await buildLogKeywordCheck({
          checkId: RDS_INSTANCE_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          logsClientCache: caches.logsClientCache,
          exportedLogTypes: logTypes,
          logGroupNames: buildRdsLogGroupNames(
            "instance",
            instance?.DBInstanceIdentifier,
            logTypes
          ),
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate RDS DB instance checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: RDS_INSTANCE_STATUS_CHECK_ID,
        checkName: "DB instance status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: RDS_INSTANCE_RUNTIME_CHECK_ID,
        checkName: "DB engine major version lifecycle support status",
        category: "runtime-eol",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: RDS_INSTANCE_FREE_STORAGE_CHECK_ID,
        checkName: "Free storage space",
        category: "capacity",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: RDS_INSTANCE_REPLICA_LAG_CHECK_ID,
        checkName: "Replica lag",
        category: "errors",
        summary: message,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: RDS_INSTANCE_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          category: "error-logs",
          summary: message,
        })
      );
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateRdsDbCluster({
  target,
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks,
  caches,
  logger,
}) {
  const checks = [];
  const errors = [];
  try {
    const cluster = await fetchRdsDbCluster({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      buildStatusCheck({
        checkId: RDS_CLUSTER_STATUS_CHECK_ID,
        checkName: "DB cluster status",
        statusValue: cluster?.Status,
        unhealthyStatuses: RDS_UNHEALTHY_CLUSTER_STATUSES,
        details: {
          dbClusterIdentifier: cluster?.DBClusterIdentifier || null,
          dbClusterArn: cluster?.DBClusterArn || null,
        },
      })
    );
    checks.push(
      await buildRdsLifecycleCheck({
        checkId: RDS_CLUSTER_RUNTIME_CHECK_ID,
        checkName: "DB cluster engine major version lifecycle support status",
        config: cluster,
        region: target.region,
        credentials,
        lifecycleCache: caches.lifecycleCache,
      })
    );
    checks.push(
      await buildRdsDeadlocksCheck({
        cluster,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    if (includeCloudWatchLogChecks) {
      const logTypes = resolveEnabledLogExports(cluster);
      checks.push(
        await buildLogKeywordCheck({
          checkId: RDS_CLUSTER_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          logsClientCache: caches.logsClientCache,
          exportedLogTypes: logTypes,
          logGroupNames: buildRdsLogGroupNames(
            "cluster",
            cluster?.DBClusterIdentifier,
            logTypes
          ),
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate RDS DB cluster checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: RDS_CLUSTER_STATUS_CHECK_ID,
        checkName: "DB cluster status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: RDS_CLUSTER_RUNTIME_CHECK_ID,
        checkName: "DB cluster engine major version lifecycle support status",
        category: "runtime-eol",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: RDS_CLUSTER_DEADLOCKS_CHECK_ID,
        checkName: "Deadlocks",
        category: "errors",
        summary: message,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: RDS_CLUSTER_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          category: "error-logs",
          summary: message,
        })
      );
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateDocDbInstance({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const instance = await fetchDocDbInstance({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      buildStatusCheck({
        checkId: DOCDB_INSTANCE_STATUS_CHECK_ID,
        checkName: "DB instance status",
        statusValue: instance?.DBInstanceStatus,
        unhealthyStatuses: DOCDB_UNHEALTHY_INSTANCE_STATUSES,
        details: {
          dbInstanceIdentifier: instance?.DBInstanceIdentifier || null,
          dbInstanceArn: instance?.DBInstanceArn || null,
        },
      })
    );
    checks.push(
      buildReplicaStatusCheck({
        checkId: DOCDB_INSTANCE_REPLICA_CHECK_ID,
        checkName: "Read replica status",
        statusInfos: instance?.StatusInfos,
        details: {
          dbInstanceIdentifier: instance?.DBInstanceIdentifier || null,
          dbClusterIdentifier: instance?.DBClusterIdentifier || null,
        },
      })
    );
    checks.push(
      await buildDocDbConnectionHeadroomCheck({
        instance,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    checks.push(
      await buildDocDbLowMemoryThrottlingCheck({
        instance,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate DocumentDB DB instance checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: DOCDB_INSTANCE_STATUS_CHECK_ID,
        checkName: "DB instance status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: DOCDB_INSTANCE_REPLICA_CHECK_ID,
        checkName: "Read replica status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: DOCDB_INSTANCE_CONNECTION_LIMIT_CHECK_ID,
        checkName: "Connection limit headroom",
        category: "capacity",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: DOCDB_INSTANCE_LOW_MEMORY_THROTTLING_CHECK_ID,
        checkName: "Low-memory throttling",
        category: "errors",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateDocDbCluster({
  target,
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks,
  caches,
  logger,
}) {
  const checks = [];
  const errors = [];
  try {
    const cluster = await fetchDocDbCluster({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      buildStatusCheck({
        checkId: DOCDB_CLUSTER_STATUS_CHECK_ID,
        checkName: "DB cluster status",
        statusValue: cluster?.Status,
        unhealthyStatuses: DOCDB_UNHEALTHY_CLUSTER_STATUSES,
        details: {
          dbClusterIdentifier: cluster?.DBClusterIdentifier || null,
          dbClusterArn: cluster?.DBClusterArn || null,
        },
      })
    );
    checks.push(
      await buildDocDbGlobalReplicationLagCheck({
        cluster,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    if (includeCloudWatchLogChecks) {
      const logTypes = resolveEnabledLogExports(cluster);
      checks.push(
        await buildLogKeywordCheck({
          checkId: DOCDB_CLUSTER_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          logsClientCache: caches.logsClientCache,
          exportedLogTypes: logTypes,
          logGroupNames: buildDocDbLogGroupNames(cluster?.DBClusterIdentifier, logTypes),
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate DocumentDB DB cluster checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: DOCDB_CLUSTER_STATUS_CHECK_ID,
        checkName: "DB cluster status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: DOCDB_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID,
        checkName: "Global replication lag",
        category: "errors",
        summary: message,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: DOCDB_CLUSTER_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          category: "error-logs",
          summary: message,
        })
      );
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateNeptuneInstance({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const instance = await fetchNeptuneInstance({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      buildStatusCheck({
        checkId: NEPTUNE_INSTANCE_STATUS_CHECK_ID,
        checkName: "DB instance status",
        statusValue: instance?.DBInstanceStatus,
        unhealthyStatuses: NEPTUNE_UNHEALTHY_INSTANCE_STATUSES,
        details: {
          dbInstanceIdentifier: instance?.DBInstanceIdentifier || null,
          dbInstanceArn: instance?.DBInstanceArn || null,
        },
      })
    );
    checks.push(
      buildReplicaStatusCheck({
        checkId: NEPTUNE_INSTANCE_REPLICA_CHECK_ID,
        checkName: "Read replica status",
        statusInfos: instance?.StatusInfos,
        details: {
          dbInstanceIdentifier: instance?.DBInstanceIdentifier || null,
          dbClusterIdentifier: instance?.DBClusterIdentifier || null,
        },
      })
    );
    checks.push(
      await buildNeptuneQueuePressureCheck({
        instance,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate Neptune DB instance checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: NEPTUNE_INSTANCE_STATUS_CHECK_ID,
        checkName: "DB instance status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: NEPTUNE_INSTANCE_REPLICA_CHECK_ID,
        checkName: "Read replica status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: NEPTUNE_INSTANCE_QUEUE_PRESSURE_CHECK_ID,
        checkName: "Main request queue pending requests",
        category: "errors",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateNeptuneCluster({
  target,
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks,
  caches,
  logger,
}) {
  const checks = [];
  const errors = [];
  try {
    const cluster = await fetchNeptuneCluster({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      buildStatusCheck({
        checkId: NEPTUNE_CLUSTER_STATUS_CHECK_ID,
        checkName: "DB cluster status",
        statusValue: cluster?.Status,
        unhealthyStatuses: NEPTUNE_UNHEALTHY_CLUSTER_STATUSES,
        details: {
          dbClusterIdentifier: cluster?.DBClusterIdentifier || null,
        },
      })
    );
    checks.push(
      await buildNeptuneGlobalReplicationLagCheck({
        cluster,
        target,
        credentials,
        lookbackHours,
        caches,
      })
    );
    if (includeCloudWatchLogChecks) {
      const logTypes = resolveEnabledLogExports(cluster);
      checks.push(
        await buildLogKeywordCheck({
          checkId: NEPTUNE_CLUSTER_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          logsClientCache: caches.logsClientCache,
          exportedLogTypes: logTypes,
          logGroupNames: buildNeptuneLogGroupNames(cluster?.DBClusterIdentifier, logTypes),
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate Neptune DB cluster checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: NEPTUNE_CLUSTER_STATUS_CHECK_ID,
        checkName: "DB cluster status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: NEPTUNE_CLUSTER_GLOBAL_REPLICATION_LAG_CHECK_ID,
        checkName: "Global replication lag",
        category: "errors",
        summary: message,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: NEPTUNE_CLUSTER_LOGS_CHECK_ID,
          checkName: "Recent CloudWatch DB log errors",
          category: "error-logs",
          summary: message,
        })
      );
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateElastiCacheCluster({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const cluster = await fetchElastiCacheCluster({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    const cacheClusterId = safeTrim(cluster?.CacheClusterId);
    checks.push(
      buildStatusCheck({
        checkId: ELASTICACHE_CLUSTER_STATUS_CHECK_ID,
        checkName: "Cache cluster status",
        statusValue: cluster?.CacheClusterStatus,
        unhealthyStatuses: ELASTICACHE_UNHEALTHY_CLUSTER_STATUSES,
        details: {
          cacheClusterId,
          engine: cluster?.Engine || null,
          engineVersion: cluster?.EngineVersion || null,
          cacheNodeType: cluster?.CacheNodeType || null,
          numCacheNodes: cluster?.NumCacheNodes || null,
        },
      })
    );
    checks.push(
      await buildMaximumMetricThresholdCheck({
        checkId: ELASTICACHE_CLUSTER_CPU_CHECK_ID,
        checkName: "CPU utilization",
        category: "capacity",
        namespace: "AWS/ElastiCache",
        metricName: "CPUUtilization",
        dimensions: [{ Name: "CacheClusterId", Value: cacheClusterId }],
        region: target.region,
        credentials,
        lookbackHours,
        threshold: HIGH_UTILIZATION_PERCENT,
        unit: "%",
        cloudWatchClientCache: caches.cloudWatchClientCache,
        details: { cacheClusterId },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate ElastiCache cache cluster checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: ELASTICACHE_CLUSTER_STATUS_CHECK_ID,
        checkName: "Cache cluster status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: ELASTICACHE_CLUSTER_CPU_CHECK_ID,
        checkName: "CPU utilization",
        category: "capacity",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateElastiCacheReplicationGroup({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const group = await fetchElastiCacheReplicationGroup({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    const replicationGroupId = safeTrim(group?.ReplicationGroupId);
    checks.push(
      buildStatusCheck({
        checkId: ELASTICACHE_REPLICATION_GROUP_STATUS_CHECK_ID,
        checkName: "Replication group status",
        statusValue: group?.Status,
        unhealthyStatuses: ELASTICACHE_UNHEALTHY_REPLICATION_GROUP_STATUSES,
        details: {
          replicationGroupId,
          arn: group?.ARN || null,
          memberClusters: normalizeStringArray(group?.MemberClusters || []),
        },
      })
    );
    checks.push(
      await buildAnyPositiveMetricCheck({
        checkId: ELASTICACHE_REPLICATION_GROUP_EVICTIONS_CHECK_ID,
        checkName: "Cache evictions",
        namespace: "AWS/ElastiCache",
        metricName: "Evictions",
        dimensionSets: [[{ Name: "ReplicationGroupId", Value: replicationGroupId }]],
        region: target.region,
        credentials,
        lookbackHours,
        statistic: "Sum",
        periodSeconds: FIVE_MINUTES_IN_SECONDS,
        cloudWatchClientCache: caches.cloudWatchClientCache,
        missingDataSummary: `No ElastiCache eviction datapoints were reported in the last ${lookbackHours}h.`,
        positiveSummary: (value) =>
          `ElastiCache reported ${value} evictions in the last ${lookbackHours}h.`,
        zeroSummary: `No ElastiCache evictions were reported in the last ${lookbackHours}h.`,
        details: { replicationGroupId },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate ElastiCache replication group checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: ELASTICACHE_REPLICATION_GROUP_STATUS_CHECK_ID,
        checkName: "Replication group status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: ELASTICACHE_REPLICATION_GROUP_EVICTIONS_CHECK_ID,
        checkName: "Cache evictions",
        category: "errors",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateElastiCacheSubnetGroup({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const subnetGroup = await fetchElastiCacheSubnetGroup({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      createCheckResult({
        checkId: ELASTICACHE_SUBNET_GROUP_STATUS_CHECK_ID,
        checkName: "Subnet group reachable",
        category: "availability",
        status: HEALTH_STATUS.HEALTHY,
        summary: "ElastiCache subnet group was found.",
        details: {
          cacheSubnetGroupName: subnetGroup?.CacheSubnetGroupName || null,
          vpcId: subnetGroup?.VpcId || null,
          subnetCount: Array.isArray(subnetGroup?.Subnets) ? subnetGroup.Subnets.length : null,
        },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate ElastiCache subnet group checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: ELASTICACHE_SUBNET_GROUP_STATUS_CHECK_ID,
        checkName: "Subnet group reachable",
        category: "availability",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateRedshiftCluster({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const cluster = await fetchRedshiftCluster({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    const clusterIdentifier = safeTrim(cluster?.ClusterIdentifier);
    checks.push(
      buildStatusCheck({
        checkId: REDSHIFT_CLUSTER_STATUS_CHECK_ID,
        checkName: "Cluster status",
        statusValue: cluster?.ClusterStatus,
        unhealthyStatuses: REDSHIFT_UNHEALTHY_CLUSTER_STATUSES,
        details: {
          clusterIdentifier,
          clusterNamespaceArn: cluster?.ClusterNamespaceArn || null,
          nodeType: cluster?.NodeType || null,
          numberOfNodes: cluster?.NumberOfNodes || null,
        },
      })
    );
    checks.push(
      await buildMinimumMetricHealthyCheck({
        checkId: REDSHIFT_CLUSTER_HEALTH_STATUS_CHECK_ID,
        checkName: "Cluster health status metric",
        category: "availability",
        namespace: "AWS/Redshift",
        metricName: "HealthStatus",
        dimensions: [{ Name: "ClusterIdentifier", Value: clusterIdentifier }],
        region: target.region,
        credentials,
        lookbackHours,
        minimumHealthyValue: 1,
        cloudWatchClientCache: caches.cloudWatchClientCache,
        healthySummary: () => `Redshift HealthStatus remained healthy in the last ${lookbackHours}h.`,
        problemSummary: () => `Redshift HealthStatus reported unhealthy in the last ${lookbackHours}h.`,
        details: { clusterIdentifier },
      })
    );
    checks.push(
      await buildMaximumMetricThresholdCheck({
        checkId: REDSHIFT_CLUSTER_CPU_CHECK_ID,
        checkName: "CPU utilization",
        category: "capacity",
        namespace: "AWS/Redshift",
        metricName: "CPUUtilization",
        dimensions: [{ Name: "ClusterIdentifier", Value: clusterIdentifier }],
        region: target.region,
        credentials,
        lookbackHours,
        threshold: HIGH_UTILIZATION_PERCENT,
        unit: "%",
        cloudWatchClientCache: caches.cloudWatchClientCache,
        details: { clusterIdentifier },
      })
    );
    checks.push(
      await buildMaximumMetricThresholdCheck({
        checkId: REDSHIFT_CLUSTER_DISK_CHECK_ID,
        checkName: "Disk space used",
        category: "capacity",
        namespace: "AWS/Redshift",
        metricName: "PercentageDiskSpaceUsed",
        dimensions: [{ Name: "ClusterIdentifier", Value: clusterIdentifier }],
        region: target.region,
        credentials,
        lookbackHours,
        threshold: HIGH_UTILIZATION_PERCENT,
        unit: "%",
        cloudWatchClientCache: caches.cloudWatchClientCache,
        details: { clusterIdentifier },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate Redshift cluster checks";
    errors.push(message);
    for (const [checkId, checkName, category] of [
      [REDSHIFT_CLUSTER_STATUS_CHECK_ID, "Cluster status", "availability"],
      [REDSHIFT_CLUSTER_HEALTH_STATUS_CHECK_ID, "Cluster health status metric", "availability"],
      [REDSHIFT_CLUSTER_CPU_CHECK_ID, "CPU utilization", "capacity"],
      [REDSHIFT_CLUSTER_DISK_CHECK_ID, "Disk space used", "capacity"],
    ]) {
      checks.push(buildCheckError({ checkId, checkName, category, summary: message }));
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateMemoryDbCluster({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const cluster = await fetchMemoryDbCluster({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    const clusterName = safeTrim(cluster?.Name);
    checks.push(
      buildStatusCheck({
        checkId: MEMORYDB_CLUSTER_STATUS_CHECK_ID,
        checkName: "Cluster status",
        statusValue: cluster?.Status,
        unhealthyStatuses: MEMORYDB_UNHEALTHY_CLUSTER_STATUSES,
        details: {
          clusterName,
          clusterArn: cluster?.ARN || null,
          nodeType: cluster?.NodeType || null,
          engineVersion: cluster?.EngineVersion || null,
        },
      })
    );
    for (const [checkId, checkName, metricName] of [
      [MEMORYDB_CLUSTER_CPU_CHECK_ID, "CPU utilization", "CPUUtilization"],
      [MEMORYDB_CLUSTER_ENGINE_CPU_CHECK_ID, "Engine CPU utilization", "EngineCPUUtilization"],
    ]) {
      checks.push(
        await buildMaximumMetricThresholdCheck({
          checkId,
          checkName,
          category: "capacity",
          namespace: "AWS/MemoryDB",
          metricName,
          dimensions: [{ Name: "ClusterName", Value: clusterName }],
          region: target.region,
          credentials,
          lookbackHours,
          threshold: HIGH_UTILIZATION_PERCENT,
          unit: "%",
          cloudWatchClientCache: caches.cloudWatchClientCache,
          details: { clusterName },
        })
      );
    }
    checks.push(
      await buildAnyPositiveMetricCheck({
        checkId: MEMORYDB_CLUSTER_EVICTIONS_CHECK_ID,
        checkName: "Evictions",
        namespace: "AWS/MemoryDB",
        metricName: "Evictions",
        dimensionSets: [[{ Name: "ClusterName", Value: clusterName }]],
        region: target.region,
        credentials,
        lookbackHours,
        statistic: "Sum",
        periodSeconds: FIVE_MINUTES_IN_SECONDS,
        cloudWatchClientCache: caches.cloudWatchClientCache,
        missingDataSummary: `No MemoryDB eviction datapoints were reported in the last ${lookbackHours}h.`,
        positiveSummary: (value) => `MemoryDB reported ${value} evictions in the last ${lookbackHours}h.`,
        zeroSummary: `No MemoryDB evictions were reported in the last ${lookbackHours}h.`,
        details: { clusterName },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate MemoryDB cluster checks";
    errors.push(message);
    for (const [checkId, checkName, category] of [
      [MEMORYDB_CLUSTER_STATUS_CHECK_ID, "Cluster status", "availability"],
      [MEMORYDB_CLUSTER_CPU_CHECK_ID, "CPU utilization", "capacity"],
      [MEMORYDB_CLUSTER_ENGINE_CPU_CHECK_ID, "Engine CPU utilization", "capacity"],
      [MEMORYDB_CLUSTER_EVICTIONS_CHECK_ID, "Evictions", "errors"],
    ]) {
      checks.push(buildCheckError({ checkId, checkName, category, summary: message }));
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateTimestreamDatabase({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const database = await fetchTimestreamDatabase({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      createCheckResult({
        checkId: TIMESTREAM_DATABASE_STATUS_CHECK_ID,
        checkName: "Database reachable",
        category: "availability",
        status: HEALTH_STATUS.HEALTHY,
        summary: "Timestream database was found.",
        details: {
          databaseName: database?.DatabaseName || null,
          databaseArn: database?.Arn || null,
          tableCount: database?.TableCount ?? null,
          kmsKeyId: database?.KmsKeyId || null,
        },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate Timestream database checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: TIMESTREAM_DATABASE_STATUS_CHECK_ID,
        checkName: "Database reachable",
        category: "availability",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateTimestreamTable({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const table = await fetchTimestreamTable({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    const databaseName = safeTrim(table?.DatabaseName);
    const tableName = safeTrim(table?.TableName);
    checks.push(
      buildStatusCheck({
        checkId: TIMESTREAM_TABLE_STATUS_CHECK_ID,
        checkName: "Table status",
        statusValue: table?.TableStatus,
        unhealthyStatuses: new Set(["DELETING", "RESTORING"]),
        details: {
          databaseName,
          tableName,
          tableArn: table?.Arn || null,
        },
      })
    );
    checks.push(buildTimestreamRetentionCheck({ table }));
    checks.push(
      await buildAnyPositiveMetricCheck({
        checkId: TIMESTREAM_TABLE_REJECTED_RECORDS_CHECK_ID,
        checkName: "Magnetic store rejected records",
        namespace: "AWS/Timestream",
        metricName: "MagneticStoreRejectedRecordCount",
        dimensionSets: [[
          { Name: "DatabaseName", Value: databaseName },
          { Name: "TableName", Value: tableName },
        ]],
        region: target.region,
        credentials,
        lookbackHours,
        statistic: "Sum",
        periodSeconds: FIVE_MINUTES_IN_SECONDS,
        cloudWatchClientCache: caches.cloudWatchClientCache,
        zeroDatapointsHealthySummary:
          "No magnetic-store rejected record datapoints were published; Timestream only emits this signal when records are rejected.",
        positiveSummary: (value) =>
          `Timestream reported ${value} magnetic-store rejected records in the last ${lookbackHours}h.`,
        zeroSummary: `No magnetic-store rejected records were reported in the last ${lookbackHours}h.`,
        treatMissingAsZero: true,
        details: { databaseName, tableName },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate Timestream table checks";
    errors.push(message);
    for (const [checkId, checkName, category] of [
      [TIMESTREAM_TABLE_STATUS_CHECK_ID, "Table status", "availability"],
      ["timestream.table.retention", "Retention configuration", "configuration"],
      [TIMESTREAM_TABLE_REJECTED_RECORDS_CHECK_ID, "Magnetic store rejected records", "errors"],
    ]) {
      checks.push(buildCheckError({ checkId, checkName, category, summary: message }));
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateKeyspacesKeyspace({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const keyspace = await fetchKeyspacesKeyspace({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    checks.push(
      createCheckResult({
        checkId: KEYSPACES_KEYSPACE_STATUS_CHECK_ID,
        checkName: "Keyspace reachable",
        category: "availability",
        status: HEALTH_STATUS.HEALTHY,
        summary: "Keyspaces keyspace was found.",
        details: {
          keyspaceName: keyspace?.keyspaceName || null,
          resourceArn: keyspace?.resourceArn || null,
          replicationStrategy: keyspace?.replicationStrategy || null,
          replicationRegions: normalizeStringArray(keyspace?.replicationRegions || []),
        },
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate Keyspaces keyspace checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: KEYSPACES_KEYSPACE_STATUS_CHECK_ID,
        checkName: "Keyspace reachable",
        category: "availability",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateKeyspacesTable({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  const effectiveLookbackHours = lookbackHours || DEFAULT_LOOKBACK_HOURS;
  try {
    const table = await fetchKeyspacesTable({
      target,
      credentials,
      clientCache: caches.serviceClientCache,
    });
    const keyspaceName = safeTrim(table?.keyspaceName);
    const tableName = safeTrim(table?.tableName);
    checks.push(
      buildStatusCheck({
        checkId: KEYSPACES_TABLE_STATUS_CHECK_ID,
        checkName: "Table status",
        statusValue: table?.status,
        unhealthyStatuses: KEYSPACES_UNHEALTHY_TABLE_STATUSES,
        details: {
          keyspaceName,
          tableName,
          resourceArn: table?.resourceArn || null,
          capacityMode: table?.capacitySpecification?.throughputMode || null,
          encryptionType: table?.encryptionSpecification?.type || null,
          pointInTimeRecoveryStatus:
            table?.pointInTimeRecovery?.status || table?.pointInTimeRecovery?.statusOverride || null,
        },
      })
    );

    for (const [checkId, checkName, category, metricName, summaryName] of [
      [
        KEYSPACES_TABLE_SYSTEM_ERRORS_CHECK_ID,
        "System errors",
        "errors",
        "SystemErrors",
        "system errors",
      ],
      [
        KEYSPACES_TABLE_USER_ERRORS_CHECK_ID,
        "User errors",
        "errors",
        "UserErrors",
        "user errors",
      ],
      [
        KEYSPACES_TABLE_READ_THROTTLES_CHECK_ID,
        "Read throttle events",
        "capacity",
        "ReadThrottleEvents",
        "read throttle events",
      ],
      [
        KEYSPACES_TABLE_WRITE_THROTTLES_CHECK_ID,
        "Write throttle events",
        "capacity",
        "WriteThrottleEvents",
        "write throttle events",
      ],
      [
        KEYSPACES_TABLE_CONNECTION_RATE_CHECK_ID,
        "Per-connection request rate exceeded",
        "capacity",
        "PerConnectionRequestRateExceeded",
        "per-connection request rate exceedance events",
      ],
    ]) {
      const dimensionSets = await buildKeyspacesMetricDimensionSets({
        keyspaceName,
        tableName,
        metricName,
        region: target.region,
        credentials,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      });
      checks.push(
        await buildAnyPositiveMetricCheck({
          checkId,
          checkName,
          category,
          namespace: "AWS/Cassandra",
          metricName,
          dimensionSets,
          region: target.region,
          credentials,
          lookbackHours: effectiveLookbackHours,
          statistic: "Sum",
          periodSeconds: FIVE_MINUTES_IN_SECONDS,
          cloudWatchClientCache: caches.cloudWatchClientCache,
          zeroDatapointsHealthySummary:
            `No ${summaryName} datapoints were published for this Keyspaces table in the last ${effectiveLookbackHours}h.`,
          positiveSummary: (value) =>
            `Keyspaces reported ${value} ${summaryName} in the last ${effectiveLookbackHours}h.`,
          zeroSummary: `No ${summaryName} were reported in the last ${effectiveLookbackHours}h.`,
          treatMissingAsZero: true,
          details: { keyspaceName, tableName },
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate Keyspaces table checks";
    errors.push(message);
    for (const [checkId, checkName, category] of [
      [KEYSPACES_TABLE_STATUS_CHECK_ID, "Table status", "availability"],
      [KEYSPACES_TABLE_SYSTEM_ERRORS_CHECK_ID, "System errors", "errors"],
      [KEYSPACES_TABLE_USER_ERRORS_CHECK_ID, "User errors", "errors"],
      [KEYSPACES_TABLE_READ_THROTTLES_CHECK_ID, "Read throttle events", "capacity"],
      [KEYSPACES_TABLE_WRITE_THROTTLES_CHECK_ID, "Write throttle events", "capacity"],
      [KEYSPACES_TABLE_CONNECTION_RATE_CHECK_ID, "Per-connection request rate exceeded", "capacity"],
    ]) {
      checks.push(buildCheckError({ checkId, checkName, category, summary: message }));
    }
  }

  return createResourceResult({ target, checks, errors });
}

export async function runDatabaseHealthChecks({
  resources = [],
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks = false,
  logger,
} = {}) {
  const caches = {
    cloudWatchClientCache: new Map(),
    lifecycleCache: new Map(),
    logsClientCache: new Map(),
    serviceClientCache: new Map(),
  };

  return Promise.all(
    (Array.isArray(resources) ? resources : []).map((target) => {
      switch (target.resourceType) {
        case "AWS::RDS::DBInstance":
          return evaluateRdsDbInstance({
            target,
            credentials,
            lookbackHours,
            includeCloudWatchLogChecks,
            caches,
            logger,
          });
        case "AWS::RDS::DBCluster":
          return evaluateRdsDbCluster({
            target,
            credentials,
            lookbackHours,
            includeCloudWatchLogChecks,
            caches,
            logger,
          });
        case "AWS::DocDB::DBInstance":
          return evaluateDocDbInstance({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        case "AWS::DocDB::DBCluster":
          return evaluateDocDbCluster({
            target,
            credentials,
            lookbackHours,
            includeCloudWatchLogChecks,
            caches,
            logger,
          });
        case "AWS::Neptune::DBInstance":
          return evaluateNeptuneInstance({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        case "AWS::Neptune::DBCluster":
          return evaluateNeptuneCluster({
            target,
            credentials,
            lookbackHours,
            includeCloudWatchLogChecks,
            caches,
            logger,
          });
        case "AWS::ElastiCache::CacheCluster":
          return evaluateElastiCacheCluster({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        case "AWS::ElastiCache::ReplicationGroup":
          return evaluateElastiCacheReplicationGroup({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        case "AWS::ElastiCache::SubnetGroup":
          return evaluateElastiCacheSubnetGroup({
            target,
            credentials,
            caches,
          });
        case "AWS::Redshift::Cluster":
          return evaluateRedshiftCluster({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        case "AWS::MemoryDB::Cluster":
          return evaluateMemoryDbCluster({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        case "AWS::Timestream::Database":
          return evaluateTimestreamDatabase({
            target,
            credentials,
            caches,
          });
        case "AWS::Timestream::Table":
          return evaluateTimestreamTable({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        case "AWS::Cassandra::Keyspace":
          return evaluateKeyspacesKeyspace({
            target,
            credentials,
            caches,
          });
        case "AWS::Cassandra::Table":
          return evaluateKeyspacesTable({
            target,
            credentials,
            lookbackHours,
            caches,
          });
        default:
          return createResourceResult({
            target,
            checks: [],
            errors: [`Database health checks are not implemented for ${target.resourceType}.`],
          });
      }
    })
  );
}
