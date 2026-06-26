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
const Done = '/done.png';
const Cancel = '/cancel-red.png';

const pillars = [
  { key: 'operationalExcellence', value: 'Operational Excellence', color: '#6366f1' },
  { key: 'security', value: 'Security', color: '#ef4444' },
  { key: 'reliability', value: 'Reliability', color: '#f59e0b' },
  { key: 'performance', value: 'Performance Efficiency', color: '#10b981' },
  { key: 'costOptimization', value: 'Cost Optimization', color: '#8b5cf6' },
  { key: 'sustainability', value: 'Sustainability', color: '#06b6d4' },
];

// Register Open Sans font (TTF format for react-pdf compatibility)
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

const PDFReport = (props) => {
  const getPillarInfo = (pillarId) => {
    return pillars.find((p) => p.key === pillarId) || { value: pillarId, color: '#6b7280' };
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Count questions and suggestions
  const getStats = () => {
    let totalQuestions = 0;
    let questionsWithSuggestions = 0;
    let passedSuggestions = 0;
    let failedSuggestions = 0;

    props?.allLenses?.forEach((lensGroup) => {
      lensGroup.forEach((pillarGroup) => {
        pillarGroup.Questions.forEach((question) => {
          totalQuestions++;
          question?.Choices?.forEach((choice) => {
            const context = choice.Context || {};
            if (context.passed?.length > 0 || context.failed?.length > 0 || context.accountContext?.length > 0) {
              questionsWithSuggestions++;
            }
            passedSuggestions += context.passed?.length || 0;
            failedSuggestions += context.failed?.length || 0;
          });
        });
      });
    });

    return { totalQuestions, questionsWithSuggestions, passedSuggestions, failedSuggestions };
  };

  const stats = getStats();

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverHeader}>
          <PdfImage
            src={props.logo || LOGO}
            style={{
              ...styles.coverLogo,
              width: props.logoWidth ? Number(props.logoWidth) : 180,
              height: props.logoHeight ? Number(props.logoHeight) : 'auto',
            }}
          />
        </View>

        <View style={styles.coverContent}>
          <Text style={styles.coverTitle}>Well-Architected Review</Text>
          <Text style={styles.coverSubtitle}>Assessment Report</Text>

          {props.workloadName && (
            <View style={styles.coverWorkload}>
              <Text style={styles.coverWorkloadLabel}>Workload</Text>
              <Text style={styles.coverWorkloadName}>{props.workloadName}</Text>
            </View>
          )}

          {props.accountId && (
            <View style={styles.coverAccount}>
              <Text style={styles.coverAccountLabel}>Account ID</Text>
              <Text style={styles.coverAccountValue}>{props.accountId}</Text>
            </View>
          )}

          <View style={styles.coverDate}>
            <Text style={styles.coverDateLabel}>Report Generated</Text>
            <Text style={styles.coverDateValue}>{formatDate()}</Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={styles.coverStats}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalQuestions}</Text>
            <Text style={styles.statLabel}>Total Questions</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#ecfdf5' }]}>
            <Text style={[styles.statNumber, { color: '#059669' }]}>{stats.passedSuggestions}</Text>
            <Text style={styles.statLabel}>Passed Checks</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.statNumber, { color: '#dc2626' }]}>{stats.failedSuggestions}</Text>
            <Text style={styles.statLabel}>Failed Checks</Text>
          </View>
        </View>

        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>
            Generated using AWS Well-Architected Framework
          </Text>
        </View>
      </Page>

      {/* Content Pages */}
      <Page size="A4" style={styles.body} wrap>
        {/* Page Header */}
        <View style={styles.pageHeader} fixed>
          <PdfImage
            src={props.logo || LOGO}
            style={styles.headerLogo}
          />
          <Text style={styles.headerTitle}>Well-Architected Review</Text>
        </View>

        {/* Page Footer */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>
            {props.workloadName || 'Well-Architected Assessment'}
          </Text>
          <Text
            style={styles.footerPageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

        {/* Milestones Section */}
        {props?.milestones?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Milestones</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Milestone Name</Text>
                <Text style={styles.tableHeaderCell}>Unanswered</Text>
                <Text style={styles.tableHeaderCell}>High Risk</Text>
                <Text style={styles.tableHeaderCell}>Medium Risk</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Date</Text>
              </View>
              {props?.milestones
                ?.sort((a, b) => a.MilestoneNumber - b.MilestoneNumber)
                .map((milestone, i) => (
                  <View style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]} key={i}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{milestone.MilestoneName}</Text>
                    <Text style={styles.tableCell}>
                      {milestone?.WorkloadSummary?.RiskCounts?.UNANSWERED || 0}
                    </Text>
                    <Text style={[styles.tableCell, styles.highRisk]}>
                      {milestone?.WorkloadSummary?.RiskCounts?.HIGH || 0}
                    </Text>
                    <Text style={[styles.tableCell, styles.mediumRisk]}>
                      {milestone?.WorkloadSummary?.RiskCounts?.MEDIUM || 0}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.5 }]}>
                      {milestone.RecordedAt?.split('T')[0] || ''}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Questions by Lens */}
        {props?.allLenses?.map((lensGroup, lensIndex) => (
          <View key={lensIndex} break={lensIndex !== 0}>
            <View style={styles.lensHeader}>
              <Text style={styles.lensTitle}>
                {lensGroup.length > 0 && lensGroup[0]?.LensAlias
                  ? lensGroup[0]?.LensAlias.replace(/^arn:aws:wellarchitected::aws:lens\//, '').replace(/-/g, ' ')
                  : 'Well-Architected'}
              </Text>
            </View>

            {lensGroup.map((pillarGroup) => {
              const pillarInfo = getPillarInfo(pillarGroup.PillarId);
              return (
                <View key={pillarGroup.PillarId} style={styles.pillarSection}>
                  <View style={[styles.pillarHeader, { borderLeftColor: pillarInfo.color }]}>
                    <Text style={styles.pillarTitle}>{pillarInfo.value}</Text>
                    <Text style={styles.pillarCount}>
                      {pillarGroup.Questions.length} Questions
                    </Text>
                  </View>

                  {pillarGroup.Questions.map((question, qIndex) => (
                    <View style={styles.questionCard} key={question.QuestionId} wrap={false}>
                      <View style={styles.questionHeader}>
                        <Text style={styles.questionNumber}>Q{qIndex + 1}</Text>
                        <Text style={styles.questionTitle}>{question.QuestionTitle}</Text>
                      </View>

                      {props.options.notes && question?.Notes && (
                        <View style={styles.notesBox}>
                          <Text style={styles.notesLabel}>Notes</Text>
                          <Text style={styles.notesText}>{question.Notes}</Text>
                        </View>
                      )}

                      <View style={styles.choicesTable}>
                        <View style={[styles.choiceRow, styles.choiceHeader]}>
                          <Text style={[styles.choiceHeaderCell, { flex: 3 }]}>Choice</Text>
                          {props.options.suggestedColumn && (
                            <Text style={styles.choiceHeaderCell}>Suggested</Text>
                          )}
                          {props.options.answersColumn && (
                            <Text style={styles.choiceHeaderCell}>Answer</Text>
                          )}
                        </View>

                        {question?.Choices?.map((choice, i) => {
                          const context = choice.Context || {
                            failed: [],
                            passed: [],
                            notapplicable: [],
                            accountContext: [],
                          };
                          const accountContextPassed = (context.accountContext || []).filter(
                            (c) => c.result === 'True'
                          );
                          const accountContextFailed = (context.accountContext || []).filter(
                            (c) => c.result === 'False'
                          );

                          const hasPassed = (context.passed?.length > 0) || (accountContextPassed.length > 0);
                          const hasFailed = (context.failed?.length > 0) || (accountContextFailed.length > 0);
                          const isPassed = hasPassed && !hasFailed;

                          return (
                            <View style={[styles.choiceRow, i % 2 === 0 && styles.choiceRowAlt]} key={i}>
                              <View style={[styles.choiceCell, { flex: 3 }]}>
                                <Text style={styles.choiceTitle}>{choice.Title}</Text>

                                {props.options.recommendationDetails &&
                                  ((context.passed?.length > 0) ||
                                    (context.failed?.length > 0) ||
                                    (context.accountContext?.length > 0)) && (
                                    <View style={styles.assessmentDetails}>
                                      <Text style={styles.assessmentLabel}>Assessment Findings:</Text>
                                      {context.failed?.map((r, idx) => (
                                        <View style={styles.findingRow} key={`f-${idx}`}>
                                          <View style={[styles.findingDot, styles.findingDotFailed]} />
                                          <Text style={styles.findingText}>{r.title}</Text>
                                        </View>
                                      ))}
                                      {context.passed?.map((r, idx) => (
                                        <View style={styles.findingRow} key={`p-${idx}`}>
                                          <View style={[styles.findingDot, styles.findingDotPassed]} />
                                          <Text style={styles.findingText}>{r.title}</Text>
                                        </View>
                                      ))}
                                      {accountContextPassed.map((r, idx) => (
                                        <View style={styles.findingRow} key={`ap-${idx}`}>
                                          <View style={[styles.findingDot, styles.findingDotPassed]} />
                                          <Text style={styles.findingText}>{r.customAnswerText}</Text>
                                        </View>
                                      ))}
                                      {accountContextFailed.map((r, idx) => (
                                        <View style={styles.findingRow} key={`af-${idx}`}>
                                          <View style={[styles.findingDot, styles.findingDotFailed]} />
                                          <Text style={styles.findingText}>{r.customAnswerText}</Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                              </View>

                              {props.options.suggestedColumn && (
                                <View style={styles.choiceCell}>
                                  {(hasPassed || hasFailed) && (
                                    <View style={[
                                      styles.statusBadge,
                                      isPassed ? styles.statusPassed : styles.statusFailed
                                    ]}>
                                      <Text style={[
                                        styles.statusText,
                                        isPassed ? styles.statusTextPassed : styles.statusTextFailed
                                      ]}>
                                        {isPassed ? 'Pass' : 'Fail'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              {props.options.answersColumn && (
                                <View style={styles.choiceCell}>
                                  {question?.SelectedChoices?.includes(choice.ChoiceId) && (
                                    <View style={styles.checkMark}>
                                      <Text style={styles.checkMarkText}>Yes</Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  // Cover Page Styles
  coverPage: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Open Sans',
    display: 'flex',
    flexDirection: 'column',
  },
  coverHeader: {
    alignItems: 'center',
    marginBottom: 60,
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
    fontSize: 36,
    fontWeight: 700,
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 18,
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
  coverAccount: {
    alignItems: 'center',
    marginBottom: 20,
  },
  coverAccountLabel: {
    fontSize: 10,
    fontWeight: 500,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coverAccountValue: {
    fontSize: 14,
    fontWeight: 500,
    color: '#4b5563',
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
    minWidth: 120,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
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

  // Content Page Styles
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

  // Section Styles
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },

  // Table Styles
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
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
  highRisk: {
    color: '#dc2626',
    fontWeight: 600,
  },
  mediumRisk: {
    color: '#f59e0b',
    fontWeight: 600,
  },

  // Lens Styles
  lensHeader: {
    backgroundColor: '#1e40af',
    padding: '12 16',
    borderRadius: 6,
    marginBottom: 16,
  },
  lensTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
    textTransform: 'capitalize',
  },

  // Pillar Styles
  pillarSection: {
    marginBottom: 20,
  },
  pillarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: '10 14',
    borderLeftWidth: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  pillarTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1f2937',
  },
  pillarCount: {
    fontSize: 10,
    fontWeight: 500,
    color: '#6b7280',
  },

  // Question Styles
  questionCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fafafa',
    padding: '10 12',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  questionNumber: {
    fontSize: 10,
    fontWeight: 700,
    color: '#3b82f6',
    marginRight: 8,
    minWidth: 24,
  },
  questionTitle: {
    fontSize: 11,
    fontWeight: 500,
    color: '#1f2937',
    flex: 1,
  },
  notesBox: {
    backgroundColor: '#fefce8',
    padding: '8 12',
    borderBottomWidth: 1,
    borderBottomColor: '#fef08a',
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: '#a16207',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 9,
    color: '#713f12',
  },

  // Choices Table Styles
  choicesTable: {
    margin: 0,
  },
  choiceRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  choiceRowAlt: {
    backgroundColor: '#fafafa',
  },
  choiceHeader: {
    backgroundColor: '#f3f4f6',
  },
  choiceHeaderCell: {
    flex: 1,
    padding: '6 10',
    fontSize: 8,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  choiceCell: {
    flex: 1,
    padding: '8 10',
  },
  choiceTitle: {
    fontSize: 9,
    color: '#374151',
  },

  // Assessment Details
  assessmentDetails: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'dashed',
  },
  assessmentLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 4,
  },
  findingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  findingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    marginTop: 2,
  },
  findingDotPassed: {
    backgroundColor: '#22c55e',
  },
  findingDotFailed: {
    backgroundColor: '#ef4444',
  },
  findingText: {
    fontSize: 8,
    color: '#4b5563',
    flex: 1,
  },

  // Status Badge
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusPassed: {
    backgroundColor: '#dcfce7',
  },
  statusFailed: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 8,
    fontWeight: 600,
  },
  statusTextPassed: {
    color: '#166534',
  },
  statusTextFailed: {
    color: '#991b1b',
  },

  // Check Mark
  checkMark: {
    backgroundColor: '#dbeafe',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  checkMarkText: {
    fontSize: 8,
    fontWeight: 600,
    color: '#1e40af',
  },
});

export default PDFReport;
