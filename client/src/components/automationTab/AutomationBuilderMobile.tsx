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
import { Plus, Smartphone } from "lucide-react";
import { useMobileLDPlayer } from "../../hooks/use-mobile-ldplayer";
import { MobileNodeSelector } from "./MobileNodeSelector";
import { NodeData, NodeKind } from "./types";
import { generateNodeId } from "./utils";
import { PALETTE } from "./PaletteConfig";

function AutomationBuilderInner() {
  const rf = useReactFlow();
  const { isMobile, isLDPlayer, screenSize } = useMobileLDPlayer();
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showMobileSelector, setShowMobileSelector] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  // Handle canvas tap (mobile)
  const handleCanvasTap = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (isMobile) {
      // On mobile, show node selector instead of drag-drop
      setShowMobileSelector(true);
    }
  }, [isMobile]);

  return (
    <div className="h-full w-full relative">
      {/* ReactFlow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
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

      {/* Mobile FAB (Floating Action Button) */}
      {isMobile && (
        <button
          onClick={() => setShowMobileSelector(true)}
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-2xl flex items-center justify-center z-50 active:scale-95 transition-transform"
          style={{ touchAction: 'manipulation' }}
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {/* Mobile Node Selector */}
      <MobileNodeSelector
        isOpen={showMobileSelector}
        onClose={() => setShowMobileSelector(false)}
        onSelectNode={handleAddNode}
        palette={PALETTE}
      />

      {/* Info Badge */}
      <div className="fixed top-4 left-4 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 z-40">
        <Smartphone className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isLDPlayer ? "LDPlayer" : isMobile ? "Mobile" : "Desktop"} • {nodes.length} nodes
        </span>
      </div>
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
