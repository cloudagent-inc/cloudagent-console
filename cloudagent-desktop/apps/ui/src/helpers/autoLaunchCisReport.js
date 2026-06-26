import { initiateAssessment } from '../api/assessments';
import { refreshUserCredits } from '../features/agent/agentSlice';
import { refreshAccountScans } from '../features/auth/authSlice';
import { normalizeReportId } from './reportId';
import toast from 'react-hot-toast';

const AWS_CIS_PLAN_ID = 'report_compliance_aws_cis_v3_0_0';
const GWS_CIS_PLAN_ID = 'report_compliance_gws_cis_v1_2';
const AZURE_CIS_PLAN_ID = 'report_compliance_azure_cis_v2_0_0';
const PLANS_BASE_URL =
  'https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans';

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

/**
 * Auto-launches the appropriate CIS compliance report after a new cloud
 * environment is created. Runs the scan in the background (no WebSocket)
 * and shows a toast notification with a link to view the report.
 *
 * @param {Object} params
 * @param {Function} params.dispatch          - Redux dispatch
 * @param {string}   params.cloudProvider     - 'aws' | 'google_workspace' | 'azure'
 * @param {Object}   params.authProfile       - Auth profile for the scan
 * @param {string}   params.accountId         - AWS account ID, GWS domain, or Azure tenant ID
 * @param {string}   [params.parentId]        - Permission profile recordId
 * @param {number}   params.availableCredits  - Current credit balance
 * @returns {Promise<string|null>} scanId if launched, null otherwise
 */
export async function autoLaunchCisReport({
  dispatch,
  cloudProvider,
  authProfile,
  accountId,
  parentId,
  availableCredits,
}) {
  const isGws = cloudProvider === 'google_workspace';
  const isAzure = cloudProvider === 'azure';
  const planId = isGws ? GWS_CIS_PLAN_ID : isAzure ? AZURE_CIS_PLAN_ID : AWS_CIS_PLAN_ID;

  try {
    const planResponse = await fetch(`${PLANS_BASE_URL}/${planId}.json`);
    if (!planResponse.ok) {
      console.error('[autoLaunchCisReport] Failed to fetch plan:', planResponse.status);
      return null;
    }
    const planData = await planResponse.json();

    const plan = planData.plan || [];
    const services = plan[0]?.tasks?.[0]?.services || [];
    const credits = planData.credits || 1;
    const title = planData.title || 'CIS Compliance Report';

    if (availableCredits < credits) {
      toast(
        `CIS compliance report available for this environment. Add credits to run it automatically.`,
        { icon: 'ℹ️', duration: 6000 }
      );
      return null;
    }

    const effectiveAccountId = isGws
      ? authProfile?.domain || accountId || ''
      : isAzure
        ? authProfile?.tenantId || accountId || ''
        : authProfile?.awsAccountId || accountId || '';
    const scanId = `${effectiveAccountId}-${Date.now()}-${planId}`;
    const reportId = normalizeReportId(planId);

    const toastId = toast.loading(
      `Starting CIS compliance scan for ${effectiveAccountId}...`
    );

    const azureSubscriptionIds =
      toArray(authProfile?.subscriptionIds).length > 0
        ? toArray(authProfile?.subscriptionIds)
        : toArray(authProfile?.azureSubscriptionIds).length > 0
          ? toArray(authProfile?.azureSubscriptionIds)
          : Array.isArray(authProfile?.subscriptions)
            ? authProfile.subscriptions
                .map((subscription) => subscription?.subscriptionId || subscription?.id)
                .filter(Boolean)
            : [];
    const azureAuthDetails = authProfile?.authDetails || (
      authProfile?.clientId && authProfile?.clientSecret
        ? {
            all: {
              clientId: authProfile.clientId,
              clientSecret: authProfile.clientSecret,
            },
          }
        : {}
    );

    const assessmentConfig = isGws
      ? {
          scanId,
          domain: authProfile?.domain,
          superAdminEmailAddress: authProfile?.adminEmail,
          serviceAccountJson:
            typeof authProfile?.serviceAccountJson === 'string'
              ? authProfile.serviceAccountJson
              : JSON.stringify(authProfile?.serviceAccountJson),
          services,
        }
      : isAzure
        ? {
            scanId,
            tenantId: effectiveAccountId,
            subscriptionIds: azureSubscriptionIds,
            authDetails: azureAuthDetails,
            services,
            regions: ['all'],
            tenantType:
              authProfile?.tenantType ||
              authProfile?.azureTenantType ||
              (['m365', 'entra'].includes(authProfile?.provider) ? authProfile.provider : 'azure'),
            tenantEnvironment:
              authProfile?.tenantEnvironment || authProfile?.azureEnvironment || 'public',
          }
        : {
            accountId: effectiveAccountId,
            services,
            regions: ['us-east-1'],
            authProfile: {
              ...authProfile,
              accountId: effectiveAccountId,
            },
          };

    await initiateAssessment({
      cloudProvider: isGws ? 'google_workspace' : isAzure ? 'azure' : 'aws',
      config: assessmentConfig,
      common: {
        assessmentId: scanId,
        reportId,
        title,
        parentId: parentId || null,
        licenseType: 'ongoing',
        connectionId: null,
      },
      callbacks: {
        onError: (error) =>
          console.error('[autoLaunchCisReport] Assessment error:', error),
        onSuccess: () => {},
      },
    });
    dispatch(refreshUserCredits())
      .unwrap()
      .catch((error) => {
        console.warn('[autoLaunchCisReport] Failed to refresh credits:', error);
      });

    toast.success(
      `CIS compliance report started for ${effectiveAccountId}. You can view it from your reports.`,
      { id: toastId, duration: 8000 }
    );

    setTimeout(() => {
      dispatch(refreshAccountScans());
    }, 5000);

    return scanId;
  } catch (error) {
    console.error('[autoLaunchCisReport] Failed:', error);
    toast.error('Failed to start CIS compliance report automatically');
    return null;
  }
}
