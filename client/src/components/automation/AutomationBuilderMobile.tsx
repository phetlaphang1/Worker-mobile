import { useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { Smartphone } from "lucide-react";
import { useMobileLDPlayer } from "../../hooks/use-mobile-ldplayer";
import { MobileNodeSelector } from "./MobileNodeSelector";
import { MobileNodeEditor } from "./MobileNodeEditor";
import { NodePalette } from "./NodePalette";
import { NodeData, NodeKind } from "./types";
import { generateNodeId } from "./utils";
import { PALETTE } from "./PaletteConfig";

function AutomationBuilderInner() {
  const rf = useReactFlow();
  const { isMobile, isLDPlayer, screenSize } = useMobileLDPlayer();
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showMobileSelector, setShowMobileSelector] = useState(false);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<NodeData | null>(null);
  const [draggedNodeKind, setDraggedNodeKind] = useState<NodeKind | null>(null);

  // Handle connections between nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "#60a5fa", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#60a5fa",
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Add node to canvas (mobile version)
  const handleAddNode = useCallback(
    (kind: NodeKind) => {
      const def = PALETTE.find((p) => p.kind === kind);
      if (!def) return;

      const id = generateNodeId(kind);
      
      // Add node at center of viewport
      const viewport = rf.getViewport();
      const centerX = (screenSize.width / 2 - viewport.x) / viewport.zoom;
      const centerY = (screenSize.height / 2 - viewport.y) / viewport.zoom;

      setNodes((nds) =>
        nds.concat({
          id,
          type: "default",
          position: { x: centerX - 100, y: centerY - 50 },
          data: {
            label: def.label,
            kind: def.kind,
            config: def.defaultConfig,
          } as NodeData,
        })
      );

      setSelectedNodeId(id);
    },
    [rf, screenSize, setNodes]
  );

  // Handle canvas tap (mobile) - Reserved for future use
  // const handleCanvasTap = useCallback((event: React.MouseEvent | React.TouchEvent) => {
  //   if (isMobile) {
  //     // On mobile, show node selector instead of drag-drop
  //     setShowMobileSelector(true);
  //   }
  // }, [isMobile]);

  // Handle node click to open editor
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedNodeData(node.data as NodeData);
    setShowNodeEditor(true);
  }, []);

  // Handle save node config
  const handleSaveNodeConfig = useCallback((updatedData: NodeData) => {
    if (!selectedNodeId) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          return {
            ...node,
            data: updatedData,
          };
        }
        return node;
      })
    );
  }, [selectedNodeId, setNodes]);

  // Handle drag start from palette
  const handleDragStart = useCallback((event: React.DragEvent, nodeKind: NodeKind) => {
    setDraggedNodeKind(nodeKind);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  // Handle drag over canvas
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop on canvas
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!draggedNodeKind) return;

      const def = PALETTE.find((p) => p.kind === draggedNodeKind);
      if (!def) return;

      // Get the drop position relative to the ReactFlow canvas
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const viewport = rf.getViewport();

      const x = (event.clientX - reactFlowBounds.left - viewport.x) / viewport.zoom;
      const y = (event.clientY - reactFlowBounds.top - viewport.y) / viewport.zoom;

      const id = generateNodeId(draggedNodeKind);

      setNodes((nds) =>
        nds.concat({
          id,
          type: "default",
          position: { x: x - 75, y: y - 25 }, // Center the node on cursor
          data: {
            label: def.label,
            kind: def.kind,
            config: def.defaultConfig,
          } as NodeData,
        })
      );

      setDraggedNodeKind(null);
    },
    [draggedNodeKind, rf, setNodes]
  );

  return (
    <div className="h-full w-full flex">
      {/* Node Palette Sidebar */}
      <NodePalette palette={PALETTE} onDragStart={handleDragStart} />

      {/* ReactFlow Canvas */}
      <div
        className="flex-1 relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          fitView
          panOnScroll={true}
          panOnDrag={true}
          zoomOnScroll={true}
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
          {!isMobile && <MiniMap />}
        </ReactFlow>

        {/* Info Badge */}
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 z-40">
          <Smartphone className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isLDPlayer ? "LDPlayer" : isMobile ? "Mobile" : "Desktop"} • {nodes.length} nodes
          </span>
        </div>
      </div>

      {/* Mobile Node Selector */}
      <MobileNodeSelector
        isOpen={showMobileSelector}
        onClose={() => setShowMobileSelector(false)}
        onSelectNode={handleAddNode}
        palette={PALETTE}
      />

      {/* Mobile Node Editor */}
      <MobileNodeEditor
        isOpen={showNodeEditor}
        onClose={() => setShowNodeEditor(false)}
        nodeData={selectedNodeData}
        onSave={handleSaveNodeConfig}
      />
    </div>
  );
}

export default function AutomationBuilderMobile() {
  return (
    <ReactFlowProvider>
      <AutomationBuilderInner />
    </ReactFlowProvider>
  );
}
