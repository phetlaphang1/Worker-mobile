// Node types
export type NodeKind = "GoTo" | "Type" | "Click" | "MultiType" | "If" | "Else" | "Wait" | "Sleep" | "For" | "While" | "Variable" | "Extract" | "Navigation" | "SwitchFrame" | "SwitchTab" | "ScrollTo" | "Select" | "Loop" | "EndLoop" | "DataProcess" | "Log" | "HttpRequest" | "AI" | "CaptchaSolver";

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
    requestTimeout?: number;
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
