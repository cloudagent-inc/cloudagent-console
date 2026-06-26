import React from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image as PdfImage,
  Font,
} from '@react-pdf/renderer';

const LOGO = '/logo.png';

Font.register({
  family: 'Open Sans',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-600.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-700.ttf',
      fontWeight: 700,
    },
  ],
});

const sanitizePdfText = (value) =>
  String(value || '')
    .normalize('NFKC')
    // Remove control, bidi, and zero-width characters that can break PDF text shaping.
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const splitLongToken = (word, chunkSize = 40) => {
  if (!word || word.length <= chunkSize) return [word];
  const chunks = [];
  for (let index = 0; index < word.length; index += chunkSize) {
    chunks.push(word.slice(index, index + chunkSize));
  }
  return chunks;
};

Font.registerHyphenationCallback((word) => splitLongToken(sanitizePdfText(word)));

const truncateText = (value, maxLength = 120) => {
  const text = sanitizePdfText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

const styles = StyleSheet.create({
  coverPage: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Open Sans',
    display: 'flex',
    flexDirection: 'column',
  },
  coverHeader: {
    alignItems: 'center',
    marginBottom: 44,
  },
  coverLogo: {
    maxWidth: 180,
    maxHeight: 80,
  },
  coverContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 25,
    fontWeight: 700,
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 1.18,
  },
  coverTitleBlock: {
    width: 500,
    alignItems: 'center',
    marginBottom: 14,
  },
  coverSubtitle: {
    fontSize: 16,
    fontWeight: 400,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  coverWorkload: {
    alignItems: 'center',
    marginBottom: 20,
  },
  coverWorkloadLabel: {
    fontSize: 10,
    fontWeight: 500,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coverWorkloadName: {
    fontSize: 20,
    fontWeight: 600,
    color: '#1f2937',
  },
  coverDate: {
    alignItems: 'center',
  },
  coverDateLabel: {
    fontSize: 10,
    fontWeight: 500,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coverDateValue: {
    fontSize: 12,
    fontWeight: 400,
    color: '#6b7280',
  },
  coverStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 40,
    marginBottom: 40,
  },
  statBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: '16 24',
    alignItems: 'center',
    minWidth: 100,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 500,
    color: '#6b7280',
  },
  coverFooter: {
    alignItems: 'center',
  },
  coverFooterText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  sourceReportsBox: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 14,
    marginTop: 24,
    backgroundColor: '#f9fafb',
  },
  sourceReportsTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sourceReportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f3',
  },
  sourceReportName: {
    flex: 1,
    fontSize: 9,
    fontWeight: 600,
    color: '#1f2937',
  },
  sourceReportDate: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  body: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: 'Open Sans',
  },
  pageHeader: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 10,
  },
  headerLogo: {
    width: 80,
    height: 'auto',
    maxHeight: 30,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: 500,
    color: '#6b7280',
    marginLeft: 'auto',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#9ca3af',
  },
  footerPageNumber: {
    fontSize: 9,
    color: '#6b7280',
  },
  sectionHeader: {
    backgroundColor: '#1e40af',
    padding: '12 16',
    borderRadius: 6,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
  },
  paragraph: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  heading1: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 11,
    fontWeight: 600,
    color: '#374151',
    marginTop: 10,
    marginBottom: 4,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    width: 15,
    fontSize: 10,
    color: '#6b7280',
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.4,
  },
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
  },
  tableHeaderCell: {
    flex: 1,
    padding: '8 10',
    fontSize: 9,
    fontWeight: 600,
    color: '#374151',
  },
  tableCell: {
    flex: 1,
    padding: '8 10',
    fontSize: 9,
    color: '#4b5563',
  },
  tableCellWide: {
    flex: 2,
  },
  tableCellNarrow: {
    flex: 0.7,
    textAlign: 'center',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 600,
  },
  badgeCritical: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  badgeHigh: {
    backgroundColor: '#ffedd5',
    color: '#9a3412',
  },
  badgeMedium: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  badgeLow: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeComplete: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  badgeFailed: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  badgeInProgress: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  infoBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  infoBoxText: {
    fontSize: 9,
    color: '#0369a1',
    lineHeight: 1.4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginVertical: 16,
  },
  subsection: {
    marginBottom: 20,
  },
  noContent: {
    padding: 20,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 10,
  },
});

const formatDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const formatReportTypeLabel = (reportType) => {
  if (!reportType) return 'Unknown Report';

  const reportTypeLabels = {
    compliance_aws_cis_v3_0_0: 'AWS CIS v3.0.0',
    compliance_aws_nist_800_53_v5: 'AWS NIST 800-53 v5',
    report_aws_backup: 'AWS Backup Report',
    report_aws_unused_resources: 'AWS Unused Resources',
    compliance_aws_cis_v2_0_0: 'AWS CIS v2.0.0',
    compliance_aws_cis_v1_4_0: 'AWS CIS v1.4.0',
    report_aws_cost: 'AWS Cost Report',
  };

  if (reportTypeLabels[reportType]) return reportTypeLabels[reportType];

  return reportType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/Aws/g, 'AWS')
    .replace(/Cis/g, 'CIS')
    .replace(/Nist/g, 'NIST');
};

const buildSourceReports = (summary, accountScans = []) => {
  if (!summary?.sources || typeof summary.sources !== 'object') return [];

  return Object.entries(summary.sources).map(([reportType, scanId]) => {
    const scan = accountScans.find(
      (item) =>
        item?.scanId === scanId ||
        item?.id === scanId ||
        item?.recordId === scanId ||
        (item?.reportId === reportType && item?.scanId === scanId)
    );

    const timestamp =
      scan?.lastUpdateTime ||
      scan?.latestAssessmentDate ||
      scan?.updatedAt ||
      scan?.createdAt ||
      null;

    return {
      scanId,
      title: truncateText(scan?.title || scan?.reportName || formatReportTypeLabel(reportType), 90),
      date: timestamp ? formatTimestamp(timestamp) : '—',
    };
  });
};

const getScanNameDisplay = (scan) => {
  if (!scan) return 'Unknown Report';
  return truncateText(
    scan.title || scan.reportName || formatReportTypeLabel(scan.reportId) || scan.scanId || 'Unknown Report',
    90
  );
};

const getReportTimestamp = (scan) =>
  scan?.lastUpdateTime || scan?.latestAssessmentDate || scan?.updatedAt || scan?.createdAt || null;

const getPermissionProfileName = (scan, permissionProfiles = []) => {
  if (!scan?.accountId) return scan?.accountId || 'N/A';

  const permission = permissionProfiles.find((profile) => {
    try {
      const authProfile =
        typeof profile.authProfile === 'string'
          ? JSON.parse(profile.authProfile)
          : profile.authProfile || {};
      return String(authProfile.awsAccountId || authProfile.accountId || '') === String(scan.accountId);
    } catch {
      return false;
    }
  });

  return truncateText(permission?.name || scan.accountId || 'N/A', 70);
};

const getStatusDisplay = (status) => {
  if (!status) return 'Unknown';
  const statusLower = String(status).toLowerCase();
  if (statusLower === 'completed' || statusLower === 'success' || statusLower === 'complete') return 'Completed';
  if (statusLower === 'failed' || statusLower === 'error' || statusLower === 'failure') return 'Failed';
  if (statusLower === 'in_progress' || statusLower === 'running' || statusLower === 'in progress') return 'In Progress';
  if (statusLower === 'pending' || statusLower === 'queued') return 'Pending';
  return String(status).charAt(0).toUpperCase() + String(status).slice(1);
};

const splitTitleIntoLines = (title, maxCharactersPerLine = 32) => {
  const words = sanitizePdfText(title).split(' ').filter(Boolean);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && nextLine.length > maxCharactersPerLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines.slice(0, 3) : ['Workload Report'];
};

const parseMarkdownToPdfElements = (markdownText) => {
  if (!markdownText) return [];
  
  const lines = markdownText.split('\n');
  const elements = [];
  let currentList = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (currentList) {
        elements.push({ type: 'list', items: currentList });
        currentList = null;
      }
      continue;
    }
    
    if (trimmed.startsWith('# ')) {
      if (currentList) {
        elements.push({ type: 'list', items: currentList });
        currentList = null;
      }
      elements.push({ type: 'h1', text: truncateText(trimmed.substring(2), 120) });
    } else if (trimmed.startsWith('## ')) {
      if (currentList) {
        elements.push({ type: 'list', items: currentList });
        currentList = null;
      }
      elements.push({ type: 'h2', text: truncateText(trimmed.substring(3), 120) });
    } else if (trimmed.startsWith('### ')) {
      if (currentList) {
        elements.push({ type: 'list', items: currentList });
        currentList = null;
      }
      elements.push({ type: 'h3', text: truncateText(trimmed.substring(4), 120) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = truncateText(trimmed.substring(2).replace(/\*\*/g, ''), 240);
      if (!currentList) currentList = [];
      currentList.push(text);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const text = truncateText(trimmed.replace(/^\d+\.\s/, '').replace(/\*\*/g, ''), 240);
      if (!currentList) currentList = [];
      currentList.push(text);
    } else {
      if (currentList) {
        elements.push({ type: 'list', items: currentList });
        currentList = null;
      }
      const cleanText = truncateText(trimmed.replace(/\*\*/g, ''), 320);
      elements.push({ type: 'paragraph', text: cleanText });
    }
  }
  
  if (currentList) {
    elements.push({ type: 'list', items: currentList });
  }
  
  return elements;
};

const MarkdownContent = ({ content }) => {
  const elements = parseMarkdownToPdfElements(content);
  
  return (
    <View>
      {elements.map((el, idx) => {
        if (el.type === 'h1') {
          return <Text key={idx} style={styles.heading1}>{el.text}</Text>;
        }
        if (el.type === 'h2') {
          return <Text key={idx} style={styles.heading2}>{el.text}</Text>;
        }
        if (el.type === 'h3') {
          return <Text key={idx} style={styles.heading3}>{el.text}</Text>;
        }
        if (el.type === 'list') {
          return (
            <View key={idx} style={{ marginBottom: 8 }}>
              {el.items.map((item, itemIdx) => (
                <View key={itemIdx} style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        return <Text key={idx} style={styles.paragraph}>{el.text}</Text>;
      })}
    </View>
  );
};

const getPriorityBadgeStyle = (priority) => {
  const numericValue = Number(priority);
  if (!Number.isFinite(numericValue)) return null;
  
  const value = Math.max(0, Math.min(100, Math.round(numericValue)));
  
  if (value >= 90) return { style: styles.badgeCritical, label: 'Critical' };
  if (value >= 80) return { style: styles.badgeHigh, label: 'High' };
  if (value >= 50) return { style: styles.badgeMedium, label: 'Medium' };
  return { style: styles.badgeLow, label: 'Low' };
};

const safeParseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const WorkloadExportPDFDocument = ({
  workload,
  executiveSummary,
  diagramImage,
  accountScans = [],
  reports = [],
  permissionProfiles = [],
  recommendations = [],
  options = {
    includeExecutiveSummary: true,
    includeDiagram: true,
    includeRecommendations: true,
    includeLatestReports: true,
    includeCoverSources: true,
  },
  logo = LOGO,
}) => {
  const workloadName = truncateText(workload?.workloadName || 'Workload Report', 120);
  const description = truncateText(workload?.description || '', 240);
  const sourceReports = buildSourceReports(executiveSummary, accountScans);
  const latestReports = [...reports].sort((a, b) => {
    const aTime = getReportTimestamp(a) ? new Date(getReportTimestamp(a)).getTime() : 0;
    const bTime = getReportTimestamp(b) ? new Date(getReportTimestamp(b)).getTime() : 0;
    return bTime - aTime;
  });
  
  const getStats = () => {
    return {
      hasDiagram: options.includeDiagram && diagramImage ? 1 : 0,
      recommendationsCount: options.includeRecommendations ? recommendations.length : 0,
      environmentsCount: Array.isArray(workload?.environments) ? workload.environments.length : 0,
    };
  };
  
  const stats = getStats();
  const titleLines = splitTitleIntoLines(workloadName);

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverHeader}>
          <PdfImage src={logo} style={styles.coverLogo} />
        </View>

        <View style={styles.coverContent}>
          <View style={styles.coverTitleBlock}>
            {titleLines.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.coverTitle}>
                {line}
              </Text>
            ))}
          </View>

          {description && (
            <View style={{ alignItems: 'center', marginBottom: 20, maxWidth: 400 }}>
              <Text style={{ fontSize: 10, color: '#6b7280', textAlign: 'center' }}>
                {description}
              </Text>
            </View>
          )}

          <View style={styles.coverDate}>
            <Text style={styles.coverDateLabel}>Report Generated</Text>
            <Text style={styles.coverDateValue}>{formatDate()}</Text>
          </View>

          {options.includeCoverSources !== false && sourceReports.length > 0 && (
            <View style={styles.sourceReportsBox}>
              <Text style={styles.sourceReportsTitle}>
                Executive Summary Source Reports
              </Text>
              {sourceReports.slice(0, 8).map((report, index) => (
                <View
                  key={`${report.scanId}-${index}`}
                  style={[
                    styles.sourceReportRow,
                    index === sourceReports.length - 1 ? { borderBottomWidth: 0 } : {},
                  ]}
                >
      <Text style={styles.sourceReportName}>{truncateText(report.title, 80)}</Text>
                  <Text style={styles.sourceReportDate}>{report.date}</Text>
                </View>
              ))}
              {sourceReports.length > 8 && (
                <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 8 }}>
                  + {sourceReports.length - 8} more source report{sourceReports.length - 8 !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.coverStats}>
          {stats.environmentsCount > 0 && (
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.environmentsCount}</Text>
              <Text style={styles.statLabel}>Environments</Text>
            </View>
          )}
          {options.includeDiagram && stats.hasDiagram > 0 && (
            <View style={[styles.statBox, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.statNumber, { color: '#1d4ed8' }]}>1</Text>
              <Text style={styles.statLabel}>Diagram</Text>
            </View>
          )}
          {options.includeRecommendations && (
            <View style={[styles.statBox, { backgroundColor: stats.recommendationsCount > 0 ? '#fef3c7' : '#f3f4f6' }]}>
              <Text style={[styles.statNumber, { color: stats.recommendationsCount > 0 ? '#d97706' : '#1f2937' }]}>
                {stats.recommendationsCount}
              </Text>
              <Text style={styles.statLabel}>Recommendations</Text>
            </View>
          )}
        </View>

        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>
            Generated by Cloud Agent
          </Text>
        </View>
      </Page>

      {/* Diagram Page */}
      {options.includeDiagram && (
        <Page size="A4" orientation="landscape" style={styles.body} wrap={false}>
          <View style={styles.pageHeader} fixed>
            <PdfImage src={logo} style={styles.headerLogo} />
            <Text style={styles.headerTitle}>{workloadName}</Text>
          </View>

          <View style={styles.pageFooter} fixed>
            <Text style={styles.footerText}>{workloadName}</Text>
            <Text
              style={styles.footerPageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>

          <View style={styles.subsection} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Architecture Diagram</Text>
            </View>

            {diagramImage ? (
              <View style={{ alignItems: 'center', padding: 4 }}>
                <PdfImage
                  src={diagramImage}
                  style={{
                    width: 700,
                    height: 340,
                    objectFit: 'contain',
                  }}
                />
                <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 6 }}>
                  Architecture diagram showing workload resources and their relationships
                </Text>
              </View>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  No architecture diagram has been generated for this workload yet.
                </Text>
              </View>
            )}
          </View>
        </Page>
      )}

      {/* Content Pages */}
      {(options.includeExecutiveSummary || options.includeRecommendations) && (
      <Page size="A4" style={styles.body} wrap>
        {/* Header */}
        <View style={styles.pageHeader} fixed>
          <PdfImage src={logo} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>{workloadName}</Text>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>{workloadName}</Text>
          <Text
            style={styles.footerPageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

        {/* Executive Summary Section */}
        {options.includeExecutiveSummary && (
          <View style={styles.subsection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Executive Summary</Text>
            </View>
            
            {executiveSummary?.summaryText ? (
              <>
                <MarkdownContent content={executiveSummary.summaryText} />
                {executiveSummary.updatedAt && (
                  <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 8 }}>
                    Last updated: {formatTimestamp(executiveSummary.updatedAt)}
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  No executive summary has been generated for this workload yet.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Recommendations Section */}
        {options.includeRecommendations && (
          <View style={styles.subsection} break={options.includeExecutiveSummary && executiveSummary?.summaryText}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommendations ({recommendations.length})</Text>
            </View>
            
            {recommendations.length > 0 ? (
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableHeaderCell, styles.tableCellWide]}>Recommendation</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableCellNarrow]}>Priority</Text>
                  <Text style={styles.tableHeaderCell}>Resources</Text>
                  <Text style={styles.tableHeaderCell}>Updated</Text>
                </View>
                {recommendations.slice(0, 30).map((rec, index) => {
                  const metadata = safeParseJson(rec.metadata);
                  const priorityValue = metadata?.priority ?? rec.priority;
                  const priorityBadge = getPriorityBadgeStyle(priorityValue);
                  const targetResources = safeParseJson(rec.targetResources);
                  const resourceCount = Array.isArray(targetResources) ? targetResources.length : 0;
                  
                  return (
                    <View
                      key={`${rec.recommendationId || rec.id}-${index}`}
                      style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                      wrap={false}
                    >
                      <View style={[styles.tableCell, styles.tableCellWide]}>
                        <Text>{truncateText(rec.title || 'Untitled Recommendation', 90)}</Text>
                        {rec.notes && (
                          <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 2 }}>
                            {truncateText(rec.notes, 110)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.tableCell, styles.tableCellNarrow]}>
                        {priorityBadge && (
                          <Text style={[styles.badge, priorityBadge.style]}>
                            {priorityBadge.label}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.tableCell}>
                        {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.tableCell}>
                        {formatTimestamp(rec.updatedAt || rec.createdAt)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  No recommendations are currently available for this workload.
                </Text>
              </View>
            )}
            {recommendations.length > 30 && (
              <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 4 }}>
                Showing 30 of {recommendations.length} recommendations. View full list in the dashboard.
              </Text>
            )}
          </View>
        )}
      </Page>
      )}

      {/* Latest Reports Page */}
      {options.includeLatestReports !== false && (
      <Page size="A4" style={styles.body} wrap>
        <View style={styles.pageHeader} fixed>
          <PdfImage src={logo} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>{workloadName}</Text>
        </View>

        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>{workloadName}</Text>
          <Text
            style={styles.footerPageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

        <View style={styles.subsection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Environment Reports</Text>
          </View>

          {latestReports.length > 0 ? (
            <>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableHeaderCell, styles.tableCellWide]}>Report</Text>
                  <Text style={styles.tableHeaderCell}>Cloud Environment</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableCellNarrow]}>Status</Text>
                  <Text style={styles.tableHeaderCell}>Updated</Text>
                </View>
                {latestReports.slice(0, 30).map((report, index) => (
                  <View
                    key={`${report.scanId || report.reportId}-${index}`}
                    style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                    wrap={false}
                  >
                    <Text style={[styles.tableCell, styles.tableCellWide]}>
                      {getScanNameDisplay(report)}
                    </Text>
                    <Text style={styles.tableCell}>
                      {getPermissionProfileName(report, permissionProfiles)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellNarrow]}>
                      {getStatusDisplay(report.status)}
                    </Text>
                    <Text style={styles.tableCell}>
                      {formatTimestamp(getReportTimestamp(report))}
                    </Text>
                  </View>
                ))}
              </View>
              {latestReports.length > 30 && (
                <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 4 }}>
                  Showing 30 of {latestReports.length} reports. View full list in the dashboard.
                </Text>
              )}
            </>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                No reports have been run for this workload's environments yet.
              </Text>
            </View>
          )}
        </View>
      </Page>
      )}
    </Document>
  );
};

export default WorkloadExportPDFDocument;
