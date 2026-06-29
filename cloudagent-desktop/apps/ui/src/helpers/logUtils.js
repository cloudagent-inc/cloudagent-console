/**
 * Attempt to convert a Java Map.toString() style string into valid JSON.
 * Handles patterns like: {key=value, nested={a=b}, list=[{x=1}, {y=2}]}
 */
const javaMapToJson = (str) => {
  if (typeof str !== 'string') return str;

  // Quick heuristic: Java map strings use `=` for key-value and don't quote keys.
  // If the string already looks like JSON (starts with `{` and contains `":`) skip conversion.
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') || trimmed.includes('":')) {
    return str; // likely already JSON or not a map
  }

  try {
    // Replace `=` between a key and value with `:`, then quote unquoted keys.
    // This is a best-effort heuristic and may not cover every edge case.
    let converted = trimmed
      // Handle null values (Java prints literal `null`)
      .replace(/=null([,}\]])/g, ':null$1')
      // Key=value where value is a string/number/boolean/null or nested structure
      .replace(/([{,\[]\s*)([a-zA-Z_][a-zA-Z0-9_]*)=/g, '$1"$2":');

    // Attempt to parse; if it fails, return original
    JSON.parse(converted);
    return converted;
  } catch (_) {
    // Conversion didn't produce valid JSON; return original string
    return str;
  }
};

/**
 * Concise agent stream logger for debugging agent backend responses.
 * Shows chunk flow with clear status indicators.
 */
const AGENT_LOG_ENABLED = true; // Toggle to disable agent logging
const AGENT_LOG_PREFIX = '%c[Agent]';
const AGENT_LOG_STYLES = {
  chunk: 'color: #6366f1; font-weight: bold',      // indigo for chunks
  status: 'color: #22c55e; font-weight: bold',     // green for status updates
  error: 'color: #ef4444; font-weight: bold',      // red for errors
  loading: 'color: #f59e0b; font-weight: bold',    // amber for loading state
  info: 'color: #3b82f6',                          // blue for info
};

/**
 * Log agent stream chunk with concise formatting
 * @param {Object} chunk - The chunk received from agent backend
 * @param {Object} context - Additional context (answerIndex, currentTask, etc.)
 */
export const logAgentChunk = (chunk, context = {}) => {
  if (!AGENT_LOG_ENABLED) return;
  
  const type = chunk?.type || 'unknown';
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  
  switch (type) {
    case 'message_start':
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.status, `${timestamp} ▶ Stream started`);
      break;
      
    case 'message_in_progress':
      // Truncate content for readability
      const content = typeof chunk.content === 'string' 
        ? chunk.content.slice(0, 80) + (chunk.content.length > 80 ? '...' : '')
        : '[object]';
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.chunk, `${timestamp} 📝 Message | "${content}"`);
      break;
      
    case 'task_status_update': {
      let taskStatus;
      try {
        taskStatus = typeof chunk.content === 'string' ? JSON.parse(chunk.content) : chunk.content;
      } catch {
        taskStatus = chunk;
      }
      const statusEmoji = taskStatus?.status === 'complete' ? '✅' : taskStatus?.status === 'in_progress' ? '🔄' : '📋';
      console.log(
        AGENT_LOG_PREFIX, AGENT_LOG_STYLES.status, 
        `${timestamp} ${statusEmoji} Task Status | id: ${taskStatus?.task_id || 'unknown'} | status: ${taskStatus?.status || 'unknown'}`
      );
      break;
    }
      
    case 'action_start':
      const actions = chunk.actions?.map(a => a.name).join(', ') || 'unknown';
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.chunk, `${timestamp} ⚡ Action Start | ${actions}`);
      break;
      
    case 'action_end':
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.chunk, `${timestamp} ⚡ Action End | id: ${chunk.actionId || 'unknown'}`);
      break;
      
    case 'cli_command_output':
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.chunk, `${timestamp} 💻 CLI Output | task: ${chunk.task_id || 'unknown'}`);
      break;
      
    case 'blueprint_updated':
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.status, `${timestamp} 📘 Blueprint Updated`);
      break;
      
    case 'error':
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.error, `${timestamp} ❌ Error | ${chunk.message || chunk.error_message || 'Unknown error'}`);
      break;
      
    default:
      console.log(AGENT_LOG_PREFIX, AGENT_LOG_STYLES.info, `${timestamp} 📦 ${type} | ${JSON.stringify(chunk).slice(0, 100)}...`);
  }
};

/**
 * Log loading state changes
 * @param {boolean} isLoading - Current loading state
 * @param {string} source - Where the state change originated
 */
export const logAgentLoadingState = (isLoading, source = '') => {
  if (!AGENT_LOG_ENABLED) return;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  const emoji = isLoading ? '⏳' : '✓';
  console.log(
    AGENT_LOG_PREFIX, AGENT_LOG_STYLES.loading,
    `${timestamp} ${emoji} Loading: ${isLoading ? 'TRUE' : 'FALSE'}${source ? ` (${source})` : ''}`
  );
};

/**
 * Log state transition summary (call periodically or on key events)
 * @param {Object} state - Current agent state
 */
export const logAgentStateSummary = (state) => {
  if (!AGENT_LOG_ENABLED) return;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  console.log(
    AGENT_LOG_PREFIX, AGENT_LOG_STYLES.info,
    `${timestamp} 📊 State | loading: ${state.loading} | phase: ${state.currentPhase} | task: ${state.currentTask} | action: ${state.currentAction || 'none'} | answers: ${state.answers?.length || 0}`
  );
};

/**
 * Log blueprint/plan updates
 * @param {string} event - 'received' or 'applied'
 * @param {Object} details - Details about the blueprint update
 */
export const logBlueprintUpdate = (event, details = {}) => {
  if (!AGENT_LOG_ENABLED) return;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  
  if (event === 'received') {
    const { title, phases, tasks } = details;
    console.log(
      AGENT_LOG_PREFIX, AGENT_LOG_STYLES.status,
      `${timestamp} 📘 Blueprint RECEIVED | title: "${title || 'untitled'}" | phases: ${phases || 0} | tasks: ${tasks || 0}`
    );
  } else if (event === 'applied') {
    const { phases, tasks, title } = details;
    console.log(
      AGENT_LOG_PREFIX, AGENT_LOG_STYLES.status,
      `${timestamp} ✅ Blueprint APPLIED to state | title: "${title || 'untitled'}" | phases: ${phases || 0} | tasks: ${tasks || 0}`
    );
  } else if (event === 'skipped') {
    console.log(
      AGENT_LOG_PREFIX, AGENT_LOG_STYLES.error,
      `${timestamp} ⚠️ Blueprint SKIPPED | reason: ${details.reason || 'unknown'}`
    );
  }
};

export const toLogObject = (logValue) => {
  if (!logValue) return {};

  if (typeof logValue === 'string') {
    // First try direct JSON parse
    try {
      return JSON.parse(logValue);
    } catch (_directParseError) {
      // Might be Java Map.toString() format; attempt conversion
    }

    const converted = javaMapToJson(logValue);
    try {
      return JSON.parse(converted);
    } catch (error) {
      console.warn('[logUtils] Failed to parse log string after conversion, returning empty object.', error);
      return {};
    }
  }

  if (typeof logValue === 'object') {
    return logValue;
  }

  return {};
};

const normalizeSummaryValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const getSummaryCandidate = (value) => {
  if (!value || typeof value !== 'object') return null;
  const candidate =
    value.runSummary ||
    value.run_summary ||
    value.finalTaskSummary ||
    value.finalSummary ||
    value.summary ||
    value.text ||
    value.result ||
    value.rawFinalSummary ||
    value.message ||
    null;
  return candidate ? value.runSummary || value.run_summary || value : null;
};

export const getRunSummaryFromLog = (logValue) => {
  const parsedLog = toLogObject(logValue);
  const runSummary = getSummaryCandidate(parsedLog);

  if (typeof runSummary === 'string') {
    return normalizeSummaryValue(runSummary);
  }

  if (runSummary && typeof runSummary === 'object') {
    const objectSummary =
      runSummary.finalTaskSummary ||
      runSummary.finalSummary ||
      runSummary.summary ||
      runSummary.text ||
      runSummary.result ||
      runSummary.rawFinalSummary ||
      runSummary.message ||
      '';
    const normalizedObjectSummary = normalizeSummaryValue(objectSummary);
    if (normalizedObjectSummary) {
      return normalizedObjectSummary;
    }
  }

  const logs = Array.isArray(parsedLog?.logs) ? parsedLog.logs : [];
  for (let idx = logs.length - 1; idx >= 0; idx -= 1) {
    const entry = logs[idx];
    if (!entry) continue;
    const status = typeof entry.status === 'string' ? entry.status.toLowerCase() : '';
    if (status !== 'complete' && status !== 'completed' && status !== 'success') continue;
    const fallbackSummary = normalizeSummaryValue(entry.task_output || entry.output || '');
    if (fallbackSummary) {
      return fallbackSummary;
    }
  }

  return '';
};
