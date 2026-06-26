import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Box, Package, Plus, ExternalLink } from 'lucide-react';
import StatusIndicator from '@/components/ui/status-indicator';
import { complianceReports } from '@/components/SecurityCompliance/complianceReportsData';
import { buildReportRoute } from '@/helpers/accountScans';

function WorkloadReportsTable({ reports = [], userProfile, workloadId }) {
  const navigate = useNavigate();

  const getScanNameDisplay = (scan) => {
    if (!scan) return 'Unknown Report';
    // Prioritize title like in reports history table
    if (scan.title) return scan.title;
    if (scan.reportName) return scan.reportName;
    if (scan.reportId) {
      // Try to get report name from complianceReports
      const reportConfig = complianceReports.find(
        (r) => r.id === scan.reportId
      );
      if (reportConfig) return reportConfig.name;
      return scan.reportId;
    }
    return scan.scanId || 'Unknown Report';
  };

  const getPermissionProfileName = (scan) => {
    if (!scan?.accountId) return null;
    const permission = userProfile?.agentPermissionProfiles?.find((p) => {
      const authProfile =
        typeof p.authProfile === 'string' ? JSON.parse(p.authProfile) : p.authProfile || {};
      return authProfile.awsAccountId === scan.accountId;
    });
    return permission?.name || null;
  };

  const mapScanStatusToUI = (status) => {
    if (!status) return 'in-progress';
    const upperStatus = status.toUpperCase();
    
    // Map to StatusIndicator expected values
    if (upperStatus === 'COMPLETED' || upperStatus.includes('SUCCESS') || upperStatus === 'COMPLETE') {
      return 'complete';
    }
    if (upperStatus === 'FAILED' || upperStatus === 'ERROR' || upperStatus === 'FAILURE') {
      return 'failed';
    }
    if (upperStatus === 'IN_PROGRESS' || upperStatus === 'RUNNING' || upperStatus === 'IN PROGRESS') {
      return 'in-progress';
    }
    if (upperStatus === 'PENDING' || upperStatus === 'QUEUED' || upperStatus === 'WAITING') {
      return 'in-progress';
    }
    
    // Default to in-progress for unknown statuses
    return 'in-progress';
  };

  const getStatusDisplay = (status) => {
    if (!status) return 'Unknown';
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'success') return 'Completed';
    if (statusLower === 'failed' || statusLower === 'error') return 'Failed';
    if (statusLower === 'in_progress' || statusLower === 'running') return 'In Progress';
    if (statusLower === 'pending' || statusLower === 'queued') return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const isScanCompleted = (status) => {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower === 'completed' || statusLower === 'success';
  };

  const handleViewReport = (scan) => {
    if (scan.scanId && scan.reportId) {
      const url = buildReportRoute(scan, { workloadId });
      if (!url) return;
      navigate(url, {
        state: {
          scanId: scan.scanId,
          reportId: scan.reportId,
        },
      });
    }
  };

  const handleRunNewReport = () => {
    navigate('/dashboard/reports/library');
  };

  if (!reports || reports.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900">Reports</h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunNewReport}
                className="flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Run New Report
              </Button>
              <Link
                to="/dashboard/reports"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View All
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <div className="text-center py-8">
            <div className="text-gray-500">No reports found for this workload</div>
            <div className="mt-2 text-sm text-gray-400">
              Reports will appear here when they are run for this workload's environments
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-semibold text-gray-900">Reports</h4>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunNewReport}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Run New Report
            </Button>
            <Link
              to="/dashboard/reports"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View All
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="max-h-[360px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="bg-white">Name</TableHead>
                  <TableHead className="bg-white">Cloud Environment</TableHead>
                  <TableHead className="bg-white">Status</TableHead>
                  <TableHead className="bg-white">Updated</TableHead>
                  <TableHead className="text-right bg-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((scan, index) => {
                  if (!scan) return null;
                  const uniqueKey = `${scan.scanId}-${index}`;

                  return (
                    <TableRow key={uniqueKey} className="hover:bg-gray-50">
                      <TableCell className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-blue-500" />
                        {getScanNameDisplay(scan)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {getPermissionProfileName(scan) || scan.accountId || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={mapScanStatusToUI(scan.status)} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatTimestamp(scan.lastUpdateTime)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => handleViewReport(scan)}
                        >
                          <Box className="w-3.5 h-3.5 mr-1.5" />
                          View Report
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkloadReportsTable;
