import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Maximize2, ArrowRight } from 'lucide-react';
import {
  DiagramEditor,
  autoLayoutDiagramSpec,
} from '@cloudagent/diagram-ui-core';

function specSignature(spec) {
  if (!spec) return null;
  try {
    return JSON.stringify(spec);
  } catch {
    return null;
  }
}

function hasSavedPositions(spec) {
  return Array.isArray(spec?.nodes)
    ? spec.nodes.some(
        (node) =>
          Number.isFinite(node?.x) &&
          Number.isFinite(node?.y)
      )
    : false;
}

function prepareDiagramSpec(spec) {
  if (!spec) return null;
  return autoLayoutDiagramSpec(spec, { force: !hasSavedPositions(spec) });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return null;
  }
}

function WorkloadDiagramCard({
  diagramSpec,
  diagramGeneratedAt,
  diagramUpdatedAt,
  onRefreshDiagram,
  onSaveDiagramSpec,
  onApplyDiagramInstruction,
  isRefreshingDiagram,
  isSavingDiagram,
  isApplyingDiagramInstruction = false,
  previewMode = false,
  minimalPreview = false,
  onExpandClick,
}) {
  const [editorInitialSpec, setEditorInitialSpec] = useState(null);
  const [currentSpec, setCurrentSpec] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [diagramInstruction, setDiagramInstruction] = useState('');
  const saveTokenRef = useRef(0);
  const lastLoadedSignatureRef = useRef(null);
  const lastAttemptedSaveSignatureRef = useRef(null);
  const editorPanelRef = useRef(null);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!diagramSpec) {
      setEditorInitialSpec(null);
      setCurrentSpec(null);
      lastLoadedSignatureRef.current = null;
      return;
    }
    const prepared = prepareDiagramSpec(diagramSpec);
    const signature = specSignature(prepared);
    lastLoadedSignatureRef.current = signature;
    lastAttemptedSaveSignatureRef.current = null;
    setEditorInitialSpec(prepared);
    setCurrentSpec(prepared);
    setEditorKey((value) => value + 1);
  }, [diagramSpec]);

  useEffect(() => {
    if (!currentSpec || typeof onSaveDiagramSpec !== 'function') return undefined;
    const signature = specSignature(currentSpec);
    if (!signature || signature === lastLoadedSignatureRef.current) {
      return undefined;
    }
    if (signature === lastAttemptedSaveSignatureRef.current) {
      return undefined;
    }

    const token = saveTokenRef.current + 1;
    saveTokenRef.current = token;
    lastAttemptedSaveSignatureRef.current = signature;

    const timer = setTimeout(async () => {
      try {
        await onSaveDiagramSpec(currentSpec);
        if (saveTokenRef.current === token) {
          lastLoadedSignatureRef.current = signature;
        }
      } catch {
        // Parent reports save errors.
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [currentSpec, onSaveDiagramSpec]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const element = editorPanelRef.current;
      if (!element?.requestFullscreen) return;
      await element.requestFullscreen();
    } catch {
      // Ignore browser fullscreen restrictions.
    }
  };

  const generatedLabel = formatTimestamp(diagramGeneratedAt);
  const updatedLabel = formatTimestamp(diagramUpdatedAt);
  const hasDiagramMetadata = Boolean(diagramGeneratedAt || diagramUpdatedAt);
  const showLoadingState = isRefreshingDiagram || (!editorInitialSpec && hasDiagramMetadata);
  const canApplyInstruction =
    typeof onApplyDiagramInstruction === 'function' &&
    editorInitialSpec &&
    diagramInstruction.trim().length > 0 &&
    !isApplyingDiagramInstruction &&
    !isRefreshingDiagram;

  const submitDiagramInstruction = async () => {
    const instruction = diagramInstruction.trim();
    if (!instruction || typeof onApplyDiagramInstruction !== 'function') return;
    try {
      await onApplyDiagramInstruction(instruction);
      setDiagramInstruction('');
    } catch {
      // Parent reports update errors.
    }
  };

  // Minimal preview mode: just the diagram, no wrapper, no toolbar, zoomed to fit
  if (previewMode && minimalPreview) {
    if (!editorInitialSpec) return null;
    return (
      <div className="diagram-minimal-preview" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <style>{`
          .diagram-minimal-preview [class*="toolbar"],
          .diagram-minimal-preview [class*="Toolbar"],
          .diagram-minimal-preview [class*="controls"],
          .diagram-minimal-preview [class*="Controls"],
          .diagram-minimal-preview [class*="sidebar"],
          .diagram-minimal-preview [class*="Sidebar"],
          .diagram-minimal-preview .react-flow__panel,
          .diagram-minimal-preview .react-flow__controls,
          .diagram-minimal-preview .react-flow__attribution,
          .diagram-minimal-preview .react-flow__minimap,
          .diagram-minimal-preview header,
          .diagram-minimal-preview footer,
          .diagram-minimal-preview nav,
          .diagram-minimal-preview button:not(.react-flow__node button) {
            display: none !important;
          }
          .diagram-minimal-preview .react-flow {
            background: transparent !important;
          }
          .diagram-minimal-preview__inner {
            width: 200%;
            height: 200%;
            transform: scale(0.5);
            transform-origin: top left;
          }
        `}</style>
        <div className="diagram-minimal-preview__inner">
          <DiagramEditor
            key={editorKey}
            initialSpec={editorInitialSpec}
            interactionMode="view-only"
            isFullscreen={false}
            fullscreenEnabled={false}
            onToggleFullscreen={() => {}}
            onSpecChange={() => {}}
          />
        </div>
      </div>
    );
  }

  // Preview mode: static display with click-to-expand
  if (previewMode) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Architecture Diagram</div>
            {updatedLabel ? (
              <div className="text-xs text-gray-500">Updated {updatedLabel}</div>
            ) : generatedLabel ? (
              <div className="text-xs text-gray-500">Generated {generatedLabel}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRefreshDiagram && onRefreshDiagram()}
              disabled={isRefreshingDiagram}
              title={diagramSpec ? 'Regenerate diagram' : 'Generate diagram'}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshingDiagram ? 'animate-spin' : ''}`}
              />
            </Button>
            {onExpandClick && editorInitialSpec && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExpandClick}
                className="flex items-center gap-1.5"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Expand
              </Button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onExpandClick}
          disabled={!editorInitialSpec || !onExpandClick}
          className="w-full relative rounded border border-gray-200 bg-gray-50 overflow-hidden group cursor-pointer disabled:cursor-default"
          style={{ minHeight: '280px', maxHeight: '360px' }}
        >
          {editorInitialSpec ? (
            <>
              <div className="h-[320px] pointer-events-none">
                <DiagramEditor
                  key={editorKey}
                  initialSpec={editorInitialSpec}
                  interactionMode="view-only"
                  isFullscreen={false}
                  fullscreenEnabled={false}
                  onToggleFullscreen={() => {}}
                  onSpecChange={() => {}}
                />
              </div>
              {/* Click to interact overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-200 text-sm text-gray-700">
                  <Maximize2 className="h-4 w-4" />
                  Click to interact with diagram
                </div>
              </div>
            </>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-center px-4 text-sm text-gray-500">
              {showLoadingState ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <div>{hasDiagramMetadata ? 'Loading architecture diagram...' : 'Generating architecture diagram...'}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-gray-400">No diagram generated yet</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshDiagram && onRefreshDiagram();
                    }}
                    disabled={isRefreshingDiagram}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshingDiagram ? 'animate-spin' : ''}`} />
                    Generate Diagram
                  </Button>
                </div>
              )}
            </div>
          )}
        </button>
      </div>
    );
  }

  // Full interactive mode
  return (
    <div
      ref={editorPanelRef}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Architecture Diagram</div>
          {updatedLabel ? (
            <div className="text-xs text-gray-500">Updated {updatedLabel}</div>
          ) : generatedLabel ? (
            <div className="text-xs text-gray-500">Generated {generatedLabel}</div>
          ) : null}
          <div className="mt-1 text-xs text-gray-500">
            Drag resources to rearrange them. Layout saves automatically.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRefreshDiagram && onRefreshDiagram()}
            disabled={isRefreshingDiagram}
            title={diagramSpec ? 'Regenerate diagram' : 'Generate diagram'}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshingDiagram ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex-1 rounded border border-gray-200 bg-gray-50 p-3 min-h-[420px]">
        {editorInitialSpec ? (
          <div className="relative h-full">
            <DiagramEditor
              key={editorKey}
              initialSpec={editorInitialSpec}
              interactionMode="move-only"
              isFullscreen={isFullscreen}
              fullscreenEnabled={
                typeof document !== 'undefined'
                  ? Boolean(document.fullscreenEnabled)
                  : true
              }
              onToggleFullscreen={toggleFullscreen}
              onSpecChange={(nextSpec) => setCurrentSpec(nextSpec)}
            />

            {typeof onApplyDiagramInstruction === 'function' ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
                <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-gray-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
                  <input
                    type="text"
                    value={diagramInstruction}
                    onChange={(event) => setDiagramInstruction(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (canApplyInstruction) {
                          submitDiagramInstruction();
                        }
                      }
                    }}
                    placeholder="Describe a diagram update..."
                    className="h-10 flex-1 border-0 bg-transparent px-2 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    disabled={isApplyingDiagramInstruction}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    disabled={!canApplyInstruction}
                    onClick={submitDiagramInstruction}
                    title="Apply AI diagram update"
                  >
                    {isApplyingDiagramInstruction ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="h-full min-h-[360px] flex items-center justify-center text-center px-4 text-sm text-gray-500">
            {showLoadingState ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <div>{hasDiagramMetadata ? 'Loading architecture diagram...' : 'Generating architecture diagram...'}</div>
              </div>
            ) : (
              <div>Click refresh to generate an editable architecture diagram for this workload.</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500 min-h-[1rem]">
        {isApplyingDiagramInstruction
          ? 'Applying AI diagram update...'
          : isSavingDiagram
            ? 'Saving layout...'
            : '\u00a0'}
      </div>
    </div>
  );
}

export default WorkloadDiagramCard;
