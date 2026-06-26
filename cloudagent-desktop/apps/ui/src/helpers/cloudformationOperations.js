function parseToolPayload(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value;
  return null;
}

function parseCloudFormationStackArn(stackId) {
  const raw = String(stackId || '');
  if (!raw.startsWith('arn:')) return null;
  const parts = raw.split(':');
  if (parts.length < 6) return null;
  const resource = parts.slice(5).join(':') || null;
  let stackName = null;
  if (resource && resource.startsWith('stack/')) {
    const resourceParts = resource.split('/');
    if (resourceParts.length >= 2) {
      stackName = resourceParts[1] || null;
    }
  }
  return {
    region: parts[3] || null,
    accountId: parts[4] || null,
    stackName,
  };
}

function buildCloudFormationStackConsoleUrl({ region, stackId, stackName }) {
  if (!region) return null;
  const base = `https://${region}.console.aws.amazon.com/cloudformation/home?region=${encodeURIComponent(region)}`;
  if (stackId) {
    return `${base}#/stacks/stackinfo?stackId=${encodeURIComponent(stackId)}`;
  }
  if (stackName) {
    return `${base}#/stacks?filteringStatus=active&filteringText=${encodeURIComponent(stackName)}&viewNested=true`;
  }
  return null;
}

function classifyCloudFormationStackStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toUpperCase();
  if (!status) {
    return { terminal: false, outcome: 'unknown' };
  }
  if (
    status.endsWith('_COMPLETE') ||
    status === 'CREATE_COMPLETE' ||
    status === 'UPDATE_COMPLETE'
  ) {
    return { terminal: true, outcome: 'success' };
  }
  if (
    status.includes('FAILED') ||
    status.includes('ROLLBACK') ||
    status.includes('DELETE_COMPLETE')
  ) {
    return { terminal: true, outcome: 'failed' };
  }
  if (status.includes('IN_PROGRESS') || status === 'REVIEW_IN_PROGRESS') {
    return { terminal: false, outcome: 'in_progress' };
  }
  return { terminal: false, outcome: 'unknown' };
}

export function normalizeCloudFormationOperation({ output, input = null }) {
  const toolOutput = parseToolPayload(output);
  if (!toolOutput || typeof toolOutput !== 'object') return null;

  const lambdaEnvelopeFromRaw = parseToolPayload(toolOutput.raw);
  const lambdaEnvelope = lambdaEnvelopeFromRaw || (
    toolOutput.statusCode != null ||
    toolOutput.result ||
    toolOutput.notification ||
    toolOutput.validationsPassed != null ||
    toolOutput.error
      ? toolOutput
      : {}
  );
  const lambdaResult = parseToolPayload(lambdaEnvelope?.result) || {};
  const lambdaNotification = parseToolPayload(lambdaEnvelope?.notification) || null;
  const lambdaError = parseToolPayload(lambdaEnvelope?.error) || null;

  const stackId = toolOutput.stackId || lambdaResult.stackId || null;
  const stackArnMeta = parseCloudFormationStackArn(stackId);
  const region = toolOutput.region || input?.region || stackArnMeta?.region || null;
  const stackName =
    toolOutput.stackName || lambdaResult.stackName || input?.stackName || stackArnMeta?.stackName || null;
  const accountId = toolOutput.accountId || input?.accountId || stackArnMeta?.accountId || null;
  const permissionProfileId = toolOutput.permissionProfileId || input?.permissionProfileId || null;
  const operation = toolOutput.operation || input?.operation || null;
  const action = toolOutput.action || lambdaResult.action || null;
  const changeSetId = toolOutput.changeSetId || lambdaResult.changeSetId || null;
  const changeSetName = toolOutput.changeSetName || lambdaResult.changeSetName || null;
  const changeSetType = toolOutput.changeSetType || lambdaResult.changeSetType || null;
  const reviewUrl = toolOutput.reviewUrl || lambdaResult.reviewUrl || null;
  const status = toolOutput.status || lambdaResult.status || null;
  const statusReason = toolOutput.statusReason || lambdaResult.statusReason || null;
  const createdTime = toolOutput.createdTime || lambdaResult.createdTime || null;
  const lastUpdatedTime = toolOutput.lastUpdatedTime || lambdaResult.lastUpdatedTime || null;
  const numericStatusCode = Number.isFinite(Number(toolOutput.statusCode ?? lambdaEnvelope?.statusCode))
    ? Number(toolOutput.statusCode ?? lambdaEnvelope?.statusCode)
    : null;
  const empty = Boolean(toolOutput.empty || lambdaResult.empty);
  const terminalFromPayload = typeof toolOutput.terminal === 'boolean' ? toolOutput.terminal : null;
  const outcomeFromPayload =
    typeof toolOutput.outcome === 'string' ? String(toolOutput.outcome).trim().toLowerCase() : null;
  const notificationSentTo = Array.isArray(toolOutput?.notificationSentTo)
    ? toolOutput.notificationSentTo
    : Array.isArray(toolOutput?.notification?.sentTo)
      ? toolOutput.notification.sentTo
      : Array.isArray(lambdaNotification?.sentTo)
        ? lambdaNotification.sentTo
        : [];
  const events = Array.isArray(toolOutput.events)
    ? toolOutput.events
    : Array.isArray(lambdaResult.events)
      ? lambdaResult.events
      : [];

  const message =
    toolOutput.message ||
    statusReason ||
    lambdaError?.message ||
    (typeof toolOutput.error === 'string' ? toolOutput.error : toolOutput?.error?.message) ||
    null;
  const operationToken = String(operation || '').toLowerCase();
  const actionToken = String(action || '').toLowerCase();
  const statusToken = String(status || '').toLowerCase();
  const stackClassification = classifyCloudFormationStackStatus(status);
  const terminal = terminalFromPayload != null ? terminalFromPayload : stackClassification.terminal;
  const outcome = outcomeFromPayload || stackClassification.outcome;

  const changeRequestCreated = actionToken === 'changeset' || Boolean(changeSetId) || Boolean(reviewUrl);
  const noChanges = empty || actionToken === 'noop';
  const failed =
    outcome === 'failed' ||
    statusToken.includes('rollback_complete') ||
    toolOutput.ok === false ||
    (numericStatusCode != null && numericStatusCode >= 400) ||
    statusToken.includes('fail') ||
    statusToken.includes('error');
  const deploymentInProgress = !failed && !noChanges && !changeRequestCreated && (
    outcome === 'in_progress' ||
    statusToken.includes('_in_progress') ||
    statusToken.includes('_cleanup_in_progress') ||
    statusToken === 'review_in_progress' ||
    actionToken === 'status_check' ||
    actionToken === 'describe' ||
    operationToken === 'create' ||
    operationToken === 'update'
  );
  const deploymentComplete = !failed && !noChanges && !changeRequestCreated && (
    outcome === 'success' || (terminal && statusToken.includes('complete'))
  );

  let statusKind = 'updated';
  let statusLabel = 'CloudFormation updated';
  if (failed) {
    statusKind = 'failed';
    statusLabel = 'Operation failed';
  } else if (noChanges) {
    statusKind = 'no_changes';
    statusLabel = 'No changes detected';
  } else if (changeRequestCreated) {
    statusKind = 'change_request_created';
    statusLabel = 'Change request created';
  } else if (deploymentComplete) {
    statusKind = 'deployment_complete';
    statusLabel = 'Deployment complete';
  } else if (deploymentInProgress) {
    statusKind = 'deployment_in_progress';
    statusLabel = 'Deployment started';
  }

  let summary = message;
  if (!summary && statusKind === 'change_request_created') {
    summary = `Created change set${changeSetName ? ` ${changeSetName}` : ''} for ${stackName || 'the stack'}.`;
  } else if (!summary && statusKind === 'deployment_in_progress') {
    summary = `${operationToken === 'create' ? 'Create' : 'Update'} request submitted for ${stackName || 'the stack'}.`;
  } else if (!summary && statusKind === 'deployment_complete') {
    summary = `Stack ${stackName || 'deployment'} reached ${status || 'a complete state'}.`;
  } else if (!summary && statusKind === 'no_changes') {
    summary = `No updates were needed for ${stackName || 'the stack'}.`;
  } else if (!summary && statusKind === 'failed') {
    summary = 'CloudFormation operation failed.';
  }

  return {
    operation: operation || null,
    action: action || null,
    accountId,
    permissionProfileId,
    region,
    stackName,
    stackId,
    stackUrl: buildCloudFormationStackConsoleUrl({ region, stackId, stackName }),
    changeSetId,
    changeSetName,
    changeSetType,
    reviewUrl,
    status,
    statusReason,
    createdTime,
    lastUpdatedTime,
    statusCode: numericStatusCode,
    message,
    summary,
    statusKind,
    statusLabel,
    terminal,
    outcome,
    changeRequestCreated,
    deploymentComplete,
    deploymentInProgress,
    noChanges,
    events,
    notificationSentTo,
  };
}

export function dedupeCloudFormationOperations(operations = []) {
  const seen = new Set();
  return (Array.isArray(operations) ? operations : []).filter((operation) => {
    if (!operation || typeof operation !== 'object') return false;
    const dedupeKey = [
      operation.stackId || operation.stackName || '',
      operation.changeSetId || '',
      operation.action || operation.operation || '',
      operation.statusKind || '',
      operation.status || '',
    ].join('::');
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
}
