import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image as PdfImage,
} from '@react-pdf/renderer';
const LOGO = '/logo.png';

Font.register({
  family: 'Open Sans',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-regular.ttf',
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

const styles = StyleSheet.create({
  body: {
    paddingTop: 35,
    paddingBottom: 65,
    flexDirection: 'column',
    fontFamily: 'Open Sans',
  },
  logoContainer: {
    backgroundColor: '#f7f7f7',
    padding: 20,
    textAlign: 'center',
    marginTop: -35,
    marginHorizontal: -35,
    marginBottom: 20,
    alignItems: 'center',
    display: 'flex',
  },
  logoImage: {
    maxWidth: 200,
    marginHorizontal: 120,
    maxHeight: 120,
  },
  logoContainerFooter: {
    position: 'absolute',
    fontSize: 12,
    bottom: 30,
    right: 30,
    textAlign: 'center',
    color: 'grey',
  },
  container: {
    padding: 10,
    marginHorizontal: 10,
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    color: '#09111B',
    fontWeight: 'bold',
    fontFamily: 'Open Sans',
    textAlign: 'center',
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    marginTop: 10,
  },
  summaryItem: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  summaryHeader: {
    fontSize: 12,
    color: '#525252',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryContent: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  scoreBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  scoreBarContainer: {
    flexGrow: 1,
    backgroundColor: '#F7F8F8',
    borderRadius: 5,
    height: 10,
    marginRight: 5,
  },
  scoreBar: {
    height: 10,
    borderRadius: 5,
  },
  progressSuccess: {
    backgroundColor: '#69ae09',
  },
  progressWarning: {
    backgroundColor: '#d65a00',
  },
  progressError: {
    backgroundColor: '#FF4747',
  },
  scorePercentage: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  percentageSuccess: {
    color: '#69ae09',
  },
  percentageWarning: {
    color: '#d65a00',
  },
  percentageError: {
    color: '#FF4747',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E5E7E8',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7E8',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#ffffff',
  },
  tableRowGreen: {
    backgroundColor: '#eaf4dd',
  },
  tableRowRed: {
    backgroundColor: '#FFEDED',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2C35',
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 10,
    color: '#1F2C35',
    flexWrap: 'wrap',
  },
  col1: {
    width: '25%',
  },
  col2: {
    width: '50%',
  },
  col3: {
    width: '12.5%',
    textAlign: 'right',
  },
  col4: {
    width: '12.5%',
    textAlign: 'right',
  },
  passText: {
    color: '#69ae09',
    fontWeight: 'bold',
  },
  failText: {
    color: '#FF4747',
    fontWeight: 'bold',
  },
  neutralText: {
    color: '#8A8A8A',
  },
  affectedHeader: {
    fontSize: 16,
    marginBottom: 15,
    fontWeight: 'bold',
    fontFamily: 'Open Sans',
  },
  resourceContainer: {
    padding: 10,
    marginTop: 10,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#E5E7E8',
    borderRadius: 8,
    backgroundColor: '#F7F8F8',
    marginBottom: 16,
  },
  resourceTitle: {
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
    fontSize: 13,
    marginBottom: 10,
  },
  resourceTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  resourceRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 2,
  },
  resourceColumn: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    color: '#1F2C35',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#E5E7E8',
    flexWrap: 'wrap',
  },
  resourceColumnHeader: {
    fontWeight: 'bold',
    backgroundColor: '#f9fafb',
  },
  detailTableCol1: {
    width: '30%',
  },
  detailTableCol2: {
    width: '15%',
  },
  detailTableColCheck: {
    textAlign: 'center',
  },
  statusBadgePass: {
    color: '#69ae09',
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusBadgeFail: {
    color: '#FF4747',
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusBadgeNA: {
    color: '#8A8A8A',
    fontSize: 9,
  },
});

export const CompliancePDFDocument = ({ complianceResults }) => {
  const getStatusBadgeStyle = (isPassed, isFailed) => {
    if (isPassed) return styles.statusBadgePass;
    if (isFailed) return styles.statusBadgeFail;
    return styles.statusBadgeNA;
  };

  const getStatusText = (isPassed, isFailed) => {
    if (isPassed) return 'PASS';
    if (isFailed) return 'FAIL';
    return '—';
  };

  const getCheckColumnWidth = (numChecks) => {
    const fixedWidth = 45;
    const availableWidth = 100 - fixedWidth;
    return `${availableWidth / numChecks}%`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.body} wrap>
        {LOGO && (
          <View style={styles.logoContainer}>
            <PdfImage src={LOGO} style={styles.logoImage} />
          </View>
        )}

        <View style={styles.container}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Compliance Report Summary</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.affectedHeader}>Summary by Service</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.col1]}>
              AWS Service
            </Text>
            <Text style={[styles.tableHeaderCell, styles.col2]}>Feature</Text>
            <Text style={[styles.tableHeaderCell, styles.col3]}>Pass</Text>
            <Text style={[styles.tableHeaderCell, styles.col4]}>Fail</Text>
          </View>

          {Object.keys(complianceResults).map((group) =>
            Object.keys(complianceResults[group]['checks']).map(
              (feature, featureIdx) => {
                const isFirstFeature = featureIdx === 0;
                const passedCount =
                  complianceResults[group]['checks'][feature].passed.length;
                const failedCount =
                  complianceResults[group]['checks'][feature].failed.length;
                const hasFailed = failedCount > 0;
                const hasPassed = passedCount > 0;

                const rowStyle = hasFailed
                  ? styles.tableRowRed
                  : hasPassed
                    ? styles.tableRowGreen
                    : {};

                return (
                  <View
                    key={`${group}-${feature}`}
                    style={[styles.tableRow, rowStyle]}
                    wrap={false}
                  >
                    {isFirstFeature && (
                      <Text style={[styles.tableCell, styles.col1]}>
                        {complianceResults[group]['title']}
                      </Text>
                    )}
                    {!isFirstFeature && (
                      <Text style={[styles.tableCell, styles.col1]}></Text>
                    )}

                    <Text style={[styles.tableCell, styles.col2]}>
                      {feature}
                    </Text>

                    <Text
                      style={[
                        styles.tableCell,
                        styles.col3,
                        hasPassed ? styles.passText : styles.neutralText,
                      ]}
                    >
                      {passedCount}
                    </Text>

                    <Text
                      style={[
                        styles.tableCell,
                        styles.col4,
                        hasFailed ? styles.failText : styles.neutralText,
                      ]}
                    >
                      {failedCount}
                    </Text>
                  </View>
                );
              }
            )
          )}
        </View>

        {LOGO && (
          <View style={styles.logoContainerFooter} fixed>
            <PdfImage
              src={LOGO}
              style={{ maxWidth: 120, maxHeight: 80, height: 20 }}
            />
          </View>
        )}
      </Page>

      {Object.keys(complianceResults).map((group, groupIdx) => {
        const checks = Object.keys(complianceResults[group]['checks']);
        const numChecks = checks.length;
        const checkColWidth = getCheckColumnWidth(numChecks);

        return (
          <Page key={`detail-${groupIdx}`} size="A4" style={styles.body} wrap>
            <View style={styles.section}>
              <Text style={styles.affectedHeader}>
                Resource Details: {complianceResults[group].title}
              </Text>

              <View style={styles.resourceContainer}>
                <View style={styles.resourceTableHeader}>
                  <Text
                    style={[
                      styles.resourceColumn,
                      styles.resourceColumnHeader,
                      styles.detailTableCol1,
                    ]}
                  >
                    Resource
                  </Text>
                  <Text
                    style={[
                      styles.resourceColumn,
                      styles.resourceColumnHeader,
                      styles.detailTableCol2,
                    ]}
                  >
                    Region
                  </Text>
                  {checks.map((column, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.resourceColumn,
                        styles.resourceColumnHeader,
                        styles.detailTableColCheck,
                        { width: checkColWidth },
                      ]}
                    >
                      {column.length > 15
                        ? column.substring(0, 12) + '...'
                        : column}
                    </Text>
                  ))}
                </View>

                {complianceResults[group].resources?.map((row, idx) => (
                  <View key={idx} style={styles.resourceRow} wrap={false}>
                    <Text
                      style={[styles.resourceColumn, styles.detailTableCol1]}
                    >
                      {row['displayName']}
                    </Text>
                    <Text
                      style={[styles.resourceColumn, styles.detailTableCol2]}
                    >
                      {row['region']}
                    </Text>

                    {checks.map((rule, ruleIdx) => {
                      const passed = complianceResults[group]['checks'][
                        rule
                      ].passed.includes(row['displayName']);
                      const failed = complianceResults[group]['checks'][
                        rule
                      ].failed.includes(row['displayName']);

                      return (
                        <Text
                          key={ruleIdx}
                          style={[
                            styles.resourceColumn,
                            styles.detailTableColCheck,
                            getStatusBadgeStyle(passed, failed),
                            { width: checkColWidth },
                          ]}
                        >
                          {getStatusText(passed, failed)}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {/* Footer */}
            {LOGO && (
              <View style={styles.logoContainerFooter} fixed>
                <PdfImage
                  src={LOGO}
                  style={{ maxWidth: 120, maxHeight: 80, height: 20 }}
                />
              </View>
            )}
          </Page>
        );
      })}
    </Document>
  );
};
