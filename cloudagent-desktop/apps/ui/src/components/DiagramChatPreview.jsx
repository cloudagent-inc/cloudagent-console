import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  applyEdgeChanges,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import {
  CloudNode,
  ContainerNode,
  autoLayoutDiagramSpec,
  assignEdgeHandles,
  getManifestStatus,
  preloadIconManifest,
  specToFlow,
} from '@cloudagent/diagram-ui-core';

const nodeTypes = {
  cloudNode: CloudNode,
  containerNode: ContainerNode,
};

const IMPORT_KEY = 'cloudagent_diagrammer_import';

const DIAGRAM_STYLES = `
  .diagram-chat-preview { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #ffffff; }
  .diagram-chat-preview__header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .diagram-chat-preview__title { font-size: 12px; font-weight: 700; color: #334155; }
  .diagram-chat-preview__headerActions { display: flex; align-items: center; gap: 12px; }
  .diagram-chat-preview__toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; background: #ffffff; }
  .diagram-chat-preview__toolbarError { width: 100%; font-size: 11px; color: #b91c1c; margin-top: 4px; }
  .diagram-chat-preview__btn { font-size: 11px; font-weight: 600; padding: 6px 10px; border-radius: 10px; border: 1px solid #cbd5f5; background: #ffffff; color: #334155; transition: all 0.2s ease; }
  .diagram-chat-preview__btn:hover { border-color: #94a3b8; color: #0f172a; }
  .diagram-chat-preview__btn:disabled { opacity: 0.5; cursor: not-allowed; border-color: #e2e8f0; color: #94a3b8; }
  .diagram-chat-preview__btn--primary { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
  .diagram-chat-preview__btn--ghost { border: none; background: transparent; padding: 0; }
  .diagram-chat-preview .react-flow__edge-path { stroke: #334155; stroke-width: 2.4; }
  .diagram-chat-preview .react-flow__edge.selected .react-flow__edge-path { stroke: #0ea5e9; stroke-width: 2.8; }
  .diagram-chat-preview .react-flow__edge.selected marker path { fill: #0ea5e9; }
  .diagram-chat-preview .react-flow__node .react-flow__handle { width: 8px; height: 8px; background: #0f172a; border: 2px solid #ffffff; opacity: 0; }
  .diagram-chat-preview .react-flow__nodes { z-index: 10 !important; }
  .diagram-chat-preview .react-flow__edges { z-index: 5 !important; }
  .diagram-chat-preview .react-flow__edge-interaction { stroke-opacity: 0; }
  .diagram-chat-preview .container-node { width: 100%; height: 100%; border: 1.5px solid rgba(148, 163, 184, 0.70); border-radius: 14px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06); }
  .diagram-chat-preview .container-node__header { padding: 10px 12px 8px; display: flex; flex-direction: column; gap: 2px; }
  .diagram-chat-preview .container-node__title { display: flex; align-items: center; gap: 8px; }
  .diagram-chat-preview .container-node__titleIcon { width: 18px; height: 18px; border-radius: 6px; background: rgba(255,255,255,0.75); border: 1px solid rgba(148, 163, 184, 0.55); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .diagram-chat-preview .container-node__titleIcon img { width: 100%; height: 100%; object-fit: contain; }
  .diagram-chat-preview .container-node__titleIcon span { font-weight: 900; font-size: 10px; color: #0f172a; letter-spacing: 0.3px; }
  .diagram-chat-preview .container-node__label { font-weight: 900; font-size: 13px; color: #0f172a; }
  .diagram-chat-preview .container-node__body { height: calc(100% - 44px); }
  .diagram-chat-preview .cloud-node { width: 160px; background: transparent; border: none; }
  .diagram-chat-preview .cloud-node__inner { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0; }
  .diagram-chat-preview .cloud-node__icon { width: 92px; height: 92px; border-radius: 18px; overflow: hidden; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 10px 18px rgba(15, 23, 42, 0.14)); }
  .diagram-chat-preview .cloud-node__icon img { width: 100%; height: 100%; object-fit: contain; }
  .diagram-chat-preview .cloud-node__glyph { width: 100%; height: 100%; border-radius: 18px; background: #ffffff; border: 1px solid rgba(148, 163, 184, 0.55); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #0f172a; font-size: 12px; letter-spacing: 0.3px; }
  .diagram-chat-preview .cloud-node__label { font-weight: 700; color: #0f172a; font-size: 12px; line-height: 1.15; text-align: center; max-width: 160px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .diagram-chat-preview__overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .diagram-chat-preview__overlayPanel { width: min(1200px, 96vw); background: #ffffff; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.55); box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35); overflow: hidden; }
  .diagram-chat-preview__overlayHeader { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .diagram-chat-preview__overlayTitle { font-weight: 800; font-size: 14px; color: #0f172a; }
  .diagram-chat-preview__overlayBody { height: 70vh; display: flex; flex-direction: column; }
  .diagram-chat-preview__overlayCanvas { flex: 1; min-height: 0; }
`;

const formatExportError = (err) => {
  if (!err) return 'Export failed.';
  if (typeof err === 'string') return err;
  if (typeof Event !== 'undefined' && err instanceof Event) {
    const target = err.target;
    const src = target && typeof target === 'object' ? target.src || target.currentSrc : null;
    const type = err.type || 'error';
    return src ? `Export failed: image load ${type} (${src})` : `Export failed: image load ${type}.`;
  }
  return err?.message || String(err);
};

const waitForImages = async (container, { timeoutMs = 2000 } = {}) => {
  if (!container) return;
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return;

  const failures = [];
  const pending = imgs.map(
    (img) =>
      new Promise((resolve) => {
        try {
          if (img.complete) {
            if (img.naturalWidth === 0) failures.push(img);
            return resolve();
          }
          const onDone = () => {
            if (img.naturalWidth === 0) failures.push(img);
            img.removeEventListener('load', onDone);
            img.removeEventListener('error', onDone);
            resolve();
          };
          img.addEventListener('load', onDone);
          img.addEventListener('error', onDone);
        } catch {
          resolve();
        }
      })
  );

  await Promise.race([
    Promise.all(pending),
    new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(timeoutMs) || 0))),
  ]);

  if (failures.length > 0) {
    const sample = failures
      .slice(0, 3)
      .map((img) => img.currentSrc || img.src || '(unknown)')
      .join(', ');
    throw new Error(`Export failed: ${failures.length} image(s) failed to load (${sample}).`);
  }
};

export default function DiagramChatPreview({ payload, onCloseChat }) {
  const [manifestStatus, setManifestStatus] = useState(getManifestStatus());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const provider = payload?.provider || 'aws';
  const spec = payload?.spec || null;
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const flowRef = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    let active = true;
    preloadIconManifest().finally(() => {
      if (!active) return;
      setManifestStatus(getManifestStatus());
    });
    return () => {
      active = false;
    };
  }, []);

  const applyLayout = useCallback(
    (sourceSpec, shouldFit = true) => {
      if (!sourceSpec) return;
      const laidOut = autoLayoutDiagramSpec(sourceSpec, { force: true, tighten: true });
      const base = specToFlow(laidOut, { provider });
      const nextNodes = base.nodes;
      const nextEdges = assignEdgeHandles(nextNodes, base.edges);
      setNodes(nextNodes);
      setEdges(nextEdges);
      if (shouldFit) {
        requestAnimationFrame(() => {
          flowRef.current?.fitView?.({ padding: 0.3, duration: 0 });
        });
      }
    },
    [provider, setEdges, setNodes]
  );

  useEffect(() => {
    if (!spec) return;
    applyLayout(spec, true);
  }, [spec, provider, manifestStatus, applyLayout]);

  useEffect(() => {
    if (!nodes.length) return;
    setEdges((current) => assignEdgeHandles(nodes, current));
  }, [nodes, setEdges]);

  const handleNodesChange = useCallback(
    (changes) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [setEdges]
  );

  const handleExportPng = useCallback(async () => {
    if (!nodes.length) return;
    const wrap = canvasRef.current;
    if (!wrap) return;
    const viewport = wrap.querySelector('.react-flow__viewport');
    if (!viewport) return;

    const bounds = getNodesBounds(nodes);
    if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return;

    const padding = 0.18;
    const imageWidth = Math.max(900, Math.ceil(bounds.width + 400));
    const imageHeight = Math.max(700, Math.ceil(bounds.height + 320));
    const viewportTransform = getViewportForBounds(bounds, imageWidth, imageHeight, padding, 2);

    setExporting(true);
    setExportError(null);
    try {
      await waitForImages(viewport, { timeoutMs: 2400 });
      const dataUrl = await toPng(viewport, {
        backgroundColor: '#ffffff',
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`,
        },
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = 'diagram.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setExportError(formatExportError(err));
    } finally {
      setExporting(false);
    }
  }, [nodes]);

  const renderToolbar = () => (
    <div className="diagram-chat-preview__toolbar">
      <button
        type="button"
        className="diagram-chat-preview__btn"
        disabled
        title="Add nodes is available in Diagrammer"
      >
        Add
      </button>
      <button
        type="button"
        className="diagram-chat-preview__btn"
        onClick={() => applyLayout(spec, true)}
      >
        Refresh layout
      </button>
      <button
        type="button"
        className="diagram-chat-preview__btn diagram-chat-preview__btn--primary"
        onClick={handleExportPng}
        disabled={exporting || nodes.length === 0}
      >
        {exporting ? 'Exporting...' : 'Export PNG'}
      </button>
      {exportError && (
        <div className="diagram-chat-preview__toolbarError">{exportError}</div>
      )}
    </div>
  );

  if (!spec) {
    return null;
  }

  return (
    <div
      className="diagram-chat-preview"
      style={{ maxWidth: 560, width: '90%', margin: '0 auto' }}
    >
      <style>{DIAGRAM_STYLES}</style>
      <div className="diagram-chat-preview__header">
        <div className="diagram-chat-preview__title">Diagram Preview</div>
        <div className="diagram-chat-preview__headerActions">
          <button
            type="button"
            className="diagram-chat-preview__btn diagram-chat-preview__btn--ghost"
            onClick={() => setIsFullscreen(true)}
          >
            Full Screen
          </button>
          <button
            type="button"
            className="diagram-chat-preview__btn diagram-chat-preview__btn--ghost"
            onClick={() => {
              const payloadToSave = {
                provider,
                sessionId: payload?.sessionId || null,
                spec,
              };
              try {
                sessionStorage.setItem(IMPORT_KEY, JSON.stringify(payloadToSave));
              } catch {
                // ignore storage failures
              }
              onCloseChat?.();
              navigate('/tools/cloud-diagrammer');
            }}
          >
            Edit in Diagrammer
          </button>
        </div>
      </div>
      {renderToolbar()}
      <div className="h-[320px]">
        <div ref={canvasRef} className="h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            nodeTypes={nodeTypes}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnScroll
            panOnDrag
            zoomOnScroll
            minZoom={0.05}
            maxZoom={4}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
          >
            <Background color="#e2e8f0" gap={24} />
          </ReactFlow>
        </div>
      </div>
      {isFullscreen && (
        <div className="diagram-chat-preview__overlay" role="dialog" aria-modal="true">
          <div className="diagram-chat-preview__overlayPanel">
            <div className="diagram-chat-preview__overlayHeader">
              <div className="diagram-chat-preview__overlayTitle">Diagram Preview</div>
              <button
                type="button"
                className="text-xs font-semibold text-gray-600 hover:text-gray-800"
                onClick={() => setIsFullscreen(false)}
              >
                Close
              </button>
            </div>
            <div className="diagram-chat-preview__overlayBody">
              {renderToolbar()}
              <div className="diagram-chat-preview__overlayCanvas">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  nodeTypes={nodeTypes}
                  nodesDraggable
                  nodesConnectable={false}
                  elementsSelectable
                  panOnScroll
                  panOnDrag
                  zoomOnScroll
                  minZoom={0.05}
                  maxZoom={4}
                  fitView
                  fitViewOptions={{ padding: 0.3 }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="#e2e8f0" gap={24} />
                </ReactFlow>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
