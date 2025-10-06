import {
  Globe, Type, MousePointer, Navigation, Frame, Layers, ArrowDown, List, Repeat, Database, Clock, Bot, Shield,
  Hand, Move, ArrowUpDown, Timer, ZoomIn, Home, ChevronLeft, Smartphone, Camera, AppWindow
} from "lucide-react";
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
  // Mobile Automation Nodes
  {
    kind: "MobileTap",
    label: "Mobile Tap",
    icon: <Hand className="w-6 h-6" />,
    description: "Tap tại vị trí x,y trên màn hình",
    defaultConfig: { tapX: 360, tapY: 640, tapOffsetRadius: 3 }
  },
  {
    kind: "MobileSwipe",
    label: "Mobile Swipe",
    icon: <Move className="w-6 h-6" />,
    description: "Vuốt từ vị trí này đến vị trí khác",
    defaultConfig: { swipeX1: 360, swipeY1: 800, swipeX2: 360, swipeY2: 400, swipeDuration: 500, swipeCurve: true }
  },
  {
    kind: "MobileScroll",
    label: "Mobile Scroll",
    icon: <ArrowUpDown className="w-6 h-6" />,
    description: "Cuộn lên hoặc xuống màn hình",
    defaultConfig: { scrollDirection: "down", scrollDistance: 400, scrollRandomize: true }
  },
  {
    kind: "MobileLongPress",
    label: "Mobile Long Press",
    icon: <Timer className="w-6 h-6" />,
    description: "Nhấn giữ tại vị trí x,y",
    defaultConfig: { longPressX: 360, longPressY: 640, longPressDuration: 1000 }
  },
  {
    kind: "MobileDoubleTap",
    label: "Mobile Double Tap",
    icon: <MousePointer className="w-6 h-6" />,
    description: "Nhấn đôi tại vị trí x,y",
    defaultConfig: { doubleTapX: 360, doubleTapY: 640 }
  },
  {
    kind: "MobilePinch",
    label: "Mobile Pinch",
    icon: <ZoomIn className="w-6 h-6" />,
    description: "Phóng to hoặc thu nhỏ màn hình",
    defaultConfig: { pinchZoom: "in", pinchCenterX: 360, pinchCenterY: 640 }
  },
  {
    kind: "MobileTypeText",
    label: "Mobile Type Text",
    icon: <Type className="w-6 h-6" />,
    description: "Gõ text kiểu mobile với human-like typing",
    defaultConfig: { mobileText: "", mobileFieldX: 360, mobileFieldY: 640, mobileClearFirst: false }
  },
  {
    kind: "MobileBack",
    label: "Mobile Back",
    icon: <ChevronLeft className="w-6 h-6" />,
    description: "Nhấn nút Back trên Android",
    defaultConfig: {}
  },
  {
    kind: "MobileHome",
    label: "Mobile Home",
    icon: <Home className="w-6 h-6" />,
    description: "Nhấn nút Home để về màn hình chính",
    defaultConfig: {}
  },
  {
    kind: "MobileWait",
    label: "Mobile Wait",
    icon: <Clock className="w-6 h-6" />,
    description: "Đợi một khoảng thời gian",
    defaultConfig: { mobileWaitTimeout: 2000 }
  },
  {
    kind: "MobileScreenshot",
    label: "Mobile Screenshot",
    icon: <Camera className="w-6 h-6" />,
    description: "Chụp màn hình thiết bị",
    defaultConfig: { screenshotPath: "./screenshots" }
  },
  {
    kind: "MobileOpenApp",
    label: "Mobile Open App",
    icon: <AppWindow className="w-6 h-6" />,
    description: "Mở ứng dụng theo package name",
    defaultConfig: { appPackageName: "com.twitter.android", appName: "Twitter" }
  },
];
