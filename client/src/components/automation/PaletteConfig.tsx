import { Globe, Type, MousePointer, Navigation, Frame, Layers, ArrowDown, List, Repeat, Database, Clock, Bot, Shield } from "lucide-react";
import { NodeKind } from "./types";

export const PALETTE: Array<{
  kind: NodeKind;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultConfig?: any;
}> = [
  { 
    kind: "GoTo", 
    label: "Go To URL", 
    icon: <Globe className="w-6 h-6" />,
    description: "Navigate to a webpage",
    defaultConfig: { url: "" } 
  },
  {
    kind: "Click",
    label: "Click Element",
    icon: <MousePointer className="w-6 h-6" />,
    description: "Tap on a page element",
    defaultConfig: { xpath: "", index: 0 }
  },
  {
    kind: "Type",
    label: "Type Text",
    icon: <Type className="w-6 h-6" />,
    description: "Enter text into an input field",
    defaultConfig: { xpath: "", text: "" }
  },
  { 
    kind: "Wait", 
    label: "Wait", 
    icon: <Clock className="w-6 h-6" />,
    description: "Wait for element or time",
    defaultConfig: { timeout: 5000, waitType: "time" } 
  },
  { 
    kind: "ScrollTo", 
    label: "Scroll", 
    icon: <ArrowDown className="w-6 h-6" />,
    description: "Scroll to element or position",
    defaultConfig: { scrollType: "bottom" } 
  },
  { 
    kind: "Select", 
    label: "Select Option", 
    icon: <List className="w-6 h-6" />,
    description: "Select from dropdown",
    defaultConfig: { xpath: "", selectBy: "text" } 
  },
  { 
    kind: "Loop", 
    label: "Loop", 
    icon: <Repeat className="w-6 h-6" />,
    description: "Repeat actions multiple times",
    defaultConfig: { loopType: "for", start: 0, end: 10 } 
  },
  { 
    kind: "Extract", 
    label: "Extract Data", 
    icon: <Database className="w-6 h-6" />,
    description: "Extract text or attributes",
    defaultConfig: { extractType: "text", xpath: "" } 
  },
];
