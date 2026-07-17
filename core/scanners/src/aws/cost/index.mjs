import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  StartSavingsPlansPurchaseRecommendationGenerationCommand,
  GetSavingsPlansPurchaseRecommendationCommand,
  GetRightsizingRecommendationCommand,
  GetAnomalyMonitorsCommand,
  GetAnomaliesCommand,
} from "@aws-sdk/client-cost-explorer";
import { OrganizationsClient, DescribeOrganizationCommand } from "@aws-sdk/client-organizations";
import { BudgetsClient, DescribeBudgetsCommand } from "@aws-sdk/client-budgets";
import {
  CostOptimizationHubClient,
  ListEnrollmentStatusesCommand,
  ListRecommendationsCommand,
} from "@aws-sdk/client-cost-optimization-hub";
import {
  ComputeOptimizerClient,
  GetEnrollmentStatusCommand,
  GetRecommendationSummariesCommand,
} from "@aws-sdk/client-compute-optimizer";
import { safeTrim } from "@cloudagent/platform/utils";

const BILLING_REGION =
  process.env.AWS_BILLING_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_MONTHLY_LOOKBACK_MONTHS = 12;
const LINKED_ACCOUNT_LOOKBACK_DAYS = 30;
const COST_EXPLORER_METRIC = "UnblendedCost";
const CE_MAX_PAGES = 50;
const BUDGETS_MAX_PAGES = 25;
const COH_MAX_PAGES = 25;
const CO_MAX_PAGES = 25;
const CO_MAX_RESULTS = 10;
const MAX_ATTEMPTS = 5;

const STATUS = Object.freeze({
  HEALTHY: "healthy",
  PROBLEM: "problem",
  UNKNOWN: "unknown",
  ERROR: "error",
});

const SP_RECOMMENDATION_TYPES = Object.freeze([
  "COMPUTE_SP",
  "EC2_INSTANCE_SP",
  "SAGEMAKER_SP",
  "DATABASE_SP",
]);

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function createCheck({
  checkId,
  checkName,
  category,
  status,
  summary,
  details = {},
  servicesApisUsed = [],
  costImpact = "none",
}) {
  return {
    checkId,
    checkName,
    category,
    status,
    summary,
    details,
    servicesApisUsed,
    costImpact,
    checkedAt: new Date().toISOString(),
  };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildDateRangeDays({ lookbackDays = DEFAULT_LOOKBACK_DAYS } = {}) {
  const endExclusive = startOfUtcDay(new Date());
  const startInclusive = new Date(endExclusive.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return {
    startInclusive,
    endExclusive,
    startDate: formatDate(startInclusive),
    endDate: formatDate(endExclusive),
    lookbackDays,
  };
}

function buildDateRangeMonths({ lookbackMonths = DEFAULT_MONTHLY_LOOKBACK_MONTHS } = {}) {
  const endExclusive = startOfUtcDay(new Date());
  const currentMonthStart = startOfUtcMonth(endExclusive);
  const startInclusive = new Date(
    Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - lookbackMonths + 1, 1)
  );
  return {
    startInclusive,
    endExclusive,
    startDate: formatDate(startInclusive),
    endDate: formatDate(endExclusive),
    lookbackMonths,
  };
}

function errorCode(error) {
  return safeTrim(error?.code || error?.Code || error?.name || "");
}

function errorMessage(error) {
  return safeTrim(error?.message || String(error || "unknown error"));
}

function isAccessDenied(error) {
  const code = errorCode(error).toLowerCase();
  const message = errorMessage(error).toLowerCase();
  return (
    code.includes("accessdenied") ||
    code.includes("unauthorized") ||
    message.includes("access denied") ||
    message.includes("not authorized")
  );
}

function isCostExplorerDisabledError(error) {
  const code = errorCode(error).toLowerCase();
  const message = errorMessage(error).toLowerCase();
  return (
    code.includes("billingviewhealthstatus") ||
    message.includes("cost explorer is not enabled") ||
    message.includes("billing view") ||
    message.includes("enable cost explorer")
  );
}

function buildClients(credentials) {
  const awsCredentials =
    credentials?.accessKeyId && credentials?.secretAccessKey
      ? {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          ...(credentials?.sessionToken ? { sessionToken: credentials.sessionToken } : {}),
        }
      : undefined;
  const baseOptions = {
    region: BILLING_REGION,
    maxAttempts: MAX_ATTEMPTS,
    retryMode: "standard",
    ...(awsCredentials ? { credentials: awsCredentials } : {}),
  };

  return {
    ce: new CostExplorerClient(baseOptions),
    org: new OrganizationsClient(baseOptions),
    budgets: new BudgetsClient(baseOptions),
    coh: new CostOptimizationHubClient(baseOptions),
    co: new ComputeOptimizerClient(baseOptions),
  };
}

function amountFromMetric(metric) {
  return asNumber(metric?.Amount, 0);
}

function amountFromGroup(group) {
  return amountFromMetric(group?.Metrics?.[COST_EXPLORER_METRIC]);
}

async function getCostAndUsagePages({ ce, params, maxPages = CE_MAX_PAGES }) {
  const pages = [];
  let nextPageToken;
  let pageCount = 0;

  do {
    const response = await ce.send(
      new GetCostAndUsageCommand({
        ...params,
        ...(nextPageToken ? { NextPageToken: nextPageToken } : {}),
      })
    );
    pages.push(response || {});
    nextPageToken = safeTrim(response?.NextPageToken) || undefined;
    pageCount += 1;
  } while (nextPageToken && pageCount < maxPages);

  return pages;
}

function flattenResultsByTime(pages = []) {
  const out = [];
  for (const page of pages) {
    for (const day of page?.ResultsByTime || []) {
      out.push(day);
    }
  }
  return out;
}

async function detectOrganizationContext({ org, accountId }) {
  try {
    const response = await org.send(new DescribeOrganizationCommand({}));
    const organization = response?.Organization || {};
    const managementAccountId =
      safeTrim(organization?.ManagementAccountId) || safeTrim(organization?.MasterAccountId);
    const inOrganization = Boolean(safeTrim(organization?.Id));
    const isManagementAccount =
      Boolean(accountId) && Boolean(managementAccountId) && accountId === managementAccountId;

    return {
      check: createCheck({
        checkId: "org.account_context",
        checkName: "AWS Organizations account context",
        category: "configuration",
        status: STATUS.HEALTHY,
        summary: inOrganization
          ? isManagementAccount
            ? "Account is the management account for this AWS Organization."
            : "Account is in an AWS Organization but is not the management account."
          : "Account is not in an AWS Organization.",
        details: {
          dataPath: "data.organizations",
          inOrganization,
          isManagementAccount,
          organizationId: safeTrim(organization?.Id) || null,
          managementAccountId: managementAccountId || null,
          accountId: accountId || null,
          featureSet: safeTrim(organization?.FeatureSet) || null,
        },
        servicesApisUsed: ["Organizations.DescribeOrganization"],
      }),
      context: {
        inOrganization,
        isManagementAccount,
        organizationId: safeTrim(organization?.Id) || null,
        managementAccountId: managementAccountId || null,
        accountId: accountId || null,
      },
    };
  } catch (error) {
    const code = errorCode(error);
    if (code === "AWSOrganizationsNotInUseException") {
      return {
        check: createCheck({
          checkId: "org.account_context",
          checkName: "AWS Organizations account context",
          category: "configuration",
          status: STATUS.HEALTHY,
          summary: "Account is not part of an AWS Organization.",
          details: {
            dataPath: "data.organizations",
            inOrganization: false,
            isManagementAccount: false,
            accountId: accountId || null,
          },
          servicesApisUsed: ["Organizations.DescribeOrganization"],
        }),
        context: {
          inOrganization: false,
          isManagementAccount: false,
          organizationId: null,
          managementAccountId: null,
          accountId: accountId || null,
        },
      };
    }

    return {
      check: createCheck({
        checkId: "org.account_context",
        checkName: "AWS Organizations account context",
        category: "configuration",
        status: STATUS.ERROR,
        summary: `Unable to determine AWS Organizations context: ${errorMessage(error)}.`,
        details: {
          dataPath: "data.organizations",
          accountId: accountId || null,
          errorCode: code || null,
          errorMessage: errorMessage(error),
        },
        servicesApisUsed: ["Organizations.DescribeOrganization"],
      }),
      context: {
        inOrganization: null,
        isManagementAccount: null,
        organizationId: null,
        managementAccountId: null,
        accountId: accountId || null,
      },
    };
  }
}

async function checkCostExplorerEnabled({ ce }) {
  const range = buildDateRangeDays({ lookbackDays: 2 });
  try {
    await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: range.startDate,
          End: range.endDate,
        },
        Granularity: "DAILY",
        Metrics: [COST_EXPLORER_METRIC],
      })
    );

    return {
      enabled: true,
      check: createCheck({
        checkId: "ce.enabled",
        checkName: "Cost Explorer enabled",
        category: "configuration",
        status: STATUS.HEALTHY,
        summary: "Cost Explorer query succeeded.",
        details: {
          enabled: true,
          probeWindowDays: 2,
          region: BILLING_REGION,
        },
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
      }),
    };
  } catch (error) {
    const disabled = isCostExplorerDisabledError(error);
    return {
      enabled: false,
      check: createCheck({
        checkId: "ce.enabled",
        checkName: "Cost Explorer enabled",
        category: "configuration",
        status: disabled ? STATUS.PROBLEM : STATUS.ERROR,
        summary: disabled
          ? "Cost Explorer does not appear to be enabled for this account."
          : `Unable to verify Cost Explorer availability: ${errorMessage(error)}.`,
        details: {
          enabled: false,
          errorCode: errorCode(error) || null,
          errorMessage: errorMessage(error),
          accessDenied: isAccessDenied(error),
        },
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
      }),
    };
  }
}

function parseDailyTotals(entries = []) {
  return entries.map((entry) => ({
    start: safeTrim(entry?.TimePeriod?.Start) || null,
    end: safeTrim(entry?.TimePeriod?.End) || null,
    amount: amountFromMetric(entry?.Total?.[COST_EXPLORER_METRIC]),
    unit: safeTrim(entry?.Total?.[COST_EXPLORER_METRIC]?.Unit) || "USD",
    estimated: Boolean(entry?.Estimated),
  }));
}

function parseMonthlyTotals(entries = []) {
  return entries.map((entry) => ({
    start: safeTrim(entry?.TimePeriod?.Start) || null,
    end: safeTrim(entry?.TimePeriod?.End) || null,
    amount: amountFromMetric(entry?.Total?.[COST_EXPLORER_METRIC]),
    unit: safeTrim(entry?.Total?.[COST_EXPLORER_METRIC]?.Unit) || "USD",
    estimated: Boolean(entry?.Estimated),
  }));
}

function parseDailyGroups(entries = [], groupKeyLabel = "group") {
  const out = [];
  for (const entry of entries) {
    const start = safeTrim(entry?.TimePeriod?.Start) || null;
    const end = safeTrim(entry?.TimePeriod?.End) || null;
    const estimated = Boolean(entry?.Estimated);
    for (const group of entry?.Groups || []) {
      const keyValue = safeTrim(Array.isArray(group?.Keys) ? group.Keys[0] : "") || "UNKNOWN";
      out.push({
        start,
        end,
        [groupKeyLabel]: keyValue,
        amount: amountFromGroup(group),
        unit: safeTrim(group?.Metrics?.[COST_EXPLORER_METRIC]?.Unit) || "USD",
        estimated,
      });
    }
  }
  return out;
}

function parseDailyGroupsByDimensions(entries = [], groupKeyLabels = []) {
  const out = [];
  for (const entry of entries) {
    const start = safeTrim(entry?.TimePeriod?.Start) || null;
    const end = safeTrim(entry?.TimePeriod?.End) || null;
    const estimated = Boolean(entry?.Estimated);
    for (const group of entry?.Groups || []) {
      const row = {
        start,
        end,
        amount: amountFromGroup(group),
        unit: safeTrim(group?.Metrics?.[COST_EXPLORER_METRIC]?.Unit) || "USD",
        estimated,
      };
      groupKeyLabels.forEach((label, index) => {
        row[label] = safeTrim(Array.isArray(group?.Keys) ? group.Keys[index] : "") || "UNKNOWN";
      });
      out.push(row);
    }
  }
  return out;
}

async function queryDailySpendTotal({ ce, lookbackDays = DEFAULT_LOOKBACK_DAYS }) {
  const range = buildDateRangeDays({ lookbackDays });
  const pages = await getCostAndUsagePages({
    ce,
    params: {
      TimePeriod: {
        Start: range.startDate,
        End: range.endDate,
      },
      Granularity: "DAILY",
      Metrics: [COST_EXPLORER_METRIC],
    },
  });

  const daily = parseDailyTotals(flattenResultsByTime(pages));
  const totalAmount = daily.reduce((sum, row) => sum + asNumber(row.amount), 0);
  return { daily, totalAmount, range };
}

async function queryDailySpendByService({ ce, lookbackDays = DEFAULT_LOOKBACK_DAYS }) {
  const range = buildDateRangeDays({ lookbackDays });
  const pages = await getCostAndUsagePages({
    ce,
    params: {
      TimePeriod: {
        Start: range.startDate,
        End: range.endDate,
      },
      Granularity: "DAILY",
      Metrics: [COST_EXPLORER_METRIC],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
    },
  });

  const rows = parseDailyGroups(flattenResultsByTime(pages), "service");
  return { rows, range };
}

async function queryDailySpendByLinkedAccount({ ce, lookbackDays = DEFAULT_LOOKBACK_DAYS }) {
  const range = buildDateRangeDays({ lookbackDays });
  const pages = await getCostAndUsagePages({
    ce,
    params: {
      TimePeriod: {
        Start: range.startDate,
        End: range.endDate,
      },
      Granularity: "DAILY",
      Metrics: [COST_EXPLORER_METRIC],
      GroupBy: [{ Type: "DIMENSION", Key: "LINKED_ACCOUNT" }],
    },
  });

  const rows = parseDailyGroups(flattenResultsByTime(pages), "linkedAccountId");
  return { rows, range };
}

async function queryDailySpendByServiceAndLinkedAccount({
  ce,
  lookbackDays = LINKED_ACCOUNT_LOOKBACK_DAYS,
}) {
  const range = buildDateRangeDays({ lookbackDays });
  const pages = await getCostAndUsagePages({
    ce,
    params: {
      TimePeriod: {
        Start: range.startDate,
        End: range.endDate,
      },
      Granularity: "DAILY",
      Metrics: [COST_EXPLORER_METRIC],
      GroupBy: [
        { Type: "DIMENSION", Key: "SERVICE" },
        { Type: "DIMENSION", Key: "LINKED_ACCOUNT" },
      ],
    },
  });

  const rows = parseDailyGroupsByDimensions(
    flattenResultsByTime(pages),
    ["service", "linkedAccountId"]
  );
  return { rows, range };
}

async function queryMonthlySpendTotal({ ce, lookbackMonths = DEFAULT_MONTHLY_LOOKBACK_MONTHS }) {
  const range = buildDateRangeMonths({ lookbackMonths });
  const pages = await getCostAndUsagePages({
    ce,
    params: {
      TimePeriod: {
        Start: range.startDate,
        End: range.endDate,
      },
      Granularity: "MONTHLY",
      Metrics: [COST_EXPLORER_METRIC],
    },
  });

  const monthly = parseMonthlyTotals(flattenResultsByTime(pages));
  const totalAmount = monthly.reduce((sum, row) => sum + asNumber(row.amount), 0);
  return { monthly, totalAmount, range };
}

async function getSavingsPlansRecommendations({ ce, accountScope = "LINKED" }) {
  const generationResult = {
    started: false,
    errorCode: null,
    errorMessage: null,
  };
  try {
    await ce.send(new StartSavingsPlansPurchaseRecommendationGenerationCommand({}));
    generationResult.started = true;
  } catch (error) {
    generationResult.errorCode = errorCode(error) || null;
    generationResult.errorMessage = errorMessage(error);
  }

  const recommendationsByType = [];
  const errors = [];

  for (const savingsPlansType of SP_RECOMMENDATION_TYPES) {
    let nextPageToken;
    let pageCount = 0;
    const pages = [];

    try {
      do {
        const response = await ce.send(
          new GetSavingsPlansPurchaseRecommendationCommand({
            SavingsPlansType: savingsPlansType,
            TermInYears: "ONE_YEAR",
            PaymentOption: "NO_UPFRONT",
            AccountScope: accountScope,
            LookbackPeriodInDays: "THIRTY_DAYS",
            PageSize: 20,
            ...(nextPageToken ? { NextPageToken: nextPageToken } : {}),
          })
        );

        pages.push(response || {});
        nextPageToken = safeTrim(response?.NextPageToken) || undefined;
        pageCount += 1;
      } while (nextPageToken && pageCount < CE_MAX_PAGES);

      const details = pages.flatMap(
        (page) =>
          page?.SavingsPlansPurchaseRecommendation?.SavingsPlansPurchaseRecommendationDetails || []
      );
      const summary = pages[0]?.SavingsPlansPurchaseRecommendation || {};
      recommendationsByType.push({
        savingsPlansType,
        recommendationCount: details.length,
        estimatedMonthlySavingsAmount:
          asNumber(summary?.EstimatedMonthlySavingsAmount) ||
          asNumber(summary?.EstimatedSavingsAmount),
        currencyCode: safeTrim(summary?.CurrencyCode) || "USD",
        recommendationSummary: summary,
        details,
      });
    } catch (error) {
      errors.push({
        savingsPlansType,
        errorCode: errorCode(error) || null,
        errorMessage: errorMessage(error),
      });
    }
  }

  return {
    generationResult,
    recommendationsByType,
    errors,
  };
}

async function getRightsizingRecommendations({ ce }) {
  const recommendations = [];
  let nextPageToken;
  let pageCount = 0;
  let summary = null;

  do {
    const response = await ce.send(
      new GetRightsizingRecommendationCommand({
        Service: "AmazonEC2",
        PageSize: 20,
        ...(nextPageToken ? { NextPageToken: nextPageToken } : {}),
      })
    );
    if (!summary) summary = response?.Summary || null;
    recommendations.push(...(response?.RightsizingRecommendations || []));
    nextPageToken = safeTrim(response?.NextPageToken) || undefined;
    pageCount += 1;
  } while (nextPageToken && pageCount < CE_MAX_PAGES);

  return { recommendations, summary };
}

async function getBudgetsConfiguration({ budgets, accountId }) {
  const allBudgets = [];
  let nextToken;
  let pageCount = 0;

  do {
    const response = await budgets.send(
      new DescribeBudgetsCommand({
        AccountId: accountId,
        MaxResults: 100,
        ...(nextToken ? { NextToken: nextToken } : {}),
      })
    );
    allBudgets.push(...(response?.Budgets || []));
    nextToken = safeTrim(response?.NextToken) || undefined;
    pageCount += 1;
  } while (nextToken && pageCount < BUDGETS_MAX_PAGES);

  return allBudgets;
}

async function getAnomalyConfigurationAndFindings({
  ce,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
}) {
  const monitors = [];
  let nextPageToken;
  let pageCount = 0;
  do {
    const response = await ce.send(
      new GetAnomalyMonitorsCommand({
        MaxResults: 100,
        ...(nextPageToken ? { NextPageToken: nextPageToken } : {}),
      })
    );
    monitors.push(...(response?.AnomalyMonitors || []));
    nextPageToken = safeTrim(response?.NextPageToken) || undefined;
    pageCount += 1;
  } while (nextPageToken && pageCount < CE_MAX_PAGES);

  const range = buildDateRangeDays({ lookbackDays });
  const anomalies = [];
  if (monitors.length > 0) {
    let anomaliesToken;
    let anomalyPages = 0;
    do {
      const response = await ce.send(
        new GetAnomaliesCommand({
          DateInterval: {
            StartDate: range.startDate,
            EndDate: range.endDate,
          },
          MaxResults: 100,
          ...(anomaliesToken ? { NextPageToken: anomaliesToken } : {}),
        })
      );
      anomalies.push(...(response?.Anomalies || []));
      anomaliesToken = safeTrim(response?.NextPageToken) || undefined;
      anomalyPages += 1;
    } while (anomaliesToken && anomalyPages < CE_MAX_PAGES);
  }

  return { monitors, anomalies, range };
}

function isEnabledStatus(value) {
  const status = safeTrim(value).toUpperCase();
  return ["ACTIVE", "ENABLED", "ENROLLED", "OPTED_IN", "OPT_IN", "ON"].includes(status);
}

async function getCostOptimizationHubStatusAndRecommendations({ coh, accountId }) {
  const enrollmentResponse = await coh.send(
    new ListEnrollmentStatusesCommand({
      accountId,
      includeOrganizationInfo: true,
      maxResults: 100,
    })
  );
  const enrollments = Array.isArray(enrollmentResponse?.items) ? enrollmentResponse.items : [];
  const enabled = enrollments.some((item) => isEnabledStatus(item?.status));

  const recommendations = [];
  if (enabled) {
    let nextToken;
    let pageCount = 0;
    do {
      const response = await coh.send(
        new ListRecommendationsCommand({
          includeAllRecommendations: false,
          maxResults: 100,
          ...(nextToken ? { nextToken } : {}),
        })
      );
      recommendations.push(...(response?.items || []));
      nextToken = safeTrim(response?.nextToken) || undefined;
      pageCount += 1;
    } while (nextToken && pageCount < COH_MAX_PAGES);
  }

  return { enrollments, enabled, recommendations };
}

async function getComputeOptimizerStatusAndSummaries({ co, accountId, isManagementAccount }) {
  const enrollment = await co.send(new GetEnrollmentStatusCommand({}));
  const enabled = isEnabledStatus(enrollment?.status);

  const recommendationSummaries = [];
  if (enabled) {
    let nextToken;
    let pageCount = 0;
    do {
      const response = await co.send(
        new GetRecommendationSummariesCommand({
          ...(isManagementAccount ? { accountIds: [accountId] } : {}),
          maxResults: CO_MAX_RESULTS,
          ...(nextToken ? { nextToken } : {}),
        })
      );
      recommendationSummaries.push(...(response?.recommendationSummaries || []));
      nextToken = safeTrim(response?.nextToken) || undefined;
      pageCount += 1;
    } while (nextToken && pageCount < CO_MAX_PAGES);
  }

  return { enrollment, enabled, recommendationSummaries };
}

function buildSkippedCheck({
  checkId,
  checkName,
  category,
  reason,
  dataPath,
  servicesApisUsed = [],
  costImpact = "none",
}) {
  return createCheck({
    checkId,
    checkName,
    category,
    status: STATUS.UNKNOWN,
    summary: reason,
    details: { skipped: true, ...(dataPath ? { dataPath } : {}) },
    servicesApisUsed,
    costImpact,
  });
}

export async function runAwsCostAnalysis({
  accountId,
  credentials,
  logger,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
} = {}) {
  const checks = [];
  const errors = [];
  const data = {
    spend: {
      dailyTotal: [],
      monthlyTotal12m: [],
      dailyByService: [],
      dailyByLinkedAccount: [],
      dailyByServiceLinkedAccount: [],
      range: null,
      monthlyRange12m: null,
      linkedAccountRange30d: null,
    },
    savingsPlans: {
      recommendationGeneration: null,
      recommendationsByType: [],
      errors: [],
    },
    rightsizing: {
      recommendations: [],
      summary: null,
    },
    budgets: {
      configured: false,
      count: 0,
    },
    anomalyDetection: {
      configured: false,
      monitorCount: 0,
      monitors: [],
      anomalies: [],
      range: null,
    },
    organizations: {
      inOrganization: null,
      isManagementAccount: null,
      organizationId: null,
      managementAccountId: null,
      accountId: accountId || null,
    },
    costOptimizationHub: {
      enabled: false,
      enrollments: [],
      recommendations: [],
    },
    computeOptimizer: {
      enabled: false,
      enrollment: null,
      recommendationSummaries: [],
    },
  };

  const clients = buildClients(credentials);

  const orgContext = await detectOrganizationContext({
    org: clients.org,
    accountId,
  });
  checks.push(orgContext.check);
  data.organizations = orgContext.context;

  const ceEnabled = await checkCostExplorerEnabled({ ce: clients.ce });
  checks.push(ceEnabled.check);

  if (ceEnabled.enabled) {
    try {
      const spendTotal = await queryDailySpendTotal({
        ce: clients.ce,
        lookbackDays,
      });
      data.spend.dailyTotal = spendTotal.daily;
      data.spend.range = spendTotal.range;
      checks.push(
        createCheck({
          checkId: "ce.spend.daily_total_90d",
          checkName: "Daily total spend",
          category: "spend",
          status: STATUS.HEALTHY,
          summary: `Retrieved ${spendTotal.daily.length} daily spend points for the last ${lookbackDays} days.`,
          details: {
            dataPath: "data.spend.dailyTotal",
            lookbackDays,
            dataPoints: spendTotal.daily.length,
            totalUnblendedCost: spendTotal.totalAmount,
          },
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
    } catch (error) {
      errors.push(`Daily total spend query failed: ${errorMessage(error)}`);
      checks.push(
        createCheck({
          checkId: "ce.spend.daily_total_90d",
          checkName: "Daily total spend",
          category: "spend",
          status: STATUS.ERROR,
          summary: `Unable to retrieve daily total spend: ${errorMessage(error)}.`,
          details: {
            dataPath: "data.spend.dailyTotal",
            errorCode: errorCode(error) || null,
          },
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
    }

    try {
      const spendMonthly = await queryMonthlySpendTotal({
        ce: clients.ce,
      });
      data.spend.monthlyTotal12m = spendMonthly.monthly;
      data.spend.monthlyRange12m = spendMonthly.range;
      checks.push(
        createCheck({
          checkId: "ce.spend.monthly_total_12m",
          checkName: "Monthly total spend for past 12 months",
          category: "spend",
          status: STATUS.HEALTHY,
          summary: `Retrieved ${spendMonthly.monthly.length} monthly spend points for the last ${spendMonthly.range.lookbackMonths} months.`,
          details: {
            dataPath: "data.spend.monthlyTotal12m",
            lookbackMonths: spendMonthly.range.lookbackMonths,
            dataPoints: spendMonthly.monthly.length,
            totalUnblendedCost: spendMonthly.totalAmount,
          },
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
    } catch (error) {
      errors.push(`Monthly total spend query failed: ${errorMessage(error)}`);
      checks.push(
        createCheck({
          checkId: "ce.spend.monthly_total_12m",
          checkName: "Monthly total spend for past 12 months",
          category: "spend",
          status: STATUS.ERROR,
          summary: `Unable to retrieve monthly total spend: ${errorMessage(error)}.`,
          details: {
            dataPath: "data.spend.monthlyTotal12m",
            errorCode: errorCode(error) || null,
          },
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
    }

    try {
      const spendByService = await queryDailySpendByService({
        ce: clients.ce,
        lookbackDays,
      });
      data.spend.dailyByService = spendByService.rows;
      if (!data.spend.range) data.spend.range = spendByService.range;
      checks.push(
        createCheck({
          checkId: "ce.spend.daily_by_service_90d",
          checkName: "Daily spend by service",
          category: "spend",
          status: STATUS.HEALTHY,
          summary: `Retrieved ${spendByService.rows.length} daily service cost rows.`,
          details: {
            dataPath: "data.spend.dailyByService",
            lookbackDays,
            rowCount: spendByService.rows.length,
          },
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
    } catch (error) {
      errors.push(`Daily spend by service query failed: ${errorMessage(error)}`);
      checks.push(
        createCheck({
          checkId: "ce.spend.daily_by_service_90d",
          checkName: "Daily spend by service",
          category: "spend",
          status: STATUS.ERROR,
          summary: `Unable to retrieve daily spend by service: ${errorMessage(error)}.`,
          details: {
            dataPath: "data.spend.dailyByService",
            errorCode: errorCode(error) || null,
          },
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
    }

    if (orgContext.context.isManagementAccount === true) {
      try {
        const spendByLinkedAccount = await queryDailySpendByLinkedAccount({
          ce: clients.ce,
          lookbackDays: LINKED_ACCOUNT_LOOKBACK_DAYS,
        });
        data.spend.dailyByLinkedAccount = spendByLinkedAccount.rows;
        data.spend.linkedAccountRange30d = spendByLinkedAccount.range;
        checks.push(
          createCheck({
            checkId: "ce.spend.daily_by_linked_account_30d",
            checkName: "Daily spend by linked account",
            category: "spend",
            status: STATUS.HEALTHY,
            summary: `Retrieved ${spendByLinkedAccount.rows.length} linked-account daily cost rows for the last ${LINKED_ACCOUNT_LOOKBACK_DAYS} days.`,
            details: {
              dataPath: "data.spend.dailyByLinkedAccount",
              lookbackDays: LINKED_ACCOUNT_LOOKBACK_DAYS,
              rowCount: spendByLinkedAccount.rows.length,
            },
            servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
            costImpact: "paid-api",
          })
        );
      } catch (error) {
        errors.push(`Daily spend by linked account query failed: ${errorMessage(error)}`);
        checks.push(
          createCheck({
            checkId: "ce.spend.daily_by_linked_account_30d",
            checkName: "Daily spend by linked account",
            category: "spend",
            status: STATUS.ERROR,
            summary: `Unable to retrieve daily spend by linked account: ${errorMessage(error)}.`,
            details: {
              dataPath: "data.spend.dailyByLinkedAccount",
              errorCode: errorCode(error) || null,
            },
            servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
            costImpact: "paid-api",
          })
        );
      }

      try {
        const spendByServiceLinkedAccount = await queryDailySpendByServiceAndLinkedAccount({
          ce: clients.ce,
          lookbackDays: LINKED_ACCOUNT_LOOKBACK_DAYS,
        });
        data.spend.dailyByServiceLinkedAccount = spendByServiceLinkedAccount.rows;
        if (!data.spend.linkedAccountRange30d) {
          data.spend.linkedAccountRange30d = spendByServiceLinkedAccount.range;
        }
        checks.push(
          createCheck({
            checkId: "ce.spend.daily_by_service_linked_account_30d",
            checkName: "Daily spend by service and linked account",
            category: "spend",
            status: STATUS.HEALTHY,
            summary: `Retrieved ${spendByServiceLinkedAccount.rows.length} service-by-linked-account daily cost rows for the last ${LINKED_ACCOUNT_LOOKBACK_DAYS} days.`,
            details: {
              dataPath: "data.spend.dailyByServiceLinkedAccount",
              lookbackDays: LINKED_ACCOUNT_LOOKBACK_DAYS,
              rowCount: spendByServiceLinkedAccount.rows.length,
            },
            servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
            costImpact: "paid-api",
          })
        );
      } catch (error) {
        errors.push(`Daily spend by service and linked account query failed: ${errorMessage(error)}`);
        checks.push(
          createCheck({
            checkId: "ce.spend.daily_by_service_linked_account_30d",
            checkName: "Daily spend by service and linked account",
            category: "spend",
            status: STATUS.ERROR,
            summary: `Unable to retrieve daily spend by service and linked account: ${errorMessage(error)}.`,
            details: {
              dataPath: "data.spend.dailyByServiceLinkedAccount",
              errorCode: errorCode(error) || null,
            },
            servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
            costImpact: "paid-api",
          })
        );
      }
    } else {
      checks.push(
        buildSkippedCheck({
          checkId: "ce.spend.daily_by_linked_account_30d",
          checkName: "Daily spend by linked account",
          category: "spend",
          reason:
            orgContext.context.isManagementAccount === false
              ? "Skipped because account is not an AWS Organizations management account."
              : "Skipped because AWS Organizations management-account status is unknown.",
          dataPath: "data.spend.dailyByLinkedAccount",
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
      checks.push(
        buildSkippedCheck({
          checkId: "ce.spend.daily_by_service_linked_account_30d",
          checkName: "Daily spend by service and linked account",
          category: "spend",
          reason:
            orgContext.context.isManagementAccount === false
              ? "Skipped because account is not an AWS Organizations management account."
              : "Skipped because AWS Organizations management-account status is unknown.",
          dataPath: "data.spend.dailyByServiceLinkedAccount",
          servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
          costImpact: "paid-api",
        })
      );
    }

    try {
      const accountScope = orgContext.context.isManagementAccount ? "PAYER" : "LINKED";
      const sp = await getSavingsPlansRecommendations({
        ce: clients.ce,
        accountScope,
      });
      data.savingsPlans.recommendationGeneration = sp.generationResult;
      data.savingsPlans.recommendationsByType = sp.recommendationsByType;
      data.savingsPlans.errors = sp.errors;
      const recommendationCount = sp.recommendationsByType.reduce(
        (sum, entry) => sum + asNumber(entry?.recommendationCount),
        0
      );
      const status = recommendationCount > 0 ? STATUS.PROBLEM : STATUS.HEALTHY;
      checks.push(
        createCheck({
          checkId: "ce.savings_plans.recommendations",
          checkName: "Savings Plans recommendations",
          category: "optimization",
          status,
          summary:
            status === STATUS.HEALTHY
              ? "No Savings Plans purchase recommendations were returned."
              : `Found ${recommendationCount} Savings Plans purchase recommendations.`,
          details: {
            dataPath: "data.savingsPlans",
            accountScope,
            recommendationCount,
            generationResult: sp.generationResult,
            errors: sp.errors,
          },
          servicesApisUsed: [
            "CostExplorer.StartSavingsPlansPurchaseRecommendationGeneration",
            "CostExplorer.GetSavingsPlansPurchaseRecommendation",
          ],
          costImpact: "paid-api",
        })
      );
    } catch (error) {
      errors.push(`Savings Plans recommendations query failed: ${errorMessage(error)}`);
      checks.push(
        createCheck({
          checkId: "ce.savings_plans.recommendations",
          checkName: "Savings Plans recommendations",
          category: "optimization",
          status: STATUS.ERROR,
          summary: `Unable to retrieve Savings Plans recommendations: ${errorMessage(error)}.`,
          details: {
            dataPath: "data.savingsPlans",
            errorCode: errorCode(error) || null,
          },
          servicesApisUsed: [
            "CostExplorer.StartSavingsPlansPurchaseRecommendationGeneration",
            "CostExplorer.GetSavingsPlansPurchaseRecommendation",
          ],
          costImpact: "paid-api",
        })
      );
    }

    try {
      const rightsizing = await getRightsizingRecommendations({ ce: clients.ce });
      data.rightsizing.recommendations = rightsizing.recommendations;
      data.rightsizing.summary = rightsizing.summary;
      const recommendationCount = rightsizing.recommendations.length;
      checks.push(
        createCheck({
          checkId: "ce.rightsizing.recommendations_ec2",
          checkName: "EC2 rightsizing recommendations",
          category: "optimization",
          status: recommendationCount > 0 ? STATUS.PROBLEM : STATUS.HEALTHY,
          summary:
            recommendationCount > 0
              ? `Found ${recommendationCount} EC2 rightsizing recommendations.`
              : "No EC2 rightsizing recommendations were returned.",
          details: {
            dataPath: "data.rightsizing",
            service: "AmazonEC2",
            recommendationCount,
            summary: rightsizing.summary,
          },
          servicesApisUsed: ["CostExplorer.GetRightsizingRecommendation"],
          costImpact: "paid-api",
        })
      );
    } catch (error) {
      errors.push(`Rightsizing recommendations query failed: ${errorMessage(error)}`);
      checks.push(
        createCheck({
          checkId: "ce.rightsizing.recommendations_ec2",
          checkName: "EC2 rightsizing recommendations",
          category: "optimization",
          status: STATUS.ERROR,
          summary: `Unable to retrieve EC2 rightsizing recommendations: ${errorMessage(error)}.`,
          details: {
            dataPath: "data.rightsizing",
            errorCode: errorCode(error) || null,
          },
          servicesApisUsed: ["CostExplorer.GetRightsizingRecommendation"],
          costImpact: "paid-api",
        })
      );
    }

    try {
      const anomalyData = await getAnomalyConfigurationAndFindings({
        ce: clients.ce,
        lookbackDays,
      });
      data.anomalyDetection.configured = anomalyData.monitors.length > 0;
      data.anomalyDetection.monitorCount = anomalyData.monitors.length;
      data.anomalyDetection.monitors = anomalyData.monitors;
      data.anomalyDetection.anomalies = anomalyData.anomalies;
      data.anomalyDetection.range = anomalyData.range;

      checks.push(
        createCheck({
          checkId: "ce.anomaly_detection.configured",
          checkName: "Cost anomaly detection configured",
          category: "configuration",
          status: anomalyData.monitors.length > 0 ? STATUS.HEALTHY : STATUS.PROBLEM,
          summary:
            anomalyData.monitors.length > 0
              ? `Cost anomaly detection is configured with ${anomalyData.monitors.length} monitor(s).`
              : "No cost anomaly detection monitors are configured.",
          details: {
            dataPath: "data.anomalyDetection",
            configured: anomalyData.monitors.length > 0,
            monitorCount: anomalyData.monitors.length,
          },
          servicesApisUsed: ["CostExplorer.GetAnomalyMonitors"],
          costImpact: "paid-api",
        })
      );

      if (anomalyData.monitors.length > 0) {
        checks.push(
          createCheck({
            checkId: "ce.anomaly_detection.findings_recent",
            checkName: "Recent cost anomalies",
            category: "anomaly",
            status: anomalyData.anomalies.length > 0 ? STATUS.PROBLEM : STATUS.HEALTHY,
            summary:
              anomalyData.anomalies.length > 0
                ? `Found ${anomalyData.anomalies.length} anomaly finding(s) in the last ${lookbackDays} days.`
                : `No cost anomaly findings in the last ${lookbackDays} days.`,
            details: {
              dataPath: "data.anomalyDetection.anomalies",
              lookbackDays,
              anomalyCount: anomalyData.anomalies.length,
              monitorCount: anomalyData.monitors.length,
            },
            servicesApisUsed: ["CostExplorer.GetAnomalies"],
            costImpact: "paid-api",
          })
        );
      } else {
        checks.push(
          buildSkippedCheck({
            checkId: "ce.anomaly_detection.findings_recent",
            checkName: "Recent cost anomalies",
            category: "anomaly",
            reason: "Skipped because cost anomaly detection monitors are not configured.",
            dataPath: "data.anomalyDetection.anomalies",
            servicesApisUsed: ["CostExplorer.GetAnomalies"],
            costImpact: "paid-api",
          })
        );
      }
    } catch (error) {
      errors.push(`Cost anomaly detection query failed: ${errorMessage(error)}`);
      checks.push(
        createCheck({
          checkId: "ce.anomaly_detection.configured",
          checkName: "Cost anomaly detection configured",
          category: "configuration",
          status: STATUS.ERROR,
          summary: `Unable to determine anomaly monitor configuration: ${errorMessage(error)}.`,
          details: {
            dataPath: "data.anomalyDetection",
            errorCode: errorCode(error) || null,
          },
          servicesApisUsed: ["CostExplorer.GetAnomalyMonitors"],
          costImpact: "paid-api",
        })
      );
      checks.push(
        createCheck({
          checkId: "ce.anomaly_detection.findings_recent",
          checkName: "Recent cost anomalies",
          category: "anomaly",
          status: STATUS.ERROR,
          summary: `Unable to retrieve recent anomalies: ${errorMessage(error)}.`,
          details: {
            dataPath: "data.anomalyDetection.anomalies",
            errorCode: errorCode(error) || null,
          },
          servicesApisUsed: ["CostExplorer.GetAnomalies"],
          costImpact: "paid-api",
        })
      );
    }
  } else {
    checks.push(
      buildSkippedCheck({
        checkId: "ce.spend.daily_total_90d",
        checkName: "Daily total spend",
        category: "spend",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.spend.dailyTotal",
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.spend.monthly_total_12m",
        checkName: "Monthly total spend for past 12 months",
        category: "spend",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.spend.monthlyTotal12m",
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.spend.daily_by_service_90d",
        checkName: "Daily spend by service",
        category: "spend",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.spend.dailyByService",
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.spend.daily_by_linked_account_30d",
        checkName: "Daily spend by linked account",
        category: "spend",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.spend.dailyByLinkedAccount",
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.spend.daily_by_service_linked_account_30d",
        checkName: "Daily spend by service and linked account",
        category: "spend",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.spend.dailyByServiceLinkedAccount",
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.savings_plans.recommendations",
        checkName: "Savings Plans recommendations",
        category: "optimization",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.savingsPlans",
        servicesApisUsed: [
          "CostExplorer.StartSavingsPlansPurchaseRecommendationGeneration",
          "CostExplorer.GetSavingsPlansPurchaseRecommendation",
        ],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.rightsizing.recommendations_ec2",
        checkName: "EC2 rightsizing recommendations",
        category: "optimization",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.rightsizing",
        servicesApisUsed: ["CostExplorer.GetRightsizingRecommendation"],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.anomaly_detection.configured",
        checkName: "Cost anomaly detection configured",
        category: "configuration",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.anomalyDetection",
        servicesApisUsed: ["CostExplorer.GetAnomalyMonitors"],
        costImpact: "paid-api",
      })
    );
    checks.push(
      buildSkippedCheck({
        checkId: "ce.anomaly_detection.findings_recent",
        checkName: "Recent cost anomalies",
        category: "anomaly",
        reason: "Skipped because Cost Explorer is not enabled or not accessible.",
        dataPath: "data.anomalyDetection.anomalies",
        servicesApisUsed: ["CostExplorer.GetAnomalies"],
        costImpact: "paid-api",
      })
    );
  }

  try {
    const budgets = await getBudgetsConfiguration({
      budgets: clients.budgets,
      accountId,
    });
    data.budgets.configured = budgets.length > 0;
    data.budgets.count = budgets.length;

    checks.push(
      createCheck({
        checkId: "budgets.configured",
        checkName: "AWS Budgets configured",
        category: "configuration",
        status: budgets.length > 0 ? STATUS.HEALTHY : STATUS.PROBLEM,
        summary:
          budgets.length > 0
            ? `Found ${budgets.length} configured budget(s).`
            : "No AWS Budgets are configured.",
        details: {
          dataPath: "data.budgets",
          configured: budgets.length > 0,
          budgetCount: budgets.length,
        },
        servicesApisUsed: ["Budgets.DescribeBudgets"],
      })
    );
  } catch (error) {
    errors.push(`Budgets configuration query failed: ${errorMessage(error)}`);
    checks.push(
      createCheck({
        checkId: "budgets.configured",
        checkName: "AWS Budgets configured",
        category: "configuration",
        status: STATUS.ERROR,
        summary: `Unable to determine budgets configuration: ${errorMessage(error)}.`,
        details: {
          dataPath: "data.budgets",
          errorCode: errorCode(error) || null,
        },
        servicesApisUsed: ["Budgets.DescribeBudgets"],
      })
    );
  }

  try {
    const cohData = await getCostOptimizationHubStatusAndRecommendations({
      coh: clients.coh,
      accountId,
    });
    data.costOptimizationHub.enabled = cohData.enabled;
    data.costOptimizationHub.enrollments = cohData.enrollments;
    data.costOptimizationHub.recommendations = cohData.recommendations;

    checks.push(
      createCheck({
        checkId: "cost_optimization_hub.enabled",
        checkName: "Cost Optimization Hub enabled",
        category: "configuration",
        status: cohData.enabled ? STATUS.HEALTHY : STATUS.PROBLEM,
        summary: cohData.enabled
          ? "Cost Optimization Hub is enabled."
          : "Cost Optimization Hub is not enabled.",
        details: {
          dataPath: "data.costOptimizationHub",
          enabled: cohData.enabled,
          enrollmentCount: cohData.enrollments.length,
        },
        servicesApisUsed: ["CostOptimizationHub.ListEnrollmentStatuses"],
      })
    );

    if (cohData.enabled) {
      checks.push(
        createCheck({
          checkId: "cost_optimization_hub.recommendations",
          checkName: "Cost Optimization Hub recommendations",
          category: "optimization",
          status: cohData.recommendations.length > 0 ? STATUS.PROBLEM : STATUS.HEALTHY,
          summary:
            cohData.recommendations.length > 0
              ? `Found ${cohData.recommendations.length} Cost Optimization Hub recommendations.`
              : "No Cost Optimization Hub recommendations returned.",
          details: {
            dataPath: "data.costOptimizationHub.recommendations",
            recommendationCount: cohData.recommendations.length,
          },
          servicesApisUsed: ["CostOptimizationHub.ListRecommendations"],
        })
      );
    } else {
      checks.push(
        buildSkippedCheck({
          checkId: "cost_optimization_hub.recommendations",
          checkName: "Cost Optimization Hub recommendations",
          category: "optimization",
          reason: "Skipped because Cost Optimization Hub is not enabled.",
          dataPath: "data.costOptimizationHub.recommendations",
          servicesApisUsed: ["CostOptimizationHub.ListRecommendations"],
        })
      );
    }
  } catch (error) {
    errors.push(`Cost Optimization Hub query failed: ${errorMessage(error)}`);
    checks.push(
      createCheck({
        checkId: "cost_optimization_hub.enabled",
        checkName: "Cost Optimization Hub enabled",
        category: "configuration",
        status: STATUS.ERROR,
        summary: `Unable to determine Cost Optimization Hub enrollment: ${errorMessage(error)}.`,
        details: {
          dataPath: "data.costOptimizationHub",
          errorCode: errorCode(error) || null,
        },
        servicesApisUsed: ["CostOptimizationHub.ListEnrollmentStatuses"],
      })
    );
    checks.push(
      createCheck({
        checkId: "cost_optimization_hub.recommendations",
        checkName: "Cost Optimization Hub recommendations",
        category: "optimization",
        status: STATUS.ERROR,
        summary: `Unable to retrieve Cost Optimization Hub recommendations: ${errorMessage(error)}.`,
        details: {
          dataPath: "data.costOptimizationHub.recommendations",
          errorCode: errorCode(error) || null,
        },
        servicesApisUsed: ["CostOptimizationHub.ListRecommendations"],
      })
    );
  }

  try {
    const coData = await getComputeOptimizerStatusAndSummaries({
      co: clients.co,
      accountId,
      isManagementAccount: orgContext.context.isManagementAccount === true,
    });
    data.computeOptimizer.enabled = coData.enabled;
    data.computeOptimizer.enrollment = coData.enrollment;
    data.computeOptimizer.recommendationSummaries = coData.recommendationSummaries;

    checks.push(
      createCheck({
        checkId: "compute_optimizer.enabled",
        checkName: "Compute Optimizer enabled",
        category: "configuration",
        status: coData.enabled ? STATUS.HEALTHY : STATUS.PROBLEM,
        summary: coData.enabled
          ? "Compute Optimizer is enabled."
          : "Compute Optimizer is not enabled.",
        details: {
          dataPath: "data.computeOptimizer",
          enabled: coData.enabled,
          status: safeTrim(coData.enrollment?.status) || null,
          statusReason: safeTrim(coData.enrollment?.statusReason) || null,
        },
        servicesApisUsed: ["ComputeOptimizer.GetEnrollmentStatus"],
      })
    );

    if (coData.enabled) {
      checks.push(
        createCheck({
          checkId: "compute_optimizer.recommendation_summaries",
          checkName: "Compute Optimizer recommendation summaries",
          category: "optimization",
          status: coData.recommendationSummaries.length > 0 ? STATUS.PROBLEM : STATUS.HEALTHY,
          summary:
            coData.recommendationSummaries.length > 0
              ? `Found ${coData.recommendationSummaries.length} Compute Optimizer recommendation summaries.`
              : "No Compute Optimizer recommendation summaries returned.",
          details: {
            dataPath: "data.computeOptimizer.recommendationSummaries",
            summaryCount: coData.recommendationSummaries.length,
          },
          servicesApisUsed: ["ComputeOptimizer.GetRecommendationSummaries"],
        })
      );
    } else {
      checks.push(
        buildSkippedCheck({
          checkId: "compute_optimizer.recommendation_summaries",
          checkName: "Compute Optimizer recommendation summaries",
          category: "optimization",
          reason: "Skipped because Compute Optimizer is not enabled.",
          dataPath: "data.computeOptimizer.recommendationSummaries",
          servicesApisUsed: ["ComputeOptimizer.GetRecommendationSummaries"],
        })
      );
    }
  } catch (error) {
    errors.push(`Compute Optimizer query failed: ${errorMessage(error)}`);
    checks.push(
      createCheck({
        checkId: "compute_optimizer.enabled",
        checkName: "Compute Optimizer enabled",
        category: "configuration",
        status: STATUS.ERROR,
        summary: `Unable to determine Compute Optimizer enrollment: ${errorMessage(error)}.`,
        details: {
          dataPath: "data.computeOptimizer",
          errorCode: errorCode(error) || null,
        },
        servicesApisUsed: ["ComputeOptimizer.GetEnrollmentStatus"],
      })
    );
    checks.push(
      createCheck({
        checkId: "compute_optimizer.recommendation_summaries",
        checkName: "Compute Optimizer recommendation summaries",
        category: "optimization",
        status: STATUS.ERROR,
        summary: `Unable to retrieve Compute Optimizer recommendation summaries: ${errorMessage(error)}.`,
        details: {
          dataPath: "data.computeOptimizer.recommendationSummaries",
          errorCode: errorCode(error) || null,
        },
        servicesApisUsed: ["ComputeOptimizer.GetRecommendationSummaries"],
      })
    );
  }

  const statusCounts = checks.reduce((acc, check) => {
    const key = safeTrim(check?.status) || STATUS.UNKNOWN;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const callCostNotes = [
    {
      callFamily: "CostExplorer.*",
      impact: "paid-api",
      note: "AWS Cost Explorer API requests are billed per request.",
    },
    {
      callFamily: "Budgets.*, Organizations.*, CostOptimizationHub.*, ComputeOptimizer.*",
      impact: "no-extra-api-fee-expected",
      note: "No separate per-request API billing is generally applied, but service-specific pricing still applies.",
    },
  ];

  logger?.info?.("[cost-scanner] completed", {
    accountId,
    checkCount: checks.length,
    statusCounts,
    errors: errors.length,
  });

  return {
    version: "2026-03-18",
    generatedAt: new Date().toISOString(),
    accountId: accountId || null,
    lookbackDays,
    checks,
    statusCounts,
    errors,
    data,
    callCostNotes,
  };
}
