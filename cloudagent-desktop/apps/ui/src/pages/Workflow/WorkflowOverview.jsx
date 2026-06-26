// src/pages/WorkflowOverviewPage.jsx (or your preferred location)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  useReactFlow,
} from 'reactflow';
import {
  Loader2,
  AlertTriangle,
  Edit,
  ChevronLeft,
  Package,
  Play,
} from 'lucide-react'; // Assuming lucide-react for icons
import { Button } from '../../components/ui/button'; // Adjust path as needed
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';

import { Progress } from '@/components/ui/progress';
// --- Import shared logic and components ---
// Adjust paths based on your project structure
import {
  transformWorkflowToNodes,
  buildEdgesFromNodes,
  getLayoutedElements,
  reactFlowNodeTypes,
  nodeStyles,
} from './index'; // Or wherever these live
import QuickRunWorkflowModal from '../../components/workflows/QuickRunWorkflowModal';
import { runWorkflow } from '../../api/apigw';
import { createWorkflow } from '../../features/workflow/workflowSlice';

import 'reactflow/dist/style.css';
import './WorkflowOverview.css'; // Create a CSS file for styling

// --------------------------------------------------
// Helper: Apply Read-Only Callbacks (Removes Delete)
// --------------------------------------------------
// We need a version that doesn't add the onDelete handler
const applyReadOnlyCallbacks = (nodeArr, handleHeightMeasured) => {
  return nodeArr.map((n) => {
    const data = {
      ...n.data,
      onHeightMeasured: handleHeightMeasured || (() => {}), // Still useful for potential future uses
      onDelete: undefined, // Explicitly ensure no delete callback
      layoutDirection: 'TB', // Use vertical layout for overview
    };
    // Remove potentially sensitive or interactive data fields if necessary for read-only view
    // delete data.interactiveField;
    return { ...n, data };
  });
};

// --------------------------------------------------
// Internal Read-Only Flow Component
// --------------------------------------------------
function ReadOnlyFlow({ workflowData }) {
  // Hooks needed for layout and rendering within the Provider context
  const reactFlowInstance = useReactFlow(); // Needed if fitView is called here
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLayoutApplied, setIsLayoutApplied] = useState(false);

  // Memoize default edge options (copy from FlowEditor or define here)
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep', // Or your preferred type
      animated: false,
      style: { strokeWidth: 1.5, stroke: '#888' },
      markerEnd: { type: 'arrowclosed', width: 15, height: 15, color: '#888' }, // Use string type for MarkerType here if not importing it
    }),
    []
  );

  // --- Effect to Process Data and Apply Layout ---
  useEffect(() => {
    // Guard: Only run if instance is ready, data exists, and layout not applied yet
    if (!reactFlowInstance || !workflowData || isLayoutApplied) {
      return;
    }


    // 1. Transform fetched workflow nodes
    const initialNodesRaw = transformWorkflowToNodes(
      workflowData,
      () => {}, // Pass dummy height measurement callback if not needed
      'TB' // Use vertical layout for overview
    );

    // 2. Build initial edges
    const initialEdges = buildEdgesFromNodes(
      initialNodesRaw,
      defaultEdgeOptions
    );

    // 3. Calculate layout using Dagre
    let finalNodesWithPositions;
    if (initialNodesRaw.length > 0) {
      finalNodesWithPositions = getLayoutedElements(
        initialNodesRaw,
        initialEdges,
        'TB'
      );
    } else {
      finalNodesWithPositions = [];
    }

    // 4. Apply READ-ONLY interaction callbacks (removes delete icon etc.)
    const finalNodesForDisplay = applyReadOnlyCallbacks(
      finalNodesWithPositions,
      () => {} // Dummy height callback
    );

    // 5. Set React Flow state
    setNodes(finalNodesForDisplay);
    setEdges(initialEdges);
    setIsLayoutApplied(true);

    // 6. Fit the view - Use a timeout to ensure rendering is complete
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.1, duration: 300 });
      }
    }, 100);
  }, [reactFlowInstance, workflowData, isLayoutApplied, defaultEdgeOptions]); // Dependencies

  return (
    <div className="workflow-diagram-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={reactFlowNodeTypes} // Use the same node components
        defaultEdgeOptions={defaultEdgeOptions}
        style={{ background: '#FAFAFA' }} // Or your preferred background
        // --- Read-Only Settings ---
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true} // Allow panning
        zoomOnScroll={true} // Allow zooming
        zoomOnDoubleClick={true} // Allow double-click zoom
        fitView // Initial fitView call
        fitViewOptions={{ padding: 0.1 }}
        proOptions={{ hideAttribution: true }}
        // --- End Read-Only Settings ---
      >
        <Background variant="dots" gap={15} size={1} color="#eee" />
        {/* No <Controls /> */}
      </ReactFlow>
    </div>
  );
}

// --------------------------------------------------
// Main Overview Page Component
// --------------------------------------------------
export default function WorkflowOverviewPage() {
  useEffect(() => {
    // Ensure the page scrolls to the top when this component mounts
    window.scrollTo(0, 0);
  }, []);
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.auth);

  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(true);
  const [workflowLoadError, setWorkflowLoadError] = useState(null);
  const [workflowData, setWorkflowData] = useState(null); // Store the entire fetched workflow object
  const [isQuickRunOpen, setIsQuickRunOpen] = useState(false);
  const [quickRunSubmitting, setQuickRunSubmitting] = useState(false);

  // --- Fetch Workflow Data ---
  useEffect(() => {
    if (!workflowId) {
      setWorkflowLoadError('Workflow ID missing from URL.');
      setIsLoadingWorkflow(false);
      return;
    }

    const fetchWorkflow = async () => {
      setIsLoadingWorkflow(true);
      setWorkflowLoadError(null);
      setWorkflowData(null); // Clear previous data

      const url = `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/workflows/${workflowId}.json`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `HTTP error ${response.status}: ${response.statusText}`
          );
        }
        const data = await response.json();
        if (!data || !data.nodes || !Array.isArray(data.nodes)) {
          throw new Error('Invalid workflow data format received.');
        }
        setWorkflowData(data); // Store the fetched data
      } catch (error) {
        console.error('Failed to fetch workflow:', error);
        setWorkflowLoadError(error.message || 'Failed to load workflow data.');
      } finally {
        setIsLoadingWorkflow(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]); // Re-fetch if workflowId changes

  // --- Navigation Handler ---
  const handleEditWorkflow = (workflow) => {
    navigate(`/workflow/${workflow.id || workflowId}`, {
      state: {
        workflowName: workflowData.workflowName,
        workflowDescription: workflowData.workflowDescription,
        isLibrary: true,
      },
    });
  };

  const handleRunWorkflow = async (definition, workflowRunPreferences) => {
    setQuickRunSubmitting(true);
    try {
      await runWorkflow({
        workflowDefinition: definition,
        workflowRunPreferences,
        userId: userProfile?.userId,
        navigate,
      });
      setIsQuickRunOpen(false);
    } catch (error) {
      toast.error(error?.message || 'Failed to start workflow.');
    } finally {
      setQuickRunSubmitting(false);
    }
  };

  const handleSaveAndRunWorkflow = async (definition, workflowRunPreferences) => {
    setQuickRunSubmitting(true);
    try {
      const savedWorkflow = await dispatch(
        createWorkflow({
          nodes: JSON.stringify(definition.nodes || []),
          title: definition.title,
          description: definition.description || '',
          schedule: JSON.stringify(definition.schedule || {}),
        })
      ).unwrap();

      await runWorkflow({
        workflowDefinition: {
          ...definition,
          workflowId: savedWorkflow?.workflowId || definition.workflowId,
          title: savedWorkflow?.title || definition.title,
        },
        workflowRunPreferences,
        userId: userProfile?.userId,
        navigate,
      });
      setIsQuickRunOpen(false);
    } catch (error) {
      toast.error(error?.message || 'Failed to save and start workflow.');
    } finally {
      setQuickRunSubmitting(false);
    }
  };

  // --- Render Logic ---
  if (isLoadingWorkflow) {
    return (
      <div className="loading-container">
        <Loader2 size={32} className="animate-spin" />
        <span>Loading Workflow Details...</span>
      </div>
    );
  }

  if (workflowLoadError) {
    return (
      <div className="error-container">
        <AlertTriangle size={32} />
        <span>Error Loading Workflow</span>
        <pre>{workflowLoadError}</pre>
      </div>
    );
  }

  if (!workflowData) {
    return <div className="error-container">Workflow data not found.</div>; // Should be caught by error state usually
  }

  const calculateProgress = () => {
    return 33;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="px-6">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Button
                  variant="link"
                  onClick={() => {
                    navigate('/workflows');
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  {workflowData.workflowName || 'Workflow'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <Progress value={calculateProgress()} className="h-2 bg-primary-200" />

      <div className="">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/4 min-h-[100%] md:min-h-[100vh]">
            <div className="bg-white p-6 h-[100%]">
              <div className="pl-4">
                <h1 className="text-2xl font-[500] mb-4 text-primary-800">
                  {workflowData.workflowName || 'Workflow Overview'}
                </h1>

                <div className="space-y-4 text-gray-700 mb-6">
                  <p className="text-gray-600">
                    {workflowData.workflowDescription ||
                      'No description provided.'}
                  </p>
                </div>
                {workflowData.nodes &&
                  workflowData.nodes
                    .filter(
                      (node) =>
                        node.type !== 'startNode' && node.type !== 'endNode'
                    )
                    .map((node, index) => (
                      <div key={node.id} className="mb-4">
                        <h4 className="font-medium text-primary-800 text-sm">
                          {index + 1}. {node.name}
                        </h4>
                      </div>
                    ))}
              </div>
            </div>
          </div>

          <div className="w-full md:w-3/4 p-4 md:p-8">
            <div className="bg-white shadow rounded-[16px]">
              <div className="flex flex-col md:flex-row justify-between items-center p-6 pb-0">
                <WorkflowActionSection
                  workflowData={workflowData}
                  onEditWorkflow={handleEditWorkflow}
                  onRunWorkflow={() => setIsQuickRunOpen(true)}
                />
              </div>

              <div className="p-6">
                <h1 className="text-2xl font-[500] mb-4 text-primary-800  border-b border-gray-100 pb-4">
                  {workflowData.workflowName || 'Workflow Overview'}
                </h1>

                <div className="mt-6">
                  <div
                    className="border border-gray-200 rounded-lg overflow-hidden"
                    style={{ height: '800px' }}
                  >
                    <ReactFlowProvider>
                      <ReadOnlyFlow workflowData={workflowData} />
                    </ReactFlowProvider>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <QuickRunWorkflowModal
        isOpen={isQuickRunOpen}
        onClose={() => {
          if (!quickRunSubmitting) setIsQuickRunOpen(false);
        }}
        workflow={{
          ...workflowData,
          workflowId: workflowData.workflowId || workflowData.id || workflowId,
          title: workflowData.title || workflowData.workflowName,
          description:
            workflowData.description || workflowData.workflowDescription || '',
          sourceWorkflowId: workflowId,
        }}
        source="library"
        userProfile={userProfile}
        onRun={handleRunWorkflow}
        onSaveAndRun={handleSaveAndRunWorkflow}
        onReview={() => handleEditWorkflow(workflowData)}
        isSubmitting={quickRunSubmitting}
      />
    </div>
  );
}

const WorkflowActionSection = ({ workflowData, onEditWorkflow, onRunWorkflow }) => {
  return (
    <div className="flex flex-col md:flex-row items-center gap-3 justify-between w-[100%]">
      <div className="flex items-center text-primary-600 bg-primary-50 px-4 p-2 rounded-[26px] w-full md:w-fit">
        <Package className="h-5 w-5 mr-2" />
        <span>Workflow Ready</span>
      </div>

      <div className="flex items-center gap-2">
        <Button className="w-full md:w-fit" onClick={onRunWorkflow}>
          <Play className="h-4 w-4 mr-2" />
          Run Workflow
        </Button>
        <Button
          className="w-full md:w-fit"
          variant="outline"
          onClick={onEditWorkflow}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Workflow
        </Button>
      </div>
    </div>
  );
};
