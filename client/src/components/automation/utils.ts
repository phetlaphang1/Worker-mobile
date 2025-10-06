import { Node, Edge } from "reactflow";
import { NodeData, NodeKind, FlowDefinition } from "./types";

// Validate if a connection between two nodes is valid
export const validateConnection = (
  sourceNode: Node<NodeData>,
  targetNode: Node<NodeData>
): { valid: boolean; reason?: string } => {
  const sourceKind = sourceNode.data.kind;
  const targetKind = targetNode.data.kind;

  // EndLoop can only connect from Loop nodes
  if (targetKind === "EndLoop") {
    const hasLoopAncestor = sourceKind === "Loop";
    if (!hasLoopAncestor) {
      return {
        valid: false,
        reason: "EndLoop node must be connected after a Loop node"
      };
    }
  }

  // Else nodes should follow If nodes
  if (targetKind === "Else" && sourceKind !== "If") {
    return {
      valid: false,
      reason: "Else node must follow an If node"
    };
  }

  // Prevent circular connections
  if (sourceNode.id === targetNode.id) {
    return {
      valid: false,
      reason: "Cannot connect node to itself"
    };
  }

  return { valid: true };
};

// Validate entire flow before export
export const validateFlow = (
  nodes: Node<NodeData>[],
  edges: Edge[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check if flow has at least one node
  if (nodes.length === 0) {
    errors.push("Flow must contain at least one node");
  }

  // Check for disconnected nodes (except the first node)
  const connectedNodes = new Set<string>();
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  nodes.forEach((node, index) => {
    // Skip first node as it doesn't need incoming connection
    if (index > 0 && !connectedNodes.has(node.id)) {
      errors.push(`Node "${node.data.label}" is not connected to the flow`);
    }
  });

  // Validate Loop-EndLoop pairs
  let openLoops = 0;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const sortedNodes = topologicalSort(nodes, edges);

  sortedNodes.forEach(nodeId => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (node.data.kind === "Loop") {
      openLoops++;
    } else if (node.data.kind === "EndLoop") {
      if (openLoops === 0) {
        errors.push("EndLoop found without matching Loop start");
      } else {
        openLoops--;
      }
    }
  });

  if (openLoops > 0) {
    errors.push(`${openLoops} Loop node(s) without matching EndLoop`);
  }

  // Validate required fields for each node
  nodes.forEach(node => {
    const config = node.data.config;
    const kind = node.data.kind;

    if (kind === "GoTo" && (!config?.url || config.url.trim() === "")) {
      errors.push(`GoTo node "${node.data.label}" requires a URL`);
    }

    if ((kind === "Type" || kind === "Click") && (!config?.xpath || config.xpath.trim() === "")) {
      errors.push(`${kind} node "${node.data.label}" requires an XPath selector`);
    }

    if (kind === "Type" && (!config?.text || config.text.trim() === "")) {
      errors.push(`Type node "${node.data.label}" requires text to type`);
    }

    if (kind === "Select" && (!config?.xpath || !config?.selectValue)) {
      errors.push(`Select node "${node.data.label}" requires xpath and value`);
    }

    if (kind === "Wait" && config?.waitType === "element" && (!config?.xpath || config.xpath.trim() === "")) {
      errors.push(`Wait node "${node.data.label}" requires XPath when waiting for element`);
    }

    if (kind === "HttpRequest" && (!config?.endpoint || config.endpoint.trim() === "")) {
      errors.push(`HttpRequest node "${node.data.label}" requires an endpoint URL`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

// Topological sort for execution order
export const topologicalSort = (nodes: Node<NodeData>[], edges: Edge[]): string[] => {
  const indegree: Record<string, number> = {};
  const graph: Record<string, string[]> = {};

  // Initialize
  nodes.forEach(node => {
    indegree[node.id] = 0;
    graph[node.id] = [];
  });

  // Build graph
  edges.forEach(edge => {
    indegree[edge.target] = (indegree[edge.target] || 0) + 1;
    if (!graph[edge.source]) graph[edge.source] = [];
    graph[edge.source].push(edge.target);
  });

  // Find nodes with no incoming edges
  const queue = Object.keys(indegree).filter(id => indegree[id] === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    // Reduce indegree for neighbors
    if (graph[current]) {
      graph[current].forEach(neighbor => {
        indegree[neighbor]--;
        if (indegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }
  }

  // Return sorted order or original order if cycle detected
  return sorted.length === nodes.length ? sorted : nodes.map(n => n.id);
};

// History management for undo/redo
export interface HistoryState {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export class HistoryManager {
  private history: HistoryState[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 50;

  push(state: HistoryState) {
    // Remove future history if we're not at the end
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new state
    this.history.push(JSON.parse(JSON.stringify(state)));
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.maxSize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  undo(): HistoryState | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }

  redo(): HistoryState | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
}

// Duplicate node helper
export const duplicateNode = (
  node: Node<NodeData>,
  offset: { x: number; y: number } = { x: 50, y: 50 }
): Node<NodeData> => {
  const newNode: Node<NodeData> = {
    ...node,
    id: `${node.data.kind}-${Date.now()}-copy`,
    position: {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    },
    data: {
      ...node.data,
      label: `${node.data.label} (Copy)`,
      config: { ...node.data.config }
    },
    selected: false,
  };
  return newNode;
};

// Export flow as JSON
export const exportFlowAsJSON = (
  nodes: Node<NodeData>[],
  edges: Edge[],
  flowName: string
): string => {
  const flow: FlowDefinition = {
    meta: {
      name: flowName,
      version: "1.0"
    },
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.data.kind,
      position: n.position,
      data: n.data
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined
    }))
  };

  return JSON.stringify(flow, null, 2);
};

// Generate unique node ID
export const generateNodeId = (kind: NodeKind): string => {
  return `${kind}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Check if flow has unsaved changes
export const hasUnsavedChanges = (
  currentNodes: Node<NodeData>[],
  currentEdges: Edge[],
  savedNodes: Node<NodeData>[],
  savedEdges: Edge[]
): boolean => {
  // Simple comparison - can be improved with deep equality check
  if (currentNodes.length !== savedNodes.length || currentEdges.length !== savedEdges.length) {
    return true;
  }

  // Check if node data has changed
  const currentNodesStr = JSON.stringify(currentNodes.map(n => ({ id: n.id, data: n.data, position: n.position })));
  const savedNodesStr = JSON.stringify(savedNodes.map(n => ({ id: n.id, data: n.data, position: n.position })));

  const currentEdgesStr = JSON.stringify(currentEdges.map(e => ({ source: e.source, target: e.target })));
  const savedEdgesStr = JSON.stringify(savedEdges.map(e => ({ source: e.source, target: e.target })));

  return currentNodesStr !== savedNodesStr || currentEdgesStr !== savedEdgesStr;
};