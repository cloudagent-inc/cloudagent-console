const REPORT_ID_PREFIX = 'report_';
const REPORT_DEFINITIONS_BASE_URL =
  'https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/reports';

export function normalizeReportId(value, fallbackValue = null) {
  const candidate = String(value || fallbackValue || '').trim();
  if (!candidate) return null;
  if (candidate.startsWith(REPORT_ID_PREFIX)) {
    return candidate;
  }
  return `${REPORT_ID_PREFIX}${candidate}`;
}

function getAzureReportDefinitionId(value) {
  const candidate = String(value || '').trim();
  if (!candidate.startsWith('report_compliance_azure_')) {
    return null;
  }
  return candidate.replace(/^report_/, '');
}

export function getReportIdCandidates(...values) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (candidate) => {
    const normalized = String(candidate || '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  values.forEach((value) => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return;

    pushCandidate(getAzureReportDefinitionId(rawValue));
    pushCandidate(rawValue);
    pushCandidate(normalizeReportId(rawValue));
    pushCandidate(rawValue.replace(/^report_/, ''));
  });

  return candidates;
}

export function buildReportDefinitionUrl(value, fallbackValue = null) {
  const candidate = String(value || fallbackValue || '').trim();
  return candidate
    ? `${REPORT_DEFINITIONS_BASE_URL}/${candidate}.json`
    : null;
}
