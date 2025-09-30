import { FlowDefinition } from "../../../client/src/components/automationTab/types";

// Default templates loaded statically for now
export const TEMPLATES: Record<string, FlowDefinition> = {
  "Basic: Go To URL": {
    nodes: [
      {
        id: "goto-1",
        type: "GoTo",
        position: { x: 100, y: 100 },
        data: {
          label: "Go To URL",
          kind: "GoTo",
          config: { url: "https://example.com" }
        }
      }
    ],
    edges: [],
    meta: { name: "Basic: Go To URL", version: "1.0" }
  }
};

// Load templates dynamically
export async function loadDefaultTemplates(): Promise<Record<string, FlowDefinition>> {
  return TEMPLATES;
}

// For backward compatibility - load templates synchronously if needed
// This will be empty initially and populated when loadDefaultTemplates is called
export function getTemplatesSync(): Record<string, FlowDefinition> {
  return TEMPLATES;
}