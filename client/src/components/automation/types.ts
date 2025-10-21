// Node types
export type NodeKind = "GoTo" | "Type" | "Click" | "MultiType" | "If" | "Else" | "Wait" | "Sleep" | "For" | "While" | "Variable" | "Extract" | "Navigation" | "SwitchFrame" | "SwitchTab" | "ScrollTo" | "Select" | "Loop" | "EndLoop" | "DataProcess" | "Log" | "HttpRequest" | "AI" | "CaptchaSolver" |
  // Mobile automation nodes
  "MobileTap" | "MobileTapByText" | "MobileSwipe" | "MobileScroll" | "MobileLongPress" | "MobileDoubleTap" | "MobilePinch" | "MobileBack" | "MobileHome" | "MobileTypeText" | "MobileWait" | "MobileScreenshot" | "MobileOpenApp" |
  // Human behavior nodes (MobileImposter)
  "HumanTap" | "HumanQuickTap" | "HumanSlowTap" | "HumanType" | "HumanSwipe" | "HumanScroll" | "HumanThink" | "HumanRead" | "HumanDelay" | "HumanIdle" |
  // Cloudflare handling nodes
  "CloudflareDetect" | "CloudflareWait" | "CloudflareHandle" | "CloudflareSolve";

// Cấu hình của từng node
export type NodeData = {
  label: string;
  kind: NodeKind;
  config?: {
    // GoTo
    url?: string;
    // Type
    xpath?: string;
    text?: string;
    // Click
    index?: number;
    // MultiType
    inputs?: Array<{
      xpath: string;
      text: string;
      label: string;
    }>;
    // If/Else
    condition?: "element_exists" | "element_not_exists" | "text_contains" | "page_title_is";
    value?: string;
    // Wait/Sleep
    timeout?: number;
    waitType?: "element" | "time";
    // Loop
    loopType?: "for" | "while";
    start?: number;
    end?: number;
    step?: number;
    // Variable
    variableValue?: string;
    // Extract
    extractType?: "text" | "attribute";
    attribute?: string;
    variableName?: string;
    // Navigation
    action?: "forward" | "back" | "refresh" | "newTab";
    // SwitchFrame
    frameType?: "enter" | "exit" | "parent";
    frameSelector?: string;
    // SwitchTab
    tabIndex?: number;
    tabUrl?: string;
    // ScrollTo
    scrollType?: "element" | "position" | "bottom" | "top";
    scrollX?: number;
    scrollY?: number;
    // Select
    selectBy?: "value" | "text" | "index";
    selectValue?: string;
    selectIndex?: number;
    // Loop
    items?: string[];
    iteratorName?: string;
    loopCount?: number;
    currentIndexName?: string;
    // DataProcess
    processType?: "getText" | "getValue" | "setAttribute" | "assignVariable" | "processText" | "concat";
    targetVariable?: string;
    sourceVariable?: string;
    additionalText?: string;
    operation?: "trim" | "uppercase" | "lowercase";
    // Log
    logLevel?: "info" | "warn" | "error" | "debug";
    message?: string;
    messageType?: "text" | "variable" | "template";
    // HttpRequest
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    endpoint?: string;
    headers?: Record<string, string>;
    body?: any;
    bodyType?: "json" | "formData" | "raw";
    responseVariable?: string;
    authType?: "none" | "bearer" | "basic" | "apiKey";
    authToken?: string;
    apiKeyHeader?: string;
    apiKeyValue?: string;
    httpTimeout?: number;
    // AI
    aiRole?: "assistant" | "social_commenter" | "content_creator" | "translator" | "summarizer";
    aiPrompt?: string;
    aiInputType?: "variable" | "custom";
    aiInputVariable?: string;
    aiResponseVariable?: string;
    // CaptchaSolver
    captchaMode?: "auto_detect" | "manual_config";
    captchaProvider?: "auto" | "2captcha" | "anticaptcha" | "capsolver" | "manual";
    captchaType?: "auto" | "recaptcha_v2" | "recaptcha_v3" | "recaptcha_enterprise" | "hcaptcha" | "funcaptcha" | "geetest" | "cloudflare" | "datadome" | "image";
    captchaSiteKey?: string;
    captchaPageUrl?: string;
    captchaApiKey?: string;
    captchaResultVariable?: string;
    captchaTimeout?: number;
    captchaAutoDetect?: boolean;
    captchaAutoSolve?: boolean;
    // Mobile automation
    // MobileTap
    tapX?: number;
    tapY?: number;
    tapOffsetRadius?: number;
    tapBeforeDelay?: [number, number];
    tapAfterDelay?: [number, number];
    // MobileTapByText
    tapText?: string;
    tapTextPartialMatch?: boolean;
    tapTextCaseSensitive?: boolean;
    // MobileSwipe
    swipeX1?: number;
    swipeY1?: number;
    swipeX2?: number;
    swipeY2?: number;
    swipeDuration?: number;
    swipeCurve?: boolean;
    swipeSteps?: number;
    // MobileScroll
    scrollDirection?: "up" | "down";
    scrollDistance?: number;
    scrollDuration?: number;
    scrollRandomize?: boolean;
    // MobileLongPress
    longPressX?: number;
    longPressY?: number;
    longPressDuration?: number;
    // MobileDoubleTap
    doubleTapX?: number;
    doubleTapY?: number;
    // MobilePinch
    pinchZoom?: "in" | "out";
    pinchCenterX?: number;
    pinchCenterY?: number;
    // MobileTypeText
    mobileText?: string;
    mobileFieldX?: number;
    mobileFieldY?: number;
    mobileClearFirst?: boolean;
    mobileMinCharDelay?: number;
    mobileMaxCharDelay?: number;
    // MobileWait
    mobileWaitTimeout?: number;
    // MobileScreenshot
    screenshotPath?: string;
    // MobileOpenApp
    appPackageName?: string;
    appName?: string;
    // HumanTap (all variants: tap, quickTap, slowTap)
    humanTapX?: number;
    humanTapY?: number;
    humanTapVariant?: "tap" | "quickTap" | "slowTap";
    humanTapOffsetRange?: number;
    humanPreTapDelayMin?: number;
    humanPreTapDelayMax?: number;
    humanPostTapDelayMin?: number;
    humanPostTapDelayMax?: number;
    // HumanType
    humanTypeText?: string;
    humanCharDelayMin?: number;
    humanCharDelayMax?: number;
    humanPauseChance?: number;
    // HumanSwipe
    humanSwipeX1?: number;
    humanSwipeY1?: number;
    humanSwipeX2?: number;
    humanSwipeY2?: number;
    humanSwipeDuration?: number;
    humanSwipeCurve?: boolean;
    // HumanScroll
    humanScrollDistance?: number;
    humanScrollDuration?: number;
    // HumanThink
    humanThinkMin?: number;
    humanThinkMax?: number;
    // HumanRead
    humanReadTextLength?: number;
    humanReadWpm?: number;
    // HumanDelay
    humanDelayMin?: number;
    humanDelayMax?: number;
    // HumanIdle
    humanIdleDuration?: number;
    humanIdleMovements?: number;
    // CloudflareDetect
    cloudflareDetectLog?: boolean;
    // CloudflareWait
    cloudflareWaitTimeout?: number;
    cloudflareWaitCheckInterval?: number;
    // CloudflareHandle
    cloudflareHandleTimeout?: number;
    cloudflareHandleSolveIfNeeded?: boolean;
    // CloudflareSolve
    cloudflareSolveProvider?: "2captcha" | "capsolver" | "anticaptcha";
    cloudflareSolveApiKey?: string;
    cloudflareSolveTimeout?: number;
  };
};

export type FlowDefinition = {
  nodes: Array<{
    id: string;
    type: NodeKind;
    position: { x: number; y: number };
    data: NodeData;
  }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
  meta?: { name?: string; version?: string };
};
