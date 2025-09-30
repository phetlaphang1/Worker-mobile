import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Handle,
  Position,
  MarkerType,
  ConnectionLineType,
} from "reactflow";
import { useReactFlow, ReactFlowProvider } from "reactflow";
import "reactflow/dist/style.css";

import { FlowDefinition, NodeKind, NodeData } from "./types";
import { templateManager } from "../../../../server/scripts/templates/templateManager";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  validateConnection,
  validateFlow,
  HistoryManager,
  duplicateNode,
  generateNodeId
} from "./utils";
import { NodeContextMenu } from "./NodeContextMenu";
import { Globe, Type, MousePointer, Save, Download, FileJson, Play, Copy, Code, Navigation, Frame, Layers, ArrowDown, List, Repeat, Database, FileText, Trash2, Plus, Moon, Send, Undo2, Redo2, CheckCircle, AlertCircle, CopyPlus, Clock, Bot, Shield } from "lucide-react";

// Palette với icons và descriptions
const PALETTE: { 
  kind: NodeKind; 
  label: string; 
  icon: React.ReactNode;
  description: string;
  defaultConfig?: any 
}[] = [
  { 
    kind: "GoTo", 
    label: "Go To URL", 
    icon: <Globe className="w-4 h-4" />,
    description: "Navigate to a webpage",
    defaultConfig: { url: "" } 
  },
  { 
    kind: "Navigation", 
    label: "Navigation", 
    icon: <Navigation className="w-4 h-4" />,
    description: "Browser navigation (back/forward/refresh)",
    defaultConfig: { action: "forward" } 
  },
  {
    kind: "Type",
    label: "Type Text",
    icon: <Type className="w-4 h-4" />,
    description: "Enter text into an input field",
    defaultConfig: {
      xpath: "",
      text: "",
      inputType: "text", // "text" or "variable"
      variableName: ""
    }
  },
  {
    kind: "MultiType",
    label: "Multi Type",
    icon: <Type className="w-4 h-4" />,
    description: "Type into multiple fields at once",
    defaultConfig: {
      fields: [
        { xpath: "", text: "", inputType: "text", variableName: "" },
        { xpath: "", text: "", inputType: "text", variableName: "" }
      ]
    }
  },
  {
    kind: "Click",
    label: "Click Element",
    icon: <MousePointer className="w-4 h-4" />,
    description: "Click on a page element",
    defaultConfig: { xpath: "", index: 0 }
  },
  { 
    kind: "Select", 
    label: "Select Dropdown", 
    icon: <List className="w-4 h-4" />,
    description: "Select option from dropdown",
    defaultConfig: { xpath: "", selectBy: "text", selectValue: "" } 
  },
  { 
    kind: "SwitchFrame", 
    label: "Switch Frame", 
    icon: <Frame className="w-4 h-4" />,
    description: "Enter/exit iframe",
    defaultConfig: { frameType: "enter", frameSelector: "" } 
  },
  { 
    kind: "SwitchTab", 
    label: "Switch Tab", 
    icon: <Layers className="w-4 h-4" />,
    description: "Switch between browser tabs",
    defaultConfig: { tabIndex: 0 } 
  },
  { 
    kind: "ScrollTo", 
    label: "Scroll To", 
    icon: <ArrowDown className="w-4 h-4" />,
    description: "Scroll to element or position",
    defaultConfig: { scrollType: "element", xpath: "" } 
  },
  {
    kind: "Wait",
    label: "Wait",
    icon: <Clock className="w-4 h-4" />,
    description: "Wait for element or time",
    defaultConfig: { waitType: "element", xpath: "", timeout: 5000 } 
  },
  { 
    kind: "Sleep", 
    label: "Sleep", 
    icon: <Moon className="w-4 h-4" />,
    description: "Pause execution for specified time",
    defaultConfig: { timeout: 3000 } 
  },
  { 
    kind: "If", 
    label: "If Condition", 
    icon: <Navigation className="w-4 h-4" />,
    description: "Conditional logic",
    defaultConfig: { condition: "element_exists", xpath: "" } 
  },
  { 
    kind: "Loop", 
    label: "Loop Start", 
    icon: <Repeat className="w-4 h-4" />,
    description: "Start loop - repeat actions N times",
    defaultConfig: { loopCount: 5, currentIndexName: "i" } 
  },
  { 
    kind: "EndLoop", 
    label: "Loop End", 
    icon: <Repeat className="w-4 h-4" />,
    description: "End of loop block",
    defaultConfig: {} 
  },
  {
    kind: "Extract",
    label: "Extract Data",
    icon: <Database className="w-4 h-4" />,
    description: "Extract text or attributes from element",
    defaultConfig: {
      xpath: "",
      extractType: "text",
      variableName: "extractedData"
    }
  },
  {
    kind: "DataProcess",
    label: "Process Data",
    icon: <Database className="w-4 h-4" />,
    description: "Process and assign data to variables",
    defaultConfig: {
      processType: "assignVariable",
      sourceVariable: "extractedData",
      targetVariable: "processedData"
    }
  },
  {
    kind: "Log",
    label: "Log Message",
    icon: <FileText className="w-4 h-4" />,
    description: "Log message to console",
    defaultConfig: { logLevel: "info", message: "" }
  },
  {
    kind: "HttpRequest",
    label: "HTTP Request",
    icon: <Send className="w-4 h-4" />,
    description: "Make HTTP API calls",
    defaultConfig: {
      method: "GET",
      endpoint: "",
      authType: "none",
      authToken: "",
      bodyType: "json",
      body: {},
      responseVariable: "httpResponse",
      timeout: 30000
    }
  },
  {
    kind: "AI",
    label: "AI Assistant",
    icon: <Bot className="w-4 h-4" />,
    description: "Get AI responses using  API",
    defaultConfig: {
      aiRole: "assistant",
      aiPrompt: "",
      aiInputType: "variable",
      aiInputVariable: "extractedData",
      aiResponseVariable: "aiResponse"
    }
  },
  {
    kind: "CaptchaSolver",
    label: "AI Captcha Solver",
    icon: <Shield className="w-4 h-4" />,
    description: "AI automatically detects and solves any captcha",
    defaultConfig: {
      captchaMode: "ai_auto"
    }
  },
];

// Custom Node Component với handles lớn hơn và rõ ràng hơn
const CustomNodeComponent = ({ data, selected }: { data: NodeData; selected: boolean }) => {
  return (
    <div className={`
      px-4 py-3 rounded-lg bg-white border-2 min-w-[180px]
      transition-all duration-200 hover:shadow-lg
      ${selected ? 'border-blue-500 shadow-lg' : 'border-gray-300'}
    `}>
      {/* Input Handle - Bên trái */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-blue-400 !border-2 !border-white hover:!bg-blue-500 transition-colors"
        style={{ left: '-8px' }}
      />
      
      {/* Node Content */}
      <div className="flex items-center gap-3">
        <div className={`
          p-2 rounded-lg
          ${data.kind === 'GoTo' ? 'bg-blue-100' : ''}
          ${data.kind === 'Navigation' ? 'bg-blue-100' : ''}
          ${data.kind === 'Type' ? 'bg-green-100' : ''}
          ${data.kind === 'MultiType' ? 'bg-green-100' : ''}
          ${data.kind === 'Click' ? 'bg-purple-100' : ''}
          ${data.kind === 'Select' ? 'bg-indigo-100' : ''}
          ${data.kind === 'SwitchFrame' ? 'bg-orange-100' : ''}
          ${data.kind === 'SwitchTab' ? 'bg-pink-100' : ''}
          ${data.kind === 'ScrollTo' ? 'bg-teal-100' : ''}
          ${data.kind === 'Wait' ? 'bg-yellow-100' : ''}
          ${data.kind === 'Sleep' ? 'bg-purple-100' : ''}
          ${data.kind === 'If' ? 'bg-red-100' : ''}
          ${data.kind === 'Loop' ? 'bg-cyan-100' : ''}
          ${data.kind === 'EndLoop' ? 'bg-cyan-100' : ''}
          ${data.kind === 'Extract' ? 'bg-gray-100' : ''}
          ${data.kind === 'DataProcess' ? 'bg-lime-100' : ''}
          ${data.kind === 'Log' ? 'bg-amber-100' : ''}
          ${data.kind === 'HttpRequest' ? 'bg-indigo-100' : ''}
          ${data.kind === 'AI' ? 'bg-purple-100' : ''}
        `}>
          {data.kind === "GoTo" && <Globe className="w-5 h-5 text-blue-600" />}
          {data.kind === "Navigation" && <Navigation className="w-5 h-5 text-blue-600" />}
          {data.kind === "Type" && <Type className="w-5 h-5 text-green-600" />}
          {data.kind === "MultiType" && <Type className="w-5 h-5 text-green-600" />}
          {data.kind === "Click" && <MousePointer className="w-5 h-5 text-purple-600" />}
          {data.kind === "Select" && <List className="w-5 h-5 text-indigo-600" />}
          {data.kind === "SwitchFrame" && <Frame className="w-5 h-5 text-orange-600" />}
          {data.kind === "SwitchTab" && <Layers className="w-5 h-5 text-pink-600" />}
          {data.kind === "ScrollTo" && <ArrowDown className="w-5 h-5 text-teal-600" />}
          {data.kind === "Wait" && <Clock className="w-5 h-5 text-yellow-600" />}
          {data.kind === "Sleep" && <Moon className="w-5 h-5 text-purple-600" />}
          {data.kind === "If" && <Navigation className="w-5 h-5 text-red-600" />}
          {data.kind === "Loop" && <Repeat className="w-5 h-5 text-cyan-600" />}
          {data.kind === "EndLoop" && <Repeat className="w-5 h-5 text-cyan-600" />}
          {data.kind === "Extract" && <Database className="w-5 h-5 text-gray-600" />}
          {data.kind === "DataProcess" && <Database className="w-5 h-5 text-lime-600" />}
          {data.kind === "Log" && <FileText className="w-5 h-5 text-amber-600" />}
          {data.kind === "HttpRequest" && <Send className="w-5 h-5 text-indigo-600" />}
          {data.kind === "AI" && <Bot className="w-5 h-5 text-purple-600" />}
          {data.kind === "CaptchaSolver" && <Shield className="w-5 h-5 text-red-600" />}
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">{data.label}</div>
          <div className="text-xs text-gray-500">{data.kind}</div>
        </div>
      </div>
      
      {/* Output Handle - Bên phải */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-green-400 !border-2 !border-white hover:!bg-green-500 transition-colors"
        style={{ right: '-8px' }}
      />
    </div>
  );
};

// Đăng ký node types
const nodeTypes = {
  custom: CustomNodeComponent,
};

function AutomationBuilderInner() {
  const rf = useReactFlow();
  const { toast } = useToast();

  const [flowName, setFlowName] = useState("Untitled Flow");
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [templates, setTemplates] = useState<Record<string, FlowDefinition>>({});
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [currentTemplateName, setCurrentTemplateName] = useState<string | null>(null);
  const [originalTemplateName, setOriginalTemplateName] = useState<string | null>(null);

  // History Manager for undo/redo
  const [historyManager] = useState(() => new HistoryManager());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // const [savedState, setSavedState] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ node: Node<NodeData> | null; position: { x: number; y: number } | null }>({ node: null, position: null });

  // Inspector
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) as Node<NodeData> | undefined,
    [nodes, selectedId]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      // Validate connection before adding
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);

      if (sourceNode && targetNode) {
        const validation = validateConnection(sourceNode as Node<NodeData>, targetNode as Node<NodeData>);

        if (!validation.valid) {
          toast({
            title: "Invalid Connection",
            description: validation.reason,
            variant: "destructive"
          });
          return;
        }
      }

      setEdges((eds) => addEdge({
        ...connection,
        animated: true,
        style: { stroke: '#60a5fa', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#60a5fa',
        },
      }, eds));

      // Save to history after connection
      saveToHistory();
    },
    [setEdges, nodes, toast]
  );

  // History management functions
  const saveToHistory = useCallback(() => {
    historyManager.push({ nodes: [...nodes], edges: [...edges] });
    setCanUndo(historyManager.canUndo());
    setCanRedo(historyManager.canRedo());
  }, [nodes, edges, historyManager]);

  const handleUndo = useCallback(() => {
    const state = historyManager.undo();
    if (state) {
      setNodes(state.nodes);
      setEdges(state.edges);
      setCanUndo(historyManager.canUndo());
      setCanRedo(historyManager.canRedo());
      toast({ title: "Undo", description: "Action undone" });
    }
  }, [historyManager, setNodes, setEdges, toast]);

  const handleRedo = useCallback(() => {
    const state = historyManager.redo();
    if (state) {
      setNodes(state.nodes);
      setEdges(state.edges);
      setCanUndo(historyManager.canUndo());
      setCanRedo(historyManager.canRedo());
      toast({ title: "Redo", description: "Action redone" });
    }
  }, [historyManager, setNodes, setEdges, toast]);

  // Duplicate selected node
  const handleDuplicateNode = useCallback(() => {
    if (!selectedId) {
      toast({ title: "No Selection", description: "Please select a node to duplicate", variant: "destructive" });
      return;
    }

    const nodeToDuplicate = nodes.find(n => n.id === selectedId);
    if (nodeToDuplicate) {
      const newNode = duplicateNode(nodeToDuplicate as Node<NodeData>);
      setNodes(nds => [...nds, newNode]);
      setSelectedId(newNode.id);
      saveToHistory();
      toast({ title: "Node Duplicated", description: `Created copy of "${nodeToDuplicate.data.label}"` });
    }
  }, [selectedId, nodes, setNodes, saveToHistory, toast]);

  // Validate flow before export
  const handleValidateFlow = useCallback(() => {
    const validation = validateFlow(nodes as Node<NodeData>[], edges);
    setValidationErrors(validation.errors);

    if (validation.valid) {
      toast({ title: "✓ Flow Valid", description: "Your flow is ready for export" });
    } else {
      toast({
        title: "Flow Validation Failed",
        description: `Found ${validation.errors.length} error(s). Check the validation panel.`,
        variant: "destructive"
      });
    }

    return validation.valid;
  }, [nodes, edges, toast]);


  const onDragOver = (ev: React.DragEvent) => ev.preventDefault();

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const kind = ev.dataTransfer.getData("application/node-kind") as NodeKind;
    if (!kind) return;

    const bounds = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const position = rf.project({
      x: ev.clientX - bounds.left,
      y: ev.clientY - bounds.top,
    });

    const id = generateNodeId(kind);
    const def = PALETTE.find((p) => p.kind === kind)!;

    setNodes((nds) =>
      nds.concat({
        id,
        type: "custom",
        position,
        data: {
          label: def.label,
          kind: def.kind,
          config: def.defaultConfig,
        } as NodeData,
      })
    );
    setSelectedId(id);
    saveToHistory();
  };

  // Load a template from the templates list and set it as current editing template
  const loadTemplate = (name: string) => {
    const t = templates[name];
    if (!t) return;

    setNodes(
      t.nodes.map((n) => ({
        id: n.id,
        type: "custom",
        position: n.position,
        data: { ...n.data, kind: n.type as NodeKind },
      }))
    );
    setEdges(
      t.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        style: { stroke: '#60a5fa', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#60a5fa',
        },
      }))
    );
    setFlowName(t.meta?.name ?? name);
    setSelectedId(t.nodes[0]?.id ?? null);
    
    // Set current template name to track which template is being edited
    setCurrentTemplateName(name);
    setOriginalTemplateName(name); // Store original name for rename operation
  };

  // Export current flow as executable JavaScript automation code
  const exportJS = async () => {
    // Use generateCodeInternal to get the same code as generateCode
    const jsCode = await generateCodeInternal();
    
    const blob = new Blob([jsCode], {
      type: "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flowName.replace(/\s+/g, "-").toLowerCase()}.js`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Exported", description: "JavaScript file exported successfully." });
  };

  // Save current flow - either update existing template or save as regular flow
  const saveLocal = () => {
    // If we're currently editing a template from "My Templates", update it
    if (currentTemplateName && !currentTemplateName.startsWith("Basic:") && !currentTemplateName.startsWith("X (Twitter)")) {
      const templateDef: FlowDefinition = {
        meta: { name: flowName, version: "1.0" },
        nodes: nodes.map((n) => ({
          id: n.id,
          type: (n.data as NodeData).kind,
          position: n.position,
          data: n.data as NodeData,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === 'string' ? e.label : undefined,
        })),
      };
      
      // If template was renamed, delete old one and save with new name
      if (originalTemplateName && originalTemplateName !== currentTemplateName) {
        templateManager.deleteCustomTemplate(originalTemplateName);
        templateManager.addCustomTemplate(currentTemplateName, templateDef);
        setOriginalTemplateName(currentTemplateName); // Update original name after successful rename
        
        toast({ 
          title: "Template Renamed & Updated", 
          description: `Template renamed from "${originalTemplateName}" to "${currentTemplateName}" with ${nodes.length} nodes.` 
        });
      } else {
        // Just update the existing template
        templateManager.addCustomTemplate(currentTemplateName, templateDef);
        
        toast({ 
          title: "Template Updated", 
          description: `Template "${currentTemplateName}" has been updated with ${nodes.length} nodes.` 
        });
      }
      
      // Refresh templates list
      templateManager.getAllTemplates().then((allTemplates: Record<string, FlowDefinition>) => {
        setTemplates(allTemplates);
      });
    } else {
      // Save as regular flow in localStorage
      localStorage.setItem(
        "automation:current",
        JSON.stringify({ flowName, nodes, edges })
      );
      toast({ title: "Saved", description: "Flow saved to localStorage." });
    }
  };

  const loadLocal = () => {
    const raw = localStorage.getItem("automation:current");
    if (!raw) return;
    const obj = JSON.parse(raw);
    setFlowName(obj.flowName);
    setNodes(obj.nodes);
    setEdges(obj.edges);
    setSelectedId(obj.nodes?.[0]?.id ?? null);
    setCurrentTemplateName(null); // Reset current template since loading a regular flow
    setOriginalTemplateName(null);
  };

  // Save current flow as a new template in localStorage
  const saveAsTemplate = async () => {
    if (!templateNameInput.trim()) {
      toast({ title: "Error", description: "Please enter a template name", variant: "destructive" });
      return;
    }
    
    const templateDef: FlowDefinition = {
      meta: { name: templateNameInput, version: "1.0" },
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.data as NodeData).kind,
        position: n.position,
        data: n.data as NodeData,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: typeof e.label === 'string' ? e.label : undefined,
      })),
    };
    
    try {
      // Save to localStorage for persistence
      templateManager.addCustomTemplate(templateNameInput, templateDef);
      const allTemplates = await templateManager.getAllTemplates();
      setTemplates(allTemplates);
      setShowTemplateDialog(false);
      setTemplateNameInput("");
      toast({ title: "Success", description: "Template saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteTemplate = async (name: string) => {
    const defaultTemplates = await templateManager.getDefaultTemplates();
    if (defaultTemplates[name]) {
      toast({ title: "Error", description: "Cannot delete default templates", variant: "destructive" });
      return;
    }
    
    try {
      // Delete from localStorage
      templateManager.deleteCustomTemplate(name);
      const allTemplates = await templateManager.getAllTemplates();
      setTemplates(allTemplates);
      toast({ title: "Success", description: "Template deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Import template from JSON or JS file and save to localStorage
  const importTemplateFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        
        // Check if it's a JS file or JSON file
        if (file.name.endsWith('.js')) {
          // Import JS file and save as template
          await importFromJS(content, file.name);
        } else {
          // Parse JSON template and save to localStorage
          const template = JSON.parse(content) as FlowDefinition;
          const simpleName = file.name.replace(/\.(json)$/, '');
          templateManager.addCustomTemplate(simpleName, template);
          const allTemplates = await templateManager.getAllTemplates();
          setTemplates(allTemplates);
          
          // Also load it to canvas
          loadTemplate(simpleName);
          
          toast({ title: "Success", description: `Template "${simpleName}" saved and loaded successfully` });
        }
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Invalid file format", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  // Parse JS automation code and convert to template format
  const importFromJS = async (jsContent: string, fileName: string) => {
    try {
      // Basic parsing to convert JS automation back to nodes
      const nodes: any[] = [];
      const edges: any[] = [];
      let nodeId = 0;
      let yPos = 100;
      let openLoops: string[] = []; // Track open loops
      
      const lines = jsContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      lines.forEach((line) => {
        let nodeData: any = null;
        const id = `imported-${nodeId++}`;
        
        // Parse different types of automation commands - Updated to match export format
        if (line.includes('await page.goto(')) {
          const urlMatch = line.match(/await\s+page\.goto\(["']([^"']+)["']\)/);
          nodeData = {
            label: 'Go To URL',
            kind: 'GoTo',
            config: { url: urlMatch?.[1] || 'https://example.com' }
          };
        }
        else if (line.includes('await page.goForward()')) {
          nodeData = {
            label: 'Navigation',
            kind: 'Navigation',
            config: { action: 'forward' }
          };
        }
        else if (line.includes('await page.goBack()')) {
          nodeData = {
            label: 'Navigation',
            kind: 'Navigation',
            config: { action: 'back' }
          };
        }
        else if (line.includes('await page.reload()')) {
          nodeData = {
            label: 'Navigation',
            kind: 'Navigation',
            config: { action: 'refresh' }
          };
        }
        else if (line.includes('await act.type(')) {
          const typeMatch = line.match(/await\s+act\.type\(page,\s*["']([^"']+)["'],\s*["']([^"']*)["']\)/);
          nodeData = {
            label: 'Type Text',
            kind: 'Type',
            config: { 
              xpath: typeMatch?.[1] || '',
              text: typeMatch?.[2] || ''
            }
          };
        }
        else if (line.includes('await act.click(')) {
          const clickMatch = line.match(/await\s+act\.click\(page,\s*["']([^"']+)["'](?:,\s*(\d+))?\)/);
          nodeData = {
            label: 'Click Element',
            kind: 'Click',
            config: { 
              xpath: clickMatch?.[1] || '',
              index: clickMatch?.[2] ? parseInt(clickMatch[2]) : undefined
            }
          };
        }
        else if (line.includes('await act.select(')) {
          const selectMatch = line.match(/await\s+act\.select\(page,\s*["']([^"']+)["'],\s*\{([^}]+)\}\)/);
          if (selectMatch) {
            const xpath = selectMatch[1];
            const optionsStr = selectMatch[2];
            let config: any = { xpath };
            
            if (optionsStr.includes('index:')) {
              const indexMatch = optionsStr.match(/index:\s*(\d+)/);
              config.selectBy = 'index';
              config.selectIndex = parseInt(indexMatch?.[1] || '0');
            } else if (optionsStr.includes('value:')) {
              const valueMatch = optionsStr.match(/value:\s*["']([^"']+)["']/);
              config.selectBy = 'value';
              config.selectValue = valueMatch?.[1] || '';
            } else if (optionsStr.includes('text:')) {
              const textMatch = optionsStr.match(/text:\s*["']([^"']+)["']/);
              config.selectBy = 'text';
              config.selectValue = textMatch?.[1] || '';
            }
            
            nodeData = {
              label: 'Select Dropdown',
              kind: 'Select',
              config
            };
          }
        }
        else if (line.includes('await act.scrollToElement(')) {
          const scrollMatch = line.match(/await\s+act\.scrollToElement\(page,\s*["']([^"']+)["']\)/);
          nodeData = {
            label: 'Scroll To',
            kind: 'ScrollTo',
            config: { 
              scrollType: 'element',
              xpath: scrollMatch?.[1] || ''
            }
          };
        }
        else if (line.includes('await act.waitForElement(')) {
          const waitMatch = line.match(/await\s+act\.waitForElement\(page,\s*["']([^"']+)["'],\s*(\d+)\)/);
          nodeData = {
            label: 'Wait',
            kind: 'Wait',
            config: { 
              waitType: 'element',
              xpath: waitMatch?.[1] || '',
              timeout: parseInt(waitMatch?.[2] || '5000')
            }
          };
        }
        else if (line.includes('for (let') && line.includes('< ')) {
          const loopMatch = line.match(/for\s*\(let\s+(\w+)\s*=\s*\d+;\s*\1\s*<\s*(\d+);\s*\1\+\+\)/);
          if (loopMatch) {
            openLoops.push(loopMatch[1]);
            nodeData = {
              label: 'Loop Start',
              kind: 'Loop',
              config: { 
                loopCount: parseInt(loopMatch[2]),
                currentIndexName: loopMatch[1]
              }
            };
          }
        }
        else if (line === '}' && openLoops.length > 0) {
          // Check if this is a loop end
          openLoops.pop();
          nodeData = {
            label: 'Loop End',
            kind: 'EndLoop',
            config: {}
          };
        }
        else if (line.includes('await new Promise(resolve => setTimeout(')) {
          const timeMatch = line.match(/setTimeout\(resolve,\s*(\d+)\)/);
          nodeData = {
            label: 'Sleep',
            kind: 'Sleep',
            config: { timeout: parseInt(timeMatch?.[1] || '1000') }
          };
        }
        else if (line.includes('await act.getText(')) {
          // Match pattern: const variableName = await act.getText(page, "xpath");
          const extractMatch = line.match(/const\s+(\w+)\s*=\s*await\s+act\.getText\(page,\s*["']([^"']+)["']\)/);
          nodeData = {
            label: 'Extract Data',
            kind: 'Extract',
            config: {
              xpath: extractMatch?.[2] || '',
              extractType: 'text',
              variableName: extractMatch?.[1] || 'extractedData'
            }
          };
        }
        // Parse DataProcess - Assign variable
        else if (line.includes('// Assign variable from')) {
          const nextLineIndex = lines.indexOf(line) + 1;
          if (nextLineIndex < lines.length) {
            const nextLine = lines[nextLineIndex];
            const assignMatch = nextLine.match(/const\s+(\w+)\s*=\s*(\w+);/);
            if (assignMatch) {
              nodeData = {
                label: 'Process Data',
                kind: 'DataProcess',
                config: {
                  processType: 'assignVariable',
                  targetVariable: assignMatch[1],
                  sourceVariable: assignMatch[2]
                }
              };
            }
          }
        }
        // Parse AI Assistant node
        else if (line.includes('// AI Assistant') && line.includes('Using Roxane API')) {
          // Extract AI role from comment: // AI Assistant (social_commenter)
          const roleMatch = line.match(/AI Assistant\s*\(([^)]+)\)/);
          const aiRole = roleMatch?.[1] || 'assistant';

          // Find the response variable name
          const varMatch = line.match(/const\s+(\w+)\s*=/);
          const responseVar = varMatch?.[1] || 'aiResponse';

          // Look for input variable in next lines
          const nextLines = lines.slice(lines.indexOf(line), lines.indexOf(line) + 10);
          let inputVariable = 'data';

          for (const nextLine of nextLines) {
            if (nextLine.includes('Using input from variable:')) {
              const inputMatch = nextLine.match(/Using input from variable:\s*(\w+)/);
              if (inputMatch) {
                inputVariable = inputMatch[1];
                break;
              }
            }
          }

          nodeData = {
            label: 'AI Assistant',
            kind: 'AI',
            config: {
              aiRole: aiRole,
              aiInputType: 'variable',
              aiInputVariable: inputVariable,
              aiResponseVariable: responseVar
            }
          };
        }
        else if (line.includes('console.log(') && !line.includes('Loop iteration') && !line.includes('Page title:') && !line.includes('Extracted:')) {
          const logMatch = line.match(/console\.(log|warn|error|debug)\(["']([^"']+)["']\)/);
          if (logMatch) {
            nodeData = {
              label: 'Log Message',
              kind: 'Log',
              config: { 
                logLevel: logMatch[1] === 'log' ? 'info' : logMatch[1],
                message: logMatch[2]
              }
            };
          }
        }
        
        if (nodeData) {
          nodes.push({
            id,
            type: 'custom',
            position: { x: 250, y: yPos },
            data: nodeData
          });
          
          // Create edge to connect to previous node
          if (nodes.length > 1) {
            edges.push({
              id: `edge-${nodes.length-2}-${nodes.length-1}`,
              source: nodes[nodes.length-2].id,
              target: id,
              animated: true,
              style: { stroke: '#60a5fa', strokeWidth: 2 },
              markerEnd: {
                type: 'arrowClosed',
                color: '#60a5fa',
              },
            });
          }
          
          yPos += 100;
        }
      });
      
      if (nodes.length === 0) {
        toast({ title: "Warning", description: "No automation commands found in JS file", variant: "destructive" });
        return;
      }
      
      // Create template and save to localStorage
      const template: FlowDefinition = {
        meta: { name: fileName.replace('.js', ''), version: "1.0" },
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.data.kind,
          position: n.position,
          data: n.data
        })),
        edges
      };
      
      const templateName = fileName.replace('.js', '');
      
      // Save to localStorage
      templateManager.addCustomTemplate(templateName, template);
      
      // Update templates list
      const allTemplates = await templateManager.getAllTemplates();
      setTemplates(allTemplates);
      
      // Load the template to canvas
      setNodes(nodes);
      setEdges(edges);
      setFlowName(templateName);
      
      toast({ 
        title: "Success", 
        description: `Imported ${nodes.length} nodes from JavaScript file and saved as template "${templateName}"` 
      });
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast({ title: "Error", description: error.message || "Failed to parse JavaScript file", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadLocal();
    // Load templates asynchronously
    templateManager.getAllTemplates().then((allTemplates: Record<string, FlowDefinition>) => {
      setTemplates(allTemplates);
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      // Duplicate: Ctrl/Cmd + D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicateNode();
      }
      // Delete selected node: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Check if user is typing in an input/textarea field
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );

        // Only delete node if NOT typing in a field
        if (!isTyping) {
          e.preventDefault();
          setNodes(nds => nds.filter(n => n.id !== selectedId));
          setEdges(eds => eds.filter(e => e.source !== selectedId && e.target !== selectedId));
          setSelectedId(null);
          saveToHistory();
          toast({ title: "Node Deleted", description: "Node removed from flow" });
        }
      }
      // Validate: Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleValidateFlow();
      }
      // Save: Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveLocal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDuplicateNode, handleValidateFlow, selectedId, setNodes, setEdges, saveToHistory, toast, saveLocal]);

  // ==== Update helpers for Inspector ====
  const patchSelectedNode = (patch: Partial<NodeData>) => {
    if (!selectedId) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId
          ? {
              ...n,
              data: {
                ...n.data,
                ...patch,
                config: {
                  ...n.data.config,
                  ...patch.config,
                },
              },
            }
          : n
      )
    );
  };
  const patchSelectedConfig = (cfgPatch: Record<string, any>) => {
    if (!selectedId) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId
          ? {
              ...n,
              data: {
                ...n.data,
                config: { ...n.data.config, ...cfgPatch },
              },
            }
          : n
      )
    );
  };

  // ====== Code generator (Puppeteer + helpers) ======
  const [isDefault, setIsDefault] = useState(true);
  const [preview, setPreview] = useState("");

  // topo sort để xác định thứ tự thực thi
  const topoSort = () => {
    const indeg: Record<string, number> = {};
    const g: Record<string, string[]> = {};
    nodes.forEach((n) => {
      indeg[n.id] = 0;
      g[n.id] = [];
    });
    edges.forEach((e) => {
      indeg[e.target] = (indeg[e.target] ?? 0) + 1;
      g[e.source].push(e.target);
    });
    const q = Object.keys(indeg).filter((id) => indeg[id] === 0);
    const order: string[] = [];
    while (q.length) {
      const u = q.shift()!;
      order.push(u);
      for (const v of g[u]) if (--indeg[v] === 0) q.push(v);
    }
    return order.length ? order : nodes.map((n) => n.id);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Code copied to clipboard." });
    } catch (error) {
      // Fallback method without using deprecated execCommand
      try {
        // Create a blob and use it to copy
        const blob = new Blob([text], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({ 'text/plain': blob });
        await navigator.clipboard.write([clipboardItem]);
        toast({ title: "Copied", description: "Code copied to clipboard." });
      } catch (fallbackError) {
        console.error("Failed to copy:", fallbackError);
        toast({
          title: "Copy Failed",
          description: "Please select and copy the code manually.",
          variant: "destructive"
        });
      }
    }
  };



  // Shared code generation logic
  const generateCodeInternal = async () => {
    // build phần thân từ các node
    const order = topoSort();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const lines: string[] = [];
    let openLoops = 0; // Track open loops
    let openIfs = 0; // Track open if statements
    let hasElse = false; // Track if current if has else

  for (const id of order) {
    const n = nodeMap.get(id);
    if (!n) continue;
    const d = n.data as NodeData;

    if (d.kind === "GoTo") {
      const url = d.config?.url?.trim() || "https://example.com";
      lines.push(`await page.goto(${JSON.stringify(url)});`);
      lines.push(`console.log("Page title:", await page.title());`);
    }
    if (d.kind === "Navigation") {
      const action = d.config?.action || "forward";
      if (action === "forward") lines.push(`await page.goForward();`);
      else if (action === "back") lines.push(`await page.goBack();`);
      else if (action === "refresh") lines.push(`await page.reload();`);
      else if (action === "newTab") lines.push(`const newPage = await browser.newPage();`);
    }
    if (d.kind === "Type") {
      const xpath = d.config?.xpath?.trim() || "";
      const inputType = (d.config as any)?.inputType || "text";

      if (inputType === "variable") {
        const variableName = d.config?.variableName || "inputText";
        lines.push(`await act.type(page, ${JSON.stringify(xpath)}, ${variableName});`);
      } else {
        const text = d.config?.text ?? "";
        lines.push(`await act.type(page, ${JSON.stringify(xpath)}, ${JSON.stringify(text)});`);
      }
    }
    if (d.kind === "MultiType") {
      const fields = (d.config as any)?.fields || [];
      lines.push(`// Type into multiple fields`);

      for (const field of fields) {
        const xpath = field.xpath?.trim() || "";
        const inputType = field.inputType || "text";

        if (xpath) {
          if (inputType === "variable") {
            const variableName = field.variableName || "inputText";
            lines.push(`await act.type(page, ${JSON.stringify(xpath)}, ${variableName});`);
          } else {
            const text = field.text ?? "";
            lines.push(`await act.type(page, ${JSON.stringify(xpath)}, ${JSON.stringify(text)});`);
          }
        }
      }
    }
    if (d.kind === "Click") {
      const xpath = d.config?.xpath?.trim() || "";
      const index = d.config?.index;
      const stmt = Number.isFinite(index)
        ? `await act.click(page, ${JSON.stringify(xpath)}, ${Number(index)});`
        : `await act.click(page, ${JSON.stringify(xpath)});`;
      lines.push(stmt);
    }
    if (d.kind === "Select") {
      const xpath = d.config?.xpath?.trim() || "";
      const selectBy = d.config?.selectBy || "text";
      const selectValue = d.config?.selectValue || "";
      const selectIndex = d.config?.selectIndex ?? 0;
      
      if (selectBy === "index") {
        lines.push(`await act.select(page, ${JSON.stringify(xpath)}, { index: ${selectIndex} });`);
      } else if (selectBy === "value") {
        lines.push(`await act.select(page, ${JSON.stringify(xpath)}, { value: ${JSON.stringify(selectValue)} });`);
      } else {
        lines.push(`await act.select(page, ${JSON.stringify(xpath)}, { text: ${JSON.stringify(selectValue)} });`);
      }
    }
    if (d.kind === "SwitchFrame") {
      const frameType = d.config?.frameType || "enter";
      const frameSelector = d.config?.frameSelector || "";
      
      if (frameType === "enter") {
        lines.push(`const frame = await page.waitForSelector(${JSON.stringify(frameSelector)});`);
        lines.push(`await page.evaluate(el => el.contentDocument, frame);`);
      } else if (frameType === "exit") {
        lines.push(`await page.mainFrame();`);
      } else if (frameType === "parent") {
        lines.push(`await page.parentFrame();`);
      }
    }
    if (d.kind === "SwitchTab") {
      const tabIndex = d.config?.tabIndex ?? 0;
      const tabUrl = d.config?.tabUrl || "";
      
      if (tabUrl) {
        lines.push(`const pages = await browser.pages();`);
        lines.push(`const targetPage = pages.find(p => p.url().includes(${JSON.stringify(tabUrl)}));`);
        lines.push(`if (targetPage) await targetPage.bringToFront();`);
      } else {
        lines.push(`const pages = await browser.pages();`);
        lines.push(`if (pages[${tabIndex}]) await pages[${tabIndex}].bringToFront();`);
      }
    }
    if (d.kind === "ScrollTo") {
      const scrollType = d.config?.scrollType || "element";
      const xpath = d.config?.xpath?.trim() || "";
      const scrollX = d.config?.scrollX ?? 0;
      const scrollY = d.config?.scrollY ?? 0;
      
      if (scrollType === "element") {
        lines.push(`await act.scrollToElement(page, ${JSON.stringify(xpath)});`);
      } else if (scrollType === "position") {
        lines.push(`await page.evaluate(() => window.scrollTo(${scrollX}, ${scrollY}));`);
      } else if (scrollType === "bottom") {
        lines.push(`await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`);
      } else if (scrollType === "top") {
        lines.push(`await page.evaluate(() => window.scrollTo(0, 0));`);
      }
    }
    if (d.kind === "Wait") {
      const waitType = d.config?.waitType || "element";
      const xpath = d.config?.xpath?.trim() || "";
      const timeout = d.config?.timeout ?? 5000;

      if (waitType === "element" && xpath) {
        lines.push(`// Wait for element to appear`);
        lines.push(`await page.waitForSelector("::-p-xpath(${JSON.stringify(xpath)})", { timeout: ${timeout} });`);
        lines.push(`console.log("Element found: ${xpath}");`);
      } else {
        lines.push(`// Wait for ${timeout}ms`);
        lines.push(`await act.pause(${timeout});`);
      }
    }
    if (d.kind === "Sleep") {
      const timeout = d.config?.timeout ?? 1000;
      lines.push(`await new Promise(resolve => setTimeout(resolve, ${timeout}));`);
    }
    if (d.kind === "If") {
      const condition = d.config?.condition || "element_exists";
      const xpath = d.config?.xpath?.trim() || "";
      const value = d.config?.value || "";

      // Check if next node is Else
      const currentIndex = order.indexOf(id);
      const nextNodeId = order[currentIndex + 1];
      const nextNode = nextNodeId ? nodeMap.get(nextNodeId) : null;
      hasElse = !!(nextNode && (nextNode.data as NodeData).kind === "Else");

      if (condition === "element_exists") {
        lines.push(`if (await act.elementExists(page, ${JSON.stringify(xpath)})) {`);
      } else if (condition === "element_not_exists") {
        lines.push(`if (!(await act.elementExists(page, ${JSON.stringify(xpath)}))) {`);
      } else if (condition === "text_contains") {
        lines.push(`if ((await page.content()).includes(${JSON.stringify(value)})) {`);
      } else if (condition === "page_title_is") {
        lines.push(`if ((await page.title()) === ${JSON.stringify(value)}) {`);
      }
      openIfs++;
    }
    if (d.kind === "Else") {
      // Close the if block and open the else block
      // The openIfs counter remains the same since we're replacing if with else
      lines.push(`} else {`);
      lines.push(`  console.warn("Condition was false, executing else block");`);
    }
    if (d.kind === "Loop") {
      const loopCount = d.config?.loopCount ?? 5;
      const currentIndexName = d.config?.currentIndexName || "i";
      lines.push(`for (let ${currentIndexName} = 0; ${currentIndexName} < ${loopCount}; ${currentIndexName}++) {`);
      lines.push(`  console.log("Loop iteration:", ${currentIndexName} + 1);`);
      openLoops++;
    }
    if (d.kind === "EndLoop") {
      if (openLoops > 0) {
        lines.push(`}`); // Close the loop
        openLoops--;
      }
    }
    if (d.kind === "For") {
      const start = d.config?.start ?? 0;
      const end = d.config?.end ?? 10;
      const step = d.config?.step ?? 1;
      lines.push(`for (let i = ${start}; i < ${end}; i += ${step}) {`);
    }
    if (d.kind === "While") {
      const condition = d.config?.condition || "element_exists";
      const xpath = d.config?.xpath?.trim() || "";
      
      if (condition === "element_exists") {
        lines.push(`while (await act.elementExists(page, ${JSON.stringify(xpath)})) {`);
      }
    }
    if (d.kind === "Variable") {
      const variableName = d.config?.variableName || "myVar";
      const variableValue = d.config?.variableValue || "";
      const operation = d.config?.operation || "set";
      
      if (operation === "set") {
        lines.push(`const ${variableName} = ${JSON.stringify(variableValue)};`);
      } else {
        lines.push(`console.log(${variableName});`);
      }
    }
    if (d.kind === "Extract") {
      const xpath = d.config?.xpath?.trim() || "";
      const extractType = d.config?.extractType || "text";
      const variableName = d.config?.variableName || "extractedData";
      const attribute = d.config?.attribute || "";

      if (extractType === "text") {
        lines.push(`// Extract text content from element`);
        lines.push(`const ${variableName} = await act.getText(page, ${JSON.stringify(xpath)});`);
        lines.push(`console.log("Extracted text into '${variableName}':", ${variableName});`);
      } else {
        lines.push(`// Extract attribute '${attribute}' from element`);
        lines.push(`const ${variableName} = await act.getAttribute(page, ${JSON.stringify(xpath)}, ${JSON.stringify(attribute)});`);
        lines.push(`console.log("Extracted attribute into '${variableName}':", ${variableName});`);
      }
    }
    if (d.kind === "DataProcess") {
      const processType = d.config?.processType || "assignVariable";
      const targetVariable = d.config?.targetVariable || "processedData";
      const sourceVariable = d.config?.sourceVariable || "extractedData";

      if (processType === "assignVariable") {
        lines.push(`// Assign variable from ${sourceVariable} to ${targetVariable}`);
        lines.push(`const ${targetVariable} = ${sourceVariable};`);
        lines.push(`console.log("Assigned '${targetVariable}':", ${targetVariable});`);
      } else if (processType === "processText") {
        const operation = d.config?.operation || "trim";
        lines.push(`// Process text with ${operation}`);
        if (operation === "trim") {
          lines.push(`const ${targetVariable} = ${sourceVariable}.trim();`);
        } else if (operation === "uppercase") {
          lines.push(`const ${targetVariable} = ${sourceVariable}.toUpperCase();`);
        } else if (operation === "lowercase") {
          lines.push(`const ${targetVariable} = ${sourceVariable}.toLowerCase();`);
        }
        lines.push(`console.log("Processed '${targetVariable}':", ${targetVariable});`);
      } else if (processType === "concat") {
        const additionalText = d.config?.additionalText || "";
        lines.push(`// Concatenate variables/text`);
        lines.push(`const ${targetVariable} = ${sourceVariable} + " ${additionalText}";`);
        lines.push(`console.log("Concatenated '${targetVariable}':", ${targetVariable});`);
      }
    }
    if (d.kind === "Log") {
      const logLevel = d.config?.logLevel || "info";
      const messageType = d.config?.messageType || "text";
      const message = d.config?.message || "";
      const variableName = d.config?.variableName || "";

      let logContent;
      if (messageType === "variable") {
        // Log a variable directly
        logContent = variableName;
      } else if (messageType === "template") {
        // Template with variable interpolation
        logContent = `\`${message.replace(/\${/g, '${')}\``;
      } else {
        // Static text
        logContent = JSON.stringify(message);
      }

      if (logLevel === "error") {
        lines.push(`console.error(${messageType === "variable" ? `"${variableName}:", ${logContent}` : logContent});`);
      } else if (logLevel === "warn") {
        lines.push(`console.warn(${messageType === "variable" ? `"${variableName}:", ${logContent}` : logContent});`);
      } else if (logLevel === "debug") {
        lines.push(`console.debug(${messageType === "variable" ? `"${variableName}:", ${logContent}` : logContent});`);
      } else {
        lines.push(`console.log(${messageType === "variable" ? `"${variableName}:", ${logContent}` : logContent});`);
      }
    }
    if (d.kind === "HttpRequest") {
      const method = d.config?.method || "POST";
      const endpoint = d.config?.endpoint || "";
      const headers = d.config?.headers || {};
      const body = d.config?.body || {};
      const authType = d.config?.authType || "none";
      const authToken = d.config?.authToken || "";
      const apiKeyHeader = d.config?.apiKeyHeader || "";
      const apiKeyValue = d.config?.apiKeyValue || "";
      const responseVariable = d.config?.responseVariable || "httpResponse";
      const timeout = d.config?.timeout || 30000;

      lines.push(`// HTTP Request to ${endpoint}`);
      lines.push(`const ${responseVariable} = await (async () => {`);
      lines.push(`  const axios = (await import('axios')).default;`);
      lines.push(`  const requestConfig = {`);
      lines.push(`    method: ${JSON.stringify(method)},`);
      lines.push(`    url: ${JSON.stringify(endpoint)},`);
      lines.push(`    timeout: ${timeout},`);
      lines.push(`    headers: {`);
      lines.push(`      'Content-Type': 'application/json',`);

      // Add authentication headers
      if (authType === "bearer" && authToken) {
        // Check if authToken already includes "Bearer" prefix
        const bearerToken = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
        lines.push(`      'Authorization': '${bearerToken}',`);
      } else if (authType === "apiKey" && apiKeyHeader && apiKeyValue) {
        lines.push(`      '${apiKeyHeader}': '${apiKeyValue}',`);
      }

      // Add custom headers
      Object.entries(headers).forEach(([key, value]) => {
        lines.push(`      '${key}': '${value}',`);
      });

      lines.push(`    },`);

      // Add body for POST, PUT, PATCH requests
      if (["POST", "PUT", "PATCH"].includes(method)) {
        // Check if body contains variable references like ${variableName}
        const bodyStr = JSON.stringify(body, null, 2);
        if (bodyStr.includes('${')) {
          // Parse body to inject variables - safer approach
          lines.push(`    data: (() => {`);
          lines.push(`      // Create template`);
          lines.push(`      let bodyTemplate = ${bodyStr};`);
          lines.push(`      `);
          lines.push(`      // Recursively process the body to replace variables`);
          lines.push(`      const processValue = (obj) => {`);
          lines.push(`        if (typeof obj === 'string') {`);
          lines.push(`          // Replace \${variableName} with actual values`);
          lines.push(`          return obj.replace(/\\$\\{(\\w+)\\}/g, (match, varName) => {`);
          lines.push(`            try {`);
          lines.push(`              const value = eval(varName);`);
          lines.push(`              if (typeof value === 'string') {`);
          lines.push(`                // Clean text: remove newlines, tabs, quotes`);
          lines.push(`                return value`);
          lines.push(`                  .replace(/\\n/g, ' ')`);
          lines.push(`                  .replace(/\\r/g, '')`);
          lines.push(`                  .replace(/\\t/g, ' ')`);
          lines.push(`                  .replace(/\\s+/g, ' ')`);
          lines.push(`                  .trim();`);
          lines.push(`              }`);
          lines.push(`              return value;`);
          lines.push(`            } catch (e) {`);
          lines.push(`              console.warn(\`Variable \${varName} not found\`);`);
          lines.push(`              return '';`);
          lines.push(`            }`);
          lines.push(`          });`);
          lines.push(`        } else if (Array.isArray(obj)) {`);
          lines.push(`          return obj.map(processValue);`);
          lines.push(`        } else if (obj && typeof obj === 'object') {`);
          lines.push(`          const result = {};`);
          lines.push(`          for (const key in obj) {`);
          lines.push(`            result[key] = processValue(obj[key]);`);
          lines.push(`          }`);
          lines.push(`          return result;`);
          lines.push(`        }`);
          lines.push(`        return obj;`);
          lines.push(`      };`);
          lines.push(`      `);
          lines.push(`      return processValue(bodyTemplate);`);
          lines.push(`    })()`);
        } else {
          lines.push(`    data: ${bodyStr}`);
        }
      }

      lines.push(`  };`);
      lines.push(`  `);
      lines.push(`  try {`);
      lines.push(`    console.log('Making HTTP ${method} request to:', '${endpoint}');`);
      lines.push(`    const response = await axios(requestConfig);`);
      lines.push(`    console.log('Response status:', response.status);`);
      lines.push(`    console.log('Response data:', JSON.stringify(response.data, null, 2));`);
      lines.push(`    return response.data;`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error('HTTP Request failed:', error.message);`);
      lines.push(`    if (error.response) {`);
      lines.push(`      console.error('Response status:', error.response.status);`);
      lines.push(`      console.error('Response data:', error.response.data);`);
      lines.push(`    }`);
      lines.push(`    throw error;`);
      lines.push(`  }`);
      lines.push(`})();`);
      lines.push(`console.log('Response stored in variable: ${responseVariable}');`);
    }
    if (d.kind === "AI") {
      const aiRole = d.config?.aiRole || "assistant";
      const aiInputType = d.config?.aiInputType || "variable";
      const aiInputVariable = d.config?.aiInputVariable || "extractedData";
      const aiPrompt = d.config?.aiPrompt || "";
      const aiResponseVariable = d.config?.aiResponseVariable || "aiResponse";

      // Define system prompts based on role
      const rolePrompts = {
        assistant: "You are a helpful assistant. Answer directly and concisely. No explanations or formatting unless asked.",
        social_commenter: "You are a social media user. Create ONE natural comment only. Rules:\n- Write ONLY the comment, nothing else\n- No quotes, brackets, or explanations\n- Be genuine and conversational\n- 1-2 sentences maximum\n- Match the language of the post\n- No formatting like *asterisks* or _underscores_",
        content_creator: "You are a content writer. Write the content directly without any introduction or explanation. No formatting markers.",
        translator: "Translate the text directly. Output ONLY the translation, no explanations or notes. Default to Vietnamese.",
        summarizer: "Summarize in 1-2 sentences. Output ONLY the summary, no introductions like 'Here is the summary:'"
      };

      const systemPrompt = rolePrompts[aiRole] || rolePrompts.assistant;

      lines.push(`// AI Assistant (${aiRole}) - Using Roxane API`);
      lines.push(`const ${aiResponseVariable} = await (async () => {`);
      lines.push(`  const axios = (await import('axios')).default;`);

      // Determine the user message
      let userMessage;
      if (aiInputType === "custom" && aiPrompt) {
        // Custom input with possible variable interpolation
        if (aiPrompt.includes('${')) {
          lines.push(`  // Process custom prompt with variables`);
          lines.push(`  const userPrompt = \`${aiPrompt.replace(/`/g, '\\`')}\`;`);
          userMessage = 'userPrompt';
        } else {
          userMessage = JSON.stringify(aiPrompt);
        }
      } else {
        // Use variable from previous node
        lines.push(`  // Using input from variable: ${aiInputVariable}`);

        // Add role-specific instructions
        if (aiRole === "social_commenter") {
          lines.push(`  const userPrompt = \`Comment on this: \${${aiInputVariable}}\`;`);
        } else if (aiRole === "content_creator") {
          lines.push(`  const userPrompt = \`Write about: \${${aiInputVariable}}\`;`);
        } else if (aiRole === "translator") {
          lines.push(`  const userPrompt = \`Translate: \${${aiInputVariable}}\`;`);
        } else if (aiRole === "summarizer") {
          lines.push(`  const userPrompt = \`Summarize: \${${aiInputVariable}}\`;`);
        } else {
          lines.push(`  const userPrompt = \`\${${aiInputVariable}}\`;`);
        }
        userMessage = 'userPrompt';
      }

      lines.push(``);
      lines.push(`  const requestConfig = {`);
      lines.push(`    method: 'POST',`);
      lines.push(`    url: 'https://llmapi.roxane.one/v1/chat/completions',`);
      lines.push(`    headers: {`);
      lines.push(`      'Content-Type': 'application/json',`);
      lines.push(`      'Authorization': 'Bearer linh-1752464641053-phonefarm'`);
      lines.push(`    },`);
      lines.push(`    data: {`);
      lines.push(`      model: 'text-model',`);
      lines.push(`      messages: [`);
      lines.push(`        { role: 'system', content: ${JSON.stringify(systemPrompt)} },`);
      lines.push(`        { role: 'user', content: ${userMessage} }`);
      lines.push(`      ],`);
      lines.push(`      temperature: 0.8,`);
      lines.push(`      max_tokens: 150`);
      lines.push(`    }`);
      lines.push(`  };`);
      lines.push(``);
      lines.push(`  try {`);
      lines.push(`    console.log('Calling Roxane AI (${aiRole} mode)...');`);
      lines.push(`    const response = await axios(requestConfig);`);
      lines.push(`    let aiText = response.data.choices[0].message.content;`);
      lines.push(`    `);
      lines.push(`    // Clean the response`);
      lines.push(`    aiText = aiText.trim();`);
      lines.push(`    // Remove quotes if present`);
      lines.push(`    aiText = aiText.replace(/^["']|["']$/g, '');`);
      lines.push(`    // Remove common prefixes`);
      lines.push(`    aiText = aiText.replace(/^(Comment:|Answer:|Response:|Here is|Here's)\\s*/i, '');`);
      lines.push(`    // Remove markdown formatting`);
      lines.push(`    aiText = aiText.replace(/\\*\\*(.*?)\\*\\*/g, '$1');`);
      lines.push(`    aiText = aiText.replace(/__(.*?)__/g, '$1');`);
      lines.push(`    aiText = aiText.replace(/\\*(.*?)\\*/g, '$1');`);
      lines.push(`    aiText = aiText.replace(/_(.*?)_/g, '$1');`);
      lines.push(`    `);
      lines.push(`    console.log('AI Response:', aiText);`);
      lines.push(`    return aiText;`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error('Roxane AI Request failed:', error.message);`);
      lines.push(`    if (error.response) {`);
      lines.push(`      console.error('Error details:', error.response.data);`);
      lines.push(`    }`);
      lines.push(`    throw error;`);
      lines.push(`  }`);
      lines.push(`})();`);
      lines.push(`console.log('AI response stored in: ${aiResponseVariable}');`);
    }

    if (d.kind === "CaptchaSolver") {
      lines.push(`// CAPTCHA Auto Solver with Gemma3:27b AI`);
      lines.push(`console.log('Initializing CAPTCHA solver with Gemma3:27b...');`);
      lines.push(``);
      lines.push(`// Function to convert image to base64`);
      lines.push(`const captureScreenshot = async (element) => {`);
      lines.push(`  const screenshot = await element.screenshot({ encoding: 'base64' });`);
      lines.push(`  return screenshot;`);
      lines.push(`};`);
      lines.push(``);
      lines.push(`// Function to create debug image with marked positions (using page.evaluate)`);
      lines.push(`const createDebugImageMarkup = async (imageBase64, gridPositions, gridSize) => {`);
      lines.push(`  try {`);
      lines.push(`    // Use page.evaluate to create image with red dots in browser context`);
      lines.push(`    const markedImageBase64 = await page.evaluate((imageData, positions, size) => {`);
      lines.push(`      return new Promise((resolve) => {`);
      lines.push(`        const canvas = document.createElement('canvas');`);
      lines.push(`        const ctx = canvas.getContext('2d');`);
      lines.push(`        const img = new Image();`);
      lines.push(`        `);
      lines.push(`        img.onload = () => {`);
      lines.push(`          canvas.width = img.width;`);
      lines.push(`          canvas.height = img.height;`);
      lines.push(`          ctx.drawImage(img, 0, 0);`);
      lines.push(`          `);
      lines.push(`          // Calculate cell dimensions`);
      lines.push(`          const cellWidth = img.width / size;`);
      lines.push(`          const cellHeight = img.height / size;`);
      lines.push(`          `);
      lines.push(`          // Draw red dots on AI-selected positions`);
      lines.push(`          ctx.fillStyle = 'red';`);
      lines.push(`          ctx.strokeStyle = 'white';`);
      lines.push(`          ctx.lineWidth = 3;`);
      lines.push(`          `);
      lines.push(`          positions.forEach(([row, col], index) => {`);
      lines.push(`            const centerX = (col * cellWidth) + (cellWidth / 2);`);
      lines.push(`            const centerY = (row * cellHeight) + (cellHeight / 2);`);
      lines.push(`            `);
      lines.push(`            // Draw red circle`);
      lines.push(`            ctx.beginPath();`);
      lines.push(`            ctx.arc(centerX, centerY, 18, 0, 2 * Math.PI);`);
      lines.push(`            ctx.fill();`);
      lines.push(`            ctx.stroke();`);
      lines.push(`            `);
      lines.push(`            // Draw number in white`);
      lines.push(`            ctx.fillStyle = 'white';`);
      lines.push(`            ctx.font = 'bold 16px Arial';`);
      lines.push(`            ctx.textAlign = 'center';`);
      lines.push(`            ctx.textBaseline = 'middle';`);
      lines.push(`            ctx.fillText(String(index + 1), centerX, centerY);`);
      lines.push(`            ctx.fillStyle = 'red';`);
      lines.push(`          });`);
      lines.push(`          `);
      lines.push(`          // Convert back to base64`);
      lines.push(`          const result = canvas.toDataURL('image/png').split(',')[1];`);
      lines.push(`          resolve(result);`);
      lines.push(`        };`);
      lines.push(`        `);
      lines.push(`        img.onerror = () => resolve(imageData);`);
      lines.push(`        img.src = 'data:image/png;base64,' + imageData;`);
      lines.push(`      });`);
      lines.push(`    }, imageBase64, gridPositions, gridSize);`);
      lines.push(`    `);
      lines.push(`    return markedImageBase64;`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error('Error creating debug image:', error);`);
      lines.push(`    return imageBase64; // Return original if error`);
      lines.push(`  }`);
      lines.push(`};`);
      lines.push(``);
      lines.push(`// Function to create final debug image with both AI and Imposter positions`);
      lines.push(`const createFinalDebugImage = async (imageBase64, aiPositions, actualClicks, gridSize) => {`);
      lines.push(`  try {`);
      lines.push(`    // Use page.evaluate to create image with both red and green dots`);
      lines.push(`    const finalImageBase64 = await page.evaluate((imageData, aiPos, actualPos, size) => {`);
      lines.push(`      return new Promise((resolve) => {`);
      lines.push(`        const canvas = document.createElement('canvas');`);
      lines.push(`        const ctx = canvas.getContext('2d');`);
      lines.push(`        const img = new Image();`);
      lines.push(`        `);
      lines.push(`        img.onload = () => {`);
      lines.push(`          canvas.width = img.width;`);
      lines.push(`          canvas.height = img.height;`);
      lines.push(`          ctx.drawImage(img, 0, 0);`);
      lines.push(`          `);
      lines.push(`          // Calculate cell dimensions`);
      lines.push(`          const cellWidth = img.width / size;`);
      lines.push(`          const cellHeight = img.height / size;`);
      lines.push(`          `);
      lines.push(`          // Draw RED dots for AI selections`);
      lines.push(`          ctx.fillStyle = 'red';`);
      lines.push(`          ctx.strokeStyle = 'white';`);
      lines.push(`          ctx.lineWidth = 3;`);
      lines.push(`          `);
      lines.push(`          aiPos.forEach(([row, col], index) => {`);
      lines.push(`            const centerX = (col * cellWidth) + (cellWidth / 2);`);
      lines.push(`            const centerY = (row * cellHeight) + (cellHeight / 2);`);
      lines.push(`            `);
      lines.push(`            // Draw red circle`);
      lines.push(`            ctx.beginPath();`);
      lines.push(`            ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);`);
      lines.push(`            ctx.fill();`);
      lines.push(`            ctx.stroke();`);
      lines.push(`            `);
      lines.push(`            // Draw number in white`);
      lines.push(`            ctx.fillStyle = 'white';`);
      lines.push(`            ctx.font = 'bold 18px Arial';`);
      lines.push(`            ctx.textAlign = 'center';`);
      lines.push(`            ctx.textBaseline = 'middle';`);
      lines.push(`            ctx.fillText(String(index + 1), centerX, centerY);`);
      lines.push(`            ctx.fillStyle = 'red';`);
      lines.push(`          });`);
      lines.push(`          `);
      lines.push(`          // Draw GREEN dots for actual Imposter clicks`);
      lines.push(`          ctx.fillStyle = 'lime';`);
      lines.push(`          ctx.strokeStyle = 'darkgreen';`);
      lines.push(`          ctx.lineWidth = 2;`);
      lines.push(`          `);
      lines.push(`          actualPos.forEach((clickPos) => {`);
      lines.push(`            const centerX = clickPos.x;`);
      lines.push(`            const centerY = clickPos.y;`);
      lines.push(`            `);
      lines.push(`            // Draw green circle (smaller than red)`);
      lines.push(`            ctx.beginPath();`);
      lines.push(`            ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);`);
      lines.push(`            ctx.fill();`);
      lines.push(`            ctx.stroke();`);
      lines.push(`            `);
      lines.push(`            // Draw index number in dark green`);
      lines.push(`            ctx.fillStyle = 'darkgreen';`);
      lines.push(`            ctx.font = 'bold 12px Arial';`);
      lines.push(`            ctx.textAlign = 'center';`);
      lines.push(`            ctx.textBaseline = 'middle';`);
      lines.push(`            ctx.fillText(String(clickPos.index), centerX, centerY);`);
      lines.push(`            ctx.fillStyle = 'lime';`);
      lines.push(`          });`);
      lines.push(`          `);
      lines.push(`          // Add legend`);
      lines.push(`          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';`);
      lines.push(`          ctx.fillRect(10, 10, 200, 80);`);
      lines.push(`          ctx.strokeStyle = 'black';`);
      lines.push(`          ctx.lineWidth = 1;`);
      lines.push(`          ctx.strokeRect(10, 10, 200, 80);`);
      lines.push(`          `);
      lines.push(`          // Legend text`);
      lines.push(`          ctx.fillStyle = 'black';`);
      lines.push(`          ctx.font = 'bold 14px Arial';`);
      lines.push(`          ctx.textAlign = 'left';`);
      lines.push(`          ctx.fillText('🔴 AI Selections', 20, 35);`);
      lines.push(`          ctx.fillText('🟢 Imposter Clicks', 20, 60);`);
      lines.push(`          `);
      lines.push(`          // Convert back to base64`);
      lines.push(`          const result = canvas.toDataURL('image/png').split(',')[1];`);
      lines.push(`          resolve(result);`);
      lines.push(`        };`);
      lines.push(`        `);
      lines.push(`        img.onerror = () => resolve(imageData);`);
      lines.push(`        img.src = 'data:image/png;base64,' + imageData;`);
      lines.push(`      });`);
      lines.push(`    }, imageBase64, aiPositions, actualClicks, gridSize);`);
      lines.push(`    `);
      lines.push(`    return finalImageBase64;`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error('Error creating final debug image:', error);`);
      lines.push(`    return imageBase64; // Return original if error`);
      lines.push(`  }`);
      lines.push(`};`);
      lines.push(``);
      lines.push(`// Function to solve CAPTCHA with Gemma3 AI`);
      lines.push(`const solveCaptchaWithGemma3 = async (imageBase64, instructionText) => {`);
      lines.push(`  try {`);
      lines.push(`    const systemPrompt = \`Role: You are a seasoned professional CAPTCHA analysis specialist.`);
      lines.push(``);
      lines.push(`Mission:`);
      lines.push(`- Analyze reCAPTCHA image grids with precision and accuracy`);
      lines.push(`- Identify grid cells containing the requested object type`);
      lines.push(`- Provide immediate, actionable results without seeking clarification`);
      lines.push(``);
      lines.push(`Inputs:`);
      lines.push(`- USER_QUERY: \${instructionText}`);
      lines.push(`- IMAGE: A reCAPTCHA grid (3x3 or 4x4) of smaller images`);
      lines.push(``);
      lines.push(`Grid Cell Indexing System:`);
      lines.push(`- 3x3 Grid: [0,0] [0,1] [0,2] / [1,0] [1,1] [1,2] / [2,0] [2,1] [2,2]`);
      lines.push(`- 4x4 Grid: [0,0] [0,1] [0,2] [0,3] / [1,0] [1,1] [1,2] [1,3] / etc.`);
      lines.push(`- Format: [row, column] starting from top-left as [0,0]`);
      lines.push(``);
      lines.push(`Output (Mandatory):`);
      lines.push(`- Return a JSON string (array) with exactly the grid positions of matching cells`);
      lines.push(`- Format: [[row,col],[row,col],...] where each pair represents a grid cell`);
      lines.push(`- Example: [[0,1],[1,2],[2,0]] means cells at row 0 col 1, row 1 col 2, and row 2 col 0`);
      lines.push(`- Use empty array ([]) if no objects match the criteria`);
      lines.push(`- Do not include explanations, just the JSON array`);
      lines.push(``);
      lines.push(`Behavior:`);
      lines.push(`1. Analyze each grid cell systematically for the requested object`);
      lines.push(`2. Be conservative - only include cells that CLEARLY contain the object`);
      lines.push(`3. Consider partial objects, shadows, reflections, and blurred images as valid matches`);
      lines.push(`4. Ignore ambiguous or unclear cells to avoid false positives`);
      lines.push(`5. Return results immediately without requesting clarification\`;`);
      lines.push(``);
      lines.push(`    console.log('Sending CAPTCHA image to Gemma3:27b...');`);
      lines.push(`    `);
      lines.push(`    const response = await fetch('https://ollama-privos.roxane.one/api/generate', {`);
      lines.push(`      method: 'POST',`);
      lines.push(`      headers: {`);
      lines.push(`        'Content-Type': 'application/json'`);
      lines.push(`      },`);
      lines.push(`      body: JSON.stringify({`);
      lines.push(`        model: 'gemma3:27b',`);
      lines.push(`        prompt: systemPrompt,`);
      lines.push(`        images: [imageBase64],`);
      lines.push(`        stream: false`);
      lines.push(`      })`);
      lines.push(`    });`);
      lines.push(``);
      lines.push(`    if (!response.ok) {`);
      lines.push(`      throw new Error(\`AI API error: \${response.status}\`);`);
      lines.push(`    }`);
      lines.push(``);
      lines.push(`    const data = await response.json();`);
      lines.push(`    console.log('AI response received');`);
      lines.push(`    `);
      lines.push(`    // Parse the coordinates from AI response`);
      lines.push(`    const coordinatesMatch = data.response.match(/\\[[\\d,\\s\\[\\]]+\\]/);`);
      lines.push(`    if (coordinatesMatch) {`);
      lines.push(`      return JSON.parse(coordinatesMatch[0]);`);
      lines.push(`    }`);
      lines.push(`    return null;`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error('Gemma3 AI error:', error);`);
      lines.push(`    return null;`);
      lines.push(`  }`);
      lines.push(`};`);
      lines.push(``);
      lines.push(`// Helper function for human-like clicking behavior`);
      lines.push(`const humanClick = async (page, x, y) => {`);
      lines.push(`  // Move mouse to position with steps for natural movement`);
      lines.push(`  await page.mouse.move(x, y, { steps: 10 });`);
      lines.push(`  // Small pause before clicking`);
      lines.push(`  await new Promise(r => setTimeout(r, 100 + Math.random() * 100));`);
      lines.push(`  // Press and release with natural timing`);
      lines.push(`  await page.mouse.down();`);
      lines.push(`  await new Promise(r => setTimeout(r, 50 + Math.random() * 50));`);
      lines.push(`  await page.mouse.up();`);
      lines.push(`};`);
      lines.push(``);
      lines.push(`// Main CAPTCHA solving logic`);
      lines.push(`try {`);
      lines.push(`  // Step 1: Check and click reCAPTCHA checkbox with human-like behavior`);
      lines.push(`  const recaptchaCheckbox = await page.$('iframe[src*="google.com/recaptcha/api2/anchor"]');`);
      lines.push(`  if (recaptchaCheckbox) {`);
      lines.push(`    console.log('reCAPTCHA detected, clicking "I am not a robot"...');`);
      lines.push(`    `);
      lines.push(`    // Get frames and find reCAPTCHA frame`);
      lines.push(`    const frames = await page.frames();`);
      lines.push(`    const recaptchaFrame = frames.find(frame => `);
      lines.push(`      frame.url().includes('google.com/recaptcha/api2/anchor')`);
      lines.push(`    );`);
      lines.push(`    `);
      lines.push(`    if (recaptchaFrame) {`);
      lines.push(`      // Wait for checkbox to load`);
      lines.push(`      await recaptchaFrame.waitForSelector('#recaptcha-anchor', { timeout: 5000 });`);
      lines.push(`      `);
      lines.push(`      // Click directly in the frame context`);
      lines.push(`      await recaptchaFrame.click('#recaptcha-anchor');`);
      lines.push(`      console.log('Clicked checkbox successfully');`);
      lines.push(`      `);
      lines.push(`      // Wait and check if CAPTCHA passed without challenge`);
      lines.push(`      await new Promise(r => setTimeout(r, 3000));`);
      lines.push(`      `);
      lines.push(`      // Check if checkbox is checked (CAPTCHA passed)`);
      lines.push(`      try {`);
      lines.push(`        const isChecked = await recaptchaFrame.evaluate(() => {`);
      lines.push(`          const checkbox = document.querySelector('.recaptcha-checkbox');`);
      lines.push(`          return checkbox && checkbox.getAttribute('aria-checked') === 'true';`);
      lines.push(`        });`);
      lines.push(`        `);
      lines.push(`        if (isChecked) {`);
      lines.push(`          console.log('SUCCESS: CAPTCHA passed without challenge! Imposter movement worked.');`);
      lines.push(`          return; // Exit - no need for AI`);
      lines.push(`        }`);
      lines.push(`      } catch (e) {`);
      lines.push(`        console.log('Checking for challenge...');`);
      lines.push(`      }`);
      lines.push(`    }`);
      lines.push(`  }`);
      lines.push(``);
      lines.push(`  // Step 2: Only proceed with AI if image challenge appeared`);
      lines.push(`  await new Promise(r => setTimeout(r, 2000));`);
      lines.push(`  const frames2 = await page.frames();`);
      lines.push(`  const bframe = frames2.find(frame =>`);
      lines.push(`    frame.url().includes('google.com/recaptcha/api2/bframe')`);
      lines.push(`  );`);
      lines.push(`  `);
      lines.push(`  if (bframe) {`);
      lines.push(`    console.log('Image challenge appeared, solving with AI...');`);
      lines.push(`    `);
      lines.push(`    // Wait for images to load completely`);
      lines.push(`    await bframe.waitForSelector('.rc-imageselect-challenge', { timeout: 5000 }).catch(() => {});`);
      lines.push(`    await new Promise(r => setTimeout(r, 2000));`);
      lines.push(`    `);
      lines.push(`    // Find the challenge container`);
      lines.push(`    const challengeElement = await bframe.$('.rc-imageselect-table-44, .rc-imageselect-table-33');`);
      lines.push(`    if (challengeElement) {`);
      lines.push(`      const challengeBox = await challengeElement.boundingBox();`);
      lines.push(`      if (challengeBox) {`);
      lines.push(`      // Capture larger area to include instructions`);
      lines.push(`      const screenshotBuffer = await page.screenshot({`);
      lines.push(`        clip: {`);
      lines.push(`          x: challengeBox.x - 10,`);
      lines.push(`          y: challengeBox.y - 10,`);
      lines.push(`          width: challengeBox.width + 20,`);
      lines.push(`          height: challengeBox.height + 20`);
      lines.push(`        }`);
      lines.push(`      });`);
      lines.push(`      `);
      lines.push(`      // Save screenshot and metadata to storage/local`);
      lines.push(`      const fs = require('fs');`);
      lines.push(`      const path = require('path');`);
      lines.push(`      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');`);
      lines.push(`      `);
      lines.push(`      // Create path for CAPTCHA storage`);
      lines.push(`      const storagePath = process.cwd() + '/storage/local/captcha';`);
      lines.push(`      `);
      lines.push(`      // Create directory if needed`);
      lines.push(`      if (!fs.existsSync(storagePath)) {`);
      lines.push(`        fs.mkdirSync(storagePath, { recursive: true });`);
      lines.push(`      }`);
      lines.push(`      `);
      lines.push(`      // Extract instruction text`);
      lines.push(`      let instructionText = 'Select all matching images';`);
      lines.push(`      try {`);
      lines.push(`        const instruction = await bframe.$('.rc-imageselect-desc-no-canonical, .rc-imageselect-desc');`);
      lines.push(`        if (instruction) {`);
      lines.push(`          instructionText = await bframe.evaluate(el => el.textContent, instruction);`);
      lines.push(`          console.log('CAPTCHA instruction:', instructionText);`);
      lines.push(`        }`);
      lines.push(`      } catch (e) {}`);
      lines.push(`      `);
      lines.push(`      // Save screenshot`);
      lines.push(`      const screenshotPath = path.join(storagePath, 'captcha_' + timestamp + '.png');`);
      lines.push(`      fs.writeFileSync(screenshotPath, screenshotBuffer);`);
      lines.push(`      `);
      lines.push(`      // Save metadata JSON`);
      lines.push(`      const metadata = {`);
      lines.push(`        timestamp: timestamp,`);
      lines.push(`        text: instructionText,`);
      lines.push(`        imagePath: screenshotPath,`);
      lines.push(`        type: 'recaptcha_v2'`);
      lines.push(`      };`);
      lines.push(`      const jsonPath = path.join(storagePath, 'captcha_' + timestamp + '.json');`);
      lines.push(`      fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));`);
      lines.push(`      console.log('Saved CAPTCHA files:', jsonPath);`);
      lines.push(`      `);
      lines.push(`      // Convert to base64 for AI`);
      lines.push(`      const screenshotBase64 = screenshotBuffer.toString('base64');`);
      lines.push(`      `);
      lines.push(`      // Send to Gemma3 for analysis with instruction text`);
      lines.push(`      const gridPositions = await solveCaptchaWithGemma3(screenshotBase64, instructionText);`);
      lines.push(`      `);
      lines.push(`      if (gridPositions && gridPositions.length > 0) {`);
      lines.push(`        console.log(\`AI identified \${gridPositions.length} grid cells to click\`);`);
      lines.push(`        console.log(\`AI selected positions: \${JSON.stringify(gridPositions)}\`);`);
      lines.push(`        `);
      lines.push(`        // Determine grid size (3x3 or 4x4)`);
      lines.push(`        const gridSize = challengeBox.width > 400 ? 4 : 3;`);
      lines.push(`        const cellWidth = challengeBox.width / gridSize;`);
      lines.push(`        const cellHeight = challengeBox.height / gridSize;`);
      lines.push(`        `);
      lines.push(`        console.log(\`Grid detected: \${gridSize}x\${gridSize}, cell size: \${cellWidth}x\${cellHeight}\`);`);
      lines.push(`        `);
      lines.push(`        // Create debug image with red dots marking AI selections`);
      lines.push(`        try {`);
      lines.push(`          console.log('Creating debug image with AI selections marked...');`);
      lines.push(`          const markedImageBase64 = await createDebugImageMarkup(screenshotBase64, gridPositions, gridSize);`);
      lines.push(`          `);
      lines.push(`          // Save marked image to output folder for debugging`);
      lines.push(`          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');`);
      lines.push(`          // Create output directory if not exists`);
      lines.push(`          const outputDir = process.cwd() + '/output';`);
      lines.push(`          if (!fs.existsSync(outputDir)) { fs.mkdirSync(outputDir, { recursive: true }); }`);
      lines.push(`          const debugImagePath = outputDir + '/captcha-debug-' + timestamp + '.png';`);
      lines.push(`          const markedImageBuffer = Buffer.from(markedImageBase64, 'base64');`);
      lines.push(`          fs.writeFileSync(debugImagePath, markedImageBuffer);`);
      lines.push(`          `);
      lines.push(`          console.log('📸 Debug image saved: ' + debugImagePath);`);
      lines.push(`          console.log('Red dots show AI selections: ' + gridPositions.map(([r,c], i) => (i+1) + ':[row ' + r + ', col ' + c + ']').join(', '));`);
      lines.push(`        } catch (debugError) {`);
      lines.push(`          console.warn('Could not create debug image:', debugError.message);`);
      lines.push(`        }`);
      lines.push(`        `);
      lines.push(`        // Click on each identified grid cell`);
      lines.push(`        console.log(\`Starting to click \${gridPositions.length} grid cells...\`);`);
      lines.push(`        const actualClickPositions = []; // Store actual click positions for debug`);
      lines.push(`        for (let i = 0; i < gridPositions.length; i++) {`);
      lines.push(`          console.log(\`Processing click \${i + 1} of \${gridPositions.length}\`);`);
      lines.push(`          const [row, col] = gridPositions[i];`);
      lines.push(`          `);
      lines.push(`          // Calculate center of grid cell with small random offset`);
      lines.push(`          const cellCenterX = challengeBox.x + (col * cellWidth) + (cellWidth / 2) + (Math.random() * 20 - 10);`);
      lines.push(`          const cellCenterY = challengeBox.y + (row * cellHeight) + (cellHeight / 2) + (Math.random() * 20 - 10);`);
      lines.push(`          `);
      lines.push(`          console.log(\`  Clicking cell [\${row},\${col}] at position (\${cellCenterX.toFixed(0)}, \${cellCenterY.toFixed(0)})\`);`);
      lines.push(`          `);
      lines.push(`          try {`);
      lines.push(`            // Use humanClick for natural clicking`);
      lines.push(`            await humanClick(page, cellCenterX, cellCenterY);`);
      lines.push(`            console.log(\`  ✓ Successfully clicked cell \${i + 1}\`);`);
      lines.push(`            `);
      lines.push(`            // Store actual click position for debug image`);
      lines.push(`            actualClickPositions.push({`);
      lines.push(`              x: cellCenterX - challengeBox.x, // Relative to challenge box`);
      lines.push(`              y: cellCenterY - challengeBox.y,`);
      lines.push(`              gridRow: row,`);
      lines.push(`              gridCol: col,`);
      lines.push(`              index: i + 1`);
      lines.push(`            });`);
      lines.push(`          } catch (clickError) {`);
      lines.push(`            console.error(\`  ✗ Error clicking cell \${i + 1}:, clickError.message\`);`);
      lines.push(`          }`);
      lines.push(`          `);
      lines.push(`          // Check CAPTCHA state after each click`);
      lines.push(`          try {`);
      lines.push(`            const captchaStateAfterClick = await page.evaluate(() => {`);
      lines.push(`              const recaptchaFrame = document.querySelector('iframe[src*="recaptcha"]');`);
      lines.push(`              if (recaptchaFrame) {`);
      lines.push(`                const checkbox = recaptchaFrame.contentDocument?.querySelector('.recaptcha-checkbox');`);
      lines.push(`                return checkbox ? checkbox.getAttribute('aria-checked') : 'unknown';`);
      lines.push(`              }`);
      lines.push(`              return 'no-frame';`);
      lines.push(`            });`);
      lines.push(`            console.log(\`  State after click \${i + 1}: \${captchaStateAfterClick}\`);`);
      lines.push(`          } catch (stateError) {`);
      lines.push(`            console.log(\`  Could not check state after click \${i + 1}: \${stateError.message}\`);`);
      lines.push(`          }`);
      lines.push(`          `);
      lines.push(`          // Random human-like delay between clicks (increased for CAPTCHA stability)`);
      lines.push(`          const delay = 800 + Math.random() * 1200; // 800-2000ms delay`);
      lines.push(`          console.log(\`  Waiting \${Math.round(delay)}ms before next click...\`);`);
      lines.push(`          await new Promise(r => setTimeout(r, delay));`);
      lines.push(`        }`);
      lines.push(`        console.log(\`Completed all \${gridPositions.length} clicks!\`);`);
      lines.push(`        `);
      lines.push(`        // Create final debug image with both AI selections (red) and actual clicks (green)`);
      lines.push(`        try {`);
      lines.push(`          console.log('Creating final debug image with AI + Imposter clicks...');`);
      lines.push(`          const finalDebugImageBase64 = await createFinalDebugImage(screenshotBase64, gridPositions, actualClickPositions, gridSize);`);
      lines.push(`          `);
      lines.push(`          // Save final debug image`);
      lines.push(`          const finalTimestamp = new Date().toISOString().replace(/[:.]/g, '-');`);
      lines.push(`          const outputDir = process.cwd() + '/output';`);
      lines.push(`          if (!fs.existsSync(outputDir)) { fs.mkdirSync(outputDir, { recursive: true }); }`);
      lines.push(`          const finalDebugImagePath = outputDir + '/captcha-final-debug-' + finalTimestamp + '.png';`);
      lines.push(`          const finalImageBuffer = Buffer.from(finalDebugImageBase64, 'base64');`);
      lines.push(`          fs.writeFileSync(finalDebugImagePath, finalImageBuffer);`);
      lines.push(`          `);
      lines.push(`          console.log('🔴 Red dots: AI selections');`);
      lines.push(`          console.log('🟢 Green dots: Actual Imposter clicks');`);
      lines.push(`          console.log('📸 Final debug image saved: ' + finalDebugImagePath);`);
      lines.push(`        } catch (finalDebugError) {`);
      lines.push(`          console.warn('Could not create final debug image:', finalDebugError.message);`);
      lines.push(`        }`);
      lines.push(`        `);
      lines.push(`        // Wait a bit longer before clicking verify to ensure all clicks registered`);
      lines.push(`        await new Promise(r => setTimeout(r, 2000));`);
      lines.push(`        `);
      lines.push(`        // Try to find and click verify button`);
      lines.push(`        console.log('Looking for verify button...');`);
      lines.push(`        try {`);
      lines.push(`          // Method 1: Try to find button by ID`);
      lines.push(`          const verifyBtn = await bframe.$('#recaptcha-verify-button');`);
      lines.push(`          if (verifyBtn) {`);
      lines.push(`            const btnBox = await verifyBtn.boundingBox();`);
      lines.push(`            if (btnBox) {`);
      lines.push(`              console.log('Found verify button, clicking...');`);
      lines.push(`              await humanClick(page, btnBox.x + btnBox.width/2, btnBox.y + btnBox.height/2);`);
      lines.push(`            }`);
      lines.push(`          } else {`);
      lines.push(`            // Method 2: Try to find by class or text`);
      lines.push(`            const btnByClass = await bframe.$('.rc-button-default');`);
      lines.push(`            if (btnByClass) {`);
      lines.push(`              await bframe.click('.rc-button-default');`);
      lines.push(`            } else {`);
      lines.push(`              // Method 3: Click in the known button area`);
      lines.push(`              console.log('Using fallback position for verify button');`);
      lines.push(`              const verifyX = challengeBox.x + challengeBox.width - 90;`);
      lines.push(`              const verifyY = challengeBox.y + challengeBox.height + 20;`);
      lines.push(`              await humanClick(page, verifyX, verifyY);`);
      lines.push(`            }`);
      lines.push(`          }`);
      lines.push(`        } catch (e) {`);
      lines.push(`          console.log('Error clicking verify:', e.message);`);
      lines.push(`        }`);
      lines.push(`        `);
      lines.push(`        console.log('CAPTCHA solution submitted');`);
      lines.push(`        await new Promise(r => setTimeout(r, 3000));`);
      lines.push(`      } else {`);
      lines.push(`        console.log('AI could not solve, please solve manually');`);
      lines.push(`      }`);
      lines.push(`      }`);
      lines.push(`    }`);
      lines.push(`  } else {`);
      lines.push(`    console.log('No challenge appeared, CAPTCHA passed!');`);
      lines.push(`  }`);
      lines.push(`  `);
      lines.push(`  // Step 3: Check for hCaptcha`);
      lines.push(`  const hcaptchaCheckbox = await page.$('iframe[src*="hcaptcha.com/captcha"]');`);
      lines.push(`  if (hcaptchaCheckbox) {`);
      lines.push(`    console.log('hCaptcha detected, using human-like clicking...');`);
      lines.push(`    const hbox = await hcaptchaCheckbox.boundingBox();`);
      lines.push(`    if (hbox) {`);
      lines.push(`      const hClickX = hbox.x + 50 + (Math.random() * 10 - 5);`);
      lines.push(`      const hClickY = hbox.y + hbox.height / 2 + (Math.random() * 10 - 5);`);
      lines.push(`      await humanClick(page, hClickX, hClickY);`);
      lines.push(`      console.log('Clicked hCaptcha checkbox');`);
      lines.push(`    }`);
      lines.push(`  }`);
      lines.push(`  `);
      lines.push(`} catch (error) {`);
      lines.push(`  console.error('CAPTCHA solver error:', error);`);
      lines.push(`}`);
      lines.push(``);
      lines.push(`await new Promise(r => setTimeout(r, 1000));`);
    }
  }

  // Auto-close any open loops
  while (openLoops > 0) {
    lines.push(`}`);
    openLoops--;
  }

  // Auto-close any open if/else blocks
  while (openIfs > 0) {
    lines.push(`}`);
    openIfs--;
  }

  // Xử lý code generation dựa trên checkbox Default
  let full = "";
  const body = lines.join("\n");

  if (isDefault) {
    // Default mode: chỉ xuất imports và các lệnh trực tiếp
    const helperImport = `import puppeteer from "puppeteer";\nimport * as act from "#act";\n`;
    full = helperImport + body;
    if (!full.endsWith("\n")) full += "\n";
  } else {
    // Full mode: có wrapper function với browser launch
    const header =
`import puppeteer from "puppeteer";
import * as act from "#act";

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
`;
    const footer = `
  await browser.close();
})();
`;
    full = header + "  " + body.split("\n").join("\n  ") + footer;
    if (!full.endsWith("\n")) full += "\n";
  }

  return full;
};

  // Generate code and copy to clipboard
  const generateCode = async () => {
    const full = await generateCodeInternal();
    setPreview(full);
    await copyToClipboard(full);
  };


  return (
    <div className="flex h-full min-h-[520px]">
      {/* Enhanced Palette */}
      <aside className="w-80 border-r bg-gradient-to-b from-white to-gray-50 shadow-sm overflow-y-auto max-h-full">
        <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Code className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800">Automation Nodes</h2>
        </div>
        
        <div className="space-y-3">
          {PALETTE.map((p) => (
            <button
              key={p.kind}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("application/node-kind", p.kind)
              }
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-left 
                         hover:border-blue-400 hover:shadow-md hover:scale-[1.02] 
                         transition-all duration-200 cursor-move group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                  {p.icon}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{p.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{p.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              Templates
            </h3>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTemplateDialog(true)}
                className="h-7 w-7 p-0"
                title="Save current flow as template"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Template save dialog */}
          {showTemplateDialog && (
            <div className="mb-3 p-3 border rounded-lg bg-gray-50">
              <input
                className="w-full mb-2 border-2 border-gray-200 rounded px-2 py-1 text-sm"
                placeholder="Template name..."
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveAsTemplate()}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveAsTemplate} className="flex-1">
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setShowTemplateDialog(false);
                    setTemplateNameInput("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {/* Custom Templates (saved in localStorage) */}
            {Object.keys(templates).filter(t => !t.startsWith("Basic:") && !t.startsWith("X (Twitter)")).length > 0 && (
              <>
                <div className="text-xs text-gray-500 font-medium mb-1">My Templates</div>
                {Object.keys(templates).filter(t => !t.startsWith("Basic:") && !t.startsWith("X (Twitter)")).map((t) => (
                  <div key={t} className="flex items-center gap-1 group hover:bg-gray-50 rounded px-1">
                    <Button
                      className="flex-1 justify-start text-xs"
                      variant="outline"
                      size="sm"
                      onClick={() => loadTemplate(t)}
                    >
                      <Play className="w-3 h-3 mr-2" />
                      {t}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete template "${t}"?`)) {
                          deleteTemplate(t);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      title="Delete template"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </>
            )}
            
            {/* Default Templates */}
            <div className="text-xs text-gray-500 font-medium mt-2 mb-1">Default Templates</div>
            {Object.keys(templates).filter(t => t.startsWith("Basic:") || t.startsWith("X (Twitter)")).map((t) => (
              <div key={t} className="flex items-center gap-1">
                <Button
                  className="flex-1 justify-start text-xs"
                  variant="outline"
                  size="sm"
                  onClick={() => loadTemplate(t)}
                >
                  <Play className="w-3 h-3 mr-2" />
                  {t.replace("Basic: ", "").replace("X (Twitter) ", "")}
                </Button>
              </div>
            ))}
            
            {Object.keys(templates).filter(t => !t.startsWith("Basic:") && !t.startsWith("X (Twitter)")).length === 0 && (
              <div className="text-xs text-gray-400 italic mt-2 p-2 bg-gray-50 rounded">
                No custom templates yet. Click + to save current flow as template.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
          {/* Template editing UI - Shows when editing a custom template */}
          {currentTemplateName && !currentTemplateName.startsWith("Basic:") && !currentTemplateName.startsWith("X (Twitter)") && (
            <div className="bg-blue-50 p-3 rounded-lg space-y-2">
              <div className="text-xs text-blue-700 font-medium mb-2">Editing Template</div>
              {/* Input for renaming template - User can change template name here */}
              <input
                className="w-full border-2 border-blue-200 rounded px-2 py-1 text-sm font-medium
                         focus:border-blue-400 focus:outline-none transition-colors bg-white"
                value={currentTemplateName}
                onChange={(e) => setCurrentTemplateName(e.target.value)}
                placeholder="Template name..."
              />
              <div className="text-xs text-blue-600">
                Rename template by editing above, then click Save to apply changes
              </div>
            </div>
          )}
          
          {/* REMOVED: Flow Name input and New Flow button as requested by user */}
          {/* Users should manage flows through the template system */}
          
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={saveLocal} className="w-full" size="sm">
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button 
              onClick={() => {
                // Create file input dynamically
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.js';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const event = e as React.ChangeEvent<HTMLInputElement>;
                    importTemplateFile(event);
                  } else {
                    // If no file selected, try loading from localStorage
                    loadLocal();
                  }
                };
                input.click();
              }}
              variant="outline" 
              className="w-full" 
              size="sm"
            >
              <Download className="w-4 h-4 mr-1" />
              Load
            </Button>
          </div>
          
          <Button onClick={exportJS} variant="secondary" className="w-full" size="sm">
            <Code className="w-4 h-4 mr-2" />
            Export JS
          </Button>

          {/* Enhanced Controls */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={handleUndo}
              disabled={!canUndo}
              variant="outline"
              size="sm"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleRedo}
              disabled={!canRedo}
              variant="outline"
              size="sm"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleDuplicateNode}
              disabled={!selectedId}
              variant="outline"
              size="sm"
              title="Duplicate Node (Ctrl+D)"
            >
              <CopyPlus className="w-4 h-4" />
            </Button>
          </div>

          {/* Validation Button */}
          <Button
            onClick={handleValidateFlow}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Validate Flow
          </Button>

          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-800">Validation Errors</span>
              </div>
              <ul className="space-y-1">
                {validationErrors.slice(0, 3).map((error, idx) => (
                  <li key={idx} className="text-xs text-red-700">
                    • {error}
                  </li>
                ))}
                {validationErrors.length > 3 && (
                  <li className="text-xs text-red-600 font-medium">
                    ... and {validationErrors.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Code Generation Section */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Code Generation</h3>
            
            <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-gray-700">Generate snippet only (no boilerplate)</span>
            </label>
            
            <Button 
              onClick={generateCode} 
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
            >
              <Copy className="w-4 h-4 mr-2" />
              Generate & Copy Code
            </Button>
          </div>

          {/* Enhanced Code Preview */}
          {preview && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">Generated Code</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => copyToClipboard(preview)}
                  className="h-6 px-2"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="relative">
                <textarea
                  readOnly
                  className="w-full h-48 border-2 border-gray-200 rounded-lg p-3 
                           text-xs font-mono bg-gray-900 text-green-400
                           resize-none focus:outline-none"
                  value={preview}
                />
                <div className="absolute top-2 right-2 text-xs text-gray-500">JavaScript</div>
              </div>
            </div>
          )}
        </div>
        </div>
      </aside>

      {/* Canvas + Inspector */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute inset-0"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              setContextMenu({
                node: node as Node<NodeData>,
                position: { x: event.clientX, y: event.clientY }
              });
            }}
            connectionLineStyle={{ stroke: '#60a5fa', strokeWidth: 2 }}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            fitView
          >
            <MiniMap />
            <Controls />
            <Background gap={16} />
          </ReactFlow>
        </div>

        {/* Node Context Menu */}
        <NodeContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onClose={() => setContextMenu({ node: null, position: null })}
          onDuplicate={(node) => {
            const newNode = duplicateNode(node);
            setNodes(nds => [...nds, newNode]);
            setSelectedId(newNode.id);
            saveToHistory();
            toast({ title: "Node Duplicated", description: `Created copy of "${node.data.label}"` });
          }}
          onDelete={(nodeId) => {
            setNodes(nds => nds.filter(n => n.id !== nodeId));
            setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
            if (selectedId === nodeId) setSelectedId(null);
            saveToHistory();
            toast({ title: "Node Deleted", description: "Node removed from flow" });
          }}
          onEdit={(nodeId) => {
            setSelectedId(nodeId);
            // Focus on the inspector panel
            const inspector = document.querySelector('.inspector-panel');
            if (inspector) {
              inspector.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          onInfo={(node) => {
            toast({
              title: node.data.label,
              description: `Type: ${node.data.kind}\nID: ${node.id}\nPosition: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`
            });
          }}
        />

        {/* Enhanced Inspector */}
        <aside className="inspector-panel absolute top-0 right-0 h-full w-[380px] border-l bg-gradient-to-b from-white to-gray-50 shadow-lg overflow-auto">
          <div className="sticky top-0 bg-white border-b p-4 z-10">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-blue-600" />
              Node Properties
            </h2>
          </div>

          <div className="p-4">
            {!selectedNode ? (
              <div className="text-center py-12">
                <MousePointer className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">Select a node to configure</p>
                <p className="text-xs text-gray-400 mt-2">Click on any node in the canvas</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Node Label
                  </label>
                  <input
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 
                             focus:border-blue-400 focus:outline-none transition-colors"
                    value={(selectedNode.data as NodeData).label || ""}
                    onChange={(e) => patchSelectedNode({ label: e.target.value })}
                    placeholder="Enter a descriptive label..."
                  />
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    {(selectedNode.data as NodeData).kind === "GoTo" && <Globe className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Navigation" && <Navigation className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Type" && <Type className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Click" && <MousePointer className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Select" && <List className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "SwitchFrame" && <Frame className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "SwitchTab" && <Layers className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "ScrollTo" && <ArrowDown className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Wait" && <Clock className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Sleep" && <Moon className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "If" && <Navigation className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Loop" && <Repeat className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "EndLoop" && <Repeat className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Extract" && <Database className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "DataProcess" && <Database className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "Log" && <FileText className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "HttpRequest" && <Send className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "AI" && <Bot className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind === "CaptchaSolver" && <Shield className="w-4 h-4" />}
                    {(selectedNode.data as NodeData).kind} Configuration
                  </h3>

                  {/* GoTo URL */}
                  {(selectedNode.data as NodeData).kind === "GoTo" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Target URL
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="https://example.com"
                          value={(selectedNode.data as NodeData).config?.url || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ url: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter the full URL including https://
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Type */}
                  {(selectedNode.data as NodeData).kind === "Type" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Element XPath
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                          placeholder="//input[@name='q']"
                          value={(selectedNode.data as NodeData).config?.xpath || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ xpath: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          XPath selector for the input element
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Input Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={((selectedNode.data as NodeData).config as any)?.inputType || "text"}
                          onChange={(e) =>
                            patchSelectedConfig({ inputType: e.target.value })
                          }
                        >
                          <option value="text">Fixed Text</option>
                          <option value="variable">From Variable</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Choose to type fixed text or use a variable
                        </p>
                      </div>

                      {((selectedNode.data as NodeData).config as any)?.inputType === "variable" ? (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Variable Name
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            placeholder="extractedData"
                            value={(selectedNode.data as NodeData).config?.variableName || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ variableName: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Name of the variable containing the text to type
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Text to Type
                          </label>
                          <textarea
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors resize-none"
                            rows={3}
                            placeholder="Enter the text to type..."
                            value={(selectedNode.data as NodeData).config?.text || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ text: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            The text that will be typed into the element
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Click */}
                  {(selectedNode.data as NodeData).kind === "Click" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Element XPath
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                          placeholder="//button[@id='submit']"
                          value={(selectedNode.data as NodeData).config?.xpath || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ xpath: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          XPath selector for the element to click
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Element Index
                          <span className="text-xs text-gray-400 ml-2">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="0"
                          min="0"
                          value={
                            (selectedNode.data as NodeData).config?.index ?? ""
                          }
                          onChange={(e) => {
                            const v =
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value);
                            patchSelectedConfig({ index: v });
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          If multiple elements match, specify which one (0 = first)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Navigation */}
                  {(selectedNode.data as NodeData).kind === "Navigation" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Navigation Action
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.action || "forward"}
                          onChange={(e) =>
                            patchSelectedConfig({ action: e.target.value })
                          }
                        >
                          <option value="forward">Forward</option>
                          <option value="back">Back</option>
                          <option value="refresh">Refresh</option>
                          <option value="newTab">New Tab</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* MultiType */}
                  {(selectedNode.data as NodeData).kind === "MultiType" && (
                    <div className="space-y-3">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-blue-800 mb-1">
                          💡 Type into multiple fields at once
                        </p>
                        <p className="text-xs text-blue-700">
                          Perfect for login forms, multi-field forms, etc.
                        </p>
                      </div>

                      {(((selectedNode.data as NodeData).config as any)?.fields || []).map((field: any, index: number) => (
                        <div key={index} className="border-2 border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-medium text-gray-700">Field {index + 1}</h4>
                            {index > 1 && (
                              <button
                                onClick={() => {
                                  const fields = [...(((selectedNode.data as NodeData).config as any)?.fields || [])];
                                  fields.splice(index, 1);
                                  patchSelectedConfig({ fields });
                                }}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                              XPath
                            </label>
                            <input
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm
                                       focus:border-blue-400 focus:outline-none font-mono"
                              placeholder={index === 0 ? "//input[@name='username']" : "//input[@name='password']"}
                              value={field.xpath || ""}
                              onChange={(e) => {
                                const fields = [...(((selectedNode.data as NodeData).config as any)?.fields || [])];
                                fields[index] = { ...fields[index], xpath: e.target.value };
                                patchSelectedConfig({ fields });
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                              Input Type
                            </label>
                            <select
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm
                                       focus:border-blue-400 focus:outline-none"
                              value={field.inputType || "text"}
                              onChange={(e) => {
                                const fields = [...(((selectedNode.data as NodeData).config as any)?.fields || [])];
                                fields[index] = { ...fields[index], inputType: e.target.value };
                                patchSelectedConfig({ fields });
                              }}
                            >
                              <option value="text">Fixed Text</option>
                              <option value="variable">From Variable</option>
                            </select>
                          </div>

                          {field.inputType === "variable" ? (
                            <div>
                              <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Variable Name
                              </label>
                              <input
                                className="w-full border border-gray-200 rounded px-2 py-1 text-sm
                                         focus:border-blue-400 focus:outline-none"
                                placeholder="username"
                                value={field.variableName || ""}
                                onChange={(e) => {
                                  const fields = [...(((selectedNode.data as NodeData).config as any)?.fields || [])];
                                  fields[index] = { ...fields[index], variableName: e.target.value };
                                  patchSelectedConfig({ fields });
                                }}
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Text to Type
                              </label>
                              <input
                                className="w-full border border-gray-200 rounded px-2 py-1 text-sm
                                         focus:border-blue-400 focus:outline-none"
                                placeholder={index === 0 ? "Enter username..." : "Enter password..."}
                                value={field.text || ""}
                                onChange={(e) => {
                                  const fields = [...(((selectedNode.data as NodeData).config as any)?.fields || [])];
                                  fields[index] = { ...fields[index], text: e.target.value };
                                  patchSelectedConfig({ fields });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}

                      <button
                        onClick={() => {
                          const fields = [...(((selectedNode.data as NodeData).config as any)?.fields || [])];
                          fields.push({ xpath: "", text: "", inputType: "text", variableName: "" });
                          patchSelectedConfig({ fields });
                        }}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg
                                 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600
                                 transition-colors"
                      >
                        + Add Field
                      </button>
                    </div>
                  )}

                  {/* Select */}
                  {(selectedNode.data as NodeData).kind === "Select" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Dropdown XPath
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                          placeholder="//select[@name='country']"
                          value={(selectedNode.data as NodeData).config?.xpath || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ xpath: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Select By
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.selectBy || "text"}
                          onChange={(e) =>
                            patchSelectedConfig({ selectBy: e.target.value })
                          }
                        >
                          <option value="text">Text</option>
                          <option value="value">Value</option>
                          <option value="index">Index</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          {(selectedNode.data as NodeData).config?.selectBy === "index" ? "Index" : "Value"}
                        </label>
                        {(selectedNode.data as NodeData).config?.selectBy === "index" ? (
                          <input
                            type="number"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            placeholder="0"
                            min="0"
                            value={(selectedNode.data as NodeData).config?.selectIndex ?? ""}
                            onChange={(e) =>
                              patchSelectedConfig({ selectIndex: Number(e.target.value) })
                            }
                          />
                        ) : (
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            placeholder="Option text or value"
                            value={(selectedNode.data as NodeData).config?.selectValue || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ selectValue: e.target.value })
                            }
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* SwitchFrame */}
                  {(selectedNode.data as NodeData).kind === "SwitchFrame" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Frame Action
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.frameType || "enter"}
                          onChange={(e) =>
                            patchSelectedConfig({ frameType: e.target.value })
                          }
                        >
                          <option value="enter">Enter Frame</option>
                          <option value="exit">Exit to Main</option>
                          <option value="parent">Exit to Parent</option>
                        </select>
                      </div>
                      {(selectedNode.data as NodeData).config?.frameType === "enter" && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Frame Selector
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                            placeholder="iframe[name='content'] or 0"
                            value={(selectedNode.data as NodeData).config?.frameSelector || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ frameSelector: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            CSS selector or frame index
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SwitchTab */}
                  {(selectedNode.data as NodeData).kind === "SwitchTab" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Tab Index
                        </label>
                        <input
                          type="number"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="0"
                          min="0"
                          value={(selectedNode.data as NodeData).config?.tabIndex ?? 0}
                          onChange={(e) =>
                            patchSelectedConfig({ tabIndex: Number(e.target.value) })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          0 = first tab, 1 = second tab, etc.
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Tab URL
                          <span className="text-xs text-gray-400 ml-2">(Optional)</span>
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="https://example.com"
                          value={(selectedNode.data as NodeData).config?.tabUrl || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ tabUrl: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Switch to tab with this URL
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ScrollTo */}
                  {(selectedNode.data as NodeData).kind === "ScrollTo" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Scroll Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.scrollType || "element"}
                          onChange={(e) =>
                            patchSelectedConfig({ scrollType: e.target.value })
                          }
                        >
                          <option value="element">To Element</option>
                          <option value="position">To Position</option>
                          <option value="bottom">To Bottom</option>
                          <option value="top">To Top</option>
                        </select>
                      </div>
                      {(selectedNode.data as NodeData).config?.scrollType === "element" && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Element XPath
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                            placeholder="//div[@id='footer']"
                            value={(selectedNode.data as NodeData).config?.xpath || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ xpath: e.target.value })
                            }
                          />
                        </div>
                      )}
                      {(selectedNode.data as NodeData).config?.scrollType === "position" && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                              X Position
                            </label>
                            <input
                              type="number"
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                       focus:border-blue-400 focus:outline-none transition-colors"
                              placeholder="0"
                              value={(selectedNode.data as NodeData).config?.scrollX ?? 0}
                              onChange={(e) =>
                                patchSelectedConfig({ scrollX: Number(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                              Y Position
                            </label>
                            <input
                              type="number"
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                       focus:border-blue-400 focus:outline-none transition-colors"
                              placeholder="500"
                              value={(selectedNode.data as NodeData).config?.scrollY ?? 0}
                              onChange={(e) =>
                                patchSelectedConfig({ scrollY: Number(e.target.value) })
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Wait */}
                  {(selectedNode.data as NodeData).kind === "Wait" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Wait Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.waitType || "element"}
                          onChange={(e) =>
                            patchSelectedConfig({ waitType: e.target.value })
                          }
                        >
                          <option value="element">For Element</option>
                          <option value="time">For Time</option>
                        </select>
                      </div>
                      {(selectedNode.data as NodeData).config?.waitType === "element" && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Element XPath
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                            placeholder="//div[@class='loaded']"
                            value={(selectedNode.data as NodeData).config?.xpath || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ xpath: e.target.value })
                            }
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="5000"
                          min="0"
                          value={(selectedNode.data as NodeData).config?.timeout ?? 5000}
                          onChange={(e) =>
                            patchSelectedConfig({ timeout: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* If */}
                  {(selectedNode.data as NodeData).kind === "If" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Condition Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.condition || "element_exists"}
                          onChange={(e) =>
                            patchSelectedConfig({ condition: e.target.value })
                          }
                        >
                          <option value="element_exists">Element Exists</option>
                          <option value="element_not_exists">Element Not Exists</option>
                          <option value="text_contains">Text Contains</option>
                          <option value="page_title_is">Page Title Is</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          {(selectedNode.data as NodeData).config?.condition?.includes("element") ? "Element XPath" : "Value"}
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                          placeholder={(selectedNode.data as NodeData).config?.condition?.includes("element") ? "//div[@id='result']" : "Expected value"}
                          value={(selectedNode.data as NodeData).config?.xpath || (selectedNode.data as NodeData).config?.value || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ 
                              [(selectedNode.data as NodeData).config?.condition?.includes("element") ? "xpath" : "value"]: e.target.value 
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Loop */}
                  {(selectedNode.data as NodeData).kind === "Loop" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Number of Iterations
                        </label>
                        <input
                          type="number"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="5"
                          min="1"
                          max="1000"
                          value={(selectedNode.data as NodeData).config?.loopCount ?? 5}
                          onChange={(e) =>
                            patchSelectedConfig({ loopCount: Number(e.target.value) })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The actions connected after this node will be repeated this many times
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Index Variable Name
                          <span className="text-xs text-gray-400 ml-2">(Optional)</span>
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="i"
                          value={(selectedNode.data as NodeData).config?.currentIndexName || "i"}
                          onChange={(e) =>
                            patchSelectedConfig({ currentIndexName: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Variable name to access the current iteration index (starts from 0)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sleep */}
                  {(selectedNode.data as NodeData).kind === "Sleep" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Sleep Duration (ms)
                        </label>
                        <input
                          type="number"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="3000"
                          min="100"
                          max="60000"
                          value={(selectedNode.data as NodeData).config?.timeout ?? 3000}
                          onChange={(e) =>
                            patchSelectedConfig({ timeout: Number(e.target.value) })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Pause execution for this many milliseconds (1000ms = 1 second)
                        </p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-purple-800 mb-1">💡 Perfect for Testing</p>
                        <p className="text-xs text-purple-700">
                          Use Sleep to pause and manually inspect browser results. Great for debugging automation flows!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* EndLoop */}
                  {(selectedNode.data as NodeData).kind === "EndLoop" && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                        <p className="font-medium mb-1">Loop End Node</p>
                        <p className="text-xs">This node marks the end of a loop block. Connect it after all the actions you want to repeat.</p>
                        <p className="text-xs mt-2">Usage: Loop Start → Actions → Loop End</p>
                      </div>
                    </div>
                  )}

                  {/* Extract */}
                  {(selectedNode.data as NodeData).kind === "Extract" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Element XPath
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                          placeholder="//h1[@class='title']"
                          value={(selectedNode.data as NodeData).config?.xpath || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ xpath: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          XPath to extract data from
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Extract Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.extractType || "text"}
                          onChange={(e) =>
                            patchSelectedConfig({ extractType: e.target.value })
                          }
                        >
                          <option value="text">Text Content</option>
                          <option value="attribute">Attribute</option>
                        </select>
                      </div>
                      {(selectedNode.data as NodeData).config?.extractType === "attribute" && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Attribute Name
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            placeholder="href"
                            value={(selectedNode.data as NodeData).config?.attribute || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ attribute: e.target.value })
                            }
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Variable Name
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="extractedData"
                          value={(selectedNode.data as NodeData).config?.variableName || "extractedData"}
                          onChange={(e) =>
                            patchSelectedConfig({ variableName: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Store extracted value in this variable
                        </p>
                      </div>
                    </div>
                  )}

                  {/* DataProcess */}
                  {(selectedNode.data as NodeData).kind === "DataProcess" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Process Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.processType || "assignVariable"}
                          onChange={(e) =>
                            patchSelectedConfig({ processType: e.target.value })
                          }
                        >
                          <option value="assignVariable">Assign Variable</option>
                          <option value="processText">Process Text</option>
                          <option value="concat">Concatenate</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Source Variable
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="extractedData"
                          value={(selectedNode.data as NodeData).config?.sourceVariable || "extractedData"}
                          onChange={(e) =>
                            patchSelectedConfig({ sourceVariable: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Variable to process (from Extract or other nodes)
                        </p>
                      </div>

                      {(selectedNode.data as NodeData).config?.processType === "processText" && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Text Operation
                          </label>
                          <select
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            value={(selectedNode.data as NodeData).config?.operation || "trim"}
                            onChange={(e) =>
                              patchSelectedConfig({ operation: e.target.value })
                            }
                          >
                            <option value="trim">Trim Whitespace</option>
                            <option value="uppercase">To Uppercase</option>
                            <option value="lowercase">To Lowercase</option>
                          </select>
                        </div>
                      )}

                      {(selectedNode.data as NodeData).config?.processType === "concat" && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Additional Text
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            placeholder="Text to append"
                            value={(selectedNode.data as NodeData).config?.additionalText || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ additionalText: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Text to concatenate with source variable
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Target Variable Name
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="myVariable"
                          value={(selectedNode.data as NodeData).config?.targetVariable || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ targetVariable: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Log */}
                  {(selectedNode.data as NodeData).kind === "Log" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Log Level
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.logLevel || "info"}
                          onChange={(e) =>
                            patchSelectedConfig({ logLevel: e.target.value })
                          }
                        >
                          <option value="info">Info</option>
                          <option value="warn">Warning</option>
                          <option value="error">Error</option>
                          <option value="debug">Debug</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Message Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.messageType || "text"}
                          onChange={(e) =>
                            patchSelectedConfig({ messageType: e.target.value })
                          }
                        >
                          <option value="text">Static Text</option>
                          <option value="variable">Variable</option>
                          <option value="template">Template</option>
                        </select>
                      </div>

                      {(selectedNode.data as NodeData).config?.messageType === "variable" ? (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Variable Name
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            placeholder="extractedData, processedData, or httpResponse"
                            value={(selectedNode.data as NodeData).config?.variableName || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ variableName: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Name of variable to log (from Extract, Process, or HTTP nodes)
                          </p>
                        </div>
                      ) : (selectedNode.data as NodeData).config?.messageType === "template" ? (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Template Message
                          </label>
                          <textarea
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors resize-none font-mono text-sm"
                            rows={3}
                            placeholder="Extracted: ${extractedData}, Response: ${httpResponse}"
                            value={(selectedNode.data as NodeData).config?.message || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ message: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Use ${`{variableName}`} to insert variables in your message
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Message
                          </label>
                          <textarea
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors resize-none"
                            rows={3}
                            placeholder="Log message..."
                            value={(selectedNode.data as NodeData).config?.message || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ message: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* HTTP Request */}
                  {(selectedNode.data as NodeData).kind === "HttpRequest" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Method
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.method || "POST"}
                          onChange={(e) =>
                            patchSelectedConfig({ method: e.target.value })
                          }
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                          <option value="PATCH">PATCH</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Endpoint URL
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors text-sm"
                          placeholder="https://api.example.com/endpoint"
                          value={(selectedNode.data as NodeData).config?.endpoint || ""}
                          onChange={(e) =>
                            patchSelectedConfig({ endpoint: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Full URL including https://
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Authentication Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.authType || "none"}
                          onChange={(e) =>
                            patchSelectedConfig({ authType: e.target.value })
                          }
                        >
                          <option value="none">None</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="apiKey">API Key</option>
                        </select>
                      </div>

                      {(selectedNode.data as NodeData).config?.authType === "bearer" && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Bearer Token
                          </label>
                          <input
                            type="password"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                            placeholder="your-bearer-token"
                            value={(selectedNode.data as NodeData).config?.authToken || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ authToken: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Enter token only (without "Bearer" prefix)
                          </p>
                        </div>
                      )}

                      {(selectedNode.data as NodeData).config?.authType === "apiKey" && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                              API Key Header Name
                            </label>
                            <input
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                       focus:border-blue-400 focus:outline-none transition-colors"
                              placeholder="X-API-Key"
                              value={(selectedNode.data as NodeData).config?.apiKeyHeader || ""}
                              onChange={(e) =>
                                patchSelectedConfig({ apiKeyHeader: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">
                              API Key Value
                            </label>
                            <input
                              type="password"
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                       focus:border-blue-400 focus:outline-none transition-colors font-mono text-sm"
                              placeholder="your-api-key"
                              value={(selectedNode.data as NodeData).config?.apiKeyValue || ""}
                              onChange={(e) =>
                                patchSelectedConfig({ apiKeyValue: e.target.value })
                              }
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Request Body (JSON)
                        </label>
                        <textarea
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors resize-none font-mono text-xs"
                          rows={8}
                          placeholder='{"key": "value", "text": "${extractedData}"}'
                          value={typeof (selectedNode.data as NodeData).config?.body === 'object'
                            ? JSON.stringify((selectedNode.data as NodeData).config?.body, null, 2)
                            : (selectedNode.data as NodeData).config?.body || ""}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              patchSelectedConfig({ body: parsed });
                            } catch {
                              patchSelectedConfig({ body: e.target.value });
                            }
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Use ${`{variableName}`} to inject variables from Extract/Process nodes
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Response Variable Name
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="apiResponse"
                          value={(selectedNode.data as NodeData).config?.responseVariable || "apiResponse"}
                          onChange={(e) =>
                            patchSelectedConfig({ responseVariable: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Variable to store the response for use in other nodes
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="30000"
                          min="1000"
                          value={(selectedNode.data as NodeData).config?.timeout || 30000}
                          onChange={(e) =>
                            patchSelectedConfig({ timeout: Number(e.target.value) })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Request timeout in milliseconds
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Captcha Solver */}
                  {(selectedNode.data as NodeData).kind === "CaptchaSolver" && (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shield className="w-5 h-5 text-purple-600" />
                          <h4 className="text-sm font-bold text-purple-900">🤖 AI Auto-Solver</h4>
                        </div>
                        <p className="text-xs text-purple-700 mb-2">
                          Just place this node where you expect a captcha. AI will handle everything!
                        </p>
                        <p className="text-xs text-purple-600 font-semibold">
                          ⏱️ Wait time: 5 seconds per attempt
                        </p>
                      </div>

                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-2">⚡ How it works:</p>
                        <div className="text-xs text-blue-700 space-y-1">
                          <p>1. Detects if captcha exists on page</p>
                          <p>2. Identifies captcha type automatically</p>
                          <p>3. Takes screenshot & sends to Gemma3 AI</p>
                          <p>4. Clicks answers with human behavior</p>
                          <p>5. Auto-completes and continues flow</p>
                        </div>
                      </div>

                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-green-800 mb-2">✨ Supported Types:</p>
                        <div className="text-xs text-green-700 grid grid-cols-2 gap-1">
                          <p>• reCAPTCHA v2/v3</p>
                          <p>• hCaptcha</p>
                          <p>• Cloudflare</p>
                          <p>• FunCaptcha</p>
                          <p>• GeeTest</p>
                          <p>• Image Captcha</p>
                        </div>
                      </div>

                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-yellow-800">
                          💡 Tip: Place after navigation or form fill nodes
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Assistant */}
                  {(selectedNode.data as NodeData).kind === "AI" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          AI Role
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.aiRole || "assistant"}
                          onChange={(e) =>
                            patchSelectedConfig({ aiRole: e.target.value })
                          }
                        >
                          <option value="assistant">🤖 Helpful Assistant</option>
                          <option value="social_commenter">💬 Social Media Commenter</option>
                          <option value="content_creator">✍️ Content Creator</option>
                          <option value="translator">🌍 Translator</option>
                          <option value="summarizer">📋 Summarizer</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {(selectedNode.data as NodeData).config?.aiRole === "assistant" && "General purpose AI assistant for any task"}
                          {(selectedNode.data as NodeData).config?.aiRole === "social_commenter" && "Creates engaging comments for social media posts"}
                          {(selectedNode.data as NodeData).config?.aiRole === "content_creator" && "Generates creative content and ideas"}
                          {(selectedNode.data as NodeData).config?.aiRole === "translator" && "Translates text between languages"}
                          {(selectedNode.data as NodeData).config?.aiRole === "summarizer" && "Creates concise summaries of long texts"}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Input Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          value={(selectedNode.data as NodeData).config?.aiInputType || "variable"}
                          onChange={(e) =>
                            patchSelectedConfig({ aiInputType: e.target.value })
                          }
                        >
                          <option value="variable">Use Variable from Previous Node</option>
                          <option value="custom">Custom Input</option>
                        </select>
                      </div>

                      {(selectedNode.data as NodeData).config?.aiInputType === "variable" ? (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Input Variable Name
                          </label>
                          <input
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors"
                            placeholder="extractedData"
                            value={(selectedNode.data as NodeData).config?.aiInputVariable || "extractedData"}
                            onChange={(e) =>
                              patchSelectedConfig({ aiInputVariable: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Variable from Extract/DataProcess nodes to send to AI
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">
                            Custom Input
                          </label>
                          <textarea
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                     focus:border-blue-400 focus:outline-none transition-colors resize-none"
                            rows={4}
                            placeholder={(() => {
                              const role = (selectedNode.data as NodeData).config?.aiRole;
                              if (role === "social_commenter") return "Write a thoughtful comment about...";
                              if (role === "content_creator") return "Create content about...";
                              if (role === "translator") return "Translate this to Vietnamese...";
                              if (role === "summarizer") return "Summarize this article...";
                              return "Your request here...";
                            })()}
                            value={(selectedNode.data as NodeData).config?.aiPrompt || ""}
                            onChange={(e) =>
                              patchSelectedConfig({ aiPrompt: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            You can also use ${`{variableName}`} to inject data
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">
                          Response Variable Name
                        </label>
                        <input
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2
                                   focus:border-blue-400 focus:outline-none transition-colors"
                          placeholder="aiResponse"
                          value={(selectedNode.data as NodeData).config?.aiResponseVariable || "aiResponse"}
                          onChange={(e) =>
                            patchSelectedConfig({ aiResponseVariable: e.target.value })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Variable to store AI response for use in other nodes (e.g., Type node)
                        </p>
                      </div>

                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-purple-800 mb-2">🌟 Roxane AI Configuration</p>
                        <div className="text-xs text-purple-700 space-y-1">
                          <p>• <strong>API Endpoint:</strong> llmapi.roxane.one</p>
                          <p>• <strong>Model:</strong> text-model (fast & efficient)</p>
                          <p>• <strong>API Key:</strong> Built-in (linh-1752464641053-phonefarm)</p>
                        </div>
                      </div>

                      {/* Example based on role */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-blue-800 mb-1">💡 Usage Example:</p>
                        <p className="text-xs text-blue-700">
                          {(selectedNode.data as NodeData).config?.aiRole === "assistant" && "Extract → AI (analyze) → Type"}
                          {(selectedNode.data as NodeData).config?.aiRole === "social_commenter" && "Extract (post content) → AI (generate comment) → Type (post comment)"}
                          {(selectedNode.data as NodeData).config?.aiRole === "content_creator" && "Extract (topic) → AI (create content) → Type (publish)"}
                          {(selectedNode.data as NodeData).config?.aiRole === "translator" && "Extract (text) → AI (translate) → Type (translated text)"}
                          {(selectedNode.data as NodeData).config?.aiRole === "summarizer" && "Extract (article) → AI (summarize) → Log (summary)"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function AutomationBuilder() {
  return (
    <ReactFlowProvider>
      <AutomationBuilderInner />
    </ReactFlowProvider>
  );
}
