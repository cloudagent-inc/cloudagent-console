export function normalizeCloudProvider(cloudProvider) {
  const normalized = String(cloudProvider || 'aws').trim().toLowerCase();
  if (normalized === 'gws') return 'google_workspace';
  return normalized || 'aws';
}

export function buildReportEntryKey(scan) {
  if (!scan || typeof scan !== 'object') {
    return null;
  }

  if (scan.reportEntryKey) {
    return scan.reportEntryKey;
  }

  if (scan.scanId && scan.reportId) {
    return `${scan.scanId}::${scan.reportId}`;
  }

  return scan.scanId || scan.reportId || null;
}

function cloneWithEntryKey(scan) {
  if (!scan || typeof scan !== 'object') {
    return scan;
  }

  const reportEntryKey = buildReportEntryKey(scan);
  return reportEntryKey ? { ...scan, reportEntryKey } : { ...scan };
}

export function expandAccountScans(accountScans = []) {
  if (!Array.isArray(accountScans)) {
    return [];
  }

  return accountScans.map(cloneWithEntryKey).filter(Boolean);
}

export function findAccountScan(scans = [], { scanId, reportId } = {}) {
  if (!scanId || !Array.isArray(scans)) {
    return null;
  }

  if (reportId) {
    const exactMatch = scans.find(
      (scan) => scan?.scanId === scanId && scan?.reportId === reportId
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  return scans.find((scan) => scan?.scanId === scanId) || null;
}

export function buildReportRoute(scan, { workloadId } = {}) {
  if (!scan?.scanId) {
    return null;
  }

  const searchParams = new URLSearchParams();
  if (scan.reportId) {
    searchParams.set('reportId', scan.reportId);
  }
  if (workloadId) {
    searchParams.set('workloadId', workloadId);
  }

  const queryString = searchParams.toString();
  return queryString
    ? `/dashboard/reports/${scan.scanId}?${queryString}`
    : `/dashboard/reports/${scan.scanId}`;
}
