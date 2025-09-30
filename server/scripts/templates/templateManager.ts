import { FlowDefinition } from "../../../client/src/components/automationTab/types";
import { loadDefaultTemplates, TEMPLATES as DEFAULT_TEMPLATES } from "./templates";

const CUSTOM_TEMPLATES_KEY = "automation:custom_templates";

export class TemplateManager {
  private static instance: TemplateManager;
  private customTemplates: Record<string, FlowDefinition> = {};
  private memoryTemplates: Record<string, FlowDefinition> = {};
  private defaultTemplates: Record<string, FlowDefinition> = {};
  private initialized = false;
  
  private constructor() {
    this.loadCustomTemplates();
    this.initializeDefaultTemplates();
  }
  
  public static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager();
    }
    return TemplateManager.instance;
  }
  
  private async initializeDefaultTemplates(): Promise<void> {
    if (!this.initialized) {
      this.defaultTemplates = await loadDefaultTemplates();
      this.initialized = true;
    }
  }
  
  private loadCustomTemplates(): void {
    try {
      const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (stored) {
        this.customTemplates = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load custom templates:", error);
      this.customTemplates = {};
    }
  }
  
  private saveCustomTemplates(): void {
    try {
      localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(this.customTemplates));
    } catch (error) {
      console.error("Failed to save custom templates:", error);
    }
  }
  
  public async getAllTemplates(): Promise<Record<string, FlowDefinition>> {
    await this.initializeDefaultTemplates();
    return {
      ...this.defaultTemplates,
      ...this.customTemplates,
      ...this.memoryTemplates
    };
  }
  
  public async getDefaultTemplates(): Promise<Record<string, FlowDefinition>> {
    await this.initializeDefaultTemplates();
    return this.defaultTemplates;
  }
  
  public getCustomTemplates(): Record<string, FlowDefinition> {
    return this.customTemplates;
  }
  
  public getMemoryTemplates(): Record<string, FlowDefinition> {
    return this.memoryTemplates;
  }
  
  public addCustomTemplate(name: string, template: FlowDefinition): void {
    if (this.defaultTemplates[name]) {
      throw new Error(`Cannot overwrite default template: ${name}`);
    }
    this.customTemplates[name] = template;
    this.saveCustomTemplates();
  }
  
  public addMemoryTemplate(name: string, template: FlowDefinition): void {
    this.memoryTemplates[name] = template;
  }
  
  public deleteCustomTemplate(name: string): boolean {
    if (this.defaultTemplates[name]) {
      throw new Error(`Cannot delete default template: ${name}`);
    }
    if (this.customTemplates[name]) {
      delete this.customTemplates[name];
      this.saveCustomTemplates();
      return true;
    }
    return false;
  }
  
  public deleteMemoryTemplate(name: string): boolean {
    if (this.memoryTemplates[name]) {
      delete this.memoryTemplates[name];
      return true;
    }
    return false;
  }
  
  public renameCustomTemplate(oldName: string, newName: string): void {
    if (this.defaultTemplates[oldName]) {
      throw new Error(`Cannot rename default template: ${oldName}`);
    }
    if (this.defaultTemplates[newName] || this.customTemplates[newName]) {
      throw new Error(`Template name already exists: ${newName}`);
    }
    if (this.customTemplates[oldName]) {
      this.customTemplates[newName] = this.customTemplates[oldName];
      delete this.customTemplates[oldName];
      this.saveCustomTemplates();
    }
  }
  
  public isDefaultTemplate(name: string): boolean {
    return !!this.defaultTemplates[name];
  }
  
  public async exportTemplate(name: string): Promise<string | null> {
    const templates = await this.getAllTemplates();
    const template = templates[name];
    if (template) {
      return JSON.stringify(template, null, 2);
    }
    return null;
  }
  
  public importTemplate(name: string, jsonString: string): void {
    try {
      const template = JSON.parse(jsonString) as FlowDefinition;
      this.addCustomTemplate(name, template);
    } catch (error) {
      throw new Error(`Invalid template JSON: ${error}`);
    }
  }
  
  // Import template from JS file content
  public async importFromJSFile(name: string, jsContent: string): Promise<void> {
    try {
      // Create a dynamic function to execute the JS content
      const func = new Function('exports', jsContent + '\nreturn exports;');
      const exports: any = {};
      func(exports);
      
      if (exports.template && typeof exports.template === 'object') {
        // Save to memory templates (not persistent)
        this.addMemoryTemplate(name, exports.template as FlowDefinition);
      } else if (exports.default && typeof exports.default === 'object') {
        this.addMemoryTemplate(name, exports.default as FlowDefinition);
      } else {
        // Try to parse as direct template object
        const directFunc = new Function('return ' + jsContent);
        const template = directFunc();
        if (template && typeof template === 'object') {
          this.addMemoryTemplate(name, template as FlowDefinition);
        } else {
          throw new Error('No valid template found in JS file');
        }
      }
    } catch (error) {
      throw new Error(`Failed to import JS template: ${error}`);
    }
  }
  
  // Clear all memory templates
  public clearMemoryTemplates(): void {
    this.memoryTemplates = {};
  }
}

export const templateManager = TemplateManager.getInstance();