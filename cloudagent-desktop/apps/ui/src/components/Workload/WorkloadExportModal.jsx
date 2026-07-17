import React, { useState, useCallback, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { toJpeg, toPng } from 'html-to-image';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';
import { Buffer } from 'buffer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, FileText, Lightbulb, Image as ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CloudNode,
  ContainerNode,
  autoLayoutDiagramSpec,
  specToFlow,
} from '@cloudagent/diagram-ui-core';
import WorkloadExportPDFDocument from './WorkloadExportPDFDocument';

const nodeTypes = {
  cloudNode: CloudNode,
  containerNode: ContainerNode,
};

if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

function WorkloadExportModal({
  open,
  onOpenChange,
  workload,
  executiveSummary,
  diagramSpec,
  accountScans = [],
  reports = [],
  permissionProfiles = [],
}) {
  const [options, setOptions] = useState({
    includeExecutiveSummary: true,
    includeDiagram: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [diagramNodes, setDiagramNodes] = useState([]);
  const [diagramEdges, setDiagramEdges] = useState([]);
  const [diagramReady, setDiagramReady] = useState(false);
  const diagramRef = useRef(null);
  const reactFlowInstance = useRef(null);

  useEffect(() => {
    if (!diagramSpec || !open) {
      setDiagramNodes([]);
      setDiagramEdges([]);
      setDiagramReady(false);
      reactFlowInstance.current = null;
      return;
    }
    try {
      // Use existing positions if available, don't force re-layout
      const layoutSpec = autoLayoutDiagramSpec(diagramSpec, { force: false });
      const { nodes, edges } = specToFlow(layoutSpec);
      setDiagramNodes(nodes);
      setDiagramEdges(edges);
      setDiagramReady(false);
    } catch {
      setDiagramNodes([]);
      setDiagramEdges([]);
      setDiagramReady(false);
    }
  }, [diagramSpec, open]);

  const handleDiagramInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
    // Fit view with padding after initialization
    setTimeout(() => {
      instance.fitView({ padding: 0.2, includeHiddenNodes: true });
      setDiagramReady(true);
    }, 200);
  }, []);

  const handleToggle = (key) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const hasAtLeastOneSection =
    options.includeExecutiveSummary ||
    options.includeDiagram;

  const waitForImages = async (container, { timeoutMs = 3000 } = {}) => {
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll('img'));
    if (imgs.length === 0) return;

    const pending = imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          const onDone = () => {
            img.removeEventListener('load', onDone);
            img.removeEventListener('error', onDone);
            resolve();
          };
          img.addEventListener('load', onDone);
          img.addEventListener('error', onDone);
        })
    );

    await Promise.race([
      Promise.all(pending),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  };

  const captureDiagramImage = useCallback(async ({ format = 'png' } = {}) => {
    if (!diagramRef.current || diagramNodes.length === 0) return null;
    
    const viewport = diagramRef.current.querySelector('.react-flow__viewport');
    const reactFlowCanvas = diagramRef.current.querySelector('.react-flow');
    if (!viewport || !reactFlowCanvas) return null;

    try {
      // Ensure fitView is called before capture
      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ padding: 0.12, includeHiddenNodes: true });
      }
      
      // Wait for images to load
      await waitForImages(reactFlowCanvas, { timeoutMs: 2500 });
      
      // Longer delay to ensure rendering and fitView is complete
      await new Promise(resolve => setTimeout(resolve, 600));

      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ padding: 0.12, includeHiddenNodes: true });
      }
      await new Promise(resolve => setTimeout(resolve, 200));

      const isJpeg = format === 'jpeg';
      const captureTarget = isJpeg ? reactFlowCanvas : viewport;
      const imageWidth = isJpeg ? 1400 : 1400;
      const imageHeight = isJpeg ? 950 : 1000;
      const exportImage = isJpeg ? toJpeg : toPng;

      const dataUrl = await exportImage(captureTarget, {
        backgroundColor: '#ffffff',
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
        },
        cacheBust: true,
        ...(isJpeg ? { quality: 0.72, pixelRatio: 1 } : {}),
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to capture diagram:', err);
      return null;
    }
  }, [diagramNodes]);

  const downloadDataUrl = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const getJsonSize = (value) => {
    try {
      return JSON.stringify(value || '').length;
    } catch {
      return -1;
    }
  };

  const handleExport = useCallback(async () => {
    if (!hasAtLeastOneSection) {
      toast.error('Please select at least one section to export.');
      return;
    }

    setIsExporting(true);
    const buildDocument = (documentOptions, image, dataOverrides = {}) => (
      <WorkloadExportPDFDocument
        workload={dataOverrides.workload ?? workload}
        executiveSummary={dataOverrides.executiveSummary ?? executiveSummary}
        diagramImage={image}
        accountScans={dataOverrides.accountScans ?? accountScans}
        reports={dataOverrides.reports ?? reports}
        permissionProfiles={permissionProfiles}
        options={documentOptions}
      />
    );

    const runPdfDiagnostics = async (originalError) => {
      const summaryText = executiveSummary?.summaryText || '';
      const sourceCount =
        executiveSummary?.sources && typeof executiveSummary.sources === 'object'
          ? Object.keys(executiveSummary.sources).length
          : 0;
      const baseOptions = {
        includeDiagram: false,
        includeExecutiveSummary: false,
        includeLatestReports: false,
        includeCoverSources: false,
      };
      const cases = [
        {
          label: 'cover only',
          options: baseOptions,
        },
        {
          label: 'cover + source report list',
          options: { ...baseOptions, includeCoverSources: true },
        },
        {
          label: 'executive summary only',
          options: { ...baseOptions, includeExecutiveSummary: true },
        },
        {
          label: 'latest reports first 5',
          options: { ...baseOptions, includeLatestReports: true },
          data: { reports: reports.slice(0, 5) },
        },
        {
          label: 'latest reports all',
          options: { ...baseOptions, includeLatestReports: true },
        },
        {
          label: 'summary + reports',
          options: {
            ...baseOptions,
            includeExecutiveSummary: true,
            includeLatestReports: true,
          },
        },
      ];

      console.error('[Workload PDF Export] Original export error:', originalError);
      console.info('[Workload PDF Export] Input sizes:', {
        workloadName: workload?.workloadName,
        summaryCharacters: summaryText.length,
        sourceReports: sourceCount,
        reports: reports.length,
        accountScans: accountScans.length,
        diagramNodes: diagramNodes.length,
        reportsJsonCharacters: getJsonSize(reports),
        accountScansJsonCharacters: getJsonSize(accountScans),
        options,
      });

      for (const diagnosticCase of cases) {
        try {
          const diagnosticBlob = await pdf(
            buildDocument(diagnosticCase.options, null, diagnosticCase.data)
          ).toBlob();
          console.info(`[Workload PDF Export] PASS: ${diagnosticCase.label}`, {
            bytes: diagnosticBlob.size,
            options: diagnosticCase.options,
          });
        } catch (caseError) {
          console.error(`[Workload PDF Export] FAIL: ${diagnosticCase.label}`, {
            error: caseError,
            options: diagnosticCase.options,
            data: diagnosticCase.data || null,
          });
        }
      }
    };

    try {
      const workloadName = workload?.workloadName || 'workload';
      const sanitizedName = workloadName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const timestamp = new Date().toISOString().split('T')[0];

      if (options.includeDiagram && diagramNodes.length > 0) {
        // Wait for diagram to be ready if needed
        if (!diagramReady) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        const diagramImage = await captureDiagramImage({ format: 'jpeg' });
        if (diagramImage) {
          const documentOptions = {
            ...options,
            includeDiagram: true,
          };

          try {
            const blob = await pdf(buildDocument(documentOptions, diagramImage)).toBlob();
            const filename = `${sanitizedName}-report-${timestamp}.pdf`;
            saveAs(blob, filename);
            toast.success('PDF exported successfully!');
            onOpenChange(false);
            return;
          } catch (pdfWithDiagramError) {
            console.warn(
              '[Workload PDF Export] PDF failed with embedded diagram; retrying without diagram.',
              pdfWithDiagramError
            );
            const diagramPng = await captureDiagramImage({ format: 'png' });
            if (diagramPng) {
              downloadDataUrl(diagramPng, `${sanitizedName}-diagram-${timestamp}.png`);
            }
          }
        } else {
          toast('Diagram could not be generated, continuing with PDF export.');
        }
      }

      const blob = await pdf(
        buildDocument(
          {
            ...options,
            includeDiagram: false,
          },
          null
        )
      ).toBlob();
      const filename = `${sanitizedName}-report-${timestamp}.pdf`;

      saveAs(blob, filename);
      toast.success(
        options.includeDiagram
          ? 'PDF exported successfully. Diagram downloaded as a separate PNG.'
          : 'PDF exported successfully!'
      );
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      console.info('[Workload PDF Export] Starting diagnostics after export failure...');
      try {
        await runPdfDiagnostics(error);
        console.info('[Workload PDF Export] Diagnostics complete.');
      } catch (diagnosticError) {
        console.error('[Workload PDF Export] Diagnostics crashed:', diagnosticError);
      }
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [workload, executiveSummary, accountScans, reports, permissionProfiles, options, hasAtLeastOneSection, onOpenChange, diagramNodes, diagramReady, captureDiagramImage]);

  const getSectionCounts = () => {
    return {
      executiveSummary: executiveSummary?.summaryText ? 1 : 0,
      diagram: diagramNodes.length > 0 ? 1 : 0,
    };
  };

  const counts = getSectionCounts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary-600" />
            Export Workload Report
          </DialogTitle>
          <DialogDescription>
            Select which sections to include in your PDF export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              options.includeExecutiveSummary
                ? 'border-primary-300 bg-primary-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  options.includeExecutiveSummary ? 'bg-primary-100' : 'bg-gray-100'
                }`}
              >
                <FileText
                  className={`w-4 h-4 ${
                    options.includeExecutiveSummary ? 'text-primary-600' : 'text-gray-500'
                  }`}
                />
              </div>
              <div>
                <Label htmlFor="executive-summary" className="font-medium cursor-pointer">
                  Executive Summary
                </Label>
                <p className="text-xs text-gray-500">
                  {counts.executiveSummary > 0
                    ? 'AI-generated overview of your workload'
                    : 'No summary available'}
                </p>
              </div>
            </div>
            <Switch
              id="executive-summary"
              checked={options.includeExecutiveSummary}
              onCheckedChange={() => handleToggle('includeExecutiveSummary')}
              className="data-[state=checked]:bg-primary-500"
            />
          </div>

          <div
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              options.includeDiagram
                ? 'border-primary-300 bg-primary-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  options.includeDiagram ? 'bg-primary-100' : 'bg-gray-100'
                }`}
              >
                <ImageIcon
                  className={`w-4 h-4 ${
                    options.includeDiagram ? 'text-primary-600' : 'text-gray-500'
                  }`}
                />
              </div>
              <div>
                <Label htmlFor="diagram" className="font-medium cursor-pointer">
                  Architecture Diagram
                </Label>
                <p className="text-xs text-gray-500">
                  {counts.diagram > 0
                    ? 'Downloads as a separate PNG with the PDF'
                    : 'No diagram available'}
                </p>
              </div>
            </div>
            <Switch
              id="diagram"
              checked={options.includeDiagram}
              onCheckedChange={() => handleToggle('includeDiagram')}
              className="data-[state=checked]:bg-primary-500"
            />
          </div>
        </div>

        {/* Hidden diagram renderer for PNG capture */}
        {options.includeDiagram && diagramNodes.length > 0 && (
          <div
            ref={diagramRef}
            className="fixed -left-[9999px] -top-[9999px] pointer-events-none"
            style={{ width: 1800, height: 1200 }}
          >
            <ReactFlow
              nodes={diagramNodes}
              edges={diagramEdges}
              nodeTypes={nodeTypes}
              onInit={handleDiagramInit}
              fitView
              fitViewOptions={{
                padding: 0.25,
                includeHiddenNodes: true,
                minZoom: 0.05,
                maxZoom: 1,
              }}
              minZoom={0.01}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !hasAtLeastOneSection}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WorkloadExportModal;
